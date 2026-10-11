import assert from "node:assert/strict";
import test from "node:test";
import { Session } from "../../src/core/scheduler/session.ts";
import type { Contract, Message, Publisher } from "../../src/core/messaging/contracts.ts";
import { COMMAND, EVENT, options } from "./fixtures.ts";

const INPUT: Contract = {
  type: "PruebaEntrada", version: 1, kind: "event", producers: [{ systemId: "adapter", phases: ["input"] }],
  fields: { operationId: { type: "string", minLength: 1 } },
};
function fixture(extra: Parameters<typeof options>[0] = {}, reversed = false) {
  let producer: Publisher; let worker: Publisher;
  const intents: Message[] = [];
  const results: string[] = [];
  const session = new Session(options({ initialState: { seed: 42, version: 1 }, contracts: [INPUT, COMMAND, EVENT], systems: [
    { id: "adapter", kind: "adapter" },
    { id: "producer", loopPhase: "decision", loop: () => {
      for (const message of intents.splice(0)) producer.send(COMMAND.type, 1, message.payload, { causes: [message] });
    } },
    { id: "worker" }, { id: "observer-a" }, { id: "observer-b" },
  ], ...extra }));
  producer = session.publisher("producer"); worker = session.publisher("worker");
  session.subscribe("producer", INPUT.type, 1, "input", message => { intents.push(message); });
  session.subscribe("worker", COMMAND.type, 1, "action", () => { worker.emit(EVENT.type, 1, { operationId: "resolved" }); });
  for (const id of reversed ? ["observer-b", "observer-a"] : ["observer-a", "observer-b"]) {
    session.subscribe(id, EVENT.type, 1, id === "observer-a" ? "resolution" : "perception", (message, context) => {
      results.push([id, context.tick, message.payload.operationId, message.correlationId].join(":"));
    });
  }
  return { session, results };
}
function stage(session: Session, operationId: string) {
  return session.stageExternalInput("adapter", { sessionId: "fixture-session", type: INPUT.type, version: 1, payload: { operationId } });
}
test("same inputs and initial state reproduce trace and results across frame groupings", () => {
  function run(groups: number[], reversed: boolean) {
    const value = fixture({}, reversed); value.session.start(); stage(value.session, "op");
    for (const ticksPerFrame of groups) for (let index = 0; index < ticksPerFrame; index++) value.session.advanceTick();
    return { results: value.results, trace: value.session.trace() };
  }
  assert.deepEqual(run([1, 0, 1, 1], false), run([3], true));
  const trace = run([3], false).trace;
  assert.equal(trace.complete, true);
  assert.deepEqual(trace.entries.filter(entry => entry.kind === "external_admitted").map(entry => [entry.tick, entry.order]), [[0, 1]]);
  assert.equal(trace.entries.filter(entry => entry.kind === "consumption_finished").length, 4);
});
test("recorded admitted inputs replay without live adapters and keep full causal history", () => {
  const original = fixture(); original.session.start(); stage(original.session, "first"); original.session.advanceTick();
  stage(original.session, "second"); original.session.advanceTick(); original.session.advanceTick();
  const recording = original.session.exportReplay();
  assert.equal(recording.completedTicks, 3);
  assert.deepEqual(recording.inputs.map(input => [input.tick, input.order]), [[0, 1], [1, 2]]);
  const replay = fixture({}, true); replay.session.loadReplay(recording); replay.session.start();
  for (let index = 0; index < recording.completedTicks; index++) replay.session.advanceTick();
  assert.deepEqual(replay.results, original.results);
  assert.equal(JSON.stringify(replay.session.trace()), JSON.stringify(original.session.trace()));
});
test("replay forbids injecting live inputs and advancing beyond its recorded horizon", () => {
  const source = fixture(); source.session.start(); source.session.advanceTick();
  const recording = source.session.exportReplay();
  const live = fixture(); live.session.loadReplay(recording); live.session.start();
  assert.throws(() => stage(live.session, "unrecorded"), { code: "REPLAY_INVALID" });
  const replay = fixture(); replay.session.loadReplay(recording); replay.session.start(); replay.session.advanceTick();
  assert.throws(() => replay.session.advanceTick(), { code: "REPLAY_INVALID" });
});
test("replay refuses changes to runtime, revision, initial state, capacities or routes", () => {
  const source = fixture(); source.session.start(); source.session.advanceTick();
  const recording = source.session.exportReplay();
  for (const config of [
    { runtime: "other-runtime" }, { revision: "other-revision" }, { initialState: { seed: 43, version: 1 } },
    { maxDeliveries: 17 },
  ]) {
    const replay = fixture(config); replay.session.loadReplay(recording);
    assert.throws(() => replay.session.start(), { code: "REPLAY_INVALID" });
    assert.equal(replay.session.state, "preparing");
  }
});
test("incomplete bounded trace is explicit and cannot certify or export a replay", () => {
  const { session } = fixture({ traceCapacity: 4 });
  session.start(); stage(session, "op"); session.advanceTick(); session.advanceTick();
  const trace = session.trace();
  assert.equal(trace.complete, false);
  assert.equal(trace.entries.length, 4);
  assert.ok(trace.droppedEntries > 0);
  assert.throws(() => session.exportReplay(), { code: "TRACE_INCOMPLETE" });
  assert.equal(session.state, "active");
});
test("trace snapshots cannot mutate retained diagnostics or admitted messages", () => {
  const { session } = fixture(); session.start(); stage(session, "op"); session.advanceTick();
  const trace = session.trace();
  assert.ok(Object.isFrozen(trace.manifest));
  assert.throws(() => { (trace.entries as unknown as unknown[]).pop(); }, TypeError);
  const first = trace.entries.find(entry => entry.kind === "published")!;
  assert.throws(() => { (first.message as unknown as { messageId: number }).messageId = 999; }, TypeError);
  assert.equal(session.trace().entries.find(entry => entry.kind === "published")!.message!.messageId, 1);
});
test("failed tick has a causal fault and cannot export partial results", () => {
  let producer: Publisher; let worker: Publisher;
  let outputs = 0;
  const session = new Session(options({ systems: [
    { id: "producer", loopPhase: "decision", loop: () => { producer.send(COMMAND.type, 1, { operationId: "op" }); } },
    { id: "worker" }, { id: "observer-a" }, { id: "observer-b" },
  ] }));
  producer = session.publisher("producer"); worker = session.publisher("worker");
  session.subscribe("worker", COMMAND.type, 1, "action", () => {
    worker.emit(EVENT.type, 1, { operationId: "output-before-fault" }); throw new Error("fail after publication");
  });
  session.subscribe("observer-a", EVENT.type, 1, "resolution", () => { outputs++; });
  session.start(); assert.throws(() => session.advanceTick());
  assert.equal(outputs, 0);
  const trace = session.trace();
  assert.equal(trace.entries.filter(entry => entry.kind === "tick_completed").length, 0);
  const failure = trace.entries.find(entry => entry.kind === "failed");
  assert.ok(failure?.kind === "failed");
  assert.equal(failure.causeId, 1);
  assert.throws(() => session.exportReplay(), { code: "REPLAY_INVALID" });
  session.close("fixture-fault");
  const closed = session.trace().entries.find(entry => entry.kind === "closed")!;
  assert.equal(closed.reason, "fixture-fault");
  assert.equal(closed.discardedDeliveries, 2);
});
test("close logs pending routes and late external rejection without reactivating", () => {
  const { session } = fixture(); session.start(); stage(session, "op"); session.advanceTick();
  session.close("finished"); session.close("ignored");
  assert.equal(stage(session, "late"), false);
  const trace = session.trace();
  assert.equal(trace.entries.filter(entry => entry.kind === "closed").length, 1);
  const discarded = trace.entries.find(entry => entry.kind === "discarded");
  assert.ok(discarded?.kind === "discarded");
  assert.equal(discarded.receiver, "observer-b");
  assert.equal(trace.entries.at(-1)!.kind, "external_rejected");
  assert.equal(session.state, "closed");
});
test("unobserved events are recorded without requiring delivery slots", () => {
  let port: Publisher;
  const session = new Session(options({ contracts: [{ ...EVENT, producers: [{ systemId: "worker", phases: ["action"] }] }],
    maxDeliveries: 1, systems: [{ id: "worker", loopPhase: "action", loop: () => {
      for (let index = 0; index < 3; index++) port.emit(EVENT.type, 1, { operationId: "unobserved" });
    } }],
  }));
  port = session.publisher("worker"); session.start(); session.advanceTick();
  assert.equal(session.diagnostics().lastMessageId, 3);
  assert.equal(session.diagnostics().pendingDeliveries, 0);
  assert.equal(session.trace().entries.filter(entry => entry.kind === "published").length, 3);
  assert.equal(session.trace().entries.filter(entry => entry.kind === "routed").length, 0);
});
