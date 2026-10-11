import assert from "node:assert/strict";
import test from "node:test";
import { Session } from "../../src/core/index.ts";
import type { Contract, Message, Publisher } from "../../src/core/index.ts";
import { COMMAND, EVENT, options } from "./fixtures.ts";

test("external input to input is immediate at the cut; internal input to input waits a tick", () => {
  const INPUT: Contract = { ...EVENT, type: "PruebaEntrada", producers: [{ systemId: "adapter", phases: ["input"] }] };
  const RELAY: Contract = { ...EVENT, type: "PruebaReenvio", producers: [{ systemId: "worker", phases: ["input"] }] };
  let worker: Publisher;
  const seen: number[] = [];
  const session = new Session(options({ contracts: [INPUT, RELAY], systems: [
    { id: "adapter", kind: "adapter" }, { id: "worker" }, { id: "observer-a" },
  ] }));
  worker = session.publisher("worker");
  session.subscribe("worker", INPUT.type, 1, "input", message => { worker.emit(RELAY.type, 1, message.payload); });
  session.subscribe("observer-a", RELAY.type, 1, "input", (_message, context) => { seen.push(context.tick); });
  session.start();
  session.stageExternalInput("adapter", { sessionId: "fixture-session", type: INPUT.type, version: 1, payload: { operationId: "op" } });
  session.advanceTick(); assert.deepEqual(seen, []);
  session.advanceTick(); assert.deepEqual(seen, [1]);
});
test("recipient mutation cannot alter a fan-out or a retained message in future ticks", () => {
  let port: Publisher; let retained: Message;
  const source = { operationId: "stable" };
  const observed: string[] = [];
  const session = new Session(options({ contracts: [{ ...EVENT, producers: [{ systemId: "worker", phases: ["action"] }] }], systems: [
    { id: "worker", loopPhase: "action", loop: ({ tick }) => {
      if (tick === 0) { port.emit(EVENT.type, 1, source); source.operationId = "modified source"; }
    } }, { id: "observer-a" }, { id: "observer-b" },
  ] }));
  port = session.publisher("worker");
  session.subscribe("observer-a", EVENT.type, 1, "resolution", message => {
    retained = message;
    assert.throws(() => { (message.payload as { operationId: string }).operationId = "modified recipient"; }, TypeError);
  });
  session.subscribe("observer-b", EVENT.type, 1, "perception", message => { observed.push(message.payload.operationId as string); });
  session.start(); session.advanceTick(); session.advanceTick(); session.advanceTick();
  assert.equal(retained!.payload.operationId, "stable"); assert.deepEqual(observed, ["stable"]);
});
test("fixture local view is initialized by messages; missing or stale data has an explicit policy", () => {
  const OBSERVATION: Contract = { type: "PruebaVista", version: 1, kind: "event",
    producers: [{ systemId: "adapter", phases: ["input"] }],
    fields: { revision: { type: "number", integer: true, min: 1 }, validThroughTick: { type: "number", integer: true, min: 0 },
      visibleCount: { type: "number", integer: true, min: 0 } },
  };
  // This state belongs only to the decision fixture; the bus contains no visibility rule.
  let view: { revision: number; validThroughTick: number; visibleCount: number } | undefined;
  const results: string[] = [];
  const session = new Session(options({ contracts: [OBSERVATION], systems: [
    { id: "adapter", kind: "adapter" },
    { id: "decision-fixture", loopPhase: "decision", loop: ({ tick }) => {
      results.push(!view ? "missing" : view.revision !== 1 || view.validThroughTick < tick ? "stale" : "visible:" + view.visibleCount);
    } },
  ] }));
  session.subscribe("decision-fixture", OBSERVATION.type, 1, "perception", message => {
    view = { revision: message.payload.revision as number, validThroughTick: message.payload.validThroughTick as number,
      visibleCount: message.payload.visibleCount as number };
  });
  session.start(); session.advanceTick();
  session.stageExternalInput("adapter", { sessionId: "fixture-session", type: OBSERVATION.type, version: 1,
    payload: { revision: 1, validThroughTick: 1, visibleCount: 3 } });
  session.advanceTick(); session.advanceTick();
  assert.deepEqual(results, ["missing", "visible:3", "stale"]);
});
test("runtime forbids restart and replay reconfiguration from a callback even when caught", () => {
  for (const method of ["start", "loadReplay"] as const) {
    const session = new Session(options({ contracts: [], systems: [
      { id: "worker", loopPhase: "action", loop: () => {
        try {
          if (method === "start") session.start();
          else session.loadReplay({ formatVersion: 1, manifest: {}, completedTicks: 0, inputs: [] });
        } catch {}
      } },
    ] }));
    session.start(); assert.throws(() => session.advanceTick()); assert.equal(session.state, "failed");
  }
});
test("replay validates route changes, input ordering and malformed records before execution", () => {
  const source = new Session(options({ contracts: [], systems: [] }));
  source.start(); source.advanceTick();
  const recording = source.exportReplay();
  for (const malformed of [null, {}, { ...recording, inputs: [null] }]) {
    const replay = new Session(options({ contracts: [], systems: [] }));
    assert.throws(() => replay.loadReplay(malformed as typeof recording), { code: "REPLAY_INVALID" });
  }
  const modified = new Session(options({ contracts: [], systems: [{ id: "extra" }] }));
  modified.loadReplay(recording);
  assert.throws(() => modified.start(), { code: "REPLAY_INVALID" });
});
test("exact queue budget supports sustained ticks and bounded trace retention", () => {
  let port: Publisher;
  let count = 0;
  const session = new Session(options({ contracts: [COMMAND], maxDeliveries: 2, traceCapacity: 20, systems: [
    { id: "producer", loopPhase: "decision", loop: () => {
      port.send(COMMAND.type, 1, { operationId: "a" }); port.send(COMMAND.type, 1, { operationId: "b" });
    } }, { id: "worker" },
  ] }));
  port = session.publisher("producer");
  session.subscribe("worker", COMMAND.type, 1, "action", () => { count++; });
  session.start(); for (let tick = 0; tick < 100; tick++) session.advanceTick();
  assert.equal(count, 200); assert.equal(session.diagnostics().lastMessageId, 200);
  assert.equal(session.diagnostics().pendingDeliveries, 0);
  assert.equal(session.trace().entries.length, 20); assert.equal(session.trace().complete, false);
});
