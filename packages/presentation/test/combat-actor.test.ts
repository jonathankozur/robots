import test from "node:test";import assert from "node:assert/strict";import type {Actor,Message,Payload,Phase} from "@robots/system-api";import {createCombatPresentationActor} from "../src/combat-actor.ts";
const identity={contextId:"ctx",attemptId:1,bundleId:"bundle.test",contentRevision:"test-1"};
function rig(create:(identity:Payload,context:{systemId:string})=>Actor,initial:unknown,initPhase:Phase="resolution",systemId="renamed-owner"){
 let tick=0,phase:Phase=initPhase,sequence=0;
 const output:Message[]=[];
 function message(type:string,payload:unknown,source="fixture",emittedTick=tick):Message{
  const copy=(v:any):any=>v&&typeof v==="object"?Object.freeze(Array.isArray(v)?v.map(copy):Object.fromEntries(Object.entries(v).map(([k,x])=>[k,copy(x)]))):v;
  return Object.freeze({messageId:++sequence,sessionId:"ctx",type,contractVersion:1,sourceSystemId:source,emittedTick,emittedPhase:phase,correlationId:1,causationIds:Object.freeze([]),payload:copy(payload)});
 }
 const emit=(type:string,version:number,payload:Payload,options?:{causes?:readonly Message[]})=>{
  const m=message(type,payload,systemId);output.push(Object.freeze({...m,contractVersion:version,causationIds:Object.freeze((options?.causes??[]).map(c=>c.messageId))}));return m.messageId;
 };
 const actor=create(identity,{systemId});actor.connect(Object.freeze({emit,send:emit}));
 actor.initialize(message("InitializeFixture",{...identity,view:initial},"app-coordinator"),{tick,phase});
 tick=1;phase="input";actor.activate(message("ApplicationContextReady",{...identity,participants:[systemId]},"app-coordinator",0),{tick,phase});
 return {actor,output,
  feed(type:string,payload:unknown,at=2,emittedTick=at){
   const sub=actor.subscriptions?.find(s=>s.type===type&&s.version===1);assert.ok(sub,"Missing subscription "+type);
   tick=at;phase=sub.phase;const m=message(type,payload,"fixture",emittedTick);sub.handler(m,{tick,phase});return m;
  },
  loop(at:number){tick=at;phase=actor.loopPhase!;actor.loop?.({tick,phase});},
  of(type:string){return output.filter(m=>m.type===type);},
 };
}

const participants=[{robotId:"a",teamId:"red"},{robotId:"b",teamId:"blue"}];
const robots=participants.map(p=>({...p,integrityUnits:1000,maxIntegrityUnits:1000,status:"ACTIVE"}));
const world={boardId:"board",width:3,height:1,tiles:[0,1,2].map(q=>({q,r:0,passable:true,terrainId:"terrain.floor"})),robots:participants.map((r,i)=>({robotId:r.robotId,definitionId:"robot.test",q:i*2,r:0,moveCooldownTicks:3,robotRevision:0,readyAtTick:0})),boardRevision:0,effectiveTick:1};
function setup(){const r=rig(createCombatPresentationActor,{battleId:"battle",boardId:"board",assemblies:participants.map(p=>({robotId:p.robotId,chassisResourceId:"resource.chassis",parts:[]}))},"action");r.feed("NavigationWorldReady",world,1);r.feed("DamageRosterInitialized",{battleId:"battle",effectiveTick:1,damageRevision:0,robots},2,1);r.feed("BattleStarted",{battleId:"battle",startedTick:2,maxBattleTicks:1200,participants},2,1);return r;}
test("projection publishes the previous complete cut and terminal HP together with movement",()=>{
 const r=setup();r.loop(2);assert.equal(r.of("PresentationViewPublished")[0]!.contractVersion,2);assert.equal(r.of("PresentationViewPublished")[0]!.payload.stage,"READY");
 r.feed("NavigationStepResolved",{boardId:"board",requestBoardId:"board",robotId:"a",requestSequence:1,accepted:true,reason:"MOVED",duplicate:false,resolvedTick:2,boardRevision:1,from:{q:0,r:0},to:{q:1,r:0},robotState:{position:{q:1,r:0},robotRevision:1,readyAtTick:5}},2);
 r.feed("ImpactResolved",{battleId:"battle",attackerRobotId:"a",targetRobotId:"b",weaponSlotId:"weapon-a",requestSequence:1,acceptedTick:2,resolvedTick:2,duplicate:false,requestedImpactUnits:1000,appliedImpactUnits:1000,integrityUnits:0,maxIntegrityUnits:1000,targetStatus:"DEFEATED",damageRevision:1},3,2);
 r.feed("BattleFinished",{battleId:"battle",finishedTick:2,outcome:"WIN",winnerTeamId:"red",reason:"ELIMINATION",damageRevision:1,robots:robots.map(p=>p.robotId==="b"?{...p,integrityUnits:0,status:"DEFEATED"}:p)},3,2);
 r.loop(3);const p=r.of("PresentationViewPublished").at(-1)!.payload as any;
 assert.equal(p.observedTick,2);assert.equal(p.world.robots[0].q,1);assert.equal(p.combatants[1].integrityUnits,0);assert.equal(p.stage,"FINISHED");assert.equal(p.movements.length,1);assert.deepEqual(p.events.map((e:any)=>e.kind),["MOVE","DAMAGE"]);
 r.loop(4);assert.equal(r.of("PresentationViewPublished").length,2);
});
test("recent events are bounded at 64 and every published payload is immutable",()=>{const r=setup();r.loop(2);for(let t=2;t<80;t++){r.feed("AIDecisionPublished",{battleId:"battle",robotId:"a",decisionTick:t,actionKind:"WAIT",reasonCode:"NO_VISIBLE_TARGET",observationTick:t},t);r.loop(t+1);}const p=r.of("PresentationViewPublished").at(-1)!.payload;assert.equal((p.events as any[]).length,64);assert.ok(Object.isFrozen(p.events));});
