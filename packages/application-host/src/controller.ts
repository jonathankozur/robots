import { ProtocolError, PHASES } from "@robots/system-api";
import type { Payload } from "@robots/system-api";
import type { ReplayRecording, TraceSnapshot, DebugRecord } from "@robots/runtime";
import { validateContentBundle } from "@robots/content";
import type { Recipe, ApplicationState, Result, ApplicationSnapshot } from "./contracts.ts";
import { copy, shape, id, fail, validateFields } from "./data.ts";
import { assemble } from "./assembly.ts";
import type { Runtime } from "./assembly.ts";
const rejected=(code:string,message:string):Result=>Object.freeze({ok:false,code,message});
const success=(contextId:string):Result=>Object.freeze({ok:true,contextId});
export class ApplicationController {
  #recipe:Recipe; #instance:string; #runtime:string; #generation=0;
  #state:ApplicationState="idle"; #active:Runtime|null=null; #busy=false;
  #memo=new Map<string,{body:string;result:Result}>(); #orphans:Runtime[]=[];
  #failure:Payload|null=null; #last:TraceSnapshot|null=null;
  #logs:{contextId:string;records:readonly DebugRecord[]}[]=[];
  constructor(options:{instanceId:string;runtime:string;recipe:Recipe}) {
    id(options.instanceId,100); id(options.runtime,1024); const r=options.recipe;
    id(r.id); id(r.revision);
    if(!Array.isArray(r.participants)||r.participants.length<1||r.participants.length>32||typeof r.prepare!=="function") fail("INVALID_REQUEST","Invalid recipe");
    const seen=new Set<string>(), commands=new Set<string>();
    const parts=r.participants.map(p=>{
      id(p.id); id(p.initializationType);
      if(p.id.startsWith("app-") && ["app-bootstrap","app-coordinator","app-output"].includes(p.id) || seen.has(p.id)||commands.has(p.initializationType)||!PHASES.includes(p.phase)||typeof p.create!=="function") fail("INVALID_REQUEST","Duplicate or invalid participant");
      seen.add(p.id);commands.add(p.initializationType);
      return Object.freeze({...p,fields:copy(p.fields)});
    });
    this.#recipe=Object.freeze({id:r.id,revision:r.revision,participants:Object.freeze(parts),contracts:copy(r.contracts),outputTypes:copy(r.outputTypes),prepare:r.prepare});
    this.#instance=options.instanceId;this.#runtime=options.runtime;
  }
  request(value:unknown):Result {
    if(this.#busy) return rejected("BUSY","An operation is in progress");
    let data:Payload;
    try { data=copy(value) as Payload; shape(data,["requestId","seed","content","selection"],["initializationMaxTicks","debug","restore"]); id(data.requestId); }
    catch(e){return this.#error(e);}
    const key=data.requestId as string,body=JSON.stringify(data),prior=this.#memo.get(key);
    if(prior) return prior.body===body?prior.result:rejected("REQUEST_CONFLICT","Request ID reused with other data");
    if(this.#memo.size>=128) return rejected("REQUEST_CAPACITY","Request registry is full");
    if(this.#state==="initializing"||this.#state==="preparing"||this.#state==="closing") return rejected("BUSY","Initialization or transition is pending");
    if(this.#state==="faulted") return rejected("CLOSE_REQUIRED","Close and clean the failed context first");
    if(this.#active?.session?.diagnostics().tickInProgress) return rejected("TICK_IN_PROGRESS","Complete the tick or explicitly close it");
    this.#busy=true;const previous=this.#state;this.#state="preparing";
    let target:Runtime|null=null;
    let result:Result;
    try {
      const max=data.initializationMaxTicks??10;
      if(!Number.isSafeInteger(max)||(max as number)<1||(max as number)>10000 || (data.debug!==undefined&&typeof data.debug!=="boolean")) fail("INVALID_REQUEST","Invalid initialization budget or debug option");
      const validated=validateContentBundle(data.content); if(!validated.ok) fail("INVALID_REQUEST",validated.issues.map(i=>i.code+" "+i.path).join("; "));
      shape(data.selection,[],Object.keys(data.selection as Payload));
      let views=copy(this.#recipe.prepare(validated.content,data.selection));
      shape(views,this.#recipe.participants.map(p=>p.id));
      if(data.restore!==undefined) {
        const restore=data.restore;shape(restore,["version","recipeId","checkpointId","revision","parts"]);id(restore.checkpointId);id(restore.revision);
        if(restore.version!==1||restore.recipeId!==this.#recipe.id||!Array.isArray(restore.parts)||restore.parts.length!==this.#recipe.participants.length) fail("INVALID_REQUEST","Restored parts do not match recipe");
        const restored:Record<string,Payload>={};
        for(const part of restore.parts) { shape(part,["ownerId","version","revision","data"]);id(part.ownerId);
          if(part.version!==1||part.revision!==restore.revision||Object.hasOwn(restored,part.ownerId)||!this.#recipe.participants.some(p=>p.id===part.ownerId)) fail("INVALID_REQUEST","Incomplete or conflicting restoration");
          restored[part.ownerId]=part.data as Payload;
        }
        views=copy(restored);
      }
      for(const p of this.#recipe.participants) validateFields(views[p.id]!,p.fields);
      if(!Number.isSafeInteger(this.#generation+1)) fail("INVALID_REQUEST","Context sequence exhausted");
      const generation=++this.#generation,contextId=this.#instance+":"+generation;
      const identity=copy({contextId,attemptId:generation,bundleId:validated.content.bundleId,contentRevision:validated.content.contentRevision}) as Payload;
      const initial=copy({identity,recipeId:this.#recipe.id,recipeRevision:this.#recipe.revision,content:validated.content,seed:data.seed,selection:data.selection,
        initializationMaxTicks:max,source:data.restore===undefined?"new":"restored-fixture",restoration:data.restore??null,views}) as unknown as Payload;
      target={identity,initial,session:null,resources:[],observe:()=>fail("STATE_INVALID","No observer before assembly")};
      assemble(this.#recipe,target,this.#runtime,data.debug===true);
      if(this.#active) {
        this.#state="closing";
        if(!this.#dispose(this.#active)) { this.#dispose(target); if(target.resources.some(r=>!r.released))this.#orphans.push(target); target=null; fail("CLEANUP_FAILED","Previous resources remain active"); }
      }
      this.#active=target;target=null;this.#failure=null;this.#state="initializing";
      result=success(this.#active.identity.contextId as string);
    } catch(e) {
      if(target && !this.#dispose(target))this.#orphans.push(target);
      if(this.#orphans.length||this.#active?.resources.some(r=>!r.released)&&this.#active.session?.state==="closed")this.#state="faulted";
      else this.#state=previous;
      result=this.#error(e);
    } finally {this.#busy=false;}
    this.#memo.set(key,{body,result});return result;
  }
  #error(e:unknown):Result {return rejected(e instanceof ProtocolError?e.code:"INVALID_REQUEST",e instanceof Error?e.message:"Operation failed");}
  #collect(target:Runtime):void {const records=target.session?.drainDebugLog()??[];if(records.length)this.#logs.push({contextId:target.identity.contextId as string,records});}
  #dispose(target:Runtime):boolean {
    const errors:string[]=[];
    try{target.session?.close("application-close");this.#collect(target);}catch(e){errors.push(String(e));}
    for(const r of target.resources)if(!r.released){try{const result:unknown=r.dispose();if(result instanceof Promise)void result.catch(()=>{});if(result!==undefined)throw new Error("Cleanup must be synchronous");r.released=true;}catch(e){errors.push(String(e));}}
    if(errors.length){this.#failure=copy({code:"CLEANUP_FAILED",message:errors.join("; ")});return false;}return true;
  }
  advance(kind:"step"|"phase"|"tick"="tick"):Result {
    if(this.#busy)return rejected("BUSY","An operation is in progress");
    if(!this.#active||!["initializing","ready"].includes(this.#state))return rejected("STATE_INVALID","No executable context");
    const target=this.#active,session=target.session!;
    if(target.replayHorizon!==undefined&&session.diagnostics().nextTick>=target.replayHorizon)return rejected("REPLAY_HORIZON","Recorded horizon completed");
    this.#busy=true;
    try {
      if(kind==="step")session.step();else if(kind==="phase")session.stepPhase();else if(kind==="tick")session.advanceTick();else fail("INVALID_REQUEST","Unknown advance operation");
      const d=session.diagnostics(),observation=target.observe();
      if(observation.rejected){this.#failure=copy({code:observation.rejected,message:"Initialization rejected"});this.#dispose(target);this.#state="faulted";return rejected(observation.rejected,"Initialization rejected");}
      else if(observation.ready&&d.phase===null)this.#state="ready";
      this.#collect(target);return success(target.identity.contextId as string);
    } catch(e) {
      this.#failure=copy(session.diagnostics().failure??{code:"APPLICATION_FAILED",message:String(e)}) as unknown as Payload;
      this.#dispose(target);this.#state="faulted";return this.#error(e);
    } finally {this.#busy=false;}
  }
  stage(contextId:string|null,type:string,payload:unknown):boolean {
    if(!contextId||this.#active?.replayHorizon!==undefined||this.#busy||this.#state!=="ready"||contextId!==this.#active?.identity.contextId)return false;
    const contract=this.#recipe.contracts.find(c=>c.type===type&&c.kind==="command"&&c.producers.some(p=>p.systemId==="app-bootstrap"&&p.phases.includes("input")));
    if(!contract)return false;
    try {const data=copy(payload) as Payload;validateFields(data,contract.fields);return this.#active.session!.stageExternalInput("app-bootstrap",{sessionId:contextId,type,version:1,payload:data});}
    catch(e){this.#failure=copy({code:"INVALID_INPUT",message:String(e)});if(this.#active.session!.state==="failed"){this.#dispose(this.#active);this.#state="faulted";}return false;}
  }
  close():Result {
    if(this.#busy)return rejected("BUSY","An operation is in progress");this.#busy=true;this.#state="closing";
    try {
      let clean=true;
      if(this.#active){clean=this.#dispose(this.#active);this.#last=this.#active.session?.trace()??null;}
      this.#orphans=this.#orphans.filter(t=>!this.#dispose(t));
      if(!clean||this.#orphans.length){this.#state="faulted";return rejected("CLEANUP_FAILED","Retry cleanup explicitly");}
      this.#active=null;this.#state="idle";return success("");
    }finally{this.#busy=false;}
  }
  snapshot():ApplicationSnapshot {
    const t=this.#active,observation=t?.observe();
    return copy({state:this.#state,contextId:(t?.identity.contextId as string|undefined)??null,attemptId:(t?.identity.attemptId as number|undefined)??null,pendingParticipants:observation?.pendingParticipants??[],
      observations:observation?.observations??{},progress:t?.session?.diagnostics()??null,failure:this.#failure,resourcesPending:(t?.resources.filter(r=>!r.released).length??0)+this.#orphans.reduce((n,t)=>n+t.resources.filter(r=>!r.released).length,0)});
  }
  trace():TraceSnapshot|null{return this.#active?.session?.trace()??this.#last;}
  exportReplay():ReplayRecording {
    if(this.#state!=="ready"||!this.#active)fail("STATE_INVALID","Only ready context can export replay");
    return this.#active.session!.exportReplay();
  }
  loadReplay(recording:unknown):Result {
    if(this.#busy||this.#state!=="idle")return rejected("STATE_INVALID","Replay requires a clean controller");
    let target:Runtime|null=null;this.#busy=true;
    try {
      const record=copy(recording,Number.MAX_SAFE_INTEGER,128) as ReplayRecording;
      shape(record,["formatVersion","manifest","completedTicks","inputs"]);
      const initial=copy(record.manifest.initialState) as Payload;
      shape(initial,["identity","recipeId","recipeRevision","content","seed","selection","initializationMaxTicks","source","restoration","views"]);
      if(initial.recipeId!==this.#recipe.id||initial.recipeRevision!==this.#recipe.revision)fail("REPLAY_INVALID","Recipe differs");
      const validated=validateContentBundle(initial.content);if(!validated.ok)fail("REPLAY_INVALID","Invalid recorded content");
      const identity=initial.identity as Payload;shape(identity,["contextId","attemptId","bundleId","contentRevision"]);id(identity.contextId);
      if(identity.bundleId!==validated.content.bundleId||identity.contentRevision!==validated.content.contentRevision)fail("REPLAY_INVALID","Content identity differs");
      const generation=identity.attemptId as number;
      if(!Number.isSafeInteger(generation)||generation<=this.#generation)fail("REPLAY_INVALID","Replay generation is invalid or reused");
      if(initial.source!=="new"&&initial.source!=="restored-fixture")fail("REPLAY_INVALID","Unknown initial source");
      const max=initial.initializationMaxTicks;
      if(!Number.isSafeInteger(max)||(max as number)<1||(max as number)>10000)fail("REPLAY_INVALID","Invalid initialization horizon");
      const views=initial.views as Payload;shape(views,this.#recipe.participants.map(p=>p.id));
      shape(initial.selection,[],Object.keys(initial.selection as Payload));
      const prepared=copy(this.#recipe.prepare(validated.content,initial.selection));
      if(initial.source==="new"&&JSON.stringify(prepared)!==JSON.stringify(views))fail("REPLAY_INVALID","Recorded views contradict the selected catalog");
      for(const p of this.#recipe.participants)validateFields(views[p.id] as Payload,p.fields);
      if(initial.source==="new"&&initial.restoration!==null)fail("REPLAY_INVALID","Unexpected restoration");
      if(initial.source==="restored-fixture") {
        const restoration=initial.restoration as Payload;shape(restoration,["version","recipeId","checkpointId","revision","parts"]);
        id(restoration.checkpointId);id(restoration.revision);
        if(restoration.version!==1||restoration.recipeId!==this.#recipe.id||!Array.isArray(restoration.parts)||restoration.parts.length!==this.#recipe.participants.length)fail("REPLAY_INVALID","Invalid restoration");
        const parts:Record<string,Payload>={};
        for(const part of restoration.parts){shape(part,["ownerId","version","revision","data"]);id(part.ownerId);
          if(part.version!==1||part.revision!==restoration.revision||Object.hasOwn(parts,part.ownerId))fail("REPLAY_INVALID","Conflicting restoration");parts[part.ownerId]=part.data as Payload;}
        if(JSON.stringify(copy(parts))!==JSON.stringify(views))fail("REPLAY_INVALID","Restored views differ");
      }
      target={identity,initial,session:null,resources:[],replayHorizon:record.completedTicks,observe:()=>fail("STATE_INVALID","No observer before assembly")};
      assemble(this.#recipe,target,this.#runtime,false,record);this.#generation=generation;this.#active=target;target=null;this.#state="initializing";
      return success(identity.contextId as string);
    }catch(e){if(target&&!this.#dispose(target))this.#orphans.push(target);if(this.#orphans.length)this.#state="faulted";return this.#error(e);}
    finally{this.#busy=false;}
  }
  drainDebugLog():readonly {contextId:string;records:readonly DebugRecord[]}[] {this.#collectIfActive();const result=Object.freeze(this.#logs.splice(0).map(g=>Object.freeze(g)));return result;}
  #collectIfActive():void {if(!this.#busy&&this.#active)this.#collect(this.#active);}
}
