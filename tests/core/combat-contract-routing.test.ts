import test from "node:test";import assert from "node:assert/strict";
import {ApplicationController} from "@robots/application-host";import {Session} from "@robots/runtime";import {bindMessage} from "@robots/application-host/bindings";import type {Payload,Publisher} from "@robots/system-api";
import {combatRecipe} from "../../apps/game/composition.ts";
import content from "../../content/scenarios/combat-mvp-v1.json" with {type:"json"};
import {PRESENTATION_MESSAGES,validateMessage} from "@robots/protocol/presentation/v2";
import type {CombatView} from "@robots/protocol/presentation/v2";
import {beginContextDefinition,initializationDefinition} from "@robots/protocol/application/v1";
import {read} from "@robots/protocol/weapons/v1";
const bytes=(v:unknown)=>Buffer.byteLength(JSON.stringify(v));
test("real deferred routes consume observations, attacks and damage in their declared phases under one root",()=>{
 const c=new ApplicationController({instanceId:"routing",runtime:"node24",recipe:combatRecipe()});
 assert.ok(c.request({requestId:"start",seed:"0123456789abcdef",content,selection:{scenarioId:"combat-mvp-v1"}}).ok);
 for(let t=0;t<6;t++)assert.ok(c.advance().ok);
 const entries=c.trace()!.entries,published=entries.flatMap(e=>e.kind==="published"?[e.message]:[]),types=new Map(published.map(m=>[m.messageId,m.type]));
 const checks:[string,string,string,number][]=[["RequestAttack","weapons","action",3],["ImpactRequested","damage","resolution",3],["ImpactResolved","battle","publication",3],["AttackAccepted","decision","decision",4],["NavigationStepResolved","perception","perception",3],["PresentationViewPublished","app-output","publication",2]];
 for(const [type,receiver,phase,tick] of checks)assert.ok(entries.some(e=>e.kind==="consumption_finished"&&types.get(e.messageId)===type&&e.receiver===receiver&&e.phase===phase&&e.tick===tick),type);
 assert.equal(new Set(published.map(m=>m.correlationId)).size,1);c.close();
});
function worstView():CombatView {
 const max=Number.MAX_SAFE_INTEGER,id=(prefix:string)=>prefix.padEnd(64,"x"),resource="resource."+ "r".repeat(119),robotDef="robot."+"r".repeat(122),terrain="terrain."+"t".repeat(120);
 const a=id("a"),b=id("b"),ta=id("team.a"),tb=id("team.b"),boardId=id("board"),battleId=id("battle");
 const robots=[{robotId:a,teamId:ta,integrityUnits:max,maxIntegrityUnits:max,status:"ACTIVE"},{robotId:b,teamId:tb,integrityUnits:0,maxIntegrityUnits:max,status:"DEFEATED"}];
 const world={boardId,width:12,height:12,effectiveTick:max,boardRevision:max,tiles:Array.from({length:144},(_,i)=>({q:i%12,r:Math.floor(i/12),passable:true,terrainId:terrain})),robots:[a,b].map((robotId,i)=>({robotId,definitionId:robotDef,q:i?11:0,r:11,moveCooldownTicks:max,robotRevision:max,readyAtTick:max}))};
 return validateMessage({contextId:"\u0000".repeat(128),battleId,boardId,sequence:max,observedTick:max,world,assemblies:[a,b].map(robotId=>({robotId,chassisResourceId:resource,parts:Array.from({length:5},(_,i)=>({slotId:id("slot"+i),socketId:id("socket"+i),resourceId:resource}))})),movements:[a,b].map((robotId,i)=>({boardId,requestBoardId:boardId,robotId,requestSequence:max,accepted:true,reason:"MOVED",duplicate:false,resolvedTick:max,boardRevision:max,from:{q:i?10:1,r:11},to:{q:i?11:0,r:11},robotState:{position:{q:i?11:0,r:11},robotRevision:max,readyAtTick:max},sourceMessageId:max-i})),damageRevision:max,combatants:robots,stage:"FINISHED",started:{battleId,startedTick:0,maxBattleTicks:max,participants:[{robotId:a,teamId:ta},{robotId:b,teamId:tb}]},result:{battleId,finishedTick:max,outcome:"WIN",winnerTeamId:ta,reason:"ELIMINATION",damageRevision:max,robots},events:Array.from({length:64},(_,i)=>({kind:"DAMAGE",tick:max,sourceMessageId:max-63+i,robotId:a,targetRobotId:b,weaponSlotId:id("weapon"),amountUnits:max,integrityUnits:max}))});
}
test("maximum combat collections and escaped context fit the unchanged 65536-byte bus budget",t=>{
 const view=worstView();t.diagnostic("Largest collections projection: "+bytes(view)+" bytes");assert.ok(bytes(view)<=65536, String(bytes(view)));assert.equal(view.events.length,64);assert.equal(view.world.tiles.length,144);assert.equal(view.assemblies[0]!.parts.length,5);
 let publisher!:Publisher,received=0;
 const s=new Session({sessionId:"budget",revision:"budget-v1",runtime:"node24",contracts:[bindMessage(PRESENTATION_MESSAGES[0]!,{producers:[{systemId:"producer",phases:["action"]}]})],systems:[{id:"producer",loopPhase:"action",loop(){publisher.emit("PresentationViewPublished",2,view as unknown as Payload);}},{id:"observer"}]});
 publisher=s.publisher("producer");s.subscribe("observer","PresentationViewPublished",2,"publication",m=>{validateMessage(m.payload);received++;});s.start();s.advanceTick();assert.equal(received,1);s.close();
});
test("combined Begin with seven maximum initial views remains admissible without enlarging limits",t=>{
 const max=Number.MAX_SAFE_INTEGER,id=(p:string)=>p.padEnd(64,"x"),view=worstView(),recipe=combatRecipe(),board=view.world;
 const identity={contextId:"\u0000".repeat(128),attemptId:max,bundleId:"bundle."+ "b".repeat(121),contentRevision:"r".repeat(128)};
 const ids=board.robots.map(r=>r.robotId),battleId=view.battleId,boardId=view.boardId;
 const views={navigation:{boardId,width:12,height:12,tiles:board.tiles,robots:board.robots.map(({robotRevision,readyAtTick,...r})=>r)},damage:{battleId,robots:view.combatants.map(({status,...r})=>({...r,integrityUnits:max}))},weapons:{battleId,boardId,weapons:ids.map(robotId=>({robotId,weaponSlotId:id("weapon"),impactUnits:max,reloadTicks:max,rangeHexes:max}))},perception:{battleId,boardId,sensors:ids.map(robotId=>({robotId,rangeHexes:max}))},decision:{battleId,boardId,robots:ids.map(robotId=>({robotId,weaponSlotId:id("weapon"),behaviorId:"fixture.pressure-v1",rangeHexes:max}))},battle:{battleId,boardId,participants:view.started!.participants,maxBattleTicks:1200,startMaxTicks:10},presentation:{battleId,boardId,assemblies:view.assemblies}};
 const fields=Object.fromEntries(recipe.participants.map(p=>[p.id,{type:"object" as const,fields:p.fields}]));
 for(const p of recipe.participants)read({...identity,view:views[p.id as keyof typeof views]},initializationDefinition(p.initializationType,p.fields).fields);
 const begin={...identity,requiredParticipants:recipe.participants.map(p=>p.id),initializationMaxTicks:10,views};read(begin,beginContextDefinition(fields).fields);t.diagnostic("Combined Begin: "+bytes(begin)+" bytes");assert.ok(bytes(begin)<=65536,String(bytes(begin)));
});
