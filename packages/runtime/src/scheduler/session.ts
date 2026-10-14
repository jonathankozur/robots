import { PHASES, ProtocolError, protocol } from "@robots/system-api";
import type { ExternalInput, Handler, LoopContext, Message, Phase, Publisher, SessionOptions } from "@robots/system-api";
import { Catalogue, positive } from "../messaging/catalogue.ts";
import { Bus } from "../messaging/bus.ts";
import type { Admission, Delivery } from "../messaging/bus.ts";
import { TraceLog } from "../messaging/trace.ts";
import type { DebugRecord, ReplayRecording, TraceSnapshot } from "../messaging/trace.ts";
import { snapshotData, snapshotPayload } from "@robots/values/json";
import type { Payload } from "@robots/system-api";
import { validateEnvironment } from "../determinism/environment.ts";

export type SessionState = "preparing" | "active" | "failed" | "closed";
export interface Failure {
  readonly code: string; readonly message: string; readonly tick: number;
  readonly phase: Phase | null; readonly systemId: string | null; readonly causeId: number | null;
}
interface Execution { readonly systemId: string; readonly context: LoopContext; readonly incoming?: Message }
export class Session {
  #catalogue: Catalogue;
  #bus: Bus;
  #state: SessionState = "preparing";
  #tick = 0;
  #phase: Phase | null = null;
  #lastCompleted: number | null = null;
  #running = false;
  #execution: Execution | null = null;
  #failure: Failure | null = null;
  #sessionId: string;
  #externalCapacity: number;
  #staged: { readonly source: string; readonly input: ExternalInput }[] = [];
  #trace: TraceLog;
  #environment: Payload;
  #admissionOrder = 0;
  #replay: ReplayRecording | null = null;
  #replayIndex = 0;
  #phaseIndex = 0;
  #phaseOpen = false;
  #batch: readonly Delivery[] = [];
  #deliveryIndex = 0;
  #loops: readonly import("../messaging/contracts.ts").SystemDefinition[] = [];
  #loopIndex = 0;
  #maxTicks: number;
  constructor(options: SessionOptions) {
    if (typeof options.sessionId !== "string" || !options.sessionId || !options.revision || !options.runtime) {
      protocol("CONFIG_INVALID", "Session identity, revision and runtime are required");
    }
    this.#catalogue = new Catalogue(options.contracts, options.systems);
    this.#sessionId = options.sessionId;
    this.#bus = new Bus(this.#catalogue, options.sessionId,
      positive(options.maxDeliveries ?? 4096, "Delivery capacity"),
      positive(options.maxPayloadBytes ?? 65_536, "Payload capacity"),
      positive(options.maxMessageId ?? Number.MAX_SAFE_INTEGER, "Message sequence bound"));
    this.#externalCapacity = positive(options.maxExternalInputs ?? 1024, "External capacity");
    const traceCapacity = positive(options.traceCapacity ?? 100_000, "Trace capacity");
    if (options.debug !== undefined && typeof options.debug !== "boolean") protocol("CONFIG_INVALID", "Debug must be boolean");
    this.#trace = new TraceLog(traceCapacity, options.debug);
    this.#maxTicks = positive(options.maxTicks ?? Number.MAX_SAFE_INTEGER, "Tick horizon");
    this.#environment = snapshotPayload({
      sessionId: options.sessionId, revision: options.revision, runtime: options.runtime, phases: PHASES,
      initialState: snapshotPayload(options.initialState ?? {}, 1_048_576),
      ...(options.environment === undefined ? {} : { environment: validateEnvironment(options.environment, this.#catalogue.systems) as unknown as Payload }),
      limits: { maxDeliveries: options.maxDeliveries ?? 4096, maxExternalInputs: this.#externalCapacity,
        maxPayloadBytes: options.maxPayloadBytes ?? 65_536, traceCapacity, maxMessageId: options.maxMessageId ?? Number.MAX_SAFE_INTEGER,
        maxTicks: this.#maxTicks },
    }, 1_048_576, 256);
  }
  get state(): SessionState { return this.#state; }
  #require(state: SessionState): void {
    if (this.#state !== state) protocol("STATE_INVALID", "Expected session state: " + state);
  }
  #fail(error: unknown, externalSource?: string): void {
    if (this.#state !== "active") return;
    this.#failure = Object.freeze({
      code: error instanceof ProtocolError ? error.code : "CALLBACK_FAILED",
      message: error instanceof Error ? error.message.slice(0, 4096) : "Unexpected callback exception",
      tick: this.#tick, phase: externalSource === undefined ? this.#phase : "input",
      systemId: externalSource ?? this.#execution?.systemId ?? null,
      causeId: externalSource === undefined ? this.#execution?.incoming?.messageId ?? null : null,
    });
    this.#state = "failed";
    if (error instanceof ProtocolError) this.#trace.append({ kind: "rejected", ...this.#failure });
    this.#trace.append({ kind: "failed", ...this.#failure });
  }
  #checked<T>(operation: () => T, externalSource?: string): T {
    try { return operation(); } catch (error) { this.#fail(error, externalSource); throw error; }
  }
  subscribe(systemId: string, type: string, version: number, phase: Phase, handler: Handler): () => boolean {
    return this.#checked(() => {
      this.#require("preparing");
      const unsubscribe = this.#catalogue.subscribe({ systemId, type, version, phase, handler });
      return () => this.#checked(unsubscribe);
    });
  }
  start(): void {
    this.#checked(() => this.#start());
  }
  #start(): void {
    this.#require("preparing");
    const manifest = snapshotPayload({ ...this.#environment, catalogue: this.#catalogue.manifest() }, Number.MAX_SAFE_INTEGER, 256);
    if (this.#replay && JSON.stringify(this.#replay.manifest) !== JSON.stringify(manifest)) {
      protocol("REPLAY_INVALID", "Replay manifest does not match this session");
    }
    this.#catalogue.start();
    this.#trace.configure(manifest); this.#state = "active";
    this.#trace.append({ kind: "started" });
  }
  #route(entry: Delivery, kind: "routed" | "discarded" | "consumption_started" | "consumption_finished"): void {
    this.#trace.append({ kind, messageId: entry.message.messageId, receiver: entry.receiver.systemId, tick: entry.tick, phase: entry.receiver.phase });
  }
  #published(admission: Admission): void {
    this.#trace.append({ kind: "published", message: admission.message });
    for (const delivery of admission.deliveries) this.#route(delivery, "routed");
  }
  stageExternalInput(source: string, input: ExternalInput): boolean {
    if (input.sessionId !== this.#sessionId || this.#state === "closed" || this.#state === "failed") {
      this.#trace.append({ kind: "external_rejected", source, sessionId: input.sessionId, tick: this.#tick,
        reason: input.sessionId !== this.#sessionId ? "wrong_session" : this.#state });
      return false;
    }
    return this.#checked(() => {
      this.#require("active");
      if (this.#replay) protocol("REPLAY_INVALID", "Live inputs are forbidden during replay");
      if (this.#catalogue.system(source).kind !== "adapter") protocol("SOURCE_INVALID", "External input requires a registered adapter");
      const payload = this.#bus.payload(source, input.type, input.version, "input", input.payload);
      if (this.#staged.length >= this.#externalCapacity) protocol("EXTERNAL_CAPACITY", "External staging capacity exceeded");
      this.#staged.push({ source, input: Object.freeze({ sessionId: this.#sessionId, type: input.type, version: input.version, payload }) });
      return true;
    }, source);
  }
  #admitExternal(): void {
    if (this.#replay) {
      while (this.#replay.inputs[this.#replayIndex]?.tick === this.#tick) {
        const { source, input } = this.#replay.inputs[this.#replayIndex]!;
        this.#staged.push({ source, input }); this.#replayIndex++;
      }
    }
    const count = this.#staged.length;
    for (let index = 0; index < count; index++) {
      const { source, input } = this.#staged[0]!;
      const kind = this.#catalogue.contract(input.type, input.version).kind;
      const admission = this.#checked(() => this.#bus.admit(source, kind, input.type, input.version,
        input.payload, this.#tick, "input", {}, undefined, true), source);
      this.#admissionOrder++;
      this.#trace.append({ kind: "external_admitted", source, input, tick: this.#tick, order: this.#admissionOrder });
      this.#published(admission);
      this.#staged.shift();
    }
  }
  publisher(systemId: string): Publisher {
    this.#catalogue.system(systemId);
    const publish = (kind: "command" | "event"): Publisher["send"] => (type, version, payload, options) => this.#checked(() => {
      this.#require("active");
      const execution = this.#execution;
      if (this.#catalogue.system(systemId).kind === "adapter" || execution?.systemId !== systemId) {
        protocol("CONTEXT_INVALID", "Publication requires the producer's own synchronous callback");
      }
      const admission = this.#bus.admit(systemId, kind, type, version, payload, execution.context.tick, execution.context.phase,
        options, execution.incoming);
      this.#published(admission);
      return admission.message.messageId;
    });
    return Object.freeze({ send: publish("command"), emit: publish("event") });
  }
  #invoke(systemId: string, context: LoopContext, callback: () => unknown, incoming?: Message): void {
    this.#execution = incoming ? { systemId, context, incoming } : { systemId, context };
    try {
      this.#checked(() => {
        const result = callback();
        if (result !== undefined) {
          if (result instanceof Promise) void result.catch(() => {});
          protocol("ASYNC_INVALID", "Handlers and loops must return void synchronously");
        }
        if (this.#state !== "active") protocol("STATE_INVALID", "Callback attempted to continue a failed session");
      });
    } finally { this.#execution = null; }
  }
  #tickInProgress(): boolean { return this.#phaseOpen || this.#phaseIndex > 0; }
  #nextOperation(): "phase_started" | "delivery" | "loop" | "phase_finished" {
    if (!this.#phaseOpen) return "phase_started";
    if (this.#deliveryIndex < this.#batch.length) return "delivery";
    if (this.#loopIndex < this.#loops.length) return "loop";
    return "phase_finished";
  }
  #advance(operation: () => void): void {
    this.#checked(() => {
      this.#require("active");
      if (this.#running) protocol("REENTRANT", "Scheduler cannot reenter a tick");
      if (this.#replay && this.#tick >= this.#replay.completedTicks) protocol("REPLAY_INVALID", "Replay horizon exhausted");
      if (this.#tick >= this.#maxTicks) protocol("TICK_EXHAUSTED", "Tick sequence exhausted");
      this.#running = true;
      try { operation(); } finally { this.#running = false; }
    });
  }
  #step(): void {
    const phase = PHASES[this.#phaseIndex]!;
    const context = Object.freeze({ tick: this.#tick, phase });
    this.#phase = phase;
    if (!this.#phaseOpen) {
      this.#trace.append({ kind: "phase_started", ...context });
      if (phase === "input") this.#admitExternal();
      this.#batch = this.#bus.freeze(this.#tick, phase); this.#deliveryIndex = 0;
      this.#loops = this.#catalogue.systems.filter(system => system.loopPhase === phase); this.#loopIndex = 0;
      this.#phaseOpen = true; return;
    }
    const delivery = this.#batch[this.#deliveryIndex];
    if (delivery) {
      this.#route(delivery, "consumption_started");
      this.#invoke(delivery.receiver.systemId, context, () => delivery.receiver.handler(delivery.message, context), delivery.message);
      this.#route(delivery, "consumption_finished"); this.#bus.consumed(delivery); this.#deliveryIndex++; return;
    }
    const system = this.#loops[this.#loopIndex];
    if (system) {
      this.#trace.append({ kind: "loop_started", systemId: system.id, ...context });
      this.#invoke(system.id, context, () => system.loop!(context));
      this.#trace.append({ kind: "loop_finished", systemId: system.id, ...context }); this.#loopIndex++; return;
    }
    this.#trace.append({ kind: "phase_finished", ...context });
    this.#phaseOpen = false; this.#batch = []; this.#loops = []; this.#phase = null;
    if (++this.#phaseIndex === PHASES.length) {
      this.#lastCompleted = this.#tick; this.#trace.append({ kind: "tick_completed", tick: this.#tick });
      this.#tick++; this.#phaseIndex = 0;
    }
  }
  step(): void { this.#advance(() => this.#step()); }
  stepPhase(): void {
    this.#advance(() => {
      const phase = this.#phaseIndex; const tick = this.#tick;
      do { this.#step(); } while (this.#phaseIndex === phase && this.#tick === tick);
    });
  }
  advanceTick(): void {
    this.#advance(() => {
      const tick = this.#tick;
      do { this.#step(); } while (this.#tick === tick);
    });
  }
  close(reason = "requested"): void {
    this.#checked(() => {
      if (this.#running) protocol("REENTRANT", "Only the session controller can close outside callbacks");
      if (this.#state === "closed") return;
      const discarded = this.#bus.discard();
      for (const delivery of discarded) this.#route(delivery, "discarded");
      this.#trace.append({ kind: "closed", reason, discardedDeliveries: discarded.length,
        discardedExternalInputs: this.#staged.length, lastCompletedTick: this.#lastCompleted });
      this.#staged = []; this.#batch = []; this.#loops = []; this.#catalogue.close(); this.#state = "closed";
    });
  }
  diagnostics() {
    return Object.freeze({
      state: this.#state, nextTick: this.#tick, lastCompletedTick: this.#lastCompleted,
      lastMessageId: this.#bus.lastId, pendingDeliveries: this.#bus.pending, failure: this.#failure,
      pendingExternalInputs: this.#staged.length,
      phase: this.#phase, nextPhase: PHASES[this.#phaseIndex]!, tickInProgress: this.#tickInProgress(),
      nextOperation: this.#nextOperation(), paused: this.#state === "active" && !this.#running,
    });
  }
  inspect() {
    return snapshotData({ deliveries: this.#bus.inspect(), stagedInputs: this.#staged,
      progress: this.diagnostics() }, Number.MAX_SAFE_INTEGER) as unknown as {
        readonly deliveries: readonly { readonly message: Message; readonly receiver: string; readonly tick: number; readonly phase: Phase; readonly status: string }[];
        readonly stagedInputs: readonly { readonly source: string; readonly input: ExternalInput }[];
        readonly progress: ReturnType<Session["diagnostics"]>;
      };
  }
  drainDebugLog(): readonly DebugRecord[] {
    if (this.#running) this.#checked(() => protocol("CONTEXT_INVALID", "Debug drain is allowed only outside callbacks"));
    return this.#trace.drainDebug();
  }
  trace(): TraceSnapshot { return this.#trace.snapshot(); }
  exportReplay(): ReplayRecording {
    if (this.#running) this.#checked(() => protocol("CONTEXT_INVALID", "Export is allowed only between ticks"));
    if (this.#state !== "active" || this.#failure) protocol("REPLAY_INVALID", "Only a healthy session between ticks can export replay");
    if (this.#tickInProgress()) protocol("CONTEXT_INVALID", "Replay cannot export a partial tick");
    return this.#trace.replay(this.#tick);
  }
  loadReplay(recording: ReplayRecording): void {
    this.#checked(() => this.#prepareReplay(recording));
  }
  #prepareReplay(recording: ReplayRecording): void {
    this.#require("preparing");
    let copied: ReplayRecording;
    try { copied = snapshotData(recording, Number.MAX_SAFE_INTEGER) as unknown as ReplayRecording; }
    catch { protocol("REPLAY_INVALID", "Replay contains non-data values"); }
    if (!copied || typeof copied !== "object" || Array.isArray(copied) || copied.formatVersion !== 1
      || !Number.isSafeInteger(copied.completedTicks) || copied.completedTicks < 0
      || copied.manifest === null || typeof copied.manifest !== "object" || Array.isArray(copied.manifest) || !Array.isArray(copied.inputs)) {
      protocol("REPLAY_INVALID", "Invalid replay recording");
    }
    let lastTick = -1;
    let lastOrder = 0;
    let count = 0;
    for (const entry of copied.inputs) {
      if (!entry || typeof entry !== "object" || !entry.input || typeof entry.input !== "object"
        || !Number.isSafeInteger(entry.tick) || entry.tick < lastTick || entry.tick < 0 || entry.tick >= copied.completedTicks
        || entry.order !== lastOrder + 1 || typeof entry.source !== "string" || entry.input.sessionId !== this.#sessionId) {
        protocol("REPLAY_INVALID", "Invalid admitted input order, session or tick");
      }
      if (entry.tick !== lastTick) count = 0;
      if (++count > this.#externalCapacity) protocol("REPLAY_INVALID", "Replay input batch exceeds capacity");
      if (this.#catalogue.system(entry.source).kind !== "adapter") protocol("REPLAY_INVALID", "Replay source is not an adapter");
      this.#bus.payload(entry.source, entry.input.type, entry.input.version, "input", entry.input.payload);
      lastTick = entry.tick; lastOrder = entry.order;
    }
    this.#replay = copied;
  }
}
