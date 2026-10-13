import assert from "node:assert/strict";
import test from "node:test";
import { createEnvironmentFixture, environmentEvidence, runEnvironmentReference, compareEnvironmentEvidence, DEFAULT_SEED, FIXTURE_TICKS } from "./environment-fixture.ts";

test("mixed operation/phase/tick execution, debug and pauses preserve logical results and trace", () => {
  const fast = createEnvironmentFixture(); fast.session.start();
  for (let i = 0; i < FIXTURE_TICKS; i++) fast.session.advanceTick();
  const partial = createEnvironmentFixture({ debug: true }); partial.session.start();
  const retained = partial.snapshot();
  for (let i = 0; i < FIXTURE_TICKS; i++) {
    partial.session.step(); partial.session.stepPhase(); partial.session.step();
    const before = partial.snapshot(); partial.session.inspect(); partial.session.trace(); partial.session.drainDebugLog();
    assert.deepEqual(partial.snapshot(), before); partial.session.advanceTick();
  }
  assert.deepEqual(partial.snapshot(), fast.snapshot()); assert.deepEqual(partial.session.trace(), fast.session.trace());
  assert.equal(retained.beta.total, 0); assert.ok(Object.isFrozen(retained));
  assert.equal(fast.snapshot().observations.length, FIXTURE_TICKS);
});
test("extra draws by beta do not alter alpha, and independent sessions do not advance each other", () => {
  const a = createEnvironmentFixture(), b = createEnvironmentFixture({ extraBetaDraws: 3 });
  a.session.start(); b.session.start(); const initial = b.snapshot();
  a.session.advanceTick(); assert.deepEqual(b.snapshot(), initial);
  b.session.advanceTick(); assert.deepEqual(a.snapshot().alpha, b.snapshot().alpha);
  assert.notDeepEqual(a.snapshot().beta.sample, b.snapshot().beta.sample);
});
test("seed changes result; replay recreates fresh owners and matches logical evidence", () => {
  const original = createEnvironmentFixture(); original.session.start();
  for (let i = 0; i < FIXTURE_TICKS; i++) original.session.advanceTick();
  const replay = createEnvironmentFixture(); replay.session.loadReplay(original.session.exportReplay()); replay.session.start();
  for (let i = 0; i < FIXTURE_TICKS; i++) replay.session.advanceTick();
  assert.deepEqual(replay.snapshot(), original.snapshot()); assert.deepEqual(replay.session.trace(), original.session.trace());
  const source = runEnvironmentReference();
  assert.equal(compareEnvironmentEvidence(source, runEnvironmentReference(DEFAULT_SEED, "chrome-example")).equal, true);
  assert.equal(compareEnvironmentEvidence(source, runEnvironmentReference("0000000000000000")).equal, false);
});
test("cross-runtime comparison rejects malformed, mismatching or incomplete evidence", () => {
  const source = runEnvironmentReference();
  for (const value of [null, {}, { ...source, completedTicks: 5 }, { ...source, logical: { ...source.logical, entries: [] } }, { ...source, format: "unknown" }]) assert.equal(compareEnvironmentEvidence(value, source).equal, false);
  const partial = createEnvironmentFixture(); partial.session.start(); partial.session.step();
  assert.throws(() => environmentEvidence(partial, DEFAULT_SEED, "test"), /complete ticks/);
});
