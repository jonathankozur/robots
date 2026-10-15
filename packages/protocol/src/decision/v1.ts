import {arr,obj,text,uint,frozen,definition,read,ensure,pair,id,choice} from "../weapons/v1.ts";
export type Behavior="fixture.observe-v1"|"fixture.pressure-v1";
export interface InitialView {readonly battleId:string;readonly boardId:string;readonly robots:readonly {readonly robotId:string;readonly behaviorId:Behavior;readonly weaponSlotId:string;readonly rangeHexes:number}[]}
export interface Decision {readonly battleId:string;readonly robotId:string;readonly decisionTick:number;readonly actionKind:"MOVE"|"ATTACK"|"WAIT";readonly reasonCode:string;readonly observationTick?:number;readonly targetRobotId?:string;readonly requestSequence?:number}
export const INITIAL_FIELDS=frozen({battleId:text(),boardId:text(),robots:arr(obj({robotId:text(),behaviorId:text(),weaponSlotId:text(),rangeHexes:uint(1)}))});
export const DECISION_MESSAGES=frozen([definition("AIDecisionPublished","event",{battleId:text(),robotId:text(),decisionTick:uint(),actionKind:text(),reasonCode:text(),observationTick:{...uint(),optional:true},targetRobotId:{...text(),optional:true},requestSequence:{...uint(1),optional:true}})]);
export function validateInitialView(v:unknown):InitialView{
 const p=read<InitialView>(v,INITIAL_FIELDS);id(p.battleId);id(p.boardId);pair(p.robots);
 for(const r of p.robots){choice(r.behaviorId,["fixture.observe-v1","fixture.pressure-v1"]);id(r.weaponSlotId);}return p;
}
export function validateMessage(type:string,v:unknown):Decision {
 ensure(type==="AIDecisionPublished");const p=read<Decision>(v,DECISION_MESSAGES[0]!.fields);id(p.battleId);id(p.robotId);
 choice(p.actionKind,["MOVE","ATTACK","WAIT"]);if(p.targetRobotId!==undefined)id(p.targetRobotId);
 if(p.actionKind==="WAIT"){
  choice(p.reasonCode,["NO_OBSERVATION","NO_VISIBLE_TARGET","NO_PATH","MOVEMENT_COOLDOWN","WEAPON_COOLDOWN"]);
  ensure(p.requestSequence===undefined,"WAIT cannot request");
  if(p.reasonCode==="NO_OBSERVATION")ensure(p.observationTick===undefined&&p.targetRobotId===undefined);
  else ensure(p.observationTick===p.decisionTick&&(p.reasonCode==="NO_VISIBLE_TARGET"?p.targetRobotId===undefined:p.targetRobotId!==undefined));
 }else{
  ensure(p.observationTick===p.decisionTick&&p.targetRobotId!==undefined&&p.requestSequence!==undefined,"Action needs a fresh target and request");
  choice(p.reasonCode,p.actionKind==="MOVE"?["APPROACH_ADJACENT","APPROACH_WEAPON_RANGE"]:["TARGET_IN_RANGE"]);
 }return p;
}
