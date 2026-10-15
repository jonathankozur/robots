import {ATTACK_FIELDS,arr,obj,text,uint,frozen,definition,read,ensure,pair,id,choice,reference} from "../weapons/v1.ts";
import type {AttackRef} from "../weapons/v1.ts";
export type Status="ACTIVE"|"DEFEATED";
export interface Combatant {readonly robotId:string;readonly teamId:string;readonly integrityUnits:number;readonly maxIntegrityUnits:number;readonly status:Status}
export interface InitialView {readonly battleId:string;readonly robots:readonly Omit<Combatant,"status">[]}
export interface Roster {readonly battleId:string;readonly effectiveTick:number;readonly damageRevision:0;readonly robots:readonly Combatant[]}
export interface ImpactRequested extends AttackRef {readonly acceptedTick:number;readonly impactUnits:number}
export interface ImpactResolved extends AttackRef {readonly acceptedTick:number;readonly resolvedTick:number;readonly requestedImpactUnits:number;readonly appliedImpactUnits:number;readonly integrityUnits:number;readonly maxIntegrityUnits:number;readonly targetStatus:Status;readonly damageRevision:number;readonly duplicate:boolean}
export interface ImpactRejected extends AttackRef {readonly acceptedTick:number;readonly resolvedTick:number;readonly reasonCode:string;readonly duplicate:boolean}
export const ROBOT_FIELDS=frozen({robotId:text(),teamId:text(),integrityUnits:uint(),maxIntegrityUnits:uint(1),status:text()});
export const INITIAL_FIELDS=frozen({battleId:text(),robots:arr(obj({robotId:text(),teamId:text(),integrityUnits:uint(1),maxIntegrityUnits:uint(1)}))});
export const IMPACT_REASONS=frozen(["NOT_READY","BATTLE_FINISHED","ATTACKER_UNKNOWN","TARGET_UNKNOWN","SELF_TARGET","FRIENDLY_TARGET","ATTACKER_DEFEATED","TARGET_DEFEATED","NON_POSITIVE_IMPACT","REQUEST_CONFLICT","REQUEST_EXPIRED"] as const);
export const DAMAGE_MESSAGES=frozen([
 definition("DamageRosterInitialized","event",{battleId:text(),effectiveTick:uint(),damageRevision:uint(),robots:arr(obj(ROBOT_FIELDS))}),
 definition("ImpactRequested","command",{...ATTACK_FIELDS,acceptedTick:uint(),impactUnits:uint()}),
 definition("ImpactResolved","event",{...ATTACK_FIELDS,acceptedTick:uint(),resolvedTick:uint(),requestedImpactUnits:uint(1),appliedImpactUnits:uint(),integrityUnits:uint(),maxIntegrityUnits:uint(1),targetStatus:text(),damageRevision:uint(1),duplicate:{type:"boolean"}}),
 definition("ImpactRejected","event",{...ATTACK_FIELDS,acceptedTick:uint(),resolvedTick:uint(),reasonCode:text(),duplicate:{type:"boolean"}})
]);
export function validateRoster(rows:readonly Combatant[]):void {
 pair(rows,true);ensure(rows[0]!.robotId<rows[1]!.robotId,"Roster must be ordered by robot ID");for(const r of rows){choice(r.status,["ACTIVE","DEFEATED"]);ensure(r.integrityUnits<=r.maxIntegrityUnits&&(r.status==="DEFEATED")===(r.integrityUnits===0),"HP contradicts status");}
}
export function validateInitialView(v:unknown):InitialView {
 const p=read<InitialView>(v,INITIAL_FIELDS);id(p.battleId);pair(p.robots,true);
 for(const r of p.robots)ensure(r.integrityUnits<=r.maxIntegrityUnits,"Initial HP exceeds maximum");return p;
}
export function validateMessage(type:string,v:unknown):Roster|ImpactRequested|ImpactResolved|ImpactRejected {
 const def=DAMAGE_MESSAGES.find(d=>d.type===type);ensure(def);
 const p=read<Roster|ImpactRequested|ImpactResolved|ImpactRejected>(v,def.fields);id(p.battleId);
 if(type==="DamageRosterInitialized"){
  const r=p as Roster;ensure(r.damageRevision===0,"Initial revision must be zero");validateRoster(r.robots);ensure(r.robots.every(x=>x.status==="ACTIVE"),"Initial robots must be active");
 }else{
  reference(p as AttackRef);
  if(type==="ImpactResolved"){
   const r=p as ImpactResolved;choice(r.targetStatus,["ACTIVE","DEFEATED"]);
   ensure(r.resolvedTick===r.acceptedTick&&r.integrityUnits<=r.maxIntegrityUnits&&r.appliedImpactUnits<=r.requestedImpactUnits&&r.appliedImpactUnits<=r.maxIntegrityUnits-r.integrityUnits&&(r.targetStatus==="DEFEATED")===(r.integrityUnits===0),"Impossible impact");
  }else if(type==="ImpactRejected"){
   const r=p as ImpactRejected;choice(r.reasonCode,IMPACT_REASONS);ensure(r.resolvedTick===r.acceptedTick,"Invalid impact time");
  }
 }
 return p;
}
