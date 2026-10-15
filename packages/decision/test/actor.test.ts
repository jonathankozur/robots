import test from "node:test";import assert from "node:assert/strict";import type {Actor,Message,Payload,Phase} from "@robots/system-api";import {createDecisionActor} from "../src/index.ts";
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
const world={boardId:"board",width:6,height:1,tiles:Array.from({length:6},(_,q)=>({q,r:0,passable:true,terrainId:"terrain.floor"})),robots:participants.map((r,i)=>({robotId:r.robotId,definitionId:"robot.test",q:i*3,r:0,moveCooldownTicks:3,robotRevision:0,readyAtTick:0})),boardRevision:0,effectiveTick:1};
function setup(){const r=rig(createDecisionActor,{battleId:"battle",boardId:"board",robots:[{robotId:"a",behaviorId:"fixture.observe-v1",weaponSlotId:"weapon-a",rangeHexes:3},{robotId:"b",behaviorId:"fixture.pressure-v1",weaponSlotId:"weapon-a",rangeHexes:3}]},"decision");r.feed("NavigationWorldReady",world,1);r.feed("BattleStarted",{battleId:"battle",startedTick:2,maxBattleTicks:1200,participants},2,1);return r;}
function observe(r:ReturnType<typeof setup>,id="a",at=2,visible=true){const a=id==="a";r.feed("RobotObservationPublished",{battleId:"battle",boardId:"board",robotId:id,observedTick:at,worldTick:1,boardRevision:0,damageRevision:0,self:{position:{q:a?0:3,r:0},robotRevision:0,status:"ACTIVE"},visibleRobots:visible?[{robotId:a?"b":"a",teamId:a?"blue":"red",position:{q:a?3:0,r:0},robotRevision:0,status:"ACTIVE",distanceHexes:3}]:[]},at);}
test("observe moves and shoots in range; pressure holds its firing distance",()=>{const r=setup();observe(r);observe(r,"b");r.loop(2);assert.equal(r.of("RequestNavigationStep").length,1);assert.equal(r.of("RequestNavigationStep")[0]!.payload.robotId,"a");assert.deepEqual(r.of("RequestNavigationStep")[0]!.payload.to,{q:1,r:0});assert.equal(r.of("RequestAttack").length,2);assert.deepEqual(r.output.filter(m=>["RequestNavigationStep","RequestAttack","AIDecisionPublished"].includes(m.type)).map(m=>m.type),["RequestNavigationStep","AIDecisionPublished","RequestAttack","AIDecisionPublished","RequestAttack","AIDecisionPublished"]);});
test("NAV never supplies a hidden target and unchanged waits are not repeated",()=>{const r=setup();r.loop(2);r.loop(3);assert.equal(r.of("RequestNavigationStep").length,0);assert.equal(r.of("RequestAttack").length,0);assert.equal(r.of("AIDecisionPublished").length,2);observe(r,"a",4,false);r.loop(4);assert.equal(r.of("AIDecisionPublished").at(-1)!.payload.reasonCode,"NO_VISIBLE_TARGET");});
test("missing attack acknowledgment fails instead of silently waiting forever",()=>{const r=setup();observe(r);r.loop(2);assert.equal(r.of("RequestAttack").length,1);assert.throws(()=>r.loop(3),{code:"DECISION_ACK_MISSING"});});
test("accepted acknowledgment carries exact cooldown and contradictory acknowledgment fails",()=>{const r=setup();observe(r);r.loop(2);r.feed("AttackAccepted",{...r.of("RequestAttack")[0]!.payload,acceptedTick:2,readyAtTick:22,duplicate:false},3,2);observe(r,"a",3);r.loop(3);assert.equal(r.of("RequestAttack").length,1);const other=setup();observe(other);other.loop(2);assert.throws(()=>other.feed("AttackAccepted",{...other.of("RequestAttack")[0]!.payload,targetRobotId:"a",acceptedTick:2,readyAtTick:22,duplicate:false},3,2),{code:"DECISION_ACK_INVALID"});});
