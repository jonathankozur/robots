import test from "node:test";
import assert from "node:assert/strict";
import { validateCombatReport, type CombatReport, type CombatantStats } from "../src/battle/v1.ts";

const validReport: CombatReport = {
  battleId: "battle.mvp",
  boardId: "board.mvp",
  startedTick: 2,
  finishedTick: 623,
  durationTicks: 621,
  outcome: "WIN",
  winnerTeamId: "team.alpha",
  reason: "ELIMINATION",
  combatants: [
    {
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
      movementSteps: 1
    },
    {
      robotId: "beta",
      teamId: "team.beta",
      status: "DEFEATED",
      finalIntegrityUnits: 0,
      maxIntegrityUnits: 80000,
      damageDealtUnits: 80000,
      damageTakenUnits: 80000,
      attacksAttempted: 32,
      attacksLanded: 32,
      attacksRejected: 0,
      accuracyPercentage: 100,
      movementSteps: 1
    }
  ],
  totalDamageDealtUnits: 160000,
  totalAttacksAttempted: 64,
  totalAttacksLanded: 64,
  totalMovementSteps: 2
};

test("validateCombatReport accepts a valid complete report and freezes payload", () => {
  const result = validateCombatReport(validReport);
  assert.deepEqual(result, validReport);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.combatants));
  assert.ok(Object.isFrozen(result.combatants[0]));
});

test("validateCombatReport rejects unknown fields and malformed IDs", () => {
  assert.throws(() => validateCombatReport({ ...validReport, extraField: "invalid" }));
  assert.throws(() => validateCombatReport({ ...validReport, battleId: "bad id with spaces" }));
  assert.throws(() => validateCombatReport({ ...validReport, boardId: "" }));
});

test("validateCombatReport enforces duration consistency", () => {
  assert.throws(() => validateCombatReport({ ...validReport, durationTicks: 999 }));
  assert.throws(() => validateCombatReport({ ...validReport, startedTick: 624 }));
});

test("validateCombatReport enforces winner and outcome coherence", () => {
  const { winnerTeamId: _omitted, ...baseWithoutWinner } = validReport;
  // WIN must declare winnerTeamId matching active robot
  assert.throws(() => validateCombatReport({ ...validReport, winnerTeamId: "team.beta" }));
  assert.throws(() => validateCombatReport({ ...baseWithoutWinner, outcome: "WIN" }));
  assert.throws(() => validateCombatReport({ ...validReport, reason: "TIME_LIMIT" }));

  // DRAW cannot have winnerTeamId
  const drawReport: CombatReport = {
    ...baseWithoutWinner,
    outcome: "DRAW",
    combatants: validReport.combatants.map((c: CombatantStats) => ({ ...c, status: "DEFEATED", finalIntegrityUnits: 0 }))
  };
  assert.deepEqual(validateCombatReport(drawReport).outcome, "DRAW");
  assert.throws(() => validateCombatReport({ ...drawReport, winnerTeamId: "team.alpha" }));
});

test("validateCombatReport enforces attack stats, accuracy and sum aggregates", () => {
  const badStats = {
    ...validReport,
    combatants: [
      { ...validReport.combatants[0]!, attacksLanded: 35, attacksAttempted: 32 }, // landed > attempted
      validReport.combatants[1]!
    ]
  };
  assert.throws(() => validateCombatReport(badStats));

  const badAccuracy = {
    ...validReport,
    combatants: [
      { ...validReport.combatants[0]!, accuracyPercentage: 50 }, // should be 100
      validReport.combatants[1]!
    ]
  };
  assert.throws(() => validateCombatReport(badAccuracy));

  const badTotalDamage = {
    ...validReport,
    totalDamageDealtUnits: 999999
  };
  assert.throws(() => validateCombatReport(badTotalDamage));

  const badTotalMoves = {
    ...validReport,
    totalMovementSteps: 99
  };
  assert.throws(() => validateCombatReport(badTotalMoves));
});

test("validateCombatReport enforces canonical robot ordering", () => {
  const reversed = {
    ...validReport,
    combatants: [...validReport.combatants].reverse()
  };
  assert.throws(() => validateCombatReport(reversed));
});
