import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ApplicationController } from "../../src/application/index.ts";
import { fixtureRecipe, nav, combat } from "./application-fixture.ts";
const content = () => JSON.parse(readFileSync(new URL("../../content/fixtures/basic-v2.json", import.meta.url), "utf8"));
export const request = (requestId = "one") => ({ requestId, seed: "0123456789abcdef", content: content(), selection: { robotId: "robot.scout", terrainId: "terrain.floor" } });
const app = (recipe = fixtureRecipe(), instanceId = "test") => new ApplicationController({ instanceId, runtime: "test-runtime", recipe });
function boot(a: ApplicationController) { assert.equal(a.request(request()).ok, true); a.advance(); a.advance(); assert.equal(a.snapshot().state, "ready"); }
test("configuration rejects before advancing and detaches caller data", () => {
  const a = app(), bad = request("invalid"); bad.content.schemaVersion = 3;
  assert.equal(a.request(bad).ok, false); assert.equal(a.snapshot().state, "idle");
  const data = request(); assert.equal(a.request(data).ok, true); data.content.definitions.chassis[0].integrityUnits = 1;
  a.advance(); a.advance(); assert.equal(a.snapshot().observations[combat]!.amount, 100000); assert.ok(Object.isFrozen(a.snapshot()));
});
test("bootstrap waits for confirmations and the complete input activation barrier", () => {
  const a = app(); assert.equal(a.request(request()).ok, true); assert.equal(a.snapshot().state, "initializing");
  assert.equal(a.stage(a.snapshot().contextId, "OperateNavigation", { delta: 1 }), false);
  a.advance(); assert.equal(a.snapshot().state, "initializing"); assert.deepEqual(a.snapshot().pendingParticipants, []);
  a.advance("step"); a.advance("step"); assert.equal(a.snapshot().state, "initializing");
  a.advance("phase"); assert.equal(a.snapshot().state, "ready"); a.advance(); assert.equal(a.snapshot().observations[nav]!.count, 0);
  const published = a.trace()!.entries.filter((e: any) => e.kind === "published").map((e: any) => e.message);
  assert.equal(new Set(published.filter((m: any) => m.type !== "FixtureEquipmentObserved").map((m: any) => m.correlationId)).size, 1);
});
test("duplicates are harmless; conflict, rejection, timeout and exception are visible", () => {
  boot(app(fixtureRecipe({ mode: "duplicate" })));
  for (const mode of ["missing", "reject", "conflict", "crash"] as const) {
    const a = app(fixtureRecipe({ mode })); a.request({ ...request(), initializationMaxTicks: 2 });
    for (let i=0;i<4 && a.snapshot().state === "initializing";i++) a.advance();
    assert.equal(a.snapshot().state, "faulted", mode); assert.ok(a.snapshot().failure);
    assert.equal(a.stage(a.snapshot().contextId, "OperateNavigation", { delta: 1 }), false);
  }
});
test("preflight failure preserves old context and replacement respects real pause", () => {
  const a = app(); boot(a); const old = a.snapshot().contextId; a.advance("step"); const paused = a.snapshot().progress;
  const partial = a.request(request("two")); assert.equal(partial.ok, false); assert.equal(partial.code, "TICK_IN_PROGRESS");
  assert.deepEqual(a.snapshot().progress, paused); a.advance();
  const before = a.trace(); const bad = request("bad"); bad.selection.robotId = "robot.missing";
  assert.equal(a.request(bad).ok, false); assert.equal(a.snapshot().contextId, old); assert.deepEqual(a.trace(), before);
  assert.equal(a.request(request("two")).ok, true); assert.notEqual(a.snapshot().contextId, old);
  assert.equal(a.stage(old, "OperateNavigation", { delta: 1 }), false); a.advance(); a.advance(); assert.equal(a.snapshot().observations[nav]!.count, 0);
});
test("request deduplication, body conflicts and bounded registry are explicit", () => {
  const a = app(); const first = a.request(request()); assert.deepEqual(a.request(request()), first); assert.equal(a.snapshot().contextId, first.contextId);
  const different = request(); different.seed = "fedcba9876543210"; assert.equal(a.request(different).code, "REQUEST_CONFLICT");
  assert.equal(a.request(request("other")).code, "BUSY");
  const b = app(); for(let i=0;i<128;i++) { const invalid = request(String(i)); invalid.content.schemaVersion = 3; b.request(invalid); }
  assert.equal(b.request(request("overflow")).code, "REQUEST_CAPACITY");
});
test("cleanup is idempotent; failed cleanup blocks new context until explicit retry", () => {
  const disposed: string[]=[]; let fail=true; const a=app(fixtureRecipe({ disposed, failCleanup: () => fail })); boot(a);
  assert.equal(a.close().ok,false); assert.equal(a.snapshot().state,"faulted"); assert.equal(a.request(request("two")).ok,false);
  fail=false; assert.equal(a.close().ok,true); assert.deepEqual(disposed.sort(),[combat,nav].sort()); a.close(); assert.equal(disposed.length,2);
  assert.equal(a.request(request("two")).ok,true);
});
test("factory reentry and invalid command routing do not publish a second context", () => {
  let a: ApplicationController; let nested: any;
  a=app(fixtureRecipe({ duringCreate: () => { nested=a.request(request("nested")); } }));
  assert.equal(a.request(request()).ok,true); assert.equal(nested.code,"BUSY");
  const bad=app(fixtureRecipe({ badRoute:true })); assert.equal(bad.request(request()).ok,false); assert.equal(bad.snapshot().state,"idle");
});
