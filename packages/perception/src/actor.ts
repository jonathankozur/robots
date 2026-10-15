import type {Actor,ActorContext,Payload,Message} from "@robots/system-api";
import {distance,hasLineOfSight} from "@robots/values/hex-grid";
import {validateWorld} from "@robots/protocol/weapons/v1";
import type {World} from "@robots/protocol/navigation/v1";
import {validateMessage as damageMessage} from "@robots/protocol/damage/v1";
import type {Roster} from "@robots/protocol/damage/v1";
import {validateInitialView,validateMessage} from "@robots/protocol/perception/v1";
import type {InitialView} from "@robots/protocol/perception/v1";
import {validateMessage as battleMessage} from "@robots/protocol/battle/v1";
import type {Started} from "@robots/protocol/battle/v1";
import {owner,ensure,moveView,damageView,type DamageView} from "./data.ts";
export function createPerceptionActor(identity:Payload,context:ActorContext={systemId:"perception"}):Actor{
 const o=owner(identity,context,"PERCEPTION_CONFIG_INVALID");
 let config:InitialView|undefined,world:World|undefined,roster:DamageView|undefined,started:Started|undefined,finished=false,cause:Message|undefined,worldCause:Message|undefined,damageCause:Message|undefined;
 const sub=(type:string,handler:(m:Message,tick:number)=>void)=>({type,version:1,phase:"perception" as const,handler(m:Message,c:{tick:number}){o.verify(m,type.startsWith("Navigation")?undefined:config?.battleId);handler(m,c.tick);}});
 return {connect:o.connect,initialize(m){config=o.initialize(m,validateInitialView);},activate:o.activate,
 subscriptions:[
  sub("NavigationWorldReady",m=>{ensure(!world,"Repeated world","COM_VIEW_CONFLICT");world=validateWorld(m.payload);ensure(world.boardId===config?.boardId);worldCause=m;}),
  sub("NavigationStepResolved",m=>{const previous=world;world=moveView(world,m.payload);if(world!==previous)worldCause=m;}),
  sub("DamageRosterInitialized",m=>{ensure(!roster,"Repeated roster","COM_VIEW_CONFLICT");roster=damageMessage(m.type,m.payload) as Roster;damageCause=m;}),
  sub("ImpactResolved",m=>{const previous=roster;roster=damageView(roster,m.payload);if(roster!==previous)damageCause=m;}),
  sub("BattleStarted",(m,tick)=>{const p=battleMessage(m.type,m.payload) as Started;ensure(o.ready&&!started&&!finished&&p.startedTick===m.emittedTick+1&&p.startedTick===tick,"Invalid start","COM_LIFECYCLE_INVALID");ensure(p.participants.every(r=>config?.sensors.some(s=>s.robotId===r.robotId)&&roster?.robots.some(x=>x.robotId===r.robotId&&x.teamId===r.teamId)),"Wrong participants","COM_VIEW_CONFLICT");started=p;cause=m;}),
  sub("BattleFinished",m=>{battleMessage(m.type,m.payload);ensure(started&&!finished,"Invalid finish","COM_LIFECYCLE_INVALID");finished=true;})
 ],loopPhase:"perception",loop(c){
  if(!o.ready||!config||!world||!roster||!started||finished||c.tick<started.startedTick)return;
  ensure(world.effectiveTick<=c.tick&&roster.effectiveTick<=c.tick,"Future view","COM_VIEW_CONFLICT");
  for(const sensor of [...config.sensors].sort((a,b)=>a.robotId<b.robotId?-1:1)){
   const self=world.robots.find(r=>r.robotId===sensor.robotId),hp=roster.robots.find(r=>r.robotId===sensor.robotId);
   ensure(self&&hp,"Missing robot","COM_VIEW_CONFLICT");
   const visibleRobots=world.robots.filter(r=>r.robotId!==self.robotId).flatMap(r=>{
    const target=roster!.robots.find(h=>h.robotId===r.robotId);ensure(target,"Missing target roster","COM_VIEW_CONFLICT");
    return hp.status==="ACTIVE"&&target.status==="ACTIVE"&&target.teamId!==hp.teamId&&distance(self,r)<=sensor.rangeHexes&&hasLineOfSight(world!,self,r)?[{robotId:r.robotId,teamId:target.teamId,position:{q:r.q,r:r.r},robotRevision:r.robotRevision,status:"ACTIVE",distanceHexes:distance(self,r)}]:[];
   });
   const payload=validateMessage("RobotObservationPublished",{battleId:config.battleId,boardId:config.boardId,robotId:self.robotId,observedTick:c.tick,worldTick:world.effectiveTick,boardRevision:world.boardRevision,damageRevision:roster.damageRevision,self:{position:{q:self.q,r:self.r},robotRevision:self.robotRevision,status:hp.status},visibleRobots});
   o.emit("RobotObservationPublished",payload,[...new Map([cause!,worldCause!,damageCause!].map(m=>[m.messageId,m])).values()]);
  }
 }};
}
