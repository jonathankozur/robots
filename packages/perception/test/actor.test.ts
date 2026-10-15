import test from "node:test";import assert from "node:assert/strict";import type {Actor,Message,Payload,Phase} from "@robots/system-api";import {createPerceptionActor} from "../src/index.ts";
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
const world={boardId:"board",width:3,height:1,tiles:Array.from({length:3},(_,q)=>({q,r:0,passable:true,terrainId:"terrain.floor"})),robots:participants.map((r,i)=>({robotId:r.robotId,definitionId:"robot.test",q:i*2,r:0,moveCooldownTicks:3,robotRevision:0,readyAtTick:0})),boardRevision:0,effectiveTick:1};
function setup(w=world,range=2){const r=rig(createPerceptionActor,{battleId:"battle",boardId:"board",sensors:participants.map(p=>({robotId:p.robotId,rangeHexes:range}))},"perception");
 r.feed("NavigationWorldReady",w,1);r.feed("DamageRosterInitialized",{battleId:"battle",effectiveTick:1,damageRevision:0,robots:participants.map(p=>({...p,integrityUnits:1000,maxIntegrityUnits:1000,status:"ACTIVE"}))},1);
 r.feed("BattleStarted",{battleId:"battle",startedTick:2,maxBattleTicks:1200,participants},2,1);return r;}
test("fresh observations include a rival exactly at sensor range, every active tick",()=>{const r=setup();r.loop(2);assert.equal(r.of("RobotObservationPublished").length,2);const p=r.of("RobotObservationPublished")[0]!.payload;assert.equal((p.visibleRobots as any[])[0].distanceHexes,2);r.loop(3);assert.equal(r.of("RobotObservationPublished").at(-1)!.payload.observedTick,3);});
test("opaque terrain and range hide rivals without remembering an old target",()=>{for(const r of [setup(world,1),setup({...world,tiles:world.tiles.map(t=>({...t,passable:t.q!==1}))})]){r.loop(2);assert.deepEqual(r.of("RobotObservationPublished")[0]!.payload.visibleRobots,[]);}});
test("contiguous damage updates hide defeated robots and revision gaps fail",()=>{const r=setup();r.feed("ImpactResolved",{battleId:"battle",attackerRobotId:"a",targetRobotId:"b",weaponSlotId:"weapon-a",requestSequence:1,acceptedTick:2,resolvedTick:2,duplicate:false,requestedImpactUnits:1000,appliedImpactUnits:1000,integrityUnits:0,maxIntegrityUnits:1000,targetStatus:"DEFEATED",damageRevision:1},3,2);r.loop(3);assert.deepEqual(r.of("RobotObservationPublished")[0]!.payload.visibleRobots,[]);assert.throws(()=>r.feed("ImpactResolved",{battleId:"battle",attackerRobotId:"b",targetRobotId:"a",weaponSlotId:"weapon-a",requestSequence:1,acceptedTick:3,resolvedTick:3,duplicate:false,requestedImpactUnits:1000,appliedImpactUnits:1000,integrityUnits:0,maxIntegrityUnits:1000,targetStatus:"DEFEATED",damageRevision:3},4,3),{code:"COM_VIEW_CONFLICT"});});
