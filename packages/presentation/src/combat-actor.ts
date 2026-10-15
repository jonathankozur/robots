import type {Actor,ActorContext,Payload,Message} from "@robots/system-api";
import {checkedAdd} from "@robots/values/numeric";
import {validateWorld,validateMovement,validateMessage as weaponMessage} from "@robots/protocol/weapons/v1";
import type {World,Result} from "@robots/protocol/navigation/v1";
import {validateMessage as damageMessage} from "@robots/protocol/damage/v1";
import type {Roster,ImpactResolved,ImpactRejected} from "@robots/protocol/damage/v1";
import {validateMessage as decisionMessage} from "@robots/protocol/decision/v1";
import {validateMessage as battleMessage} from "@robots/protocol/battle/v1";
import type {Started,Finished} from "@robots/protocol/battle/v1";
import {validateInitialView,validateMessage} from "@robots/protocol/presentation/v2";
import type {InitialView,RecentEvent,CombatView} from "@robots/protocol/presentation/v2";
import {owner,ensure,frozen,moveView,damageView,type DamageView} from "./combat-data.ts";
export function createCombatPresentationActor(identity:Payload,context:ActorContext={systemId:"presentation"}):Actor{
 const o=owner(identity,context,"PRESENTATION_CONFIG_INVALID");
 let config:InitialView|undefined,world:World|undefined,roster:DamageView|undefined,started:Started|undefined,result:Finished|undefined,sequence=0,terminal=false,lastCause:Message|undefined;
 const buffer:{m:Message;tick:number}[]=[],events:RecentEvent[]=[];
 const types=["NavigationWorldReady","NavigationStepResolved","DamageRosterInitialized","ImpactResolved","ImpactRejected","AttackAccepted","AttackRejected","AIDecisionPublished","BattleStarted","BattleFinished"];
 function effective(m:Message):number {
  const p=m.payload;
  switch(m.type){
   case "NavigationWorldReady":validateWorld(p);return p.effectiveTick as number;
   case "NavigationStepResolved":validateMovement(p);return p.resolvedTick as number;
   case "DamageRosterInitialized":damageMessage(m.type,p);return p.effectiveTick as number;
   case "ImpactResolved":case "ImpactRejected":damageMessage(m.type,p);return p.resolvedTick as number;
   case "AttackAccepted":weaponMessage(m.type,p);return p.acceptedTick as number;
   case "AttackRejected":weaponMessage(m.type,p);return p.resolvedTick as number;
   case "AIDecisionPublished":decisionMessage(m.type,p);return p.decisionTick as number;
   case "BattleStarted":battleMessage(m.type,p);return p.startedTick as number;
   default:battleMessage(m.type,p);return p.finishedTick as number;
  }
 }
 return {connect:o.connect,initialize(m){config=o.initialize(m,validateInitialView);},activate:o.activate,
 subscriptions:types.map(type=>({type,version:1,phase:"action",handler(m,c){
  o.verify(m,type.startsWith("Navigation")?undefined:config?.battleId);ensure(!terminal,"Facts after terminal projection","COM_LIFECYCLE_INVALID");
  ensure(buffer.length<256,"Projection buffer exhausted","COM_CAPACITY_EXCEEDED");
  const tick=effective(m);ensure(tick<=c.tick&&(type!=="BattleStarted"||tick===m.emittedTick+1),"Future fact","COM_VIEW_CONFLICT");buffer.push({m,tick});
 }})),
 loopPhase:"action",loop(c){
  if(!o.ready||!config||terminal||c.tick===0)return;
  const cut=c.tick-1,causes:Message[]=[],movements:CombatView["movements"][number][]=[];
  buffer.sort((a,b)=>a.tick-b.tick||a.m.messageId-b.m.messageId);
  while(buffer[0]&&buffer[0].tick<=cut){
   const {m,tick}=buffer.shift()!,p=m.payload as any;causes.push(m);
   const base={tick,sourceMessageId:m.messageId,robotId:p.attackerRobotId??p.robotId};
   let event:RecentEvent|undefined;
   switch(m.type){
    case "NavigationWorldReady":ensure(!world,"Repeated world","COM_VIEW_CONFLICT");world=validateWorld(p);ensure(world.boardId===config.boardId&&world.boardRevision===0,"Wrong world","COM_VIEW_CONFLICT");break;
    case "NavigationStepResolved":
     world=moveView(world,p);if(p.accepted&&!p.duplicate){movements.push(frozen({...p,sourceMessageId:m.messageId}));event={...base,kind:"MOVE",from:p.from,to:p.to};}break;
    case "DamageRosterInitialized":ensure(!roster,"Repeated roster","COM_VIEW_CONFLICT");roster=damageMessage(m.type,p) as Roster;lastCause=m;break;
    case "ImpactResolved":roster=damageView(roster,p);if(!p.duplicate)event={...base,kind:"DAMAGE",targetRobotId:p.targetRobotId,weaponSlotId:p.weaponSlotId,amountUnits:p.appliedImpactUnits,integrityUnits:p.integrityUnits};break;
    case "ImpactRejected":case "AttackRejected":if(!p.duplicate)event={...base,kind:m.type==="ImpactRejected"?"IMPACT_REJECTED":"ATTACK_REJECTED",targetRobotId:p.targetRobotId,weaponSlotId:p.weaponSlotId,reasonCode:p.reasonCode};break;
    case "AttackAccepted":if(!p.duplicate)event={...base,kind:"ATTACK",targetRobotId:p.targetRobotId,weaponSlotId:p.weaponSlotId};break;
    case "AIDecisionPublished":event={...base,kind:"DECISION",actionKind:p.actionKind,reasonCode:p.reasonCode,...(p.targetRobotId?{targetRobotId:p.targetRobotId}:{})};break;
    case "BattleStarted":ensure(!started&&!result,"Repeated start","COM_LIFECYCLE_INVALID");started=battleMessage(m.type,p) as Started;lastCause=m;break;
    case "BattleFinished":ensure(started&&!result,"Repeated finish","COM_LIFECYCLE_INVALID");result=battleMessage(m.type,p) as Finished;lastCause=m;break;
   }
   if(event)events.push(frozen(event));
  }
  if(!world||!roster)return;
  ensure(movements.length<=2,"Movement capacity","COM_CAPACITY_EXCEEDED");
  events.sort((a,b)=>a.tick-b.tick||a.sourceMessageId-b.sourceMessageId);if(events.length>64)events.splice(0,events.length-64);
  sequence=checkedAdd(sequence,1);
  const view=validateMessage({contextId:identity.contextId,battleId:config.battleId,boardId:config.boardId,sequence,observedTick:cut,world,assemblies:config.assemblies,movements,damageRevision:roster.damageRevision,combatants:roster.robots,stage:result?"FINISHED":started?"ACTIVE":"READY",...(started?{started}:{}),...(result?{result}:{}),events});
  o.emit("PresentationViewPublished",view,causes.length?causes:[lastCause??o.cause],2);terminal=!!result;
 }
 };
}
