import test from "node:test";import assert from "node:assert/strict";
import {ApplicationController} from "@robots/application-host";import {combatRecipe} from "../../apps/game/composition.ts";
import content from "../../content/scenarios/combat-mvp-v1.json" with {type:"json"};
function create(){return new ApplicationController({instanceId:"deterministic",runtime:"node24",recipe:combatRecipe()});}
function run(fps:number){
 const c=create();assert.ok(c.request({requestId:"start",seed:"0123456789abcdef",content,selection:{scenarioId:"combat-mvp-v1"}}).ok);
 let completed=0;
 for(let frame=1;completed<625;frame++){const due=Math.min(625,Math.floor(frame*20/fps));while(completed<due){assert.ok(c.advance().ok);completed++;}}
 assert.equal(c.trace()?.complete,true);assert.equal(c.trace()?.droppedEntries,0);return c;
}
test("30/60 visual frames and recorded replay preserve complete logical trace and final result",()=>{
 const a=run(30),b=run(60);assert.deepEqual(a.snapshot().observations,b.snapshot().observations);assert.deepEqual(a.trace(),b.trace());
 const recording=a.exportReplay();assert.equal(recording.completedTicks,625);const replay=create();assert.ok(replay.loadReplay(recording).ok);
 for(let t=0;t<recording.completedTicks;t++)assert.ok(replay.advance().ok);
 assert.deepEqual(replay.snapshot().observations,a.snapshot().observations);assert.deepEqual(replay.trace(),a.trace());
 const roots=new Set(a.trace()!.entries.flatMap(e=>e.kind==="published"?[e.message.correlationId]:[]));assert.equal(roots.size,1);
 const published=a.trace()!.entries.flatMap(e=>e.kind==="published"?[e.message]:[]);assert.equal(published.filter(m=>m.type==="BattleStarted").length,1);assert.equal(published.filter(m=>m.type==="BattleFinished").length,1);
 assert.ok(published.filter(m=>["RobotObservationPublished","RequestAttack","ImpactRequested","ImpactResolved","BattleFinished","PresentationViewPublished"].includes(m.type)).every(m=>m.causationIds.length>0));
 a.close();b.close();replay.close();
});
