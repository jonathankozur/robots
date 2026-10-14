import assert from "node:assert/strict";
import test from "node:test";
import { Session } from "@robots/runtime/session";
import type { Contract, Message, Publisher } from "@robots/system-api";
import { COMMAND, EVENT, options } from "./fixtures.ts";

const INPUT: Contract = {
  type: "PruebaEntrada", version: 1, kind: "event",
  producers: [{ systemId: "adapter", phases: ["input"] }],
  fields: { operationId: { type: "string", minLength: 1, maxLength: 128 } },
};
export function externalSession(extra: Parameters<typeof options>[0] = {}) {
  const messages: Message[] = [];
  const session = new Session(options({
    contracts: [INPUT], systems: [{ id: "adapter", kind: "adapter" }, { id: "worker" }], ...extra,
  }));
  session.subscribe("worker", INPUT.type, 1, "input", message => { messages.push(message); });
  return { session, messages };
}
function stage(session: Session, operationId: string) {
  return session.stageExternalInput("adapter", { sessionId: "fixture-session", type: INPUT.type, version: 1, payload: { operationId } });
}
test("external cut admits ordered copies at input, including same-phase receivers", () => {
  const { session, messages } = externalSession();
  session.start();
  const payload = { operationId: "first" };
  session.stageExternalInput("adapter", { sessionId: "fixture-session", type: INPUT.type, version: 1, payload });
  payload.operationId = "changed";
  stage(session, "second");
  assert.equal(messages.length, 0);
  session.advanceTick();
  assert.deepEqual(messages.map(message => [message.payload.operationId, message.emittedTick, message.emittedPhase]), [
    ["first", 0, "input"], ["second", 0, "input"],
  ]);
});
test("arrival after the cut waits until the next input admission", () => {
  let staged = false;
  const { session, messages } = externalSession({ systems: [
    { id: "adapter", kind: "adapter" }, { id: "worker" },
    { id: "controller-fixture", loopPhase: "decision", loop: () => {
      if (!staged) { stage(session, "late"); staged = true; }
    } },
  ] });
  session.start(); session.advanceTick(); assert.equal(messages.length, 0);
  session.advanceTick(); assert.equal(messages[0]!.emittedTick, 1);
});
test("external overflow fails visibly; cross-session and closed inputs are rejected", () => {
  const { session } = externalSession({ maxExternalInputs: 1 });
  session.start();
  assert.equal(session.stageExternalInput("adapter", {
    sessionId: "other-session", type: INPUT.type, version: 1, payload: { operationId: "x" },
  }), false);
  assert.equal(session.state, "active");
  stage(session, "one");
  assert.throws(() => stage(session, "two"), { code: "EXTERNAL_CAPACITY" });
  assert.equal(session.state, "failed");
  session.close(); assert.equal(stage(session, "closed"), false);
  assert.equal(session.diagnostics().pendingExternalInputs, 0);
});
test("external identity and schema validation reject unauthorized adapters", () => {
  const { session } = externalSession(); session.start();
  assert.throws(() => session.stageExternalInput("worker", {
    sessionId: "fixture-session", type: INPUT.type, version: 1, payload: { operationId: "x" },
  }), { code: "SOURCE_INVALID" });
  assert.equal(session.state, "failed");
  const invalid = externalSession().session; invalid.start();
  assert.throws(() => stage(invalid, ""), { code: "PAYLOAD_INVALID" });
});
test("unexpected handler failure stops all later work and keeps causal context", () => {
  let port: Publisher;
  let later = 0;
  const session = new Session(options({ contracts: [COMMAND], systems: [
    { id: "producer", loopPhase: "decision", loop: () => { port.send(COMMAND.type, 1, { operationId: "op" }); } },
    { id: "worker" }, { id: "later", loopPhase: "publication", loop: () => { later++; } },
  ] }));
  port = session.publisher("producer");
  session.subscribe("worker", COMMAND.type, 1, "action", () => { throw new Error("fixture failure"); });
  session.start(); assert.throws(() => session.advanceTick(), /fixture failure/);
  assert.equal(later, 0);
  assert.deepEqual(session.diagnostics().failure, {
    code: "CALLBACK_FAILED", message: "fixture failure", tick: 0, phase: "action", systemId: "worker", causeId: 1,
  });
  assert.equal(session.diagnostics().lastCompletedTick, null);
  assert.throws(() => session.advanceTick(), { code: "STATE_INVALID" });
  session.close(); session.close();
  assert.equal(session.diagnostics().pendingDeliveries, 0);
});
test("reentrancy and closure from a callback fail even when its exception is caught", () => {
  for (const action of ["advanceTick", "close"] as const) {
    let after = 0;
    const session = new Session(options({ contracts: [], systems: [
      { id: "malicious", loopPhase: "decision", loop: () => {
        try { session[action](); } catch {}
      } },
      { id: "after", loopPhase: "decision", loop: () => { after++; } },
    ] }));
    session.start(); assert.throws(() => session.advanceTick());
    assert.equal(session.state, "failed"); assert.equal(after, 0);
  }
});
test("async handlers fail without admitting delayed output or unhandled rejection", async () => {
  let port: Publisher;
  const session = new Session(options({ contracts: [COMMAND], systems: [
    { id: "producer", loopPhase: "decision", loop: async () => {
      await Promise.resolve();
      port.send(COMMAND.type, 1, { operationId: "too-late" });
    } }, { id: "worker" },
  ] }));
  port = session.publisher("producer");
  session.subscribe("worker", COMMAND.type, 1, "action", () => {});
  session.start(); assert.throws(() => session.advanceTick(), { code: "ASYNC_INVALID" });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(session.diagnostics().lastMessageId, 0);
});
test("a typed business rejection event is a normal delivery and keeps the session active", () => {
  let producer: Publisher; let worker: Publisher;
  let rejection: Message | undefined;
  const REJECTION: Contract = { ...EVENT, type: "PruebaRechazo", fields: {
    operationId: { type: "string", minLength: 1 }, reason: { type: "string", minLength: 1 },
  } };
  const session = new Session(options({ contracts: [COMMAND, REJECTION], systems: [
    { id: "producer", loopPhase: "decision", loop: () => { producer.send(COMMAND.type, 1, { operationId: "rejected-op" }); } },
    { id: "worker" }, { id: "observer-a" }, { id: "observer-b" },
  ] }));
  producer = session.publisher("producer"); worker = session.publisher("worker");
  session.subscribe("worker", COMMAND.type, 1, "action", () => {
    worker.emit(REJECTION.type, 1, { operationId: "rejected-op", reason: "fixture-operation-denied" });
  });
  session.subscribe("observer-a", REJECTION.type, 1, "publication", message => { rejection = message; });
  session.start(); session.advanceTick();
  assert.equal(session.state, "active"); assert.equal(rejection!.correlationId, 1);
  assert.equal(rejection!.payload.reason, "fixture-operation-denied");
});
test("unsubscription is idempotent and cannot silently alter an active session", () => {
  const { session } = externalSession({ systems: [
    { id: "adapter", kind: "adapter" }, { id: "worker" }, { id: "extra" },
  ] });
  const unsubscribe = session.subscribe("extra", INPUT.type, 1, "action", () => {});
  assert.ok(unsubscribe()); assert.equal(unsubscribe(), false);
  const active = session.subscribe("extra", INPUT.type, 1, "action", () => {});
  session.start();
  assert.throws(() => active(), { code: "STATE_INVALID" });
  assert.equal(session.state, "failed");
  session.close(); assert.equal(active(), false);
});
