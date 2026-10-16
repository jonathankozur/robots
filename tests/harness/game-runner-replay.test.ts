import test from "node:test";
import assert from "node:assert/strict";
import { ApplicationController } from "@robots/application-host";
import { combatRecipe } from "../../apps/game/composition.ts";
import { GameRunner } from "../../apps/game/runner.ts";
import content from "../../content/scenarios/combat-mvp-v1.json" with { type: "json" };

function setup(prepare = async () => {}) {
  const create = () => new ApplicationController({ instanceId: "runner-replay-test", runtime: "node24", recipe: combatRecipe() });
  const controller = create();
  const tasks = new Map<number, () => void>();
  let id = 0;
  const runner = new GameRunner(
    controller,
    { requestId: "start", seed: "0123456789abcdef", content, selection: { scenarioId: "combat-mvp-v1" } },
    { prepare, accept() {}, change() {} },
    {
      set(cb, ms) {
        assert.equal(ms, 50);
        tasks.set(++id, cb);
        return id;
      },
      clear(id) {
        tasks.delete(id as number);
      }
    },
    create
  );
  async function step() {
    assert.equal(tasks.size, 1);
    const [id, cb] = tasks.entries().next().value!;
    tasks.delete(id);
    cb();
    await Promise.resolve();
    await Promise.resolve();
  }
  return { controller, runner, tasks, step };
}

test("runner exports replay and combat report upon finishing, and pause/resume controls timer", async () => {
  const r = setup();
  assert.equal(r.runner.start(), true);
  for (let i = 0; i < 5 && r.runner.state !== "running"; i++) {
    await r.step();
  }
  assert.equal(r.runner.state, "running");

  // Pause
  assert.equal(r.runner.pause(), true);
  assert.equal(r.runner.state, "paused");
  assert.equal(r.tasks.size, 0);
  assert.equal(r.runner.pause(), false); // already paused

  // Resume
  assert.equal(r.runner.resume(), true);
  assert.equal(r.runner.state, "running");
  assert.equal(r.tasks.size, 1);

  // Complete battle
  for (let t = 0; t < 1300 && r.runner.state !== "finished"; t++) {
    await r.step();
  }
  assert.equal(r.runner.state, "finished");
  assert.ok(r.runner.replay);
  assert.equal(r.runner.replay.completedTicks, 625);
  assert.ok(r.runner.report);
  assert.equal(r.runner.report.winnerTeamId, "team.alpha");

  // Replay
  const recording = r.runner.replay;
  assert.equal(r.runner.startReplay(recording), true);
  assert.equal(r.runner.isReplay, true);
  for (let t = 0; t < 1300 && r.runner.state !== "finished"; t++) {
    await r.step();
  }
  assert.equal(r.runner.state, "finished");
  assert.equal(r.runner.view?.result?.winnerTeamId, "team.alpha");
  r.runner.close();
});
