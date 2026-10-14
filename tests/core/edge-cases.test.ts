import assert from "node:assert/strict";
import test from "node:test";
import { Session } from "@robots/runtime/session";
import { snapshotPayload } from "@robots/values/json";
import type { Contract, FieldRule, JsonValue, Message, Publisher } from "@robots/system-api";
import { COMMAND, EVENT, options } from "./fixtures.ts";

test("two command receivers are rejected; versions and field rules are checked before activation", () => {
  const two = new Session(options());
  two.subscribe("worker", COMMAND.type, 1, "action", () => {});
  two.subscribe("observer-a", COMMAND.type, 1, "resolution", () => {});
  assert.throws(() => two.start(), { code: "CONFIG_INVALID" });
  for (const contract of [
    { ...COMMAND, version: 0 },
    { ...COMMAND, fields: { operationId: { type: "string" as const, minLength: -1 } } },
    { ...COMMAND, fields: { operationId: { type: "string" as const, minLenght: 1 } } },
  ]) {
    const invalid = new Session(options({ contracts: [contract] }));
    if (contract.version > 0) invalid.subscribe("worker", COMMAND.type, 1, "action", () => {});
    assert.throws(() => invalid.start(), { code: "CONFIG_INVALID" });
  }
});
test("payload treats __proto__ as data and rejects sparse arrays, hidden keys, symbols and undefined", () => {
  const original = JSON.parse('{"__proto__":{"operationId":"safe"}}');
  const result = snapshotPayload(original);
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.ok(Object.hasOwn(result, "__proto__"));
  assert.equal(({} as { operationId?: string }).operationId, undefined);
  for (const data of [{ n: undefined }, { values: [, 1] }, { [Symbol("secret")]: 1 },
    Object.defineProperty({}, "hidden", { value: 1 })]) {
    assert.throws(() => snapshotPayload(data), { code: "PAYLOAD_INVALID" });
  }
});
test("nested structural schema enforces optional fields, bounded arrays and safe integer units", () => {
  const contract: Contract = { ...COMMAND, fields: {
    positions: { type: "array", maxLength: 2, items: { type: "object", fields: {
      x: { type: "number", integer: true, min: -10, max: 10 }, enabled: { type: "boolean", optional: true },
    } } },
  } };
  function run(payload: Parameters<Publisher["send"]>[2]) {
    let port: Publisher;
    const session = new Session(options({ contracts: [contract], systems: [
      { id: "producer", loopPhase: "decision", loop: () => { port.send(COMMAND.type, 1, payload); } }, { id: "worker" },
    ] }));
    port = session.publisher("producer"); session.subscribe("worker", COMMAND.type, 1, "action", () => {});
    session.start(); session.advanceTick();
  }
  run({ positions: [{ x: 1 }, { x: -10, enabled: true }] });
  for (const positions of [[{ x: 1.1 }], [{ x: 11 }], [{ x: 0, unknown: true }], [{ enabled: true }], [{ x: 0 }, { x: 1 }, { x: 2 }]]) {
    assert.throws(() => run({ positions }), { code: "PAYLOAD_INVALID" });
  }
});
test("causes reject fabricated or foreign-session messages and merging independent roots", () => {
  function run(mode: "foreign" | "forged" | "roots") {
    let producer: Publisher; let worker: Publisher;
    const causes: Message[] = [];
    const session = new Session(options({ systems: [
      { id: "producer", loopPhase: "decision", loop: () => {
        producer.send(COMMAND.type, 1, { operationId: "one" }); producer.send(COMMAND.type, 1, { operationId: "two" });
      } },
      { id: "worker", loopPhase: "action", loop: () => {
        const references = mode === "roots" ? causes : mode === "forged" ? [{ ...causes[0]! }] : [foreign];
        worker.emit(EVENT.type, 1, { operationId: "derived" }, { causes: references });
      } }, { id: "observer-a" }, { id: "observer-b" },
    ] }));
    const foreign = makeMessage();
    producer = session.publisher("producer"); worker = session.publisher("worker");
    session.subscribe("worker", COMMAND.type, 1, "action", message => { causes.push(message); });
    session.start(); session.advanceTick();
  }
  for (const mode of ["foreign", "forged", "roots"] as const) assert.throws(() => run(mode), { code: "CAUSE_INVALID" });
});
function makeMessage(): Message {
  let port: Publisher; let message: Message;
  const session = new Session(options({ contracts: [COMMAND], systems: [
    { id: "producer", loopPhase: "decision", loop: () => { port.send(COMMAND.type, 1, { operationId: "root" }); } }, { id: "worker" },
  ] }));
  port = session.publisher("producer"); session.subscribe("worker", COMMAND.type, 1, "action", received => { message = received; });
  session.start(); session.advanceTick(); return message!;
}
test("causes from one root are normalized by message ID, including an explicit loop output", () => {
  let producer: Publisher; let worker: Publisher; let observer: Publisher;
  const causes: Message[] = []; const output: Message[] = [];
  const FINAL: Contract = { ...EVENT, type: "PruebaDerivada", producers: [{ systemId: "observer-a", phases: ["resolution"] }] };
  const session = new Session(options({ contracts: [COMMAND, EVENT, FINAL], systems: [
    { id: "producer", loopPhase: "decision", loop: () => { producer.send(COMMAND.type, 1, { operationId: "op" }); } },
    { id: "worker" },
    { id: "observer-a", loopPhase: "resolution", loop: () => {
      observer.emit(FINAL.type, 1, { operationId: "result" }, { causes: [...causes].reverse() });
    } }, { id: "observer-b" },
  ] }));
  producer = session.publisher("producer"); worker = session.publisher("worker"); observer = session.publisher("observer-a");
  session.subscribe("worker", COMMAND.type, 1, "action", () => {
    worker.emit(EVENT.type, 1, { operationId: "a" }); worker.emit(EVENT.type, 1, { operationId: "b" });
  });
  session.subscribe("observer-a", EVENT.type, 1, "resolution", message => { causes.push(message); });
  session.subscribe("observer-b", FINAL.type, 1, "publication", message => { output.push(message); });
  session.start(); session.advanceTick();
  assert.deepEqual(output[0]!.causationIds, [2, 3]); assert.equal(output[0]!.correlationId, 1);
});
test("all frozen unconsumed deliveries occupy slots until their handlers finish", () => {
  let port: Publisher; let worker: Publisher;
  const SELF: Contract = { ...EVENT, producers: [{ systemId: "worker", phases: ["action"] }] };
  const session = new Session(options({ maxDeliveries: 2, contracts: [COMMAND, SELF], systems: [
    { id: "producer", loopPhase: "decision", loop: () => {
      port.send(COMMAND.type, 1, { operationId: "first" }); port.send(COMMAND.type, 1, { operationId: "second" });
    } }, { id: "worker" }, { id: "observer-a" },
  ] }));
  port = session.publisher("producer"); worker = session.publisher("worker");
  session.subscribe("worker", COMMAND.type, 1, "action", () => { worker.emit(SELF.type, 1, { operationId: "later" }); });
  session.subscribe("observer-a", SELF.type, 1, "resolution", () => { assert.fail("Cannot deliver"); });
  session.start(); assert.throws(() => session.advanceTick(), { code: "QUEUE_CAPACITY" });
  assert.equal(session.diagnostics().pendingDeliveries, 2);
});
test("caught admission violation cannot be followed by valid output in the same callback", () => {
  let port: Publisher; let processed = 0;
  const session = new Session(options({ contracts: [COMMAND], systems: [
    { id: "producer", loopPhase: "decision", loop: () => {
      try { port.send(COMMAND.type, 1, { operationId: "" }); } catch {}
      try { port.send(COMMAND.type, 1, { operationId: "valid" }); } catch {}
    } }, { id: "worker" },
  ] }));
  port = session.publisher("producer");
  session.subscribe("worker", COMMAND.type, 1, "action", () => { processed++; });
  session.start(); assert.throws(() => session.advanceTick());
  assert.equal(processed, 0); assert.equal(session.diagnostics().lastMessageId, 0);
});
test("export during a callback is blocked and fails the active session even if caught", () => {
  const session = new Session(options({ contracts: [], systems: [
    { id: "producer", loopPhase: "decision", loop: () => {
      try { session.exportReplay(); } catch {}
    } },
  ] }));
  session.start();
  assert.throws(() => session.advanceTick());
  assert.equal(session.state, "failed");
});
test("external capacity faults record the responsible adapter", () => {
  const contract: Contract = { ...EVENT, producers: [{ systemId: "adapter", phases: ["input"] }] };
  const session = new Session(options({ maxExternalInputs: 1, contracts: [contract], systems: [{ id: "adapter", kind: "adapter" }] }));
  session.start();
  const input = { sessionId: "fixture-session", type: EVENT.type, version: 1, payload: { operationId: "op" } };
  session.stageExternalInput("adapter", input);
  assert.throws(() => session.stageExternalInput("adapter", input), { code: "EXTERNAL_CAPACITY" });
  assert.equal(session.diagnostics().failure!.systemId, "adapter");
});

test("a payload at the nesting limit remains valid inside its schema, envelope and trace", () => {
  let value: JsonValue = 1;
  let rule: FieldRule = { type: "number" };
  for (let depth = 0; depth < 31; depth++) {
    value = { value }; rule = { type: "object", fields: { value: rule } };
  }
  const payload = { value };
  assert.doesNotThrow(() => snapshotPayload(payload));
  assert.throws(() => snapshotPayload({ extra: payload }), { code: "PAYLOAD_INVALID" });
  let port: Publisher;
  const session = new Session(options({ contracts: [{ ...COMMAND, fields: { value: rule } }], systems: [
    { id: "producer", loopPhase: "decision", loop: () => { port.send(COMMAND.type, 1, payload); } }, { id: "worker" },
  ] }));
  port = session.publisher("producer"); session.subscribe("worker", COMMAND.type, 1, "action", () => {});
  session.start(); session.advanceTick();
  assert.equal(session.trace().complete, true); assert.equal(session.state, "active");
});
