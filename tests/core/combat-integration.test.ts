import test from "node:test";import assert from "node:assert/strict";
import {ApplicationController} from "@robots/application-host";
import {combatRecipe} from "../../apps/game/composition.ts";
import content from "../../content/scenarios/combat-mvp-v1.json" with {type:"json"};
import {validateMessage} from "@robots/protocol/presentation/v2";
import type {CombatView} from "@robots/protocol/presentation/v2";
export function runCombat(bundle:unknown=content,max=1300){
 const controller=new ApplicationController({instanceId:"combat-test",runtime:"node24",recipe:combatRecipe()});
 assert.deepEqual(controller.request({requestId:"start",seed:"0123456789abcdef",content:bundle,selection:{scenarioId:"combat-mvp-v1"}}),{ok:true,contextId:"combat-test:1"});
 const views:CombatView[]=[];
 for(let t=0;t<max;t++){
  const result=controller.advance();assert.ok(result.ok,JSON.stringify({result,snapshot:controller.snapshot()}));
  const raw=controller.snapshot().observations.presentation;
  if(raw){const view=validateMessage(raw);views.push(view);if(view.stage==="FINISHED")return {controller,views,final:view};}
 }
 throw new Error("Battle never completed");
}
test("real seven-system encounter moves, shoots and ends with the expected winner and coherent final cut",()=>{
 const {controller,views,final}=runCombat();assert.equal(final.result?.winnerTeamId,"team.alpha");assert.equal(final.result?.finishedTick,623);assert.equal(final.observedTick,623);assert.equal(final.combatants[0]!.integrityUnits,20000);assert.equal(final.combatants[1]!.status,"DEFEATED");
 assert.equal(views[0]!.stage,"READY");assert.equal(views[0]!.observedTick,1);assert.equal(final.started?.startedTick,2);
 const initialMoves=views.find(v=>v.movements.length===2)!;assert.equal(initialMoves.observedTick,2);assert.deepEqual(initialMoves.movements.map(m=>[m.robotId,m.to]),[["alpha",{q:2,r:2}],["beta",{q:4,r:2}]]);
 assert.ok(views.some(v=>v.events.some(e=>e.kind==="ATTACK"&&e.tick===3)));assert.equal(final.damageRevision,64);
 for(const v of views){assert.ok(Buffer.byteLength(JSON.stringify(v))<=65536);assert.ok(v.events.length<=64);assert.ok(v.events.every(e=>e.tick<=v.observedTick));}
 assert.equal(controller.snapshot().progress?.nextTick,625);controller.close();
});
test("equal-HP encounter resolves both final hits before declaring a draw",()=>{const c=structuredClone(content);c.definitions.chassis.find(x=>x.id==="chassis.mvp-beta")!.integrityUnits=100000;const {controller,final}=runCombat(c);assert.equal(final.result?.outcome,"DRAW");assert.equal(final.result?.reason,"ELIMINATION");assert.ok(final.combatants.every(r=>r.integrityUnits===0));assert.equal(final.damageRevision,80);controller.close();});
