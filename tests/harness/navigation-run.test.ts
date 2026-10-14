import assert from "node:assert/strict";
import test from "node:test";
import { runTickBatch } from "../browser/navigation-run.ts";

test("tick batch reaches the exact absolute target from a nonzero cursor", async () => {
  let tick = 12;
  let calls = 0;
  const result = await runTickBatch({
    requestedTicks: 3,
    readTick: () => tick,
    advanceTick: () => { calls++; tick++; return { ok: true }; },
    isActive: () => true,
  });

  assert.deepEqual(result, {
    status: "completed", startTick: 12, targetTick: 15, finalTick: 15, actualTicks: 3,
  });
  assert.equal(calls, 3);
});

test("tick batch stops cleanly at a pause and reports the partial progress", async () => {
  let tick = 5;
  let active = true;
  let calls = 0;
  const result = await runTickBatch({
    requestedTicks: 10,
    readTick: () => tick,
    advanceTick: () => { calls++; tick++; return { ok: true }; },
    isActive: () => active,
    afterTick: () => { if (tick === 7) active = false; },
  });

  assert.deepEqual(result, {
    status: "paused", startTick: 5, targetTick: 15, finalTick: 7, actualTicks: 2,
  });
  assert.equal(calls, 2);
});

test("tick batch reports and stops on an unexpected cursor jump", async () => {
  let tick = 2;
  let calls = 0;
  const result = await runTickBatch({
    requestedTicks: 4,
    readTick: () => tick,
    advanceTick: () => { calls++; tick += 2; return { ok: true }; },
    isActive: () => true,
  });

  assert.deepEqual(result, {
    status: "failed", startTick: 2, targetTick: 6, finalTick: 4, actualTicks: 2,
    error: "Se esperaba avanzar de tick 2 a 3, pero el cursor terminó en 4.",
  });
  assert.equal(calls, 1);
});
