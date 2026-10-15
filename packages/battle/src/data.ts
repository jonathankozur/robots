import type {ActorContext,Message,Payload,Publisher} from "@robots/system-api";
import {ProtocolError} from "@robots/system-api";
import {frozen,ensure} from "@robots/protocol/weapons/v1";
export {frozen,ensure};
export function owner(input:Payload,context:ActorContext,configReason:string){
 const identity=frozen(input),systemId=context.systemId;
 ensure(typeof systemId==="string"&&systemId.length>0&&systemId.length<=128,"Invalid owner ID");
 ensure(typeof identity.contextId==="string"&&typeof identity.bundleId==="string"&&typeof identity.contentRevision==="string"&&Number.isSafeInteger(identity.attemptId)&&Number(identity.attemptId)>0,"Invalid APP identity");
 let publisher:Publisher|undefined,initial:Message|undefined,activation:Message|undefined,valid=false;
 function verify(m:Message,battleId?:string):void{
  ensure(initial&&m.sessionId===identity.contextId&&m.correlationId===initial.correlationId,"Wrong session or root","COM_IDENTITY_INVALID");
  if(battleId!==undefined)ensure(m.payload.battleId===battleId,"Wrong battle","COM_IDENTITY_INVALID");
 }
 function emit(type:string,value:unknown,causes:readonly Message[]):void{
  ensure(publisher,"No publisher");publisher.emit(type,1,frozen(value) as Payload,{causes});
 }
 return {
  id:systemId,identity,
  connect(p:Publisher){ensure(!publisher,"Repeated connection","COM_LIFECYCLE_INVALID");publisher=p;},
  initialize<T>(m:Message,parse:(v:unknown)=>T):T|undefined{
   ensure(!initial,"Repeated initialization","COM_LIFECYCLE_INVALID");
   ensure(m.sessionId===identity.contextId&&["contextId","attemptId","bundleId","contentRevision"].every(k=>m.payload[k]===identity[k]),"Wrong initialization identity","COM_IDENTITY_INVALID");initial=m;
   let result:T;
   try{result=parse(m.payload.view);}catch(e){
    if(!(e instanceof ProtocolError)||e.code!=="COM_PAYLOAD_INVALID")throw e;
    emit("ApplicationParticipantRejected",{...identity,participantId:systemId,reason:configReason},[m]);return;
   }
   valid=true;emit("ApplicationParticipantInitialized",{...identity,participantId:systemId},[m]);return result;
  },
  activate(m:Message){verify(m);ensure(valid&&!activation&&["contextId","attemptId","bundleId","contentRevision"].every(k=>m.payload[k]===identity[k]),"Invalid activation","COM_LIFECYCLE_INVALID");activation=m;},
  verify,emit,
  send(type:string,value:unknown,causes:readonly Message[]){ensure(publisher);publisher.send(type,1,frozen(value) as Payload,{causes});},
  get ready(){return activation!==undefined;},
  get cause(){ensure(activation||initial);return (activation??initial)!;}
 };
}

import type {World,Result} from "@robots/protocol/navigation/v1";
import type {Roster,ImpactResolved} from "@robots/protocol/damage/v1";
import {validateWorld,validateMovement} from "@robots/protocol/weapons/v1";
import {validateMessage as damageMessage} from "@robots/protocol/damage/v1";
export function moveView(world:World|undefined,value:unknown):World {
 const p=validateMovement(value);ensure(world,"World missing","COM_VIEW_CONFLICT");
 ensure(p.boardId===world.boardId,"Wrong board","COM_VIEW_CONFLICT");
 if(!p.accepted||p.duplicate)return world;
 const r=world.robots.find(r=>r.robotId===p.robotId);
 ensure(r&&p.robotState&&p.boardRevision===world.boardRevision+1&&p.robotState.robotRevision===r.robotRevision+1&&r.q===p.from.q&&r.r===p.from.r&&p.resolvedTick>=world.effectiveTick,"Noncontiguous movement","COM_VIEW_CONFLICT");
 return validateWorld({...world,boardRevision:p.boardRevision,effectiveTick:p.resolvedTick,robots:world.robots.map(r=>r.robotId===p.robotId?{...r,...p.robotState!.position,robotRevision:p.robotState!.robotRevision,readyAtTick:p.robotState!.readyAtTick}:r)});
}
export type DamageView=Omit<Roster,"damageRevision">&{readonly damageRevision:number};
export function damageView(roster:DamageView|undefined,value:unknown):DamageView {
 const p=damageMessage("ImpactResolved",value) as ImpactResolved;ensure(roster,"Roster missing","COM_VIEW_CONFLICT");
 ensure(p.battleId===roster.battleId,"Wrong battle","COM_VIEW_CONFLICT");if(p.duplicate)return roster;
 const r=roster.robots.find(r=>r.robotId===p.targetRobotId);
 ensure(r&&p.damageRevision===roster.damageRevision+1&&p.maxIntegrityUnits===r.maxIntegrityUnits&&r.integrityUnits-p.integrityUnits===p.appliedImpactUnits&&p.resolvedTick>=roster.effectiveTick,"Noncontiguous damage","COM_VIEW_CONFLICT");
 return frozen({...roster,damageRevision:p.damageRevision,effectiveTick:p.resolvedTick,robots:roster.robots.map(r=>r.robotId===p.targetRobotId?{...r,integrityUnits:p.integrityUnits,status:p.targetStatus}:r)});
}
