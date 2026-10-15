import type {FieldRule} from "@robots/system-api";
import type {View,Assembly} from "./v1.ts";
import {WORLD_FIELDS,RESULT_FIELDS,HEX_FIELDS} from "../navigation/v1.ts";
import {arr,obj,text,uint,frozen,read,ensure,id,choice,pair,validateWorld,validateMovement,ATTACK_REASONS} from "../weapons/v1.ts";
import {ROBOT_FIELDS,validateRoster,IMPACT_REASONS} from "../damage/v1.ts";
import type {Combatant} from "../damage/v1.ts";
import {BATTLE_MESSAGES,validateMessage as battleMessage} from "../battle/v1.ts";
import type {Started,Finished} from "../battle/v1.ts";
export interface RecentEvent {readonly kind:"MOVE"|"ATTACK"|"DAMAGE"|"ATTACK_REJECTED"|"IMPACT_REJECTED"|"DECISION";readonly tick:number;readonly sourceMessageId:number;readonly robotId:string;readonly targetRobotId?:string;readonly weaponSlotId?:string;readonly amountUnits?:number;readonly integrityUnits?:number;readonly from?:{readonly q:number;readonly r:number};readonly to?:{readonly q:number;readonly r:number};readonly actionKind?:"MOVE"|"ATTACK"|"WAIT";readonly reasonCode?:string}
export interface InitialView {readonly battleId:string;readonly boardId:string;readonly assemblies:readonly Assembly[]}
export interface CombatView extends View {readonly battleId:string;readonly damageRevision:number;readonly combatants:readonly Combatant[];readonly stage:"READY"|"ACTIVE"|"FINISHED";readonly started?:Started;readonly result?:Finished;readonly events:readonly RecentEvent[]}
const ASSEMBLY_FIELDS={robotId:text(),chassisResourceId:text(128),parts:arr(obj({slotId:text(128),socketId:text(128),resourceId:text(128)}),5)};
export const INITIAL_FIELDS=frozen({battleId:text(),boardId:text(),assemblies:arr(obj(ASSEMBLY_FIELDS))});
const baseEvent={kind:text(),tick:uint(),sourceMessageId:uint(1),robotId:text()};
const optional=(r:FieldRule):FieldRule=>({...r,optional:true});
export const EVENT_FIELDS=frozen({...baseEvent,targetRobotId:optional(text()),weaponSlotId:optional(text()),amountUnits:optional(uint()),integrityUnits:optional(uint()),from:optional(obj(HEX_FIELDS)),to:optional(obj(HEX_FIELDS)),actionKind:optional(text()),reasonCode:optional(text())});
export const VIEW_FIELDS=frozen({contextId:text(128),battleId:text(),boardId:text(),sequence:uint(1),observedTick:uint(),world:obj({...WORLD_FIELDS,robots:{...(WORLD_FIELDS.robots as Extract<FieldRule,{type:"array"}>),maxLength:2}}),assemblies:arr(obj(ASSEMBLY_FIELDS)),movements:arr(obj({...RESULT_FIELDS,sourceMessageId:uint(1)})),damageRevision:uint(),combatants:arr(obj(ROBOT_FIELDS)),stage:text(),started:optional(obj(BATTLE_MESSAGES[0]!.fields)),result:optional(obj(BATTLE_MESSAGES[1]!.fields)),events:arr(obj(EVENT_FIELDS),64)});
export const PRESENTATION_MESSAGES=frozen([{type:"PresentationViewPublished",version:2,kind:"event",fields:VIEW_FIELDS}] as const);
export function validateInitialView(v:unknown):InitialView{
 const p=read<InitialView>(v,INITIAL_FIELDS);id(p.battleId);id(p.boardId);pair(p.assemblies);
 for(const a of p.assemblies){
  ensure(/^resource\.[a-z][a-z0-9._-]*$/.test(a.chassisResourceId),"Invalid chassis resource");
  ensure(new Set(a.parts.map(x=>x.slotId)).size===a.parts.length&&new Set(a.parts.map(x=>x.socketId)).size===a.parts.length,"Repeated mounting");
  for(const part of a.parts){id(part.slotId);id(part.socketId);ensure(/^resource\.[a-z][a-z0-9._-]*$/.test(part.resourceId),"Invalid part resource");}
 }return p;
}
export function validateMessage(v:unknown):CombatView{
 const p=read<CombatView>(v,VIEW_FIELDS);
 validateInitialView({battleId:p.battleId,boardId:p.boardId,assemblies:p.assemblies});
 const w=validateWorld(p.world);validateRoster(p.combatants);choice(p.stage,["READY","ACTIVE","FINISHED"]);
 ensure(w.boardId===p.boardId&&w.effectiveTick<=p.observedTick,"World is outside projection cut");
 const ids=new Set(w.robots.map(r=>r.robotId));
 ensure(p.combatants.every(r=>ids.has(r.robotId))&&p.assemblies.every(r=>ids.has(r.robotId)),"Projection participants differ");
 if(p.stage==="READY")ensure(p.started===undefined&&p.result===undefined&&p.damageRevision===0,"READY has battle facts");
 else{
  ensure(p.started!==undefined,"Missing start");const s=battleMessage("BattleStarted",p.started) as Started;
  ensure(s.battleId===p.battleId&&s.startedTick<=p.observedTick&&s.participants.every(x=>p.combatants.some(r=>r.robotId===x.robotId&&r.teamId===x.teamId)),"Invalid projected start");
  if(p.stage==="ACTIVE")ensure(p.result===undefined,"ACTIVE has terminal result");
  else{
   ensure(p.result!==undefined,"Missing result");const r=battleMessage("BattleFinished",p.result) as Finished;
   ensure(r.battleId===p.battleId&&r.finishedTick>=s.startedTick&&r.finishedTick<=p.observedTick&&r.damageRevision===p.damageRevision,"Invalid result cut");
   ensure(r.robots.every(x=>p.combatants.some(c=>c.robotId===x.robotId&&c.teamId===x.teamId&&c.integrityUnits===x.integrityUnits&&c.maxIntegrityUnits===x.maxIntegrityUnits&&c.status===x.status)),"Final HP mismatch");
  }
 }
 for(const m of p.movements){const {sourceMessageId,...move}=m;validateMovement(move);ensure(m.accepted&&!m.duplicate&&m.resolvedTick<=p.observedTick&&ids.has(m.robotId),"Invalid projected movement");}
 const variants:Record<string,Readonly<Record<string,FieldRule>>>={
  MOVE:{from:obj(HEX_FIELDS),to:obj(HEX_FIELDS)},
  ATTACK:{targetRobotId:text(),weaponSlotId:text()},
  DAMAGE:{targetRobotId:text(),weaponSlotId:text(),amountUnits:uint(),integrityUnits:uint()},
  ATTACK_REJECTED:{targetRobotId:text(),weaponSlotId:text(),reasonCode:text()},
  IMPACT_REJECTED:{targetRobotId:text(),weaponSlotId:text(),reasonCode:text()},
  DECISION:{actionKind:text(),reasonCode:text(),targetRobotId:optional(text())}
 };
 let previous:RecentEvent|undefined;const seen=new Set<number>();
 for(const e of p.events){
  ensure(variants[e.kind],"Unknown event variant");read(e,{...baseEvent,...variants[e.kind]});
  id(e.robotId);if(e.targetRobotId!==undefined)id(e.targetRobotId);if(e.weaponSlotId!==undefined)id(e.weaponSlotId);
  ensure(ids.has(e.robotId)&&(e.targetRobotId===undefined||ids.has(e.targetRobotId)&&e.targetRobotId!==e.robotId),"Unknown event participant");
  if(e.kind==="MOVE")for(const h of [e.from!,e.to!])ensure(h.q>=0&&h.q<w.width&&h.r>=0&&h.r<w.height,"Movement event outside board");
  ensure(e.tick<=p.observedTick&&!seen.has(e.sourceMessageId),"Invalid event cut/duplicate");
  if(previous)ensure(e.tick>previous.tick||e.tick===previous.tick&&e.sourceMessageId>previous.sourceMessageId,"History is unordered");
  if(e.kind==="ATTACK_REJECTED")choice(e.reasonCode,ATTACK_REASONS);
  if(e.kind==="IMPACT_REJECTED")choice(e.reasonCode,IMPACT_REASONS);
  if(e.kind==="DECISION"){
   choice(e.actionKind,["MOVE","ATTACK","WAIT"]);
   choice(e.reasonCode,e.actionKind==="MOVE"?["APPROACH_ADJACENT","APPROACH_WEAPON_RANGE"]:e.actionKind==="ATTACK"?["TARGET_IN_RANGE"]:["NO_OBSERVATION","NO_VISIBLE_TARGET","NO_PATH","MOVEMENT_COOLDOWN","WEAPON_COOLDOWN"]);
   ensure((e.actionKind==="WAIT"&&["NO_OBSERVATION","NO_VISIBLE_TARGET"].includes(e.reasonCode!))?e.targetRobotId===undefined:e.targetRobotId!==undefined,"Invalid explanation target");
  }
  seen.add(e.sourceMessageId);previous=e;
 }return p;
}
