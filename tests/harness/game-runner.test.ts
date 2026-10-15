import test from "node:test";import assert from "node:assert/strict";
import {ApplicationController} from "@robots/application-host";import {combatRecipe} from "../../apps/game/composition.ts";import {GameRunner} from "../../apps/game/runner.ts";
import content from "../../content/scenarios/combat-mvp-v1.json" with {type:"json"};
function setup(prepare=async()=>{}){
 const controller=new ApplicationController({instanceId:"runner",runtime:"node24",recipe:combatRecipe()});const tasks=new Map<number,()=>void>();let id=0;
 const runner=new GameRunner(controller,{requestId:"start",seed:"0123456789abcdef",content,selection:{scenarioId:"combat-mvp-v1"}},{prepare,accept(){},change(){}},{set(cb,ms){assert.equal(ms,50);tasks.set(++id,cb);return id;},clear(id){tasks.delete(id as number);}});
 async function step(){assert.equal(tasks.size,1);const [id,cb]=tasks.entries().next().value!;tasks.delete(id);cb();await Promise.resolve();await Promise.resolve();}
 return {controller,runner,tasks,step};
}
test("single start and one timer; renderer preparation holds simulation at a complete tick",async()=>{
 let release!:()=>void;const r=setup(()=>new Promise<void>(resolve=>{release=resolve;}));assert.equal(r.runner.start(),true);assert.equal(r.runner.start(),false);await r.step();await r.step();await r.step();assert.equal(r.tasks.size,0);assert.equal(r.controller.snapshot().progress?.nextTick,3);assert.equal(r.runner.state,"loading");release();await Promise.resolve();await Promise.resolve();assert.equal(r.tasks.size,1);r.runner.close();assert.equal(r.tasks.size,0);
});
test("runner drains the terminal projection then stops with final life retained",async()=>{const r=setup();r.runner.start();for(let t=0;t<1300&&r.runner.state!=="finished";t++)await r.step();assert.equal(r.runner.state,"finished");assert.equal(r.runner.view?.result?.finishedTick,623);assert.equal(r.controller.snapshot().progress?.nextTick,625);assert.equal(r.tasks.size,0);r.runner.close();});
test("closing during loading prevents late tasks, and a visual failure cannot become a combat result",async()=>{let release!:()=>void;const r=setup(()=>new Promise<void>(resolve=>{release=resolve;}));r.runner.start();await r.step();await r.step();await r.step();r.runner.close();release();await Promise.resolve();await Promise.resolve();assert.equal(r.tasks.size,0);assert.equal(r.runner.state,"closed");const failed=setup(async()=>{throw Error("asset unavailable");});failed.runner.start();await failed.step();await failed.step();await failed.step();await Promise.resolve();assert.equal(failed.runner.state,"error");assert.equal(failed.runner.view?.result,undefined);assert.equal(failed.tasks.size,0);failed.runner.close();});
