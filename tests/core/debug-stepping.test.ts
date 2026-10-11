import assert from "node:assert/strict";
import test from "node:test";
import { Session } from "../../src/core/index.ts";
import type { Contract } from "../../src/core/index.ts";
import { options, COMMAND, EVENT } from "./fixtures.ts";

function fixture(debug = false) {
  const order: string[] = [];
  const session = new Session(options({ debug, systems: [
    { id: "producer", loopPhase: "decision", loop: () => { producer.send(COMMAND.type, 1, { operationId: "test" }); } },
    { id: "worker", loopPhase: "action", loop: () => { order.push("loop"); } },
    { id: "observer-a" }, { id: "observer-b" },
  ] }));
  const producer = session.publisher("producer");
  const worker = session.publisher("worker");
  session.subscribe("worker", COMMAND.type, 1, "action", () => { order.push("delivery"); worker.emit(EVENT.type, 1, { operationId: "test" }); });
  session.subscribe("observer-a", EVENT.type, 1, "perception", () => { order.push("next-tick"); });
  session.start(); return { session, order };
}
test("real operation pause exposes frozen deliveries and executes no work until resumed", () => {
  const { session, order } = fixture();
  session.stepPhase(); session.stepPhase(); session.stepPhase();
  assert.equal(session.diagnostics().nextPhase, "movement");
  assert.equal(session.diagnostics().lastCompletedTick, null);
  session.stepPhase();
  session.step(); // freeze action inbox
  assert.equal(session.inspect().deliveries[0]!.status, "frozen");
  assert.deepEqual(order, []);
  session.step(); // one handler, not the loop
  assert.deepEqual(order, ["delivery"]);
  assert.equal(session.diagnostics().nextOperation, "loop");
  assert.equal(session.inspect().deliveries[0]!.tick, 1);
  session.step(); assert.deepEqual(order, ["delivery", "loop"]);
  session.advanceTick();
  assert.equal(session.diagnostics().lastCompletedTick, 0);
  assert.equal(session.diagnostics().tickInProgress, false);
});
test("mixed operation/phase/tick stepping produces exactly the uninterrupted trace", () => {
  const a = fixture(); const b = fixture();
  a.session.advanceTick(); a.session.advanceTick();
  b.session.step(); b.session.stepPhase(); b.session.advanceTick();
  while (b.session.diagnostics().nextTick < 2) b.session.step();
  assert.deepEqual(b.session.trace(), a.session.trace());
  assert.deepEqual(b.order, a.order);
});
test("input staged during a real mid-tick pause is admitted at the next cut", () => {
  const input: Contract = { type: "Input", version: 1, kind: "event", producers: [{ systemId: "adapter", phases: ["input"] }], fields: {} };
  const ticks: number[] = [];
  const session = new Session(options({ contracts: [input], systems: [{ id: "adapter", kind: "adapter" }, { id: "worker" }] }));
  session.subscribe("worker", "Input", 1, "input", (_message, context) => { ticks.push(context.tick); });
  session.start(); session.step();
  session.stageExternalInput("adapter", { sessionId: "fixture-session", type: "Input", version: 1, payload: {} });
  session.advanceTick(); assert.deepEqual(ticks, []);
  session.advanceTick(); assert.deepEqual(ticks, [1]);
});
test("partial tick cannot export replay and closing it records unfinished routes", () => {
  const { session } = fixture();
  session.stepPhase(); session.stepPhase(); session.stepPhase();
  assert.throws(() => session.exportReplay(), { code: "CONTEXT_INVALID" });
  assert.equal(session.state, "active");
  assert.throws(() => { (session.inspect().deliveries as unknown[]).pop(); }, TypeError);
  session.close();
  assert.equal(session.diagnostics().lastCompletedTick, null);
  assert.equal(session.diagnostics().pendingDeliveries, 0);
  assert.ok(session.trace().entries.some(entry => entry.kind === "discarded"));
});
test("stepping reentry from a callback fails without later work", () => {
  const session = new Session(options({ contracts: [], systems: [{ id: "worker", loopPhase: "input", loop: () => { try { session.step(); } catch {} } }] }));
  session.start(); session.step();
  assert.throws(() => session.step());
  assert.equal(session.diagnostics().failure?.code, "REENTRANT");
  assert.equal(session.diagnostics().lastCompletedTick, null);
});
test("debug journal records every message even when retained trace is full; drain is immutable", () => {
  const session = new Session(options({ debug: true, traceCapacity: 1, contracts: [EVENT], systems: [
    { id: "worker", loopPhase: "action", loop: () => { worker.emit(EVENT.type, 1, { operationId: "x" }); } },
  ] }));
  const worker = session.publisher("worker"); session.start(); session.advanceTick();
  const records = session.drainDebugLog();
  assert.equal(records[0]!.kind, "manifest");
  assert.equal(records.filter(record => record.kind === "trace" && record.entry.kind === "published").length, 1);
  assert.equal(session.trace().complete, false);
  assert.deepEqual(records.map(record => record.sequence), records.map((_record, index) => index + 1));
  assert.ok(Object.isFrozen(records)); assert.deepEqual(session.drainDebugLog(), []);
  session.close(); assert.equal(session.drainDebugLog()[0]!.sequence, records.length + 1);
});
test("debug is optional and never changes logical traces or replay manifests", () => {
  const a = fixture(); const b = fixture(true);
  a.session.advanceTick(); b.session.advanceTick();
  assert.deepEqual(a.session.trace(), b.session.trace());
  assert.deepEqual(a.session.drainDebugLog(), []);
});
test("configured tick horizon exhaustion is visible and cannot repeat a tick", () => {
  const session = new Session(options({ contracts: [], maxTicks: 1 }));
  session.start(); session.advanceTick();
  assert.throws(() => session.step(), { code: "TICK_EXHAUSTED" });
  assert.equal(session.diagnostics().lastCompletedTick, 0);
});
