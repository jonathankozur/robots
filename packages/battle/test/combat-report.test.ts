import test from "node:test";
import assert from "node:assert/strict";
import type { Message } from "@robots/system-api";
import { generateCombatReport } from "../src/index.ts";
import { validateCombatReport, type CombatantStats } from "@robots/protocol/battle/v1";

function msg(type: string, payload: unknown, tick = 1, id = 1): Message {
  return Object.freeze({
    messageId: id,
    sessionId: "ctx",
    type,
    contractVersion: 1,
    sourceSystemId: "test",
    emittedTick: tick,
    emittedPhase: "action",
    correlationId: 1,
    causationIds: Object.freeze([]),
    payload: Object.freeze(payload as any)
  });
}

function makeMessages(): Message[] {
  return [
    msg("NavigationWorldReady", { boardId: "board.mvp", width: 2, height: 1, tiles: [], robots: [], boardRevision: 0, effectiveTick: 1 }, 1, 1),
    msg("BattleStarted", { battleId: "battle.mvp", startedTick: 2, maxBattleTicks: 100, participants: [{ robotId: "alpha", teamId: "team.alpha" }, { robotId: "beta", teamId: "team.beta" }] }, 1, 2),
    // Movement: alpha moves once, beta moves once
    msg("NavigationStepResolved", { boardId: "board.mvp", requestBoardId: "board.mvp", robotId: "alpha", from: { q: 1, r: 0 }, to: { q: 2, r: 0 }, accepted: true, duplicate: false, resolvedTick: 2 }, 2, 3),
    msg("NavigationStepResolved", { boardId: "board.mvp", requestBoardId: "board.mvp", robotId: "beta", from: { q: 5, r: 0 }, to: { q: 4, r: 0 }, accepted: true, duplicate: false, resolvedTick: 2 }, 2, 4),
    // Attacks: alpha fires and hits beta
    msg("AttackAccepted", { battleId: "battle.mvp", attackerRobotId: "alpha", targetRobotId: "beta", weaponSlotId: "w1", requestSequence: 1, acceptedTick: 3, observationTick: 3, readyAtTick: 10, duplicate: false }, 3, 5),
    msg("ImpactResolved", { battleId: "battle.mvp", attackerRobotId: "alpha", targetRobotId: "beta", weaponSlotId: "w1", requestSequence: 1, acceptedTick: 3, resolvedTick: 3, requestedImpactUnits: 2500, appliedImpactUnits: 2500, integrityUnits: 77500, maxIntegrityUnits: 80000, targetStatus: "ACTIVE", damageRevision: 1, duplicate: false }, 3, 6),
    // Beta fires and is rejected
    msg("AttackRejected", { battleId: "battle.mvp", attackerRobotId: "beta", targetRobotId: "alpha", weaponSlotId: "w2", requestSequence: 1, resolvedTick: 4, reasonCode: "OUT_OF_RANGE", duplicate: false }, 4, 7),
    // Alpha fires lethal hit
    msg("AttackAccepted", { battleId: "battle.mvp", attackerRobotId: "alpha", targetRobotId: "beta", weaponSlotId: "w1", requestSequence: 2, acceptedTick: 5, observationTick: 5, readyAtTick: 15, duplicate: false }, 5, 8),
    msg("ImpactResolved", { battleId: "battle.mvp", attackerRobotId: "alpha", targetRobotId: "beta", weaponSlotId: "w1", requestSequence: 2, acceptedTick: 5, resolvedTick: 5, requestedImpactUnits: 77500, appliedImpactUnits: 77500, integrityUnits: 0, maxIntegrityUnits: 80000, targetStatus: "DEFEATED", damageRevision: 2, duplicate: false }, 5, 9),
    // Battle finished
    msg("BattleFinished", {
      battleId: "battle.mvp",
      finishedTick: 5,
      outcome: "WIN",
      winnerTeamId: "team.alpha",
      reason: "ELIMINATION",
      damageRevision: 2,
      robots: [
        { robotId: "alpha", teamId: "team.alpha", integrityUnits: 100000, maxIntegrityUnits: 100000, status: "ACTIVE" },
        { robotId: "beta", teamId: "team.beta", integrityUnits: 0, maxIntegrityUnits: 80000, status: "DEFEATED" }
      ]
    }, 5, 10)
  ];
}

test("generateCombatReport produces accurate report from messages", () => {
  const messages = makeMessages();
  const report = generateCombatReport(messages);

  assert.equal(report.battleId, "battle.mvp");
  assert.equal(report.boardId, "board.mvp");
  assert.equal(report.startedTick, 2);
  assert.equal(report.finishedTick, 5);
  assert.equal(report.durationTicks, 3);
  assert.equal(report.outcome, "WIN");
  assert.equal(report.winnerTeamId, "team.alpha");
  assert.equal(report.reason, "ELIMINATION");

  const alpha = report.combatants.find((c: CombatantStats) => c.robotId === "alpha")!;
  assert.ok(alpha);
  assert.equal(alpha.status, "ACTIVE");
  assert.equal(alpha.finalIntegrityUnits, 100000);
  assert.equal(alpha.maxIntegrityUnits, 100000);
  assert.equal(alpha.damageDealtUnits, 80000);
  assert.equal(alpha.damageTakenUnits, 0);
  assert.equal(alpha.attacksAttempted, 2);
  assert.equal(alpha.attacksLanded, 2);
  assert.equal(alpha.attacksRejected, 0);
  assert.equal(alpha.accuracyPercentage, 100);
  assert.equal(alpha.movementSteps, 1);

  const beta = report.combatants.find((c: CombatantStats) => c.robotId === "beta")!;
  assert.ok(beta);
  assert.equal(beta.status, "DEFEATED");
  assert.equal(beta.finalIntegrityUnits, 0);
  assert.equal(beta.maxIntegrityUnits, 80000);
  assert.equal(beta.damageDealtUnits, 0);
  assert.equal(beta.damageTakenUnits, 80000);
  assert.equal(beta.attacksAttempted, 1);
  assert.equal(beta.attacksLanded, 0);
  assert.equal(beta.attacksRejected, 1);
  assert.equal(beta.accuracyPercentage, 0);
  assert.equal(beta.movementSteps, 1);

  assert.equal(report.totalDamageDealtUnits, 80000);
  assert.equal(report.totalAttacksAttempted, 3);
  assert.equal(report.totalAttacksLanded, 2);
  assert.equal(report.totalMovementSteps, 2);

  assert.deepEqual(validateCombatReport(report), report);
});

test("generateCombatReport produces valid report for a draw battle", () => {
  const messages = makeMessages();
  // Modify the finish message to be a DRAW
  const finishIndex = messages.findIndex(m => m.type === "BattleFinished");
  messages[finishIndex] = msg("BattleFinished", {
    battleId: "battle.mvp",
    finishedTick: 5,
    outcome: "DRAW",
    reason: "ELIMINATION",
    damageRevision: 2,
    robots: [
      { robotId: "alpha", teamId: "team.alpha", integrityUnits: 0, maxIntegrityUnits: 100000, status: "DEFEATED" },
      { robotId: "beta", teamId: "team.beta", integrityUnits: 0, maxIntegrityUnits: 80000, status: "DEFEATED" }
    ]
  }, 5, 10);

  const report = generateCombatReport(messages);
  assert.equal(report.outcome, "DRAW");
  assert.equal(report.winnerTeamId, undefined);
  assert.equal(report.reason, "ELIMINATION");
  assert.ok(report.combatants.every((c: CombatantStats) => c.status === "DEFEATED" && c.finalIntegrityUnits === 0));
  assert.deepEqual(validateCombatReport(report), report);
});

test("generateCombatReport throws if battle did not finish", () => {
  assert.throws(() => generateCombatReport([]), { name: "ProtocolError" });
});
