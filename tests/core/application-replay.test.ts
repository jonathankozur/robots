import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ApplicationController } from "../../src/application/index.ts";
import { fixtureRecipe, nav, combat } from "./application-fixture.ts";
const request=(requestId="run")=>({requestId,seed:"0123456789abcdef",content:JSON.parse(readFileSync(new URL("../../content/fixtures/basic-v2.json",import.meta.url),"utf8")),selection:{robotId:"robot.scout",terrainId:"terrain.floor"}});
const controller=(recipe=fixtureRecipe(),instanceId="test",runtime="runtime")=>new ApplicationController({instanceId,runtime,recipe});
const boot=(a:ApplicationController,r:unknown=request())=>{assert.equal(a.request(r).ok,true);a.advance();a.advance();assert.equal(a.snapshot().state,"ready");};
test("replay rebuilds fresh owners, forbids live input without damaging the run and preserves evidence",()=>{
  const original=controller();boot(original);original.stage(original.snapshot().contextId,"OperateNavigation",{delta:4});original.advance();
  const record=original.exportReplay(),replay=controller(fixtureRecipe(),"replay");
  assert.equal(replay.loadReplay(record).ok,true);
  for(let i=0;i<record.completedTicks;i++)replay.advance();
  assert.deepEqual(replay.trace(),original.trace());assert.deepEqual(replay.snapshot().observations,original.snapshot().observations);
  const before=replay.trace();assert.equal(replay.stage(replay.snapshot().contextId,"OperateNavigation",{delta:1}),false);
  assert.equal(replay.snapshot().state,"ready");assert.deepEqual(replay.trace(),before);
  assert.equal(replay.advance().code,"REPLAY_HORIZON");assert.deepEqual(replay.trace(),before);
});
test("replay rejects malformed data, incompatible runtime/recipe and reused generations before execution",()=>{
  const original=controller();boot(original);const record=original.exportReplay();
  assert.equal(controller(fixtureRecipe(),"replay","different").loadReplay(record).ok,false);
  assert.equal(controller(fixtureRecipe({mode:"missing"})).loadReplay(record).ok,false);
  for(const data of [null,{}, {...record,manifest:{...record.manifest,initialState:{...(record.manifest.initialState as Record<string,unknown>),views:{}}}}])assert.equal(controller().loadReplay(data as any).ok,false);
  original.close();assert.equal(original.loadReplay(record).ok,false);
});
test("mixed stepping and optional debug preserve trace and output exactly",()=>{
  const a=controller(),b=controller();a.request(request());b.request({...request(),debug:true});
  for(let i=0;i<3;i++){a.advance();b.advance("step");b.advance("phase");b.advance();}
  assert.deepEqual(a.trace(),b.trace());assert.deepEqual(a.snapshot().observations,b.snapshot().observations);
  const logs=b.drainDebugLog();assert.ok(logs.length);assert.ok(logs.some(g=>g.records.some(r=>(r as any).entry?.kind==="published")));
  assert.deepEqual(b.drainDebugLog(),[]);
});
test("restored parts are complete/versioned; bad restoration preserves old encounter",()=>{
  const a=controller();boot(a);const old=a.snapshot().contextId;
  const views=(a.trace()!.manifest!.initialState as any).views;
  const restore={version:1,recipeId:"application.fixture",checkpointId:"cp-test",revision:"r1",parts:[
    {ownerId:nav,version:1,revision:"r1",data:{...views[nav],count:7}},
    {ownerId:combat,version:1,revision:"r1",data:{...views[combat],integrityUnits:70000,count:0}}]};
  assert.equal(a.request({...request("restore"),restore}).ok,true);a.advance();a.advance();
  assert.notEqual(a.snapshot().contextId,old);assert.equal(a.snapshot().observations[combat]!.amount,70000);assert.equal(a.snapshot().observations[nav]!.count,7);
  const fixed=a.trace();
  let invalidIndex=0;
  for(const parts of [restore.parts.slice(0,1),[restore.parts[0],restore.parts[0]],restore.parts.map(p=>({...p,revision:"other"})),restore.parts.map(p=>({...p,data:{...p.data,count:-1}}))]){
    assert.equal(a.request({...request("bad-"+invalidIndex++),restore:{...restore,parts}}).ok,false);assert.deepEqual(a.trace(),fixed);
  }
});
test("hidden capabilities are rejected without executing getters and sessions stay isolated",()=>{
  let called=false;const r=request();Object.defineProperty(r,"hidden",{enumerable:true,get(){called=true;return 1;}});
  const a=controller(),b=controller(fixtureRecipe(),"second");assert.equal(a.request(r).ok,false);assert.equal(called,false);
  boot(a);boot(b);a.stage(a.snapshot().contextId,"OperateNavigation",{delta:5});a.advance();
  assert.equal(a.snapshot().observations[nav]!.count,5);assert.equal(b.snapshot().observations[nav]!.count,0);
});
test("failed factory cleans acquired resources; failed replacement routing leaves old session untouched",()=>{
  let released=0;const recipe=fixtureRecipe();const original=recipe.participants[0]!;
  const broken={...recipe,participants:[{...original,create(){throw new Error("factory broke");}},recipe.participants[1]!]};
  assert.equal(controller(broken).request(request()).ok,false);
  const acquired={...recipe,participants:[{...original,create(_identity:any,own:any){own(()=>{released++;});throw new Error("after acquisition");}},recipe.participants[1]!]};
  assert.equal(controller(acquired).request(request()).ok,false);assert.equal(released,1);
  const options={badRoute:false};const a=controller(fixtureRecipe(options));boot(a);const trace=a.trace(),id=a.snapshot().contextId;
  options.badRoute=true;assert.equal(a.request(request("next")).ok,false);assert.equal(a.snapshot().contextId,id);assert.deepEqual(a.trace(),trace);
});

test("invalid external operations reject before admission and keep the healthy session intact",()=>{
  const a=controller();boot(a);const before=a.trace(),id=a.snapshot().contextId;
  assert.equal(a.stage(id,"OperateNavigation",{delta:-1}),false);
  assert.equal(a.stage(id,"OperateNavigation",{delta:1,unexpected:true}),false);
  assert.equal(a.stage(id,"BeginApplicationContext",{}),false);
  assert.equal(a.snapshot().state,"ready");assert.deepEqual(a.trace(),before);
});

test("a participant cannot forge a new initialization confirmation from an unrelated operation root",()=>{
  const a=controller(fixtureRecipe({mode:"late-conflict"}));boot(a);
  assert.equal(a.stage(a.snapshot().contextId,"OperateNavigation",{delta:1}),true);a.advance();
  assert.equal(a.snapshot().state,"faulted");assert.equal(a.snapshot().failure!.code,"APP_CONFIRMATION_ROOT");
});

test("invalid asynchronous cleanup cannot leak a rejection and does not skip other resources",async()=>{
  const disposed:string[]=[];const base=fixtureRecipe({disposed});
  const recipe={...base,participants:base.participants.map(p=>({...p,create(identity:any,register:any){
    return p.create(identity,dispose=>register(p.id===nav?()=>Promise.reject(new Error("async cleanup forbidden")):dispose));
  }}))};
  const a=controller(recipe);boot(a);assert.equal(a.close().ok,false);
  await new Promise<void>(resolve=>setImmediate(resolve));
  assert.equal(a.snapshot().resourcesPending,1);assert.deepEqual(disposed,[combat]);
});

test("factory resource registration cannot be retained and used from simulation callbacks",()=>{
  const base=fixtureRecipe();
  const recipe={...base,participants:base.participants.map(p=>p.id!==nav?p:{...p,create(identity:any,register:any){
    const actor=p.create(identity,register);
    return {...actor,activate(message:any,context:any){register(()=>{});actor.activate(message,context);}};
  }})};
  const a=controller(recipe);a.request(request());a.advance();a.advance();
  assert.equal(a.snapshot().state,"faulted");assert.equal(a.snapshot().failure!.code,"APP_RESOURCE_CONTEXT");
  assert.equal(a.snapshot().resourcesPending,0);
});

test("new-source recordings cannot contradict the selected catalog-derived initial views",()=>{
  const a=controller();boot(a);
  const altered=JSON.parse(JSON.stringify(a.exportReplay()));
  altered.manifest.initialState.content.definitions.chassis[0].integrityUnits=123000;
  assert.equal(controller().loadReplay(altered).ok,false);
});
