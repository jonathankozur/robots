import assert from "node:assert/strict";
import test from "node:test";
import { createSimulationEnvironment, validateEnvironment } from "@robots/runtime/environment";
import { Session, ProtocolError } from "@robots/runtime";
import type { SimulationEnvironment } from "@robots/system-api";
import { checkedAdd } from "@robots/values/numeric";
const systems = [{ id: "a" }, { id: "b" }, { id: "adapter", kind: "adapter" as const }];
const declarations = [{ systemId: "b", purpose: "sample" }, { systemId: "a", purpose: "sample" }];
const seed = "0123456789abcdef";
const env = () => createSimulationEnvironment(seed, declarations, systems);
function session(environment?: SimulationEnvironment, runtime = "test-runtime") {
  return new Session({ sessionId: "env-fixture", revision: "env-v1", runtime, contracts: [], systems,
    ...(environment === undefined ? {} : { environment }) });
}
test("environment copies declarations, canonicalizes streams and verifies initial state from seed", () => {
  const e = env();
  assert.deepEqual(e.streams.map(s => s.systemId), ["a", "b"]);
  assert.deepEqual(e, createSimulationEnvironment(seed, [...declarations].reverse(), [...systems].reverse()));
  assert.deepEqual(validateEnvironment(e, systems), e);
  assert.ok(Object.isFrozen(e) && Object.isFrozen(e.streams) && Object.isFrozen(e.streams[0]!.initial.words));
  const changed = structuredClone(e); (changed.streams[0]!.initial.words as unknown as number[])[0] = 0;
  assert.throws(() => validateEnvironment(changed, systems), { code: "ENVIRONMENT_INVALID" });
});
test("unknown owners, adapters, duplicate pairs, unsupported profiles and hidden values reject configuration", () => {
  for (const streams of [[{ systemId: "absent", purpose: "x" }], [{ systemId: "adapter", purpose: "x" }], [declarations[0]!, declarations[0]!]]) assert.throws(() => createSimulationEnvironment(seed, streams, systems), { code: "ENVIRONMENT_INVALID" });
  for (const change of [{ tickRate: 30 }, { version: 2 }, { quantityScale: 10 }, { damageRounding: "ceil" }, { extra: true }, { masterSeed: "invalid" }, { streams: null }]) {
    const e = { ...env(), ...change } as unknown as SimulationEnvironment;
    assert.throws(() => validateEnvironment(e, systems), { code: "ENVIRONMENT_INVALID" });
    assert.throws(() => session(e), { code: "ENVIRONMENT_INVALID" });
  }
  let calls = 0; const e = { ...env() };
  Object.defineProperty(e, "masterSeed", { enumerable: true, get() { calls++; return seed; } });
  assert.throws(() => session(e), { code: "ENVIRONMENT_INVALID" }); assert.equal(calls, 0);
});
test("optional environment preserves legacy manifests and v1 replay; new manifest is immutable and copied", () => {
  const legacy = session(); legacy.start(); legacy.advanceTick();
  assert.equal("environment" in legacy.trace().manifest!, false);
  const copy = session(); copy.loadReplay(legacy.exportReplay()); copy.start(); copy.advanceTick();
  assert.deepEqual(copy.trace(), legacy.trace());
  const e = structuredClone(env()); const active = session(e);
  (e.streams[0]!.initial.words as unknown as number[])[0] = 0;
  active.start(); active.advanceTick();
  assert.deepEqual(active.trace().manifest!.environment, env());
  assert.equal(active.exportReplay().formatVersion, 1);
  const replay = session(env()); replay.loadReplay(active.exportReplay()); replay.start(); replay.advanceTick();
  assert.deepEqual(replay.trace(), active.trace());
});
test("replay rejects absent versus explicit environment, different seeds/streams and runtime", () => {
  const active = session(env()); active.start(); active.advanceTick(); const recording = active.exportReplay();
  const candidates = [session(), session(createSimulationEnvironment("0000000000000000", declarations, systems)),
    session(createSimulationEnvironment(seed, declarations.slice(0, 1), systems)), session(env(), "another-runtime")];
  for (const candidate of candidates) {
    candidate.loadReplay(recording); assert.throws(() => candidate.start(), { code: "REPLAY_INVALID" });
  }
  const old = session(); old.start(); old.advanceTick(); const newer = session(env()); newer.loadReplay(old.exportReplay());
  assert.throws(() => newer.start(), { code: "REPLAY_INVALID" });
});
test("an unhandled numerical protocol error fails its owning callback and prevents further ticks", () => {
  const s = new Session({ sessionId: "fault", revision: "v1", runtime: "test", contracts: [], systems: [{ id: "a", loopPhase: "decision", loop() { checkedAdd(Number.MAX_SAFE_INTEGER, 1); } }] });
  s.start(); assert.throws(() => s.advanceTick(), ProtocolError);
  assert.equal(s.state, "failed"); assert.equal(s.diagnostics().failure!.code, "NUMERIC_OVERFLOW");
  assert.equal(s.diagnostics().failure!.systemId, "a");
  assert.throws(() => s.advanceTick(), { code: "STATE_INVALID" });
});
