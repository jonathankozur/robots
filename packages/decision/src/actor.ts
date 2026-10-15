import type {Actor,ActorContext,Payload,Message} from "@robots/system-api";
import {checkedAdd} from "@robots/values/numeric";
import {distance,findPath,hasLineOfSight,same} from "@robots/values/hex-grid";
import type {Grid,Hex} from "@robots/values/hex-grid";
import type {RobotState,Result} from "@robots/protocol/navigation/v1";
import {validateWorld,validateMovement,validateMessage as weaponMessage} from "@robots/protocol/weapons/v1";
import type {RequestAttack,AttackAccepted,AttackRejected} from "@robots/protocol/weapons/v1";
import {validateInitialView,validateMessage} from "@robots/protocol/decision/v1";
import type {InitialView} from "@robots/protocol/decision/v1";
import {validateMessage as observationMessage} from "@robots/protocol/perception/v1";
import type {Observation} from "@robots/protocol/perception/v1";
import {validateMessage as battleMessage} from "@robots/protocol/battle/v1";
import type {Started} from "@robots/protocol/battle/v1";
import {owner,frozen,ensure} from "./data.ts";
export function createDecisionActor(identity:Payload,context:ActorContext={systemId:"decision"}):Actor{
 const o=owner(identity,context,"DECISION_CONFIG_INVALID");
 let config:InitialView|undefined,terrain:Grid|undefined,boardRevision=0,started:Started|undefined,finished=false;
 type State={self:RobotState|undefined;moveSeq:number;attackSeq:number;readyAt:number;pending?:RequestAttack;observed?:{value:Observation;cause:Message};wait?:string;replies:Map<number,string>};
 const states=new Map<string,State>();
 const sub=(type:string,handler:(m:Message,tick:number)=>void)=>({type,version:1,phase:"decision" as const,handler(m:Message,c:{tick:number}){o.verify(m,type.startsWith("Navigation")?undefined:config?.battleId);handler(m,c.tick);}});
 function ack(m:Message,tick:number){
  const p=weaponMessage(m.type,m.payload) as AttackAccepted|AttackRejected,s=states.get(p.attackerRobotId);ensure(s,"Unknown acknowledgment","DECISION_ACK_INVALID");
  const body=JSON.stringify({...p,duplicate:false}),prior=s.replies.get(p.requestSequence);
  if(prior){ensure(prior===body,"Changed acknowledgment","DECISION_ACK_INVALID");return;}
  const q=s.pending,at=m.type==="AttackAccepted"?(p as AttackAccepted).acceptedTick:(p as AttackRejected).resolvedTick;
  ensure(q&&q.requestSequence===p.requestSequence&&q.targetRobotId===p.targetRobotId&&q.weaponSlotId===p.weaponSlotId&&at===q.observationTick&&at===m.emittedTick&&tick===at+1,"Contradictory acknowledgment","DECISION_ACK_INVALID");
  if(m.type==="AttackAccepted")s.readyAt=(p as AttackAccepted).readyAtTick;
  s.replies.set(p.requestSequence,body);if(s.replies.size>64)s.replies.delete(s.replies.keys().next().value!);delete s.pending;
 }
 return {connect:o.connect,initialize(m){config=o.initialize(m,validateInitialView);if(config)for(const r of config.robots)states.set(r.robotId,{self:undefined,moveSeq:0,attackSeq:0,readyAt:0,replies:new Map()});},activate:o.activate,
 subscriptions:[
  sub("NavigationWorldReady",m=>{
   ensure(!terrain,"Repeated world","COM_VIEW_CONFLICT");const w=validateWorld(m.payload);ensure(w.boardId===config?.boardId);
   terrain=frozen({width:w.width,height:w.height,tiles:w.tiles.map(t=>({q:t.q,r:t.r,passable:t.passable}))});boardRevision=w.boardRevision;
   // Each policy retains only its own position. No NAV message or rival position is retained as a target/cause.
   for(const [id,s] of states){const own=w.robots.find(r=>r.robotId===id);ensure(own,"Missing own position","COM_VIEW_CONFLICT");s.self=frozen({...own});}
  }),
  sub("NavigationStepResolved",m=>{
   const p=validateMovement(m.payload);ensure(p.boardId===config?.boardId);if(!p.accepted||p.duplicate)return;
   ensure(terrain&&p.boardRevision===boardRevision+1,"Movement gap","COM_VIEW_CONFLICT");boardRevision=p.boardRevision;
   const s=states.get(p.robotId);if(!s)return;const own=s.self;
   ensure(own&&p.robotState&&p.robotState.robotRevision===own.robotRevision+1&&same(own,p.from),"Own revision conflict","COM_VIEW_CONFLICT");
   s.self=frozen({...own,...p.robotState.position,robotRevision:p.robotState.robotRevision,readyAtTick:p.robotState.readyAtTick});
  }),
  sub("RobotObservationPublished",(m,tick)=>{const p=observationMessage(m.type,m.payload),s=states.get(p.robotId);ensure(s&&p.boardId===config?.boardId&&p.observedTick===tick&&m.emittedTick===tick,"Invalid observation","COM_VIEW_CONFLICT");ensure(!s.observed||s.observed.value.observedTick<tick,"Repeated observation","COM_VIEW_CONFLICT");s.observed={value:p,cause:m};}),
  sub("AttackAccepted",ack),sub("AttackRejected",ack),
  sub("BattleStarted",(m,tick)=>{const p=battleMessage(m.type,m.payload) as Started;ensure(o.ready&&!started&&!finished&&p.startedTick===m.emittedTick+1&&tick===p.startedTick&&p.participants.every(r=>states.has(r.robotId)),"Invalid start","COM_LIFECYCLE_INVALID");started=p;}),
  sub("BattleFinished",m=>{battleMessage(m.type,m.payload);ensure(started&&!finished,"Invalid finish","COM_LIFECYCLE_INVALID");finished=true;})
 ],loopPhase:"decision",loop(c){
  if(!o.ready||!config||!started||finished||c.tick<started.startedTick)return;
  for(const profile of [...config.robots].sort((a,b)=>a.robotId<b.robotId?-1:1)){
   const s=states.get(profile.robotId)!;ensure(!s.pending||s.pending.observationTick>=c.tick,"Missing attack acknowledgment","DECISION_ACK_MISSING");
   const obs=s.observed?.value.observedTick===c.tick?s.observed:undefined,p=obs?.value,target=p?.visibleRobots[0],cause=obs?.cause??o.cause;
   if(p?.self.status==="DEFEATED")continue;
   const explain=(actionKind:string,reasonCode:string,seq?:number)=>{
    const data={battleId:config!.battleId,robotId:profile.robotId,decisionTick:c.tick,actionKind,reasonCode,...(p?{observationTick:p.observedTick}:{}),...(target?{targetRobotId:target.robotId}:{}),...(seq?{requestSequence:seq}:{})};
    validateMessage("AIDecisionPublished",data);o.emit("AIDecisionPublished",data,[cause]);
   };
   const wait=(reason:string)=>{const signature=reason+":"+(target?.robotId??"");if(s.wait!==signature){s.wait=signature;explain("WAIT",reason);}};
   if(!p){wait("NO_OBSERVATION");continue;}if(!target){wait("NO_VISIBLE_TARGET");continue;}
   ensure(terrain&&s.self&&s.self.robotRevision===p.self.robotRevision&&same(s.self,p.self.position)&&p.boardRevision===boardRevision,"Own observation conflict","COM_VIEW_CONFLICT");
   let moved=false,attacked=false,noPath=false;
   const desired=profile.behaviorId==="fixture.observe-v1"?1:profile.rangeHexes;
   if(target.distanceHexes>desired){
    const goals=terrain.tiles.filter(t=>t.passable&&!same(t,target.position)&&distance(t,target.position)<=desired&&hasLineOfSight(terrain!,t,target.position)).map(t=>({goal:t,d:distance(t,target.position),path:findPath(terrain!,p.self.position,t,[target.position])})).filter(g=>g.path.status==="FOUND");
    goals.sort((a,b)=>(profile.behaviorId==="fixture.pressure-v1"?b.d-a.d:0)||a.path.path.length-b.path.path.length||a.goal.q-b.goal.q||a.goal.r-b.goal.r);
    const next=goals[0]?.path.path[0];noPath=!next;
    if(next&&c.tick>=s.self.readyAtTick){s.moveSeq=checkedAdd(s.moveSeq,1);o.send("RequestNavigationStep",{boardId:config.boardId,robotId:profile.robotId,requestSequence:s.moveSeq,from:p.self.position,to:next,expectedRobotRevision:s.self.robotRevision,knownBoardRevision:boardRevision},[cause]);explain("MOVE",profile.behaviorId==="fixture.observe-v1"?"APPROACH_ADJACENT":"APPROACH_WEAPON_RANGE",s.moveSeq);moved=true;}
   }
   if(target.distanceHexes<=profile.rangeHexes&&c.tick>=s.readyAt&&!s.pending){
    s.attackSeq=checkedAdd(s.attackSeq,1);s.pending=frozen({battleId:config.battleId,attackerRobotId:profile.robotId,targetRobotId:target.robotId,weaponSlotId:profile.weaponSlotId,requestSequence:s.attackSeq,observationTick:c.tick});
    o.send("RequestAttack",s.pending,[cause]);explain("ATTACK","TARGET_IN_RANGE",s.attackSeq);attacked=true;
   }
   if(moved||attacked)delete s.wait;else wait(noPath?"NO_PATH":target.distanceHexes>desired&&c.tick<s.self.readyAtTick?"MOVEMENT_COOLDOWN":"WEAPON_COOLDOWN");
  }
 }};
}
