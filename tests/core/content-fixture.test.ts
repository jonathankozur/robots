import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createContentFixture } from "./content-fixture.ts";
import { Session } from "../../src/core/index.ts";
import type { Payload } from "../../src/core/index.ts";
import { options } from "./fixtures.ts";
import { validateContentBundle } from "../../src/content/index.ts";
const fresh = () => JSON.parse(readFileSync(new URL("../../content/fixtures/basic-v1.json", import.meta.url), "utf8"));
function recorded() {
  const original = createContentFixture(fresh()); original.session.start(); original.initialize();
  for (let i = 0; i < 3; i++) original.session.advanceTick();
  return { original, recording: original.session.exportReplay() };
}
test("invalid content is rejected before any session or consumer can be created", () => {
  const source = fresh(); source.definitions.weapons[0].energyCostUnits = -1;
  assert.throws(() => createContentFixture(source), /CONTENT_INVALID/);
});
test("owners receive only their minimal content via deferred messages in declared phases", () => {
  const fixture = createContentFixture(fresh()); assert.deepEqual(fixture.snapshot(), { navigation: null, combat: null });
  fixture.session.start(); fixture.initialize(); assert.deepEqual(fixture.snapshot(), { navigation: null, combat: null });
  fixture.session.stepPhase(); assert.deepEqual(fixture.snapshot(), { navigation: null, combat: null });
  assert.equal(fixture.session.trace().entries.filter(e => e.kind === "external_admitted").length, 2);
  fixture.session.advanceTick();
  const { navigation, combat } = fixture.snapshot();
  assert.equal(navigation!.moveDurationTicks, 3); assert.equal(combat!.impactUnits, 2500);
  assert.equal("definitions" in navigation!, false); assert.equal("integrityUnits" in navigation!, false); assert.equal("passable" in combat!, false);
  assert.ok(Object.isFrozen(navigation)); assert.ok(Object.isFrozen(combat));
  assert.deepEqual(fixture.session.trace().entries.flatMap(e => e.kind === "consumption_finished" && "phase" in e ? [e.phase] : []), ["movement", "resolution"]);
});
test("debug, pauses and mixed stepping preserve identical initialized states and full logical trace", () => {
  const a = createContentFixture(fresh()), b = createContentFixture(fresh(), { debug: true });
  a.session.start(); b.session.start(); a.initialize(); b.initialize();
  const retained = b.snapshot();
  for (let i = 0; i < 3; i++) {
    a.session.advanceTick(); b.session.step(); b.session.stepPhase();
    const paused = b.snapshot(); b.session.inspect(); b.session.trace(); b.session.drainDebugLog(); assert.deepEqual(b.snapshot(), paused);
    b.session.advanceTick();
  }
  assert.deepEqual(a.snapshot(), b.snapshot()); assert.deepEqual(a.session.trace(), b.session.trace()); assert.deepEqual(retained, { navigation: null, combat: null });
});
test("sessions own separate views and pin content independently of subsequent caller edits", () => {
  const source = fresh(), a = createContentFixture(source), b = createContentFixture(source);
  a.session.start(); b.session.start(); a.initialize(); a.session.advanceTick();
  assert.deepEqual(b.snapshot(), { navigation: null, combat: null }); source.definitions.chassis[0].integrityUnits = 90000;
  assert.equal((a.session.trace().manifest!.initialState as Payload).content !== source, true);
  assert.equal(a.snapshot().combat!.integrityUnits, 100000);
  b.initialize(); b.session.advanceTick(); assert.deepEqual(a.snapshot(), b.snapshot());
  const next = createContentFixture(source); next.session.start(); next.initialize(); next.session.advanceTick();
  assert.equal(next.snapshot().combat!.integrityUnits, 90000);
  assert.notEqual(a.snapshot().combat, b.snapshot().combat);
});
test("replay rebuilds fresh owners from its recorded content, with no live input admission", () => {
  const { original, recording } = recorded();
  const replay = createContentFixture((recording.manifest.initialState as Payload).content);
  assert.deepEqual(replay.snapshot(), { navigation: null, combat: null });
  replay.session.loadReplay(recording); replay.session.start();
  for (let i = 0; i < recording.completedTicks; i++) replay.session.advanceTick();
  assert.deepEqual(replay.snapshot(), original.snapshot()); assert.deepEqual(replay.session.trace(), original.session.trace());
  assert.throws(() => replay.initialize(), { code: "REPLAY_INVALID" });
});
test("replay rejects changed content, reused revision, ID, revision and runtime; accepts canonical reordering", () => {
  const { recording } = recorded();
  const changed = [
    (d: ReturnType<typeof fresh>) => { d.definitions.weapons[0].impactUnits++; },
    (d: ReturnType<typeof fresh>) => { d.bundleId = "bundle.other"; },
    (d: ReturnType<typeof fresh>) => { d.contentRevision = "lab-2"; },
  ];
  for (const mutate of changed) { const d = fresh(); mutate(d); const replay = createContentFixture(d); replay.session.loadReplay(recording); assert.throws(() => replay.session.start(), { code: "REPLAY_INVALID" }); }
  const runtime = createContentFixture(fresh(), { runtime: "another-runtime" }); runtime.session.loadReplay(recording); assert.throws(() => runtime.session.start(), { code: "REPLAY_INVALID" });
  const d = fresh(); for (const group of [d.definitions, d.vocabularies]) for (const rows of Object.values(group) as unknown[][]) rows.reverse();
  const canonical = createContentFixture(d); canonical.session.loadReplay(recording); canonical.session.start(); canonical.session.advanceTick();
});
test("reinitialization and content mismatches fail the owning callback without changing its pinned view", () => {
  const repeated = createContentFixture(fresh()); repeated.session.start(); repeated.initialize(); repeated.session.advanceTick(); const retained = repeated.snapshot();
  repeated.initialize(); assert.throws(() => repeated.session.advanceTick(), { code: "CONTENT_INIT_DUPLICATE" }); assert.deepEqual(repeated.snapshot(), retained);
  const { recording } = recorded();
  for (const change of [{ contentRevision: "lab-2" }, { moveDurationTicks: 9 }]) {
    const wrong = createContentFixture(fresh()); wrong.session.start();
    const input = recording.inputs[0]!.input; wrong.session.stageExternalInput("content-bootstrap", { ...input, payload: { ...input.payload, ...change } });
    assert.throws(() => wrong.session.advanceTick(), { code: "CONTENT_INIT_MISMATCH" });
    assert.deepEqual(wrong.snapshot(), { navigation: null, combat: null });
  }
});
test("legacy sessions never acquire a content field or infer catalog defaults", () => {
  const legacy = new Session(options()); legacy.subscribe("worker", "PruebaComando", 1, "action", () => {});
  legacy.start(); const initial = legacy.trace().manifest!.initialState as Payload;
  assert.equal(Object.hasOwn(initial, "content"), false);
});

test("the initial session envelope budget is enforced even for an individually valid near-limit catalog", () => {
  const data = fresh(), target = 1_048_576 - 256;
  let bytes = JSON.stringify(data).length;
  for (let n = 0; bytes < target; n++) {
    const resource = { schemaVersion: 1, id: "resource.pad-" + n, name: "Budget resource", sockets: Array.from({ length: 64 }, (_, i) => "s" + String(i).padStart(2, "0") + "x".repeat(61)) };
    data.vocabularies.resources.push(resource); bytes += JSON.stringify(resource).length + 1;
  }
  const last = data.vocabularies.resources.at(-1)!;
  while (JSON.stringify(data).length > target) last.sockets.pop();
  const result = validateContentBundle(data);
  assert.equal(result.ok, true); assert.ok(JSON.stringify(data).length > 1_048_576 - 512);
  assert.throws(() => createContentFixture(data), { code: "PAYLOAD_CAPACITY" });
});
test("fixture selection has explicit prerequisites and closure cannot reactivate its owners", () => {
  for (const selected of [{ robotId: "robot.absent" }, { robotId: "robot.unarmed" }, { terrainId: "terrain.absent" }]) assert.throws(() => createContentFixture(fresh(), selected), /CONTENT_FIXTURE_CONFIGURATION/);
  const fixture = createContentFixture(fresh()); fixture.session.start(); fixture.initialize(); fixture.session.advanceTick();
  const retained = fixture.snapshot(); fixture.session.close(); fixture.initialize();
  assert.equal(fixture.session.state, "closed"); assert.deepEqual(fixture.snapshot(), retained);
});
