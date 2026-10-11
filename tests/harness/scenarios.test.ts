import assert from "node:assert/strict";
import test from "node:test";
import { createLab, validateScenario, presets, compareRuns } from "../browser/scenarios.ts";

test("scenario rules use local state and emit a causal response once per received input", () => {
  const scenario = structuredClone(presets[0]!.scenario);
  const lab = createLab(scenario); lab.session.start();
  lab.stageScheduled(); lab.session.advanceTick();
  assert.equal(lab.states.get("processor")!.received, 1);
  assert.equal(lab.session.diagnostics().pendingDeliveries, 1);
  lab.stageScheduled(); lab.session.advanceTick();
  const published = lab.session.trace().entries.filter(entry => entry.kind === "published");
  assert.equal(published.length, 3);
  assert.deepEqual(published[2]!.message.causationIds, [2]);
});
test("all catalogued scenarios either run or yield their declared core fault", () => {
  for (const preset of presets) {
    let code: string | null = null;
    try {
      const lab = createLab(preset.scenario); lab.session.start();
      for (let i = 0; i < (preset.ticks ?? 2); i++) { lab.stageScheduled(); lab.session.advanceTick(); }
    } catch (error) { code = (error as { code?: string }).code ?? "CALLBACK_FAILED"; }
    assert.equal(code, preset.expectedCode ?? null, preset.name);
  }
});
test("JSON importer rejects unknown executable actions and ambiguous rule targets", () => {
  const scenario = structuredClone(presets[0]!.scenario);
  (scenario.rules[0]!.actions as unknown[]).push({ op: "eval", value: "alert(1)" });
  assert.throws(() => validateScenario(scenario), /action/i);
  scenario.rules[0]!.actions.pop(); scenario.rules[0]!.systemId = "unregistered";
  assert.throws(() => validateScenario(scenario), /rule system/i);
});
test("scenario replay rebuilds owners and comparing another run finds first divergence", () => {
  const a = createLab(presets[0]!.scenario); a.session.start();
  for (let i = 0; i < 2; i++) { a.stageScheduled(); a.session.advanceTick(); }
  const b = createLab(presets[0]!.scenario); b.session.loadReplay(a.session.exportReplay()); b.session.start();
  b.session.advanceTick(); b.session.advanceTick();
  assert.equal(compareRuns(a, b).equal, true);
  const changed = structuredClone(presets[0]!.scenario); changed.inputs[0]!.payload.operationId = "different";
  const c = createLab(changed); c.session.start(); c.stageScheduled(); c.session.advanceTick();
  assert.equal(compareRuns(a, c).equal, false);
});
