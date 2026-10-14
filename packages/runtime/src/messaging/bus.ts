import { PHASES, compareIds, protocol } from "@robots/system-api";
import type { Message, Payload, Phase, PublishOptions } from "@robots/system-api";
import { Catalogue, validatePayload } from "./catalogue.ts";
import type { Subscription } from "./catalogue.ts";
import { snapshotPayload } from "@robots/values/json";

export interface Delivery { readonly message: Message; readonly receiver: Subscription; readonly tick: number }
export interface Admission { readonly message: Message; readonly deliveries: readonly Delivery[] }
export class Bus {
  #catalogue: Catalogue;
  #sessionId: string;
  #capacity: number;
  #maxBytes: number;
  #maxId: number;
  #lastId = 0;
  // Only current/next tick exist; phase batches are removed on freezing.
  #queues = new Map<number, Map<Phase, Delivery[]>>();
  #pending = new Set<Delivery>();
  #issued = new WeakSet<Message>();
  constructor(catalogue: Catalogue, sessionId: string, capacity: number, maxBytes: number, maxId: number) {
    this.#catalogue = catalogue; this.#sessionId = sessionId;
    this.#capacity = capacity; this.#maxBytes = maxBytes; this.#maxId = maxId;
  }
  get pending(): number { return this.#pending.size; }
  get lastId(): number { return this.#lastId; }
  payload(source: string, type: string, version: number, phase: Phase, value: Payload): Payload {
    const contract = this.#catalogue.contract(type, version);
    if (!contract.producers.some(producer => producer.systemId === source && producer.phases.includes(phase))) {
      protocol("SOURCE_INVALID", "Producer or emission phase is not authorized");
    }
    const payload = snapshotPayload(value, this.#maxBytes);
    validatePayload(payload, contract.fields);
    return payload;
  }
  admit(source: string, kind: "command" | "event", type: string, version: number, value: Payload,
    tick: number, phase: Phase, options: PublishOptions = {}, incoming?: Message, external = false): Admission {
    const contract = this.#catalogue.contract(type, version);
    if (contract.kind !== kind) protocol("CONTRACT_INVALID", "Wrong publication operation for contract kind");
    const payload = this.payload(source, type, version, phase, value);
    const causes = [...(options.causes ?? (incoming ? [incoming] : []))];
    if (causes.some(message => !this.#issued.has(message)) || new Set(causes).size !== causes.length) {
      protocol("CAUSE_INVALID", "Causes must be distinct messages admitted by this session");
    }
    causes.sort((a, b) => a.messageId - b.messageId);
    if (causes.some(message => message.correlationId !== causes[0]!.correlationId)) {
      protocol("CAUSE_INVALID", "Combining independent roots requires an explicit future correlation rule");
    }
    const routes = this.#catalogue.routes(type, version);
    if (this.#pending.size + routes.length > this.#capacity) protocol("QUEUE_CAPACITY", "Atomic fan-out exceeds delivery capacity");
    if (this.#lastId >= this.#maxId) protocol("ID_EXHAUSTED", "Message sequence exhausted");
    const id = this.#lastId + 1;
    const message: Message = Object.freeze({
      messageId: id, sessionId: this.#sessionId, type, contractVersion: version, sourceSystemId: source,
      emittedTick: tick, emittedPhase: phase, correlationId: causes[0]?.correlationId ?? id,
      causationIds: Object.freeze(causes.map(cause => cause.messageId)), payload,
    });
    const deliveries = routes.map(receiver => {
      const destination = external || PHASES.indexOf(receiver.phase) > PHASES.indexOf(phase) ? tick : tick + 1;
      if (!Number.isSafeInteger(destination)) protocol("TICK_EXHAUSTED", "Destination tick exhausted");
      return Object.freeze({ message, receiver, tick: destination });
    });
    this.#lastId = id; this.#issued.add(message);
    for (const delivery of deliveries) {
      let phases = this.#queues.get(delivery.tick);
      if (!phases) { phases = new Map(); this.#queues.set(delivery.tick, phases); }
      let batch = phases.get(delivery.receiver.phase);
      if (!batch) { batch = []; phases.set(delivery.receiver.phase, batch); }
      batch.push(delivery);
      this.#pending.add(delivery);
    }
    return { message, deliveries };
  }
  freeze(tick: number, phase: Phase): readonly Delivery[] {
    const phases = this.#queues.get(tick);
    const batch = phases?.get(phase) ?? [];
    phases?.delete(phase);
    if (phases?.size === 0) this.#queues.delete(tick);
    return Object.freeze(batch
      .sort((a, b) => a.message.messageId - b.message.messageId || compareIds(a.receiver.systemId, b.receiver.systemId)));
  }
  consumed(delivery: Delivery): void { this.#pending.delete(delivery); }
  inspect() {
    return [...this.#pending]
      .sort((a, b) => a.tick - b.tick || PHASES.indexOf(a.receiver.phase) - PHASES.indexOf(b.receiver.phase)
        || a.message.messageId - b.message.messageId || compareIds(a.receiver.systemId, b.receiver.systemId))
      .map(delivery => ({ message: delivery.message, receiver: delivery.receiver.systemId,
        tick: delivery.tick, phase: delivery.receiver.phase,
        status: this.#queues.get(delivery.tick)?.get(delivery.receiver.phase)?.includes(delivery) ? "queued" : "frozen" }));
  }
  discard(): readonly Delivery[] {
    const discarded = [...this.#pending]; this.#pending.clear(); this.#queues.clear(); this.#issued = new WeakSet();
    return discarded;
  }
}
