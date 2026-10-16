import test from "node:test";
import assert from "node:assert/strict";
import { generateCombatReport } from "@robots/battle";
import { validateCombatReport, type CombatantStats } from "@robots/protocol/battle/v1";
import { ApplicationController } from "@robots/application-host";
import { combatRecipe } from "../../apps/game/composition.ts";
import content from "../../content/scenarios/combat-mvp-v1.json" with { type: "json" };

function runBattle(customContent: unknown = content) {
  const controller = new ApplicationController({ instanceId: "report-int-test", runtime: "node24", recipe: combatRecipe() });
  assert.ok(controller.request({ requestId: "start", seed: "0123456789abcdef", content: customContent, selection: { scenarioId: "combat-mvp-v1" } }).ok);
  for (let t = 0; t < 1300; t++) {
    const adv = controller.advance();
    assert.ok(adv.ok);
    const obs = controller.snapshot().observations.presentation as any;
    if (obs && obs.stage === "FINISHED") break;
  }
  const trace = controller.trace();
  assert.ok(trace);
  controller.close();
  return trace;
}

test("real 1v1 MVP battle produces accurate report matching full encounter trace", () => {
  const trace = runBattle();
  const report = generateCombatReport(trace);

  assert.equal(report.battleId, "battle.mvp");
  assert.equal(report.boardId, "board.mvp");
  assert.equal(report.startedTick, 2);
  assert.equal(report.finishedTick, 623);
  assert.equal(report.durationTicks, 621);
  assert.equal(report.outcome, "WIN");
  assert.equal(report.winnerTeamId, "team.alpha");
  assert.equal(report.reason, "ELIMINATION");

  const alpha = report.combatants.find((c: CombatantStats) => c.robotId === "alpha")!;
  assert.ok(alpha);
  assert.equal(alpha.status, "ACTIVE");
  assert.equal(alpha.finalIntegrityUnits, 20000);
  assert.equal(alpha.maxIntegrityUnits, 100000);
  assert.equal(alpha.damageDealtUnits, 80000);
  assert.equal(alpha.damageTakenUnits, 80000);
  assert.equal(alpha.attacksAttempted, 32);
  assert.equal(alpha.attacksLanded, 32);
  assert.equal(alpha.attacksRejected, 0);
  assert.equal(alpha.accuracyPercentage, 100);
  assert.equal(alpha.movementSteps, 2);

  const beta = report.combatants.find((c: CombatantStats) => c.robotId === "beta")!;
  assert.ok(beta);
  assert.equal(beta.status, "DEFEATED");
  assert.equal(beta.finalIntegrityUnits, 0);
  assert.equal(beta.maxIntegrityUnits, 80000);
  assert.equal(beta.damageDealtUnits, 80000);
  assert.equal(beta.damageTakenUnits, 80000);
  assert.equal(beta.attacksAttempted, 32);
  assert.equal(beta.attacksLanded, 32);
  assert.equal(beta.attacksRejected, 0);
  assert.equal(beta.accuracyPercentage, 100);
  assert.equal(beta.movementSteps, 1);

  assert.equal(report.totalDamageDealtUnits, 160000);
  assert.equal(report.totalAttacksAttempted, 64);
  assert.equal(report.totalAttacksLanded, 64);
  assert.equal(report.totalMovementSteps, 3);

  assert.deepEqual(validateCombatReport(report), report);
});
