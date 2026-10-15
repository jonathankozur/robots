import type {FieldRule,MessageDefinition} from "@robots/system-api";
import {ProtocolError} from "@robots/system-api";
import {freezeIntegerData} from "@robots/values/integers";
import {text,number,HEX_FIELDS,WORLD_FIELDS,RESULT_FIELDS} from "../navigation/v1.ts";
import type {World,Result} from "../navigation/v1.ts";
import {validateGrid,inside,key,distance} from "@robots/values/hex-grid";
export {text,HEX_FIELDS};
export const uint=(min=0):FieldRule=>number(min);
export const obj=(fields:Readonly<Record<string,FieldRule>>):FieldRule=>({type:"object",fields});
export const arr=(items:FieldRule,maxLength=2):FieldRule=>({type:"array",items,maxLength});
export const frozen=<T>(v:T):T=>freezeIntegerData(v,"COM_PAYLOAD_INVALID");
export function ensure(v:unknown,message="Invalid combat contract",code="COM_PAYLOAD_INVALID"):asserts v {if(!v)throw new ProtocolError(code,message);}
export const definition=(type:string,kind:"event"|"command",fields:Readonly<Record<string,FieldRule>>):MessageDefinition=>frozen({type,version:1,kind,fields});
export function read<T>(v:unknown,fields:Readonly<Record<string,FieldRule>>):T {
 const value=frozen(v);
 function object(data:unknown,rules:Readonly<Record<string,FieldRule>>):void {
  ensure(data!==null&&typeof data==="object"&&!Array.isArray(data),"Expected object");
  const p=data as Record<string,unknown>;
  for(const k of Object.keys(p))ensure(Object.hasOwn(rules,k),"Undeclared field: "+k);
  for(const [k,rule] of Object.entries(rules)){
   if(!Object.hasOwn(p,k)){ensure(rule.optional,"Missing field: "+k);continue;}
   field(p[k],rule);
  }
 }
 function field(data:unknown,rule:FieldRule):void {
  switch(rule.type){
   case "object":object(data,rule.fields);break;
   case "array":ensure(Array.isArray(data)&&data.length<=rule.maxLength,"Invalid array");for(const x of data)field(x,rule.items);break;
   case "string":ensure(typeof data==="string"&&data.length>=(rule.minLength??0)&&data.length<=(rule.maxLength??128),"Invalid string");break;
   case "boolean":ensure(typeof data==="boolean","Invalid boolean");break;
   case "number":ensure(typeof data==="number"&&Number.isSafeInteger(data)&&data>=(rule.min??0)&&data<=(rule.max??Number.MAX_SAFE_INTEGER),"Invalid integer");break;
  }
 }
 object(value,fields);return value as T;
}
export function id(v:unknown):void {ensure(typeof v==="string"&&/^[a-zA-Z0-9._-]{1,64}$/.test(v),"Invalid ID");}
export function choice(v:unknown,allowed:readonly string[]):void {ensure(typeof v==="string"&&allowed.includes(v),"Unknown enum");}
export function pair(rows:readonly {robotId:string;teamId?:string}[],teams=false):void {
 ensure(rows.length===2&&new Set(rows.map(r=>r.robotId)).size===2,"Expected two distinct robots");
 rows.forEach(r=>id(r.robotId));if(teams){ensure(new Set(rows.map(r=>r.teamId)).size===2,"Expected two teams");rows.forEach(r=>id(r.teamId));}
}
export interface AttackRef {readonly battleId:string;readonly attackerRobotId:string;readonly targetRobotId:string;readonly weaponSlotId:string;readonly requestSequence:number}
export interface RequestAttack extends AttackRef {readonly observationTick:number}
export interface AttackAccepted extends RequestAttack {readonly acceptedTick:number;readonly readyAtTick:number;readonly duplicate:boolean}
export interface AttackRejected extends AttackRef {readonly resolvedTick:number;readonly reasonCode:string;readonly duplicate:boolean}
export interface Weapon {readonly robotId:string;readonly weaponSlotId:string;readonly impactUnits:number;readonly reloadTicks:number;readonly rangeHexes:number}
export interface InitialView {readonly battleId:string;readonly boardId:string;readonly weapons:readonly Weapon[]}
export const ATTACK_FIELDS=frozen({battleId:text(),attackerRobotId:text(),targetRobotId:text(),weaponSlotId:text(),requestSequence:uint(1)});
export const INITIAL_FIELDS=frozen({battleId:text(),boardId:text(),weapons:arr(obj({robotId:text(),weaponSlotId:text(),impactUnits:uint(1),reloadTicks:uint(1),rangeHexes:uint(1)}))});
export const ATTACK_REASONS=frozen(["BATTLE_NOT_STARTED","BATTLE_FINISHED","ATTACKER_UNKNOWN","TARGET_UNKNOWN","WEAPON_UNKNOWN","SELF_TARGET","FRIENDLY_TARGET","ATTACKER_DEFEATED","TARGET_DEFEATED","VIEW_NOT_READY","STALE_OBSERVATION","TARGET_NOT_VISIBLE","OUT_OF_RANGE","LINE_BLOCKED","WEAPON_NOT_READY","REQUEST_CONFLICT","REQUEST_EXPIRED"] as const);
export const WEAPONS_MESSAGES=frozen([
 definition("RequestAttack","command",{...ATTACK_FIELDS,observationTick:uint()}),
 definition("AttackAccepted","event",{...ATTACK_FIELDS,observationTick:uint(),acceptedTick:uint(),readyAtTick:uint(1),duplicate:{type:"boolean"}}),
 definition("AttackRejected","event",{...ATTACK_FIELDS,resolvedTick:uint(),reasonCode:text(),duplicate:{type:"boolean"}})
]);
export function reference(p:AttackRef):void {id(p.battleId);id(p.attackerRobotId);id(p.targetRobotId);id(p.weaponSlotId);}
export function validateInitialView(v:unknown):InitialView {
 const p=read<InitialView>(v,INITIAL_FIELDS);id(p.battleId);id(p.boardId);pair(p.weapons);p.weapons.forEach(x=>id(x.weaponSlotId));return p;
}
export function validateMessage(type:string,v:unknown):RequestAttack|AttackAccepted|AttackRejected {
 const def=WEAPONS_MESSAGES.find(d=>d.type===type);ensure(def);
 const p=read<RequestAttack|AttackAccepted|AttackRejected>(v,def.fields);reference(p);
 if(type==="AttackAccepted"){const a=p as AttackAccepted;ensure(a.acceptedTick===a.observationTick&&a.readyAtTick>a.acceptedTick,"Invalid acceptance time");}
 if(type==="AttackRejected")choice((p as AttackRejected).reasonCode,ATTACK_REASONS);
 return p;
}
export function validateWorld(v:unknown):World {
 const w=read<World>(v,WORLD_FIELDS);validateGrid(w);id(w.boardId);pair(w.robots);
 const occupied=new Set<string>();for(const r of w.robots){
  ensure(inside(w,r)&&w.tiles.some(t=>t.passable&&t.q===r.q&&t.r===r.r)&&!occupied.has(key(r)),"Invalid robot position");
  ensure(/^robot\.[a-z][a-z0-9._-]*$/.test(r.definitionId),"Invalid robot definition");occupied.add(key(r));
 }
 return w;
}
export function validateMovement(v:unknown):Result {
 const p=read<Result>(v,RESULT_FIELDS);id(p.boardId);id(p.requestBoardId);id(p.robotId);
 choice(p.reason,["MOVED","BOARD_MISMATCH","NOT_READY","ROBOT_UNKNOWN","VIEW_IN_FUTURE","STALE_POSITION","OUT_OF_BOARD","NOT_ADJACENT","TERRAIN_BLOCKED","DESTINATION_OCCUPIED","COOLDOWN_ACTIVE","REQUEST_CONFLICT","REQUEST_EXPIRED","REQUEST_CAPACITY"]);
 ensure(p.accepted===(p.reason==="MOVED"),"Move result contradicts acceptance");
 if(p.accepted)ensure(p.robotState&&p.boardRevision>0&&p.robotState.robotRevision>0&&distance(p.from,p.to)===1&&p.to.q===p.robotState.position.q&&p.to.r===p.robotState.position.r,"Invalid accepted move");
 return p;
}
