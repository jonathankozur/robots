import type {Message} from "@robots/system-api";
import {ProtocolError} from "@robots/system-api";
import type {CombatReport,CombatantStats,Started,Finished} from "@robots/protocol/battle/v1";
import {validateCombatReport} from "@robots/protocol/battle/v1";

function extractMessages(source:unknown):readonly Message[]{
 if(Array.isArray(source))return source as readonly Message[];
 if(source&&typeof source==="object"&&Array.isArray((source as {entries?:unknown[]}).entries)){
  const list:Message[]=[];
  for(const entry of (source as {entries:{kind?:string;message?:Message}[]}).entries){
   if(entry&&entry.kind==="published"&&entry.message)list.push(entry.message);
  }
  return list;
 }
 return [];
}

export function generateCombatReport(source:readonly Message[]|{readonly entries:readonly unknown[]}):CombatReport{
 const messages=extractMessages(source);
 let started:Started|undefined,finished:Finished|undefined,boardId:string|undefined;
 for(const m of messages){
  if(m.type==="NavigationWorldReady"&&!boardId){boardId=(m.payload as unknown as {boardId?:string}).boardId;}
  else if(m.type==="BattleStarted"){started=m.payload as unknown as Started;}
  else if(m.type==="BattleFinished"){finished=m.payload as unknown as Finished;}
 }
 if(!started||!finished||!boardId){throw new ProtocolError("BATTLE_NOT_FINISHED","Cannot generate combat report for an unfinished battle");}

 const statsMap=new Map<string,{
  robotId:string;teamId:string;status:"ACTIVE"|"DEFEATED";
  finalIntegrityUnits:number;maxIntegrityUnits:number;
  damageDealtUnits:number;damageTakenUnits:number;
  attacksAttempted:number;attacksLanded:number;attacksRejected:number;
  movementSteps:number;
 }>();

 for(const r of finished.robots){
  statsMap.set(r.robotId,{
   robotId:r.robotId,teamId:r.teamId,status:r.status,
   finalIntegrityUnits:r.integrityUnits,maxIntegrityUnits:r.maxIntegrityUnits,
   damageDealtUnits:0,damageTakenUnits:0,
   attacksAttempted:0,attacksLanded:0,attacksRejected:0,
   movementSteps:0
  });
 }

 for(const m of messages){
  const p=m.payload as any;
  if(m.type==="NavigationStepResolved"){
   if(p.accepted&&!p.duplicate&&statsMap.has(p.robotId)){statsMap.get(p.robotId)!.movementSteps++;}
  }else if(m.type==="AttackAccepted"){
   if(!p.duplicate&&statsMap.has(p.attackerRobotId)){statsMap.get(p.attackerRobotId)!.attacksAttempted++;}
  }else if(m.type==="AttackRejected"){
   if(!p.duplicate&&statsMap.has(p.attackerRobotId)){
    statsMap.get(p.attackerRobotId)!.attacksAttempted++;
    statsMap.get(p.attackerRobotId)!.attacksRejected++;
   }
  }else if(m.type==="ImpactResolved"){
   if(!p.duplicate){
    if(statsMap.has(p.attackerRobotId)){
     const atk=statsMap.get(p.attackerRobotId)!;
     atk.attacksLanded++;
     atk.damageDealtUnits+=p.appliedImpactUnits;
    }
    if(statsMap.has(p.targetRobotId)){
     statsMap.get(p.targetRobotId)!.damageTakenUnits+=p.appliedImpactUnits;
    }
   }
  }else if(m.type==="ImpactRejected"){
   if(!p.duplicate&&statsMap.has(p.attackerRobotId)){statsMap.get(p.attackerRobotId)!.attacksRejected++;}
  }
 }

 const combatants:CombatantStats[]=[...statsMap.values()]
  .sort((a,b)=>a.robotId.localeCompare(b.robotId))
  .map(c=>{
   const accuracyPercentage=c.attacksAttempted>0?Math.round((c.attacksLanded/c.attacksAttempted)*100):0;
   return Object.freeze({...c,accuracyPercentage});
  });

 let totalDamageDealtUnits=0,totalAttacksAttempted=0,totalAttacksLanded=0,totalMovementSteps=0;
 for(const c of combatants){
  totalDamageDealtUnits+=c.damageDealtUnits;
  totalAttacksAttempted+=c.attacksAttempted;
  totalAttacksLanded+=c.attacksLanded;
  totalMovementSteps+=c.movementSteps;
 }

 const rawReport:CombatReport={
  battleId:finished.battleId,boardId,
  startedTick:started.startedTick,finishedTick:finished.finishedTick,
  durationTicks:finished.finishedTick-started.startedTick,
  outcome:finished.outcome,
  ...(finished.winnerTeamId?{winnerTeamId:finished.winnerTeamId}:{}),
  reason:finished.reason,
  combatants:Object.freeze(combatants),
  totalDamageDealtUnits,totalAttacksAttempted,totalAttacksLanded,totalMovementSteps
 };
 return validateCombatReport(rawReport);
}
