import assert from "node:assert/strict";
import test from "node:test";
import { Session } from "@robots/runtime/session";
import { PHASES } from "@robots/system-api";
import type { Contract, Message, Publisher } from "@robots/system-api";
import { COMMAND, EVENT, options } from "./fixtures.ts";

function exercise(destination: typeof PHASES[number], emission: typeof PHASES[number] = "decision") {
  const received: { message: Message; tick: number; phase: string }[] = [];
  let port: Publisher;
  const session = new Session(options({
    contracts: [{ ...COMMAND, producers: [{ systemId: "producer", phases: [emission] }] }],
    systems: [{ id: "producer", loopPhase: emission, loop: ({ tick }) => {
      if (tick === 0) port.send(COMMAND.type, 1, { operationId: "op" });
    } }, { id: "worker" }],
  }));
  port = session.publisher("producer");
  session.subscribe("worker", COMMAND.type, 1, destination, (message, context) => {
    received.push({ message, ...context });
  });
  session.start();
  return { session, received, port };
}

test("publishing queues a later-phase delivery and preserves its original header", () => {
  const { session, received } = exercise("action");
  assert.equal(received.length, 0);
  session.advanceTick();
  assert.equal(received.length, 1);
  assert.equal(received[0]!.tick, 0);
  assert.equal(received[0]!.message.emittedPhase, "decision");
  assert.equal(received[0]!.message.correlationId, 1);
  assert.deepEqual(received[0]!.message.causationIds, []);
  assert.ok(Object.isFrozen(received[0]!.message));
});
test("every source/destination phase pair follows the current-or-next-tick rule", () => {
  for (const emission of PHASES) for (const destination of PHASES) {
    const { session, received } = exercise(destination, emission);
    session.advanceTick();
    const sameTick = PHASES.indexOf(destination) > PHASES.indexOf(emission);
    assert.equal(received.length, sameTick ? 1 : 0, emission + " → " + destination);
    session.advanceTick();
    assert.equal(received.length, 1);
    assert.equal(received[0]!.tick, sameTick ? 0 : 1);
    assert.equal(received[0]!.message.emittedTick, 0);
  }
});
test("fan-out follows message ID then stable receiver ID, independently of registration", () => {
  function run(reverse: boolean): string[] {
    const seen: string[] = [];
    let port: Publisher;
    const contract: Contract = { ...EVENT, producers: [{ systemId: "producer", phases: ["decision"] }] };
    const session = new Session(options({ contracts: [contract], systems: [
      { id: "producer", loopPhase: "decision", loop: () => {
        port.emit(EVENT.type, 1, { operationId: "one" }); port.emit(EVENT.type, 1, { operationId: "two" });
        assert.deepEqual(seen, []);
      } }, { id: "z" }, { id: "a" },
    ] }));
    port = session.publisher("producer");
    for (const id of reverse ? ["z", "a"] : ["a", "z"]) {
      session.subscribe(id, EVENT.type, 1, "action", message => { seen.push(message.messageId + ":" + id); });
    }
    session.start(); session.advanceTick();
    return seen;
  }
  assert.deepEqual(run(true), ["1:a", "1:z", "2:a", "2:z"]);
  assert.deepEqual(run(false), run(true));
});
test("all deliveries precede loops; loops follow configured system order", () => {
  let port: Publisher;
  const order: string[] = [];
  const session = new Session(options({ contracts: [COMMAND], systems: [
    { id: "producer", loopPhase: "decision", loop: () => { port.send(COMMAND.type, 1, { operationId: "x" }); } },
    { id: "z", loopPhase: "action", loop: () => { order.push("z"); } },
    { id: "worker", loopPhase: "action", loop: () => { order.push("worker"); } },
  ] }));
  port = session.publisher("producer");
  session.subscribe("worker", COMMAND.type, 1, "action", () => { order.push("delivery"); });
  session.start(); session.advanceTick();
  assert.deepEqual(order, ["delivery", "z", "worker"]);
});
test("derived output carries the incoming cause and root correlation", () => {
  let producer: Publisher; let worker: Publisher;
  const received: Message[] = [];
  const session = new Session(options({ systems: [
    { id: "producer", loopPhase: "decision", loop: () => { producer.send(COMMAND.type, 1, { operationId: "op" }); } },
    { id: "worker" }, { id: "observer-a" }, { id: "observer-b" },
  ] }));
  producer = session.publisher("producer"); worker = session.publisher("worker");
  session.subscribe("worker", COMMAND.type, 1, "action", () => { worker.emit(EVENT.type, 1, { operationId: "op" }); });
  session.subscribe("observer-a", EVENT.type, 1, "resolution", message => { received.push(message); });
  session.start(); session.advanceTick();
  assert.equal(received[0]!.messageId, 2);
  assert.equal(received[0]!.correlationId, 1);
  assert.deepEqual(received[0]!.causationIds, [1]);
});
test("publisher cannot operate outside its own synchronous callback", () => {
  const { session, port } = exercise("action");
  assert.throws(() => port.send(COMMAND.type, 1, { operationId: "op" }), { code: "CONTEXT_INVALID" });
  assert.equal(session.diagnostics().state, "failed");
});
test("a system cannot impersonate another using its captured publisher", () => {
  let foreign: Publisher;
  const session = new Session(options({ contracts: [COMMAND], systems: [
    { id: "producer" }, { id: "worker", loopPhase: "action", loop: () => {
      foreign.send(COMMAND.type, 1, { operationId: "op" });
    } },
  ] }));
  foreign = session.publisher("producer");
  session.subscribe("worker", COMMAND.type, 1, "action", () => {});
  session.start();
  assert.throws(() => session.advanceTick(), { code: "CONTEXT_INVALID" });
});
test("wrong kind, version, producer phase and payload fail the session", () => {
  for (const invalid of [
    (port: Publisher) => port.emit(COMMAND.type, 1, { operationId: "x" }),
    (port: Publisher) => port.send(COMMAND.type, 2, { operationId: "x" }),
    (port: Publisher) => port.send(COMMAND.type, 1, { operationId: "" }),
    (port: Publisher) => port.send(COMMAND.type, 1, { operationId: "x", extra: 1 }),
  ]) {
    let port: Publisher;
    const session = new Session(options({ contracts: [COMMAND], systems: [
      { id: "producer", loopPhase: "decision", loop: () => { invalid(port); } }, { id: "worker" },
    ] }));
    port = session.publisher("producer");
    session.subscribe("worker", COMMAND.type, 1, "action", () => {});
    session.start(); assert.throws(() => session.advanceTick());
    assert.equal(session.diagnostics().state, "failed");
    assert.equal(session.diagnostics().lastCompletedTick, null);
  }
  const { session } = exercise("action", "movement");
  // Here the contract allows movement: phase-specific denial gets its own fixture below.
  session.advanceTick();
});
test("unauthorized emission phase is rejected before consuming any delivery", () => {
  let port: Publisher;
  const session = new Session(options({ contracts: [COMMAND], systems: [
    { id: "producer", loopPhase: "movement", loop: () => { port.send(COMMAND.type, 1, { operationId: "op" }); } },
    { id: "worker" },
  ] }));
  port = session.publisher("producer");
  session.subscribe("worker", COMMAND.type, 1, "action", () => { assert.fail("Must not deliver"); });
  session.start(); assert.throws(() => session.advanceTick(), { code: "SOURCE_INVALID" });
});
test("fan-out capacity is atomic and includes a currently executing delivery", () => {
  let producer: Publisher; let worker: Publisher;
  let observed = 0;
  const session = new Session(options({ maxDeliveries: 2, systems: [
    { id: "producer", loopPhase: "decision", loop: () => { producer.send(COMMAND.type, 1, { operationId: "op" }); } },
    { id: "worker" }, { id: "observer-a" }, { id: "observer-b" },
  ] }));
  producer = session.publisher("producer"); worker = session.publisher("worker");
  session.subscribe("worker", COMMAND.type, 1, "action", () => { worker.emit(EVENT.type, 1, { operationId: "op" }); });
  for (const id of ["observer-a", "observer-b"]) session.subscribe(id, EVENT.type, 1, "resolution", () => { observed++; });
  session.start(); assert.throws(() => session.advanceTick(), { code: "QUEUE_CAPACITY" });
  assert.equal(observed, 0);
  assert.equal(session.diagnostics().pendingDeliveries, 1);
});
test("consumption releases delivery capacity and unobserved events require no slot", () => {
  const { session, received } = exercise("action");
  session.advanceTick(); session.advanceTick();
  assert.equal(session.diagnostics().pendingDeliveries, 0);
  assert.equal(received.length, 1);
});
test("bounded message sequence fails before repeating an ID", () => {
  let port: Publisher;
  const session = new Session(options({ maxMessageId: 1, contracts: [COMMAND], systems: [
    { id: "producer", loopPhase: "decision", loop: () => {
      port.send(COMMAND.type, 1, { operationId: "one" }); port.send(COMMAND.type, 1, { operationId: "two" });
    } }, { id: "worker" },
  ] }));
  port = session.publisher("producer");
  session.subscribe("worker", COMMAND.type, 1, "action", () => {});
  session.start(); assert.throws(() => session.advanceTick(), { code: "ID_EXHAUSTED" });
  assert.equal(session.diagnostics().lastMessageId, 1);
});
test("sessions isolate their IDs, pending queues and lifecycle", () => {
  const first = exercise("perception"); const second = exercise("action");
  first.session.advanceTick(); second.session.advanceTick();
  first.session.close();
  assert.equal(first.session.diagnostics().pendingDeliveries, 0);
  assert.equal(second.received[0]!.message.messageId, 1);
  second.session.advanceTick();
  assert.equal(second.session.diagnostics().state, "active");
  assert.equal(first.received.length, 0);
});
