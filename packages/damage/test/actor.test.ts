import test from "node:test";import assert from "node:assert/strict";
import type {Actor,Message,Payload,Phase} from "@robots/system-api";
import {createDamageActor} from "../src/index.ts";
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

const initial={battleId:"battle",robots:[{robotId:"a",teamId:"red",integrityUnits:1000,maxIntegrityUnits:1000},{robotId:"b",teamId:"blue",integrityUnits:1000,maxIntegrityUnits:1000}]};
const start={battleId:"battle",startedTick:2,maxBattleTicks:1200,participants:initial.robots.map(({robotId,teamId})=>({robotId,teamId}))};
const hit=(a="a",b="b",seq=1,units=2500)=>({battleId:"battle",attackerRobotId:a,targetRobotId:b,weaponSlotId:"weapon-a",requestSequence:seq,acceptedTick:2,impactUnits:units});
test("damage owns HP, emits its initialized roster and preserves assigned identity",()=>{
 const r=rig(createDamageActor,initial);r.loop(1);
 assert.equal(r.of("ApplicationParticipantInitialized")[0]!.payload.participantId,"renamed-owner");
 assert.deepEqual(r.of("DamageRosterInitialized")[0]!.payload.robots,initial.robots.map(x=>({...x,status:"ACTIVE"})));
 r.feed("BattleStarted",start,2,1);r.feed("ImpactRequested",hit());r.loop(2);
 const p=r.of("ImpactResolved")[0]!.payload;assert.equal(p.appliedImpactUnits,1000);assert.equal(p.integrityUnits,0);assert.equal(p.targetStatus,"DEFEATED");
 assert.equal(p.damageRevision,1);assert.ok(Object.isFrozen(p));
});
test("both lethal attacks resolve against the phase-start roster and duplicate cannot damage again",()=>{
 for(const reversed of [false,true]){
  const r=rig(createDamageActor,initial);r.loop(1);r.feed("BattleStarted",start,2,1);
  const attacks=[hit(),hit("b","a")];if(reversed)attacks.reverse();for(const p of attacks)r.feed("ImpactRequested",p);
  r.loop(2);assert.equal(r.of("ImpactResolved").length,2);assert.ok(r.of("ImpactResolved").every(m=>m.payload.targetStatus==="DEFEATED"));
  r.feed("ImpactRequested",attacks[0],3,3);
  // A duplicate refers to its original accepted tick, even if delivered again.
  r.loop(3);assert.equal(r.of("ImpactResolved").at(-1)!.payload.duplicate,true);assert.equal(r.of("ImpactResolved").at(-1)!.payload.damageRevision,1);
 }
});
test("invalid business impacts do not change HP and state is isolated",()=>{
 const r=rig(createDamageActor,initial),other=rig(createDamageActor,initial);r.loop(1);other.loop(1);r.feed("BattleStarted",start,2,1);
 r.feed("ImpactRequested",hit("a","b",1,0));r.loop(2);
 assert.equal(r.of("ImpactRejected")[0]!.payload.reasonCode,"NON_POSITIVE_IMPACT");
 assert.equal(r.of("ImpactResolved").length,0);assert.equal(other.of("ImpactResolved").length,0);
});
test("bounded damage cache distinguishes duplicate, conflict, expired and unknown participants",()=>{
 const r=rig(createDamageActor,initial);r.loop(1);r.feed("BattleStarted",start,2,1);
 for(let seq=1;seq<=65;seq++){const tick=seq+1;r.feed("ImpactRequested",{...hit("a","b",seq,1),acceptedTick:tick},tick);r.loop(tick);}
 r.feed("ImpactRequested",{...hit("a","b",2,1),acceptedTick:3},67);r.loop(67);assert.equal(r.of("ImpactResolved").at(-1)!.payload.duplicate,true);assert.equal(r.of("ImpactResolved").at(-1)!.payload.damageRevision,2);
 r.feed("ImpactRequested",{...hit("a","b",65,2),acceptedTick:68},68);r.loop(68);assert.equal(r.of("ImpactRejected").at(-1)!.payload.reasonCode,"REQUEST_CONFLICT");
 r.feed("ImpactRequested",{...hit("a","b",1,1),acceptedTick:69},69);r.loop(69);assert.equal(r.of("ImpactRejected").at(-1)!.payload.reasonCode,"REQUEST_EXPIRED");
 r.feed("ImpactRequested",{...hit("ghost","b",1,1),acceptedTick:70},70);r.loop(70);assert.equal(r.of("ImpactRejected").at(-1)!.payload.reasonCode,"ATTACKER_UNKNOWN");
 r.feed("ImpactRequested",{...hit("a","ghost",66,1),acceptedTick:71},71);r.loop(71);assert.equal(r.of("ImpactRejected").at(-1)!.payload.reasonCode,"TARGET_UNKNOWN");
});
