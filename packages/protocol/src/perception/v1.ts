import {arr,obj,text,uint,HEX_FIELDS,frozen,definition,read,ensure,pair,id,choice} from "../weapons/v1.ts";
import type {Status} from "../damage/v1.ts";
import type {Hex} from "@robots/values/hex-grid";
import {distance} from "@robots/values/hex-grid";
export interface Observation {readonly battleId:string;readonly boardId:string;readonly robotId:string;readonly observedTick:number;readonly worldTick:number;readonly boardRevision:number;readonly damageRevision:number;readonly self:{readonly position:Hex;readonly robotRevision:number;readonly status:Status};readonly visibleRobots:readonly {readonly robotId:string;readonly teamId:string;readonly position:Hex;readonly robotRevision:number;readonly status:"ACTIVE";readonly distanceHexes:number}[]}
export interface InitialView {readonly battleId:string;readonly boardId:string;readonly sensors:readonly {readonly robotId:string;readonly rangeHexes:number}[]}
export const INITIAL_FIELDS=frozen({battleId:text(),boardId:text(),sensors:arr(obj({robotId:text(),rangeHexes:uint()}))});
export const PERCEPTION_MESSAGES=frozen([definition("RobotObservationPublished","event",{battleId:text(),boardId:text(),robotId:text(),observedTick:uint(),worldTick:uint(),boardRevision:uint(),damageRevision:uint(),self:obj({position:obj(HEX_FIELDS),robotRevision:uint(),status:text()}),visibleRobots:arr(obj({robotId:text(),teamId:text(),position:obj(HEX_FIELDS),robotRevision:uint(),status:text(),distanceHexes:uint(1)}),1)})]);
export function validateInitialView(v:unknown):InitialView{
 const p=read<InitialView>(v,INITIAL_FIELDS);id(p.battleId);id(p.boardId);pair(p.sensors);return p;
}
export function validateMessage(type:string,v:unknown):Observation {
 ensure(type==="RobotObservationPublished");const p=read<Observation>(v,PERCEPTION_MESSAGES[0]!.fields);
 id(p.battleId);id(p.boardId);id(p.robotId);choice(p.self.status,["ACTIVE","DEFEATED"]);
 ensure(p.worldTick<=p.observedTick&&(p.self.status==="ACTIVE"||p.visibleRobots.length===0),"Invalid observation time/state");
 for(const h of [p.self.position,...p.visibleRobots.map(r=>r.position)])ensure(h.q>=0&&h.q<12&&h.r>=0&&h.r<12,"Invalid observed position");
 for(const r of p.visibleRobots){id(r.robotId);id(r.teamId);ensure(r.robotId!==p.robotId&&r.status==="ACTIVE"&&r.distanceHexes===distance(p.self.position,r.position),"Invalid target");}
 return p;
}
