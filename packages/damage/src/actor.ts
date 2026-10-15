import type {Actor,ActorContext,Payload,Message} from "@robots/system-api";
import {checkedAdd} from "@robots/values/numeric";
import {validateInitialView,validateMessage} from "@robots/protocol/damage/v1";
import type {InitialView,Combatant,ImpactRequested,ImpactResolved,ImpactRejected} from "@robots/protocol/damage/v1";
import {validateMessage as battleMessage} from "@robots/protocol/battle/v1";
import type {Started,Finished} from "@robots/protocol/battle/v1";
import {owner,frozen,ensure} from "./data.ts";
export function createDamageActor(identity:Payload,context:ActorContext={systemId:"damage"}):Actor {
 const o=owner(identity,context,"DAMAGE_CONFIG_INVALID");
 let config:InitialView|undefined,rosterPublished=false,started:Started|undefined,finished=false,revision=0;
 const robots=new Map<string,Combatant>(),queue:Message[]=[];
 type Reply={type:"ImpactResolved"|"ImpactRejected";payload:ImpactResolved|ImpactRejected};
 const registers=new Map<string,{high:number;entries:Map<number,{body:string;reply:Reply}>}>();
 const roster=()=>[...robots.values()].sort((a,b)=>a.robotId<b.robotId?-1:a.robotId>b.robotId?1:0);
 function publish(type:string,payload:unknown,causes:readonly Message[]){validateMessage(type,payload);o.emit(type,payload,causes);}
 return {
  connect:o.connect,
  initialize(m){
   config=o.initialize(m,validateInitialView);
   if(config)for(const r of config.robots){robots.set(r.robotId,frozen({...r,status:"ACTIVE"}));registers.set(r.robotId,{high:0,entries:new Map()});}
  },
  activate:o.activate,
  subscriptions:[
   {type:"BattleStarted",version:1,phase:"resolution",handler(m,c){
    o.verify(m,config?.battleId);const p=battleMessage(m.type,m.payload) as Started;
    ensure(o.ready&&!started&&!finished&&p.startedTick===m.emittedTick+1&&p.startedTick===c.tick,"Invalid battle start","COM_LIFECYCLE_INVALID");
    ensure(p.participants.every(x=>robots.get(x.robotId)?.teamId===x.teamId),"Wrong participants","COM_VIEW_CONFLICT");started=p;
   }},
   {type:"BattleFinished",version:1,phase:"resolution",handler(m){
    o.verify(m,config?.battleId);const p=battleMessage(m.type,m.payload) as Finished;
    ensure(started&&!finished&&p.damageRevision===revision&&p.finishedTick===m.emittedTick,"Invalid battle finish","COM_VIEW_CONFLICT");
    ensure(p.robots.every(x=>{const r=robots.get(x.robotId);return r&&r.teamId===x.teamId&&r.integrityUnits===x.integrityUnits&&r.maxIntegrityUnits===x.maxIntegrityUnits&&r.status===x.status;}),"Final roster mismatch","COM_VIEW_CONFLICT");finished=true;
   }},
   {type:"ImpactRequested",version:1,phase:"resolution",handler(m){
    o.verify(m,config?.battleId);validateMessage(m.type,m.payload);ensure(queue.length<256,"Impact queue exhausted","COM_CAPACITY_EXCEEDED");queue.push(m);
   }}
  ],
  loopPhase:"resolution",loop(c){
   if(o.ready&&config&&!rosterPublished){publish("DamageRosterInitialized",{battleId:config.battleId,effectiveTick:c.tick,damageRevision:0,robots:roster()},[o.cause]);rosterPublished=true;}
   const active=new Set([...robots.values()].filter(r=>r.status==="ACTIVE").map(r=>r.robotId));
   const responses:{reply:Reply;cause:Message}[]=[];
   for(const m of queue.sort((a,b)=>a.messageId-b.messageId)){
    const p=m.payload as unknown as ImpactRequested,body=JSON.stringify(p),registry=registers.get(p.attackerRobotId),cached=registry?.entries.get(p.requestSequence);
    if(cached&&cached.body===body){responses.push({reply:{type:cached.reply.type,payload:frozen({...cached.reply.payload,duplicate:true})},cause:m});continue;}
    ensure(p.acceptedTick===c.tick&&m.emittedTick===c.tick,"Invalid impact tick");
    let reason=cached?"REQUEST_CONFLICT":registry&&p.requestSequence<=registry.high?"REQUEST_EXPIRED":"";
    const attacker=robots.get(p.attackerRobotId),target=robots.get(p.targetRobotId);
    if(!reason)reason=!started||!o.ready?"NOT_READY":finished?"BATTLE_FINISHED":!attacker?"ATTACKER_UNKNOWN":!target?"TARGET_UNKNOWN":p.attackerRobotId===p.targetRobotId?"SELF_TARGET":attacker.teamId===target.teamId?"FRIENDLY_TARGET":!active.has(p.attackerRobotId)?"ATTACKER_DEFEATED":!active.has(p.targetRobotId)?"TARGET_DEFEATED":p.impactUnits<=0?"NON_POSITIVE_IMPACT":"";
    const ref={battleId:p.battleId,attackerRobotId:p.attackerRobotId,targetRobotId:p.targetRobotId,weaponSlotId:p.weaponSlotId,requestSequence:p.requestSequence,acceptedTick:p.acceptedTick,resolvedTick:c.tick,duplicate:false};
    let reply:Reply;
    if(reason)reply={type:"ImpactRejected",payload:{...ref,reasonCode:reason}};
    else{
     const amount=Math.min(target!.integrityUnits,p.impactUnits),integrity=target!.integrityUnits-amount;
     const updated:Combatant=frozen({...target!,integrityUnits:integrity,status:integrity===0?"DEFEATED":"ACTIVE"});
     robots.set(updated.robotId,updated);revision=checkedAdd(revision,1);
     reply={type:"ImpactResolved",payload:{...ref,requestedImpactUnits:p.impactUnits,appliedImpactUnits:amount,integrityUnits:integrity,maxIntegrityUnits:updated.maxIntegrityUnits,targetStatus:updated.status,damageRevision:revision}};
    }
    if(registry&&!cached&&p.requestSequence>registry.high){
     registry.high=p.requestSequence;registry.entries.set(p.requestSequence,{body,reply:frozen(reply)});
     if(registry.entries.size>64)registry.entries.delete(registry.entries.keys().next().value!);
    }
    responses.push({reply,cause:m});
   }
   queue.length=0;
   for(const {reply,cause} of responses)publish(reply.type,reply.payload,[cause]);
  }
 };
}
