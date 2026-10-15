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
