import test from "node:test";import assert from "node:assert/strict";
import type {Actor,Message,Payload,Phase} from "@robots/system-api";
import {createWeaponsActor} from "../src/index.ts";
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

const robots=[{robotId:"a",teamId:"red",integrityUnits:1000,maxIntegrityUnits:1000,status:"ACTIVE"},{robotId:"b",teamId:"blue",integrityUnits:1000,maxIntegrityUnits:1000,status:"ACTIVE"}];
const world={boardId:"board",width:5,height:1,tiles:Array.from({length:5},(_,q)=>({q,r:0,passable:true,terrainId:"terrain.floor"})),robots:robots.map((r,i)=>({robotId:r.robotId,definitionId:"robot.test",q:i*3,r:0,moveCooldownTicks:3,robotRevision:0,readyAtTick:0})),boardRevision:0,effectiveTick:1};
const initial={battleId:"battle",boardId:"board",weapons:robots.map(r=>({robotId:r.robotId,weaponSlotId:"weapon-a",impactUnits:2500,reloadTicks:20,rangeHexes:3}))};
const request={battleId:"battle",attackerRobotId:"a",targetRobotId:"b",weaponSlotId:"weapon-a",requestSequence:1,observationTick:2};
function setup(){const r=rig(createWeaponsActor,initial,"action");r.feed("NavigationWorldReady",world,1);r.feed("DamageRosterInitialized",{battleId:"battle",effectiveTick:1,damageRevision:0,robots},1);r.feed("BattleStarted",{battleId:"battle",startedTick:2,maxBattleTicks:1200,participants:robots.map(({robotId,teamId})=>({robotId,teamId}))},2,1);return r;}
function observe(r:ReturnType<typeof setup>,at:number){r.feed("RobotObservationPublished",{battleId:"battle",boardId:"board",robotId:"a",observedTick:at,worldTick:1,boardRevision:0,damageRevision:0,self:{position:{q:0,r:0},robotRevision:0,status:"ACTIVE"},visibleRobots:[{robotId:"b",teamId:"blue",position:{q:3,r:0},robotRevision:0,distanceHexes:3,status:"ACTIVE"}]},at);}
test("acceptance consumes cooldown and an identical retry cannot generate another impact",()=>{
 const r=setup();observe(r,2);r.feed("RequestAttack",request);r.loop(2);
 assert.equal(r.of("AttackAccepted").length,1);assert.equal(r.of("ImpactRequested").length,1);assert.equal(r.of("AttackAccepted")[0]!.payload.readyAtTick,22);
 r.feed("RequestAttack",request,3);r.loop(3);assert.equal(r.of("AttackAccepted").at(-1)!.payload.duplicate,true);assert.equal(r.of("ImpactRequested").length,1);
 observe(r,3);r.feed("RequestAttack",{...request,requestSequence:2,observationTick:3},3);r.loop(3);assert.equal(r.of("AttackRejected").at(-1)!.payload.reasonCode,"WEAPON_NOT_READY");
 observe(r,22);r.feed("RequestAttack",{...request,requestSequence:3,observationTick:22},22);r.loop(22);assert.equal(r.of("ImpactRequested").length,2);
});
test("action evaluates movement received after the intention and rejects stale observation",()=>{
 const r=setup();observe(r,2);r.feed("RequestAttack",request);
 r.feed("NavigationStepResolved",{boardId:"board",requestBoardId:"board",robotId:"b",requestSequence:1,accepted:true,reason:"MOVED",duplicate:false,resolvedTick:2,boardRevision:1,from:{q:3,r:0},to:{q:4,r:0},robotState:{position:{q:4,r:0},robotRevision:1,readyAtTick:5}});r.loop(2);
 assert.equal(r.of("AttackRejected")[0]!.payload.reasonCode,"OUT_OF_RANGE");assert.equal(r.of("ImpactRequested").length,0);
 r.feed("RequestAttack",{...request,requestSequence:2},3);r.loop(3);assert.equal(r.of("AttackRejected").at(-1)!.payload.reasonCode,"STALE_OBSERVATION");
});

test("bounded weapon cache expires forgotten sequences and rejects conflicting retry bodies",()=>{
 const r=setup();for(let seq=1;seq<=65;seq++){const tick=seq+1;observe(r,tick);r.feed("RequestAttack",{...request,requestSequence:seq,observationTick:tick},tick);r.loop(tick);}
 r.feed("RequestAttack",{...request,requestSequence:2,observationTick:3},67);r.loop(67);assert.equal(r.of("AttackRejected").at(-1)!.payload.duplicate,true);
 r.feed("RequestAttack",{...request,observationTick:68},68);r.loop(68);assert.equal(r.of("AttackRejected").at(-1)!.payload.reasonCode,"REQUEST_EXPIRED");
 r.feed("RequestAttack",{...request,requestSequence:65,weaponSlotId:"other",observationTick:69},69);r.loop(69);assert.equal(r.of("AttackRejected").at(-1)!.payload.reasonCode,"REQUEST_CONFLICT");
 assert.equal(r.of("ImpactRequested").length,4);
});
