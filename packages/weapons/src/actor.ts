import type {Actor,ActorContext,Payload,Message} from "@robots/system-api";
import {checkedAdd} from "@robots/values/numeric";
import {distance,hasLineOfSight} from "@robots/values/hex-grid";
import {validateInitialView,validateMessage,validateWorld} from "@robots/protocol/weapons/v1";
import type {InitialView,RequestAttack,AttackAccepted,AttackRejected} from "@robots/protocol/weapons/v1";
import type {World} from "@robots/protocol/navigation/v1";
import type {Roster} from "@robots/protocol/damage/v1";
import {validateMessage as damageMessage} from "@robots/protocol/damage/v1";
import {validateMessage as observationMessage} from "@robots/protocol/perception/v1";
import type {Observation} from "@robots/protocol/perception/v1";
import {validateMessage as battleMessage} from "@robots/protocol/battle/v1";
import type {Started} from "@robots/protocol/battle/v1";
import {owner,frozen,ensure,moveView,damageView,type DamageView} from "./data.ts";
export function createWeaponsActor(identity:Payload,context:ActorContext={systemId:"weapons"}):Actor{
 const o=owner(identity,context,"WEAPONS_CONFIG_INVALID");
 let config:InitialView|undefined,world:World|undefined,roster:DamageView|undefined,started:Started|undefined,finished=false;
 const observations=new Map<string,Observation>(),ready=new Map<string,number>(),queue:Message[]=[];
 type Reply={type:"AttackAccepted"|"AttackRejected";payload:AttackAccepted|AttackRejected};
 const requests=new Map<string,{high:number;entries:Map<number,{body:string;reply:Reply}>}>();
 const subscription=(type:string,handler:(m:Message,tick:number)=>void)=>({type,version:1,phase:"action" as const,handler(m:Message,c:{tick:number}){o.verify(m,type.startsWith("Navigation")?undefined:config?.battleId);handler(m,c.tick);}});
 return {
  connect:o.connect,initialize(m){config=o.initialize(m,validateInitialView);if(config)for(const w of config.weapons){ready.set(w.robotId,0);requests.set(w.robotId,{high:0,entries:new Map()});}},activate:o.activate,
  subscriptions:[
   subscription("NavigationWorldReady",m=>{ensure(!world,"Repeated world","COM_VIEW_CONFLICT");world=validateWorld(m.payload);ensure(world.boardId===config?.boardId);}),
   subscription("NavigationStepResolved",m=>{world=moveView(world,m.payload);}),
   subscription("DamageRosterInitialized",m=>{ensure(!roster,"Repeated roster","COM_VIEW_CONFLICT");roster=damageMessage(m.type,m.payload) as Roster;}),
   subscription("ImpactResolved",m=>{roster=damageView(roster,m.payload);}),
   subscription("BattleStarted",(m,tick)=>{const p=battleMessage(m.type,m.payload) as Started;ensure(o.ready&&!started&&!finished&&p.startedTick===m.emittedTick+1&&tick===p.startedTick,"Invalid start","COM_LIFECYCLE_INVALID");ensure(p.participants.every(r=>config?.weapons.some(w=>w.robotId===r.robotId)),"Wrong participants","COM_VIEW_CONFLICT");started=p;}),
   subscription("BattleFinished",m=>{battleMessage(m.type,m.payload);ensure(started&&!finished,"Invalid finish","COM_LIFECYCLE_INVALID");finished=true;}),
   subscription("RobotObservationPublished",(m,tick)=>{const p=observationMessage(m.type,m.payload);ensure(p.boardId===config?.boardId&&p.observedTick===tick&&m.emittedTick===tick,"Invalid observation cut","COM_VIEW_CONFLICT");ensure(!observations.has(p.robotId)||observations.get(p.robotId)!.observedTick<tick,"Repeated observation","COM_VIEW_CONFLICT");observations.set(p.robotId,p);}),
   subscription("RequestAttack",m=>{validateMessage(m.type,m.payload);ensure(queue.length<256,"Attack queue exhausted","COM_CAPACITY_EXCEEDED");queue.push(m);})
  ],
  loopPhase:"action",loop(c){
   for(const m of queue.sort((a,b)=>a.messageId-b.messageId)){
    const p=m.payload as unknown as RequestAttack,registry=requests.get(p.attackerRobotId),body=JSON.stringify(p),cached=registry?.entries.get(p.requestSequence);
    if(cached&&cached.body===body){o.emit(cached.reply.type,{...cached.reply.payload,duplicate:true},[m]);continue;}
    const weapon=config?.weapons.find(w=>w.robotId===p.attackerRobotId),a=roster?.robots.find(r=>r.robotId===p.attackerRobotId),b=roster?.robots.find(r=>r.robotId===p.targetRobotId),ap=world?.robots.find(r=>r.robotId===p.attackerRobotId),bp=world?.robots.find(r=>r.robotId===p.targetRobotId),obs=observations.get(p.attackerRobotId);
    let reason=cached?"REQUEST_CONFLICT":registry&&p.requestSequence<=registry.high?"REQUEST_EXPIRED":!o.ready||!started||c.tick<started.startedTick?"BATTLE_NOT_STARTED":finished?"BATTLE_FINISHED":!a?"ATTACKER_UNKNOWN":!b?"TARGET_UNKNOWN":!weapon||weapon.weaponSlotId!==p.weaponSlotId?"WEAPON_UNKNOWN":a.robotId===b.robotId?"SELF_TARGET":a.teamId===b.teamId?"FRIENDLY_TARGET":a.status!=="ACTIVE"?"ATTACKER_DEFEATED":b.status!=="ACTIVE"?"TARGET_DEFEATED":!world||!roster||!ap||!bp?"VIEW_NOT_READY":p.observationTick!==c.tick||m.emittedTick!==c.tick||obs?.observedTick!==c.tick?"STALE_OBSERVATION":!obs.visibleRobots.some(r=>r.robotId===p.targetRobotId)?"TARGET_NOT_VISIBLE":distance(ap,bp)>weapon.rangeHexes?"OUT_OF_RANGE":!hasLineOfSight(world,ap,bp)?"LINE_BLOCKED":c.tick<ready.get(p.attackerRobotId)!?"WEAPON_NOT_READY":"";
    const ref={battleId:p.battleId,attackerRobotId:p.attackerRobotId,targetRobotId:p.targetRobotId,weaponSlotId:p.weaponSlotId,requestSequence:p.requestSequence,duplicate:false};
    let reply:Reply;
    if(reason)reply={type:"AttackRejected",payload:{...ref,resolvedTick:c.tick,reasonCode:reason}};
    else{const readyAtTick=checkedAdd(c.tick,weapon!.reloadTicks);ready.set(p.attackerRobotId,readyAtTick);reply={type:"AttackAccepted",payload:{...ref,observationTick:p.observationTick,acceptedTick:c.tick,readyAtTick}};}
    if(registry&&!cached&&p.requestSequence>registry.high){registry.high=p.requestSequence;registry.entries.set(p.requestSequence,{body,reply:frozen(reply)});if(registry.entries.size>64)registry.entries.delete(registry.entries.keys().next().value!);}
    validateMessage(reply.type,reply.payload);o.emit(reply.type,reply.payload,[m]);
    if(reply.type==="AttackAccepted")o.send("ImpactRequested",{battleId:p.battleId,attackerRobotId:p.attackerRobotId,targetRobotId:p.targetRobotId,weaponSlotId:p.weaponSlotId,requestSequence:p.requestSequence,acceptedTick:c.tick,impactUnits:weapon!.impactUnits},[m]);
    // Impact uses the accepted weapon configuration; its contract omits observationTick.
   }queue.length=0;
  }
 };
}
