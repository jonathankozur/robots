import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ApplicationController } from "@robots/application-host";
import type { Recipe, Request } from "@robots/application-host";
import { fixtureRecipe } from "./application-fixture.ts";
import { navigationRecipe, navigationPresets, request } from "./navigation-fixture.ts";
import { presentationRecipe, presentationRequest } from "./presentation-fixture.ts";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const appRequest = (): Request => ({
  requestId: "baseline", seed: "0123456789abcdef",
  content: JSON.parse(readFileSync(new URL("../../content/fixtures/basic-v2.json", import.meta.url), "utf8")),
  selection: { robotId: "robot.scout", terrainId: "terrain.floor" }
});
export const migrationCases = [
  { id: "application", recipe: fixtureRecipe, input: appRequest },
  ...navigationPresets().map(p => ({ id: "navigation-" + p.id, recipe: navigationRecipe, input: () => request(p.scenario) })),
  ...navigationPresets().map(p => ({ id: "presentation-" + p.id, recipe: presentationRecipe, input: () => presentationRequest(p.scenario) }))
];
export function measureMigrationCase(entry: typeof migrationCases[number]) {
  const create = () => new ApplicationController({ instanceId: "baseline-" + entry.id, runtime: "migration-reference-v1", recipe: entry.recipe() });
  const full = create(), stepped = create();
  assert.equal(full.request(entry.input()).ok, true);
  assert.equal(stepped.request(entry.input()).ok, true);
  for (let i = 0; i < 26; i++) {
    if (entry.id === "application" && (i === 5 || i === 12)) {
      for (const a of [full, stepped]) assert.equal(a.stage(a.snapshot().contextId, "OperateNavigation", { delta: i }), true);
    }
    assert.equal(full.advance().ok, true);
    assert.equal(stepped.advance("step").ok, true);
    assert.equal(stepped.advance("phase").ok, true);
    assert.equal(stepped.advance().ok, true);
  }
  assert.deepEqual(stepped.trace(), full.trace());
  const replay = create();
  const recording = full.exportReplay();
  assert.equal(replay.loadReplay(structuredClone(recording)).ok, true);
  for (let i = 0; i < recording.completedTicks; i++) assert.equal(replay.advance().ok, true);
  assert.deepEqual(replay.trace(), full.trace());
  assert.deepEqual(replay.snapshot().observations, full.snapshot().observations);
  const trace = full.trace()!;
  const result = {
    trace: hash(trace), observations: hash(full.snapshot().observations),
    entries: trace.entries.length, completedTicks: recording.completedTicks
  };
  for (const a of [full, stepped, replay]) assert.equal(a.close().ok, true);
  return result;
}
