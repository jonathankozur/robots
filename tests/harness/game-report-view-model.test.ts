import test from "node:test";
import assert from "node:assert/strict";
import { integrity, reportSummaryText, combatantStatsSummary, secondsText } from "../../apps/game/view-model.ts";
import type { CombatReport, CombatantStats } from "@robots/protocol/battle/v1";

const sampleStats: CombatantStats = {
  robotId: "alpha",
  teamId: "team.alpha",
  status: "ACTIVE",
  finalIntegrityUnits: 20000,
  maxIntegrityUnits: 100000,
  damageDealtUnits: 80000,
  damageTakenUnits: 80000,
  attacksAttempted: 32,
  attacksLanded: 32,
  attacksRejected: 0,
  accuracyPercentage: 100,
  movementSteps: 2
};

const sampleReport: CombatReport = {
  battleId: "battle.mvp",
  boardId: "board.mvp",
  startedTick: 2,
  finishedTick: 623,
  durationTicks: 621,
  outcome: "WIN",
  winnerTeamId: "team.alpha",
  reason: "ELIMINATION",
  combatants: [sampleStats],
  totalDamageDealtUnits: 80000,
  totalAttacksAttempted: 32,
  totalAttacksLanded: 32,
  totalMovementSteps: 2
};

test("secondsText formats ticks into seconds in Spanish", () => {
  assert.equal(secondsText(20), "1,0s");
  assert.equal(secondsText(621), "31,1s");
});

test("reportSummaryText formats battle outcome and duration", () => {
  assert.equal(reportSummaryText(sampleReport), "Victoria de Alpha en 31,1s (621 ticks)");
  const { winnerTeamId: _omitted, ...base } = sampleReport;
  const drawReport: CombatReport = {
    ...base,
    outcome: "DRAW",
    reason: "TIME_LIMIT"
  };
  assert.equal(reportSummaryText(drawReport), "Empate por tiempo en 31,1s (621 ticks)");
});

test("combatantStatsSummary extracts readable stats for UI", () => {
  const summary = combatantStatsSummary(sampleStats);
  assert.equal(summary.name, "Alpha");
  assert.equal(summary.statusText, "Activo");
  assert.equal(summary.integrityText, "20 / 100");
  assert.equal(summary.damageDealtText, "80");
  assert.equal(summary.damageTakenText, "80");
  assert.equal(summary.accuracyText, "100% (32/32)");
  assert.equal(summary.movementText, "2 pasos");
});
