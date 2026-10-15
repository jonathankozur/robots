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
