import test from "node:test";
import assert from "node:assert/strict";
import * as w from "../src/weapons/v1.ts";
import * as d from "../src/damage/v1.ts";
import * as b from "../src/battle/v1.ts";
import * as p from "../src/perception/v1.ts";
import * as a from "../src/decision/v1.ts";
const ref={battleId:"battle",attackerRobotId:"a",targetRobotId:"b",weaponSlotId:"weapon-a",requestSequence:1};
const robots=[{robotId:"a",teamId:"red",integrityUnits:1000,maxIntegrityUnits:1000,status:"ACTIVE"},{robotId:"b",teamId:"blue",integrityUnits:0,maxIntegrityUnits:1000,status:"DEFEATED"}];
test("attack contracts reject unknown fields, bad integers and malformed identifiers without invoking getters",()=>{
 const valid={...ref,observationTick:2};
 assert.deepEqual(w.validateMessage("RequestAttack",valid),valid);
 for(const invalid of [{...valid,extra:true},{...valid,requestSequence:1.5},{...valid,battleId:"bad id"}])
  assert.throws(()=>w.validateMessage("RequestAttack",invalid));
 let invoked=false;assert.throws(()=>w.validateMessage("RequestAttack",Object.defineProperty({}, "battleId",{get(){invoked=true;return "battle";},enumerable:true})));
 assert.equal(invoked,false);
});
test("weapons acceptance carries authoritative cooldown and closed rejection reasons",()=>{
 assert.throws(()=>w.validateMessage("AttackAccepted",{...ref,observationTick:2,acceptedTick:2,readyAtTick:2,duplicate:false}));
 assert.throws(()=>w.validateMessage("AttackRejected",{...ref,resolvedTick:2,reasonCode:"invented",duplicate:false}));
 assert.throws(()=>w.validateInitialView({battleId:"battle",boardId:"board",weapons:[]}));
});
test("damage contracts reject fabricated HP/status, duplicate robots and impossible applications",()=>{
 const impact={...ref,acceptedTick:2,resolvedTick:2,requestedImpactUnits:2500,appliedImpactUnits:1000,integrityUnits:0,maxIntegrityUnits:1000,targetStatus:"DEFEATED",damageRevision:1,duplicate:false};
 assert.deepEqual(d.validateMessage("ImpactResolved",impact),impact);
 assert.throws(()=>d.validateMessage("ImpactResolved",{...impact,targetStatus:"ACTIVE"}));
 assert.throws(()=>d.validateMessage("ImpactResolved",{...impact,appliedImpactUnits:3000}));
 assert.throws(()=>d.validateMessage("DamageRosterInitialized",{battleId:"battle",effectiveTick:1,damageRevision:0,robots:[robots[0],robots[0]]}));
});
test("battle result must agree with surviving team and draw omits a winner",()=>{
 const result={battleId:"battle",finishedTick:10,outcome:"WIN",winnerTeamId:"red",reason:"ELIMINATION",damageRevision:1,robots};
 assert.deepEqual(b.validateMessage("BattleFinished",result),result);
 assert.throws(()=>b.validateMessage("BattleFinished",{...result,winnerTeamId:"blue"}));
 assert.throws(()=>b.validateMessage("BattleFinished",{...result,outcome:"DRAW"}));
 assert.throws(()=>b.validateMessage("BattleStarted",{battleId:"battle",startedTick:2,maxBattleTicks:1200,participants:[{robotId:"a",teamId:"red"},{robotId:"b",teamId:"red"}]}));
});
test("observations and explanations validate freshness fields and explicit absence",()=>{
 assert.throws(()=>p.validateMessage("RobotObservationPublished",{battleId:"battle",boardId:"board",robotId:"a",observedTick:2,worldTick:3,boardRevision:0,damageRevision:0,self:{position:{q:0,r:0},robotRevision:0,status:"ACTIVE"},visibleRobots:[]}));
 assert.throws(()=>a.validateMessage("AIDecisionPublished",{battleId:"battle",robotId:"a",decisionTick:2,actionKind:"ATTACK",reasonCode:"TARGET_IN_RANGE"}));
 assert.deepEqual(a.validateMessage("AIDecisionPublished",{battleId:"battle",robotId:"a",decisionTick:2,actionKind:"WAIT",reasonCode:"NO_OBSERVATION"}).actionKind,"WAIT");
});
test("public definitions are immutable and contain no session permissions",()=>{
 const defs=[...w.WEAPONS_MESSAGES,...d.DAMAGE_MESSAGES,...b.BATTLE_MESSAGES,...p.PERCEPTION_MESSAGES,...a.DECISION_MESSAGES];
 assert.equal(defs.length,11);
 for(const def of defs){assert.ok(Object.isFrozen(def));assert.deepEqual(Object.keys(def).sort(),["fields","kind","type","version"]);}
});


test("combat presentation requires a coherent stage and rejects extra fields in history variants",async()=>{
 const v2=await import("../src/presentation/v2.ts");
 const view={contextId:"ctx",battleId:"battle",boardId:"board",sequence:1,observedTick:2,
 world:{boardId:"board",width:2,height:1,tiles:[{q:0,r:0,terrainId:"terrain.floor",passable:true},{q:1,r:0,terrainId:"terrain.floor",passable:true}],robots:[{robotId:"a",definitionId:"robot.a",q:0,r:0,moveCooldownTicks:1,robotRevision:0,readyAtTick:0},{robotId:"b",definitionId:"robot.b",q:1,r:0,moveCooldownTicks:1,robotRevision:0,readyAtTick:0}],boardRevision:0,effectiveTick:1},
 assemblies:[{robotId:"a",chassisResourceId:"resource.chassis",parts:[]},{robotId:"b",chassisResourceId:"resource.chassis",parts:[]}],
 movements:[],damageRevision:0,combatants:robots.map(r=>({...r,integrityUnits:1000,status:"ACTIVE"})),stage:"READY",events:[]};
 assert.deepEqual(v2.validateMessage(view),view);
 assert.throws(()=>v2.validateMessage({...view,stage:"FINISHED"}));
 assert.throws(()=>v2.validateMessage({...view,observedTick:0}));
 assert.throws(()=>v2.validateMessage({...view,events:[{kind:"ATTACK",tick:2,sourceMessageId:12,robotId:"a",targetRobotId:"b",weaponSlotId:"weapon-a",amountUnits:999}]}));
 assert.throws(()=>v2.validateMessage({...view,combatants:[robots[0],robots[0]]}));
 assert.throws(()=>v2.validateMessage({...view,events:[{kind:"MOVE",tick:2,sourceMessageId:12,robotId:"intruder",from:{q:0,r:0},to:{q:1,r:0}}]}));
 assert.throws(()=>v2.validateMessage({...view,events:[{kind:"MOVE",tick:2,sourceMessageId:12,robotId:"a",from:{q:-1,r:0},to:{q:0,r:0}}]}));
});
test("rosters have canonical robot order",()=>{assert.throws(()=>d.validateMessage("DamageRosterInitialized",{battleId:"battle",effectiveTick:1,damageRevision:0,robots:[...robots].reverse().map(r=>({...r,integrityUnits:1000,status:"ACTIVE"}))}));});
