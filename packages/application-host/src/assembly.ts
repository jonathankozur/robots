import { Session, createSimulationEnvironment } from "@robots/runtime";
import type { Contract, FieldRule, Message, Payload, Publisher, SystemDefinition } from "@robots/system-api";
import type { ReplayRecording } from "@robots/runtime";
import type { Recipe } from "./contracts.ts";
import { copy, fail } from "./data.ts";
export interface Resource { dispose: () => void; released: boolean }
export interface Runtime {
  identity: Payload; initial: Payload; session: Session | null; resources: Resource[]; replayHorizon?: number;
  observe: () => Observation;
}
export interface Observation { readonly ready: boolean; readonly rejected: string | null; readonly pendingParticipants: readonly string[]; readonly observations: Readonly<Record<string,Payload>> }
import { APPLICATION_IDENTITY_KEYS, initializationDefinition } from "@robots/protocol/application/v1";
import { bindApplicationContracts, bindMessage } from "./bindings.ts";
export function assemble(recipe: Recipe, target: Runtime, runtime: string, debug: boolean, recording?: ReplayRecording): void {
  const required=recipe.participants.map(p=>p.id).sort();
  const output={ready:false,rejected:null as string|null,pending:new Set(required),observations:{} as Record<string,Payload>};
  target.observe=()=>copy({ready:output.ready,rejected:output.rejected,pendingParticipants:[...output.pending].sort(),observations:output.observations});
  const viewFields: Record<string,FieldRule> = Object.fromEntries(recipe.participants.map(p=>[p.id,{type:"object",fields:p.fields}]));
  const contracts: Contract[]=[...bindApplicationContracts(recipe.participants,viewFields),...recipe.contracts];
  let installing=true;
  const actors=(()=>{try{return recipe.participants.map(p=>{
    contracts.push(bindMessage(initializationDefinition(p.initializationType,p.fields),{responsibleSystemId:p.id,producers:[{systemId:"app-coordinator",phases:["input"]}]}));
    return p.create(target.identity,dispose=>{
      if(!installing)fail("APP_RESOURCE_CONTEXT","Resources may only register during factory creation");
      if(typeof dispose!=="function") fail("INVALID_REQUEST","Resource cleanup must be callable");
      target.resources.push({dispose,released:false});
    },Object.freeze({systemId:p.id}));
  });}finally{installing=false;}})();
  let publisher: Publisher, root: Message | null=null, decision=false, rejected:string|null=null, started=0;
  const confirmations=new Map<string,Message>();
  function sameIdentity(m:Message):void {
    for(const key of APPLICATION_IDENTITY_KEYS) if(m.payload[key]!==target.identity[key]) fail("APP_IDENTITY","Unexpected initialization identity");
  }
  const systems: SystemDefinition[]=[
    {id:"app-bootstrap",kind:"adapter"},
    {id:"app-coordinator",loopPhase:"publication",loop(context){
      if(!root||decision) return;
      const pending=required.filter(id=>!confirmations.has(id));
      if(!rejected && pending.length && context.tick-started+1<(target.initial.initializationMaxTicks as number)) return;
      decision=true;
      if(rejected||pending.length) publisher.emit("ApplicationInitializationRejected",1,{...target.identity,reason:rejected?"PARTICIPANT_REJECTED":"INITIALIZATION_LIMIT",pendingParticipants:pending},{causes:[root]});
      else publisher.emit("ApplicationContextReady",1,{...target.identity,participants:required},{causes:[...confirmations.values()]});
    }},
    ...recipe.participants.map((p,i)=>({id:p.id,...(actors[i]!.loop ? {loop:actors[i]!.loop,loopPhase:actors[i]!.loopPhase!}: {})})),
    {id:"app-output"},
  ];
  const session=new Session({sessionId:target.identity.contextId as string,revision:recipe.revision,runtime,debug,
    environment:createSimulationEnvironment(target.initial.seed as string,[],systems),initialState:target.initial,contracts,systems});
  target.session=session; publisher=session.publisher("app-coordinator");
  const begin=copy({...target.identity,requiredParticipants:required,initializationMaxTicks:target.initial.initializationMaxTicks,views:target.initial.views}) as Payload;
  session.subscribe("app-coordinator","BeginApplicationContext",1,"input",(m,c)=>{
    if(root || JSON.stringify(m.payload)!==JSON.stringify(begin)) fail("APP_BEGIN","Unexpected or repeated initialization");
    root=m; started=c.tick;
    for(const p of recipe.participants) publisher.send(p.initializationType,1,{...target.identity,view:(m.payload.views as Payload)[p.id]!});
  });
  for(const type of ["ApplicationParticipantInitialized","ApplicationParticipantRejected"]) {
    session.subscribe("app-coordinator",type,1,"publication",m=>{
      sameIdentity(m); const participant=m.payload.participantId as string;
      if(participant!==m.sourceSystemId||!required.includes(participant)) fail("APP_PARTICIPANT","Confirmation source does not match owner");
      if(!root||m.correlationId!==root.correlationId)fail("APP_CONFIRMATION_ROOT","Confirmation belongs to another initialization root");
      const prior=confirmations.get(participant);
      if(prior && (prior.type!==m.type||JSON.stringify(prior.payload)!==JSON.stringify(m.payload))) fail("APP_CONFIRMATION_CONFLICT","Conflicting confirmation");
      if(decision) return;
      if(type==="ApplicationParticipantRejected") { rejected=m.payload.reason as string; confirmations.set(participant,m); }
      else confirmations.set(participant,m);
    });
    session.subscribe("app-output",type,1,"publication",m=>{ if(type==="ApplicationParticipantInitialized") output.pending.delete(m.payload.participantId as string); });
  }
  recipe.participants.forEach((p,i)=>{
    const actor=actors[i]!; actor.connect(session.publisher(p.id));
    session.subscribe(p.id,p.initializationType,1,p.phase,actor.initialize);
    session.subscribe(p.id,"ApplicationContextReady",1,"input",actor.activate);
    for(const sub of actor.subscriptions??[]) session.subscribe(p.id,sub.type,sub.version,sub.phase,sub.handler);
  });
  session.subscribe("app-output","ApplicationContextReady",1,"input",()=>{output.ready=true;});
  session.subscribe("app-output","ApplicationInitializationRejected",1,"input",m=>{output.rejected=m.payload.reason as string;});
  for(const reference of recipe.outputTypes) session.subscribe("app-output",reference.type,reference.version,"publication",m=>{output.observations[m.sourceSystemId]=m.payload;});
  if(recording) session.loadReplay(recording);
  session.start();
  if(!recording) session.stageExternalInput("app-bootstrap",{sessionId:target.identity.contextId as string,type:"BeginApplicationContext",version:1,payload:begin});
}
