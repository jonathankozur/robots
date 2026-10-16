import {arr,obj,text,uint,frozen,definition,read,ensure,pair,id,choice} from "../weapons/v1.ts";
import {ROBOT_FIELDS,validateRoster} from "../damage/v1.ts";
import type {Combatant} from "../damage/v1.ts";
export interface Participant {readonly robotId:string;readonly teamId:string}
export interface InitialView {readonly battleId:string;readonly boardId:string;readonly participants:readonly Participant[];readonly maxBattleTicks:number;readonly startMaxTicks:number}
export interface Started {readonly battleId:string;readonly startedTick:number;readonly maxBattleTicks:number;readonly participants:readonly Participant[]}
export interface Finished {readonly battleId:string;readonly finishedTick:number;readonly outcome:"WIN"|"DRAW";readonly winnerTeamId?:string;readonly reason:"ELIMINATION"|"TIME_LIMIT";readonly damageRevision:number;readonly robots:readonly Combatant[]}
export const PARTICIPANT_FIELDS=frozen({robotId:text(),teamId:text()});
export const INITIAL_FIELDS=frozen({battleId:text(),boardId:text(),participants:arr(obj(PARTICIPANT_FIELDS)),maxBattleTicks:uint(1),startMaxTicks:uint(1)});
export const BATTLE_MESSAGES=frozen([
 definition("BattleStarted","event",{battleId:text(),startedTick:uint(),maxBattleTicks:uint(1),participants:arr(obj(PARTICIPANT_FIELDS))}),
 definition("BattleFinished","event",{battleId:text(),finishedTick:uint(),outcome:text(),winnerTeamId:{...text(),optional:true},reason:text(),damageRevision:uint(),robots:arr(obj(ROBOT_FIELDS))})
]);
export function validateInitialView(v:unknown):InitialView{
 const p=read<InitialView>(v,INITIAL_FIELDS);id(p.battleId);id(p.boardId);pair(p.participants,true);return p;
}
export function validateMessage(type:string,v:unknown):Started|Finished {
 const def=BATTLE_MESSAGES.find(d=>d.type===type);ensure(def);const p=read<Started|Finished>(v,def.fields);id(p.battleId);
 if(type==="BattleStarted"){const s=p as Started;pair(s.participants,true);ensure(s.maxBattleTicks-1<=Number.MAX_SAFE_INTEGER-s.startedTick,"Invalid battle duration");}
 else{
  const f=p as Finished;validateRoster(f.robots);choice(f.outcome,["WIN","DRAW"]);choice(f.reason,["ELIMINATION","TIME_LIMIT"]);
  const active=f.robots.filter(r=>r.status==="ACTIVE");
  if(f.outcome==="WIN")ensure(f.reason==="ELIMINATION"&&active.length===1&&f.winnerTeamId===active[0]!.teamId,"Winner contradicts roster");
  else ensure(f.winnerTeamId===undefined&&(f.reason==="ELIMINATION"?active.length===0:active.length===2),"Draw contradicts roster");
 }return p;
}
export interface CombatantStats {
 readonly robotId:string;readonly teamId:string;readonly status:"ACTIVE"|"DEFEATED";
 readonly finalIntegrityUnits:number;readonly maxIntegrityUnits:number;
 readonly damageDealtUnits:number;readonly damageTakenUnits:number;
 readonly attacksAttempted:number;readonly attacksLanded:number;readonly attacksRejected:number;
 readonly accuracyPercentage:number;readonly movementSteps:number;
}
export interface CombatReport {
 readonly battleId:string;readonly boardId:string;readonly startedTick:number;readonly finishedTick:number;readonly durationTicks:number;
 readonly outcome:"WIN"|"DRAW";readonly winnerTeamId?:string;readonly reason:"ELIMINATION"|"TIME_LIMIT";
 readonly combatants:readonly CombatantStats[];
 readonly totalDamageDealtUnits:number;readonly totalAttacksAttempted:number;readonly totalAttacksLanded:number;readonly totalMovementSteps:number;
}
export const COMBATANT_STATS_FIELDS=frozen({
 robotId:text(),teamId:text(),status:text(),
 finalIntegrityUnits:uint(),maxIntegrityUnits:uint(1),
 damageDealtUnits:uint(),damageTakenUnits:uint(),
 attacksAttempted:uint(),attacksLanded:uint(),attacksRejected:uint(),
 accuracyPercentage:uint(),movementSteps:uint()
});
export const COMBAT_REPORT_FIELDS=frozen({
 battleId:text(),boardId:text(),startedTick:uint(),finishedTick:uint(),durationTicks:uint(),
 outcome:text(),winnerTeamId:{...text(),optional:true},reason:text(),
 combatants:arr(obj(COMBATANT_STATS_FIELDS)),
 totalDamageDealtUnits:uint(),totalAttacksAttempted:uint(),totalAttacksLanded:uint(),totalMovementSteps:uint()
});
export function validateCombatReport(v:unknown):CombatReport {
 const p=read<CombatReport>(v,COMBAT_REPORT_FIELDS);id(p.battleId);id(p.boardId);
 ensure(p.startedTick<=p.finishedTick&&p.durationTicks===p.finishedTick-p.startedTick,"Invalid report duration");
 choice(p.outcome,["WIN","DRAW"]);choice(p.reason,["ELIMINATION","TIME_LIMIT"]);
 pair(p.combatants,true);ensure(p.combatants[0]!.robotId<p.combatants[1]!.robotId,"Combatants must be ordered by robot ID");
 let sumDamage=0,sumAttempted=0,sumLanded=0,sumMoves=0;
 for(const c of p.combatants){
  choice(c.status,["ACTIVE","DEFEATED"]);
  ensure(c.finalIntegrityUnits<=c.maxIntegrityUnits&&(c.status==="DEFEATED")===(c.finalIntegrityUnits===0),"HP contradicts status");
  ensure(c.attacksLanded<=c.attacksAttempted,"Attacks landed exceeds attempted");
  ensure(c.attacksAttempted===c.attacksLanded+c.attacksRejected,"Attack totals mismatch");
  const expectedAcc=c.attacksAttempted>0?Math.round((c.attacksLanded/c.attacksAttempted)*100):0;
  ensure(c.accuracyPercentage===expectedAcc,"Accuracy percentage mismatch");
  sumDamage+=c.damageDealtUnits;sumAttempted+=c.attacksAttempted;sumLanded+=c.attacksLanded;sumMoves+=c.movementSteps;
 }
 ensure(p.totalDamageDealtUnits===sumDamage,"Total damage mismatch");
 ensure(p.totalAttacksAttempted===sumAttempted,"Total attacks attempted mismatch");
 ensure(p.totalAttacksLanded===sumLanded,"Total attacks landed mismatch");
 ensure(p.totalMovementSteps===sumMoves,"Total movement steps mismatch");
 const active=p.combatants.filter(r=>r.status==="ACTIVE");
 if(p.outcome==="WIN"){
  ensure(p.reason==="ELIMINATION"&&active.length===1&&p.winnerTeamId===active[0]!.teamId,"Winner contradicts combatants");
 }else{
  ensure(p.winnerTeamId===undefined&&(p.reason==="ELIMINATION"?active.length===0:active.length===2),"Draw contradicts combatants");
 }
 return p;
}
