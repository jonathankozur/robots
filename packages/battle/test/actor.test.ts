import test from "node:test";import assert from "node:assert/strict";import type {Actor,Message,Payload,Phase} from "@robots/system-api";import {createBattleActor} from "../src/index.ts";
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
const initial={battleId:"battle",boardId:"board",participants,maxBattleTicks:3,startMaxTicks:2};
const world={boardId:"board",width:2,height:1,tiles:[0,1].map(q=>({q,r:0,passable:true,terrainId:"terrain.floor"})),robots:participants.map((r,q)=>({robotId:r.robotId,definitionId:"robot.test",q,r:0,moveCooldownTicks:3,robotRevision:0,readyAtTick:0})),boardRevision:0,effectiveTick:1};
function setup(){const r=rig(createBattleActor,initial);r.feed("NavigationWorldReady",world,1);r.feed("DamageRosterInitialized",{battleId:"battle",effectiveTick:1,damageRevision:0,robots:participants.map(p=>({...p,integrityUnits:1000,maxIntegrityUnits:1000,status:"ACTIVE"}))},1);return r;}
function hit(r:ReturnType<typeof setup>,target="b",rev=1,tick=4){r.feed("ImpactResolved",{battleId:"battle",attackerRobotId:target==="b"?"a":"b",targetRobotId:target,weaponSlotId:"weapon-a",requestSequence:1,acceptedTick:tick,resolvedTick:tick,duplicate:false,requestedImpactUnits:1000,appliedImpactUnits:1000,integrityUnits:0,maxIntegrityUnits:1000,targetStatus:"DEFEATED",damageRevision:rev},tick);}
test("barriers start at next tick and time limit includes its last combat tick",()=>{const r=setup();r.loop(1);assert.equal(r.of("BattleStarted")[0]!.payload.startedTick,2);r.loop(2);r.loop(3);assert.equal(r.of("BattleFinished").length,0);r.loop(4);assert.equal(r.of("BattleFinished")[0]!.payload.reason,"TIME_LIMIT");r.loop(5);assert.equal(r.of("BattleFinished").length,1);});
test("elimination on last tick takes precedence and both lethal results produce draw",()=>{for(const double of [false,true]){const r=setup();r.loop(1);hit(r);if(double)hit(r,"a",2);r.loop(4);const p=r.of("BattleFinished")[0]!.payload;assert.equal(p.reason,"ELIMINATION");assert.equal(p.outcome,double?"DRAW":"WIN");assert.equal(p.winnerTeamId,double?undefined:"red");}});
test("missing startup sources fail without synthesizing a winner",()=>{const r=rig(createBattleActor,initial);r.loop(1);assert.throws(()=>r.loop(2),{code:"BATTLE_START_LIMIT"});assert.equal(r.of("BattleFinished").length,0);});
