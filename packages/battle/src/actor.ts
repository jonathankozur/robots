import type {Actor,ActorContext,Payload,Message} from "@robots/system-api";
import {checkedAdd} from "@robots/values/numeric";
import {validateWorld} from "@robots/protocol/weapons/v1";
import {validateMessage as damageMessage} from "@robots/protocol/damage/v1";
import type {Roster} from "@robots/protocol/damage/v1";
import {validateInitialView,validateMessage} from "@robots/protocol/battle/v1";
import type {InitialView,Started,Finished} from "@robots/protocol/battle/v1";
import {owner,ensure,damageView,type DamageView} from "./data.ts";
export function createBattleActor(identity:Payload,context:ActorContext={systemId:"battle"}):Actor{
 const o=owner(identity,context,"BATTLE_CONFIG_INVALID");
 let config:InitialView|undefined,worldCause:Message|undefined,damageCause:Message|undefined,roster:DamageView|undefined,started:Started|undefined,finished:Finished|undefined,activationTick=0;
 const sub=(type:string,handler:(m:Message)=>void)=>({type,version:1,phase:"publication" as const,handler(m:Message){o.verify(m,type==="NavigationWorldReady"?undefined:config?.battleId);handler(m);}});
 return {connect:o.connect,initialize(m){config=o.initialize(m,validateInitialView);},activate(m,c){o.activate(m);activationTick=c.tick;},
 subscriptions:[
  sub("NavigationWorldReady",m=>{ensure(!worldCause&&!finished,"Repeated world","COM_VIEW_CONFLICT");const w=validateWorld(m.payload);ensure(w.boardId===config?.boardId&&w.boardRevision===0&&config.participants.every(r=>w.robots.some(x=>x.robotId===r.robotId)),"Wrong initial world","COM_VIEW_CONFLICT");worldCause=m;}),
  sub("DamageRosterInitialized",m=>{ensure(!roster&&!finished,"Repeated roster","COM_VIEW_CONFLICT");roster=damageMessage(m.type,m.payload) as Roster;ensure(config?.participants.every(r=>roster!.robots.some(x=>x.robotId===r.robotId&&x.teamId===r.teamId)),"Wrong initial roster","COM_VIEW_CONFLICT");damageCause=m;}),
  sub("ImpactResolved",m=>{ensure(started,"Damage before start","COM_LIFECYCLE_INVALID");const p=damageMessage(m.type,m.payload);ensure(!finished||("duplicate" in p&&p.duplicate),"Damage after finish","COM_LIFECYCLE_INVALID");roster=damageView(roster,p);if("duplicate" in p&&!p.duplicate)damageCause=m;})
 ],loopPhase:"publication",loop(c){
  if(!o.ready||!config||finished)return;
  if(!started){
   if(!worldCause||!roster||!damageCause){ensure(c.tick-activationTick+1<config.startMaxTicks,"Battle startup sources missing","BATTLE_START_LIMIT");return;}
   started={battleId:config.battleId,startedTick:checkedAdd(c.tick,1),maxBattleTicks:config.maxBattleTicks,participants:config.participants};
   validateMessage("BattleStarted",started);o.emit("BattleStarted",started,[o.cause,worldCause,damageCause]);return;
  }
  if(c.tick<started.startedTick)return;
  ensure(roster&&damageCause,"Missing roster","COM_VIEW_CONFLICT");
  const active=roster.robots.filter(r=>r.status==="ACTIVE"),last=checkedAdd(started.startedTick,config.maxBattleTicks-1);
  if(active.length===2&&c.tick<last)return;
  finished={battleId:config.battleId,finishedTick:c.tick,outcome:active.length===1?"WIN":"DRAW",...(active.length===1?{winnerTeamId:active[0]!.teamId}:{}),reason:active.length<2?"ELIMINATION":"TIME_LIMIT",damageRevision:roster.damageRevision,robots:roster.robots};
  validateMessage("BattleFinished",finished);o.emit("BattleFinished",finished,[o.cause,worldCause!,damageCause]);
 }};
}
