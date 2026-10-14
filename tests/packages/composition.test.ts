import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ApplicationController } from "@robots/application-host";
import type { Recipe } from "@robots/application-host";
import { bindMessage, bindNavigationContracts, bindPresentationContracts } from "@robots/application-host/bindings";
import type { Actor, Payload, Publisher } from "@robots/system-api";
import { NAVIGATION_MESSAGES, BOARD_FIELDS } from "@robots/protocol/navigation/v1";
import type { Board, Result, Step } from "@robots/protocol/navigation/v1";
import { INITIAL_FIELDS } from "@robots/protocol/presentation/v1";
import { createNavigationActor } from "@robots/navigation";
import { createPresentationActor } from "@robots/presentation";
const board=():Board=>({boardId:"board",width:2,height:1,tiles:[{q:0,r:0,terrainId:"terrain.floor",passable:true},{q:1,r:0,terrainId:"terrain.floor",passable:true}],robots:[{robotId:"a",definitionId:"robot.scout",q:0,r:0,moveCooldownTicks:3}]});
function boot(recipe:Recipe) {
  const a=new ApplicationController({instanceId:recipe.id,runtime:"independence-test",recipe});
  const content=JSON.parse(readFileSync(new URL("../../content/fixtures/basic-v2.json",import.meta.url),"utf8"));
  assert.equal(a.request({requestId:"start",seed:"0123456789abcdef",content,selection:{}}).ok,true);
  assert.equal(a.advance().ok,true);assert.equal(a.advance().ok,true);assert.equal(a.snapshot().state,"ready");
  return a;
}
test("a presentation-only composition reaches ready and waits without registering navigation",()=>{
  const recipe:Recipe={id:"presentation-only",revision:"presentation-only-v1",
    participants:[{id:"presentation",initializationType:"InitializePresentationView",phase:"action",fields:INITIAL_FIELDS,create:createPresentationActor}],
    prepare(){return {presentation:{boardId:"board",assemblies:[]}};},
    contracts:[...NAVIGATION_MESSAGES.filter(d=>d.kind==="event").map(d=>bindMessage(d,{producers:[]})),...bindPresentationContracts("presentation")],
    outputTypes:["PresentationViewPublished"]};
  const a=boot(recipe);for(let i=0;i<6;i++)assert.equal(a.advance().ok,true);
  assert.deepEqual(a.snapshot().observations,{});
  const manifest=a.trace()!.manifest as any;
  assert.ok(!manifest.catalogue.systems.some((s:any)=>s.id==="navigation"));
  assert.equal(a.close().ok,true);
});
test("a navigation-only composition reaches ready and retains a command receiver with no decision producer",()=>{
  const recipe:Recipe={id:"navigation-only",revision:"navigation-only-v1",
    participants:[{id:"navigation",initializationType:"InitializeNavigationBoard",phase:"movement",fields:BOARD_FIELDS,create:createNavigationActor}],
    prepare(){return {navigation:board() as unknown as Payload};},
    contracts:bindNavigationContracts({navigationId:"navigation",requestProducers:[]}),
    outputTypes:["NavigationWorldReady","NavigationStepResolved"]};
  const a=boot(recipe);for(let i=0;i<6;i++)assert.equal(a.advance().ok,true);
  assert.equal(a.snapshot().observations.navigation!.boardRevision,0);
  assert.equal(a.stage(a.snapshot().contextId,"RequestNavigationStep",{}),false);
  assert.equal(a.close().ok,true);
});
function driverRecipe(sourceId:string):Recipe {
  const step:Step={boardId:"board",robotId:"a",requestSequence:1,from:{q:0,r:0},to:{q:1,r:0},expectedRobotRevision:0,knownBoardRevision:0};
  return {id:"alternative-"+sourceId,revision:"alternative-v1",prepare(){return {navigation:board() as unknown as Payload,[sourceId]:{}};},
    contracts:bindNavigationContracts({navigationId:"navigation",requestProducers:[{systemId:sourceId,phases:["decision"]}]}),
    outputTypes:["NavigationStepResolved"],
    participants:[
      {id:"navigation",initializationType:"InitializeNavigationBoard",phase:"movement",fields:BOARD_FIELDS,create:createNavigationActor},
      {id:sourceId,initializationType:"InitializeAlternativeProducer",phase:"decision",fields:{},create(identity):Actor{
        let port:Publisher,active=false,sent=false;
        return {connect(p){port=p;},initialize(){port.emit("ApplicationParticipantInitialized",1,{...identity,participantId:sourceId});},
          activate(){active=true;},loopPhase:"decision",loop(){if(active&&!sent){sent=true;port.send("RequestNavigationStep",1,step as unknown as Payload);}}};
      }}
    ]};
}
test("the host substitutes authorized decision producers without editing the navigation actor and preserves causality",()=>{
  const results:Result[]=[];
  for(const id of ["decision-a","decision-b"]){
    const a=boot(driverRecipe(id));
    const result=a.snapshot().observations.navigation as unknown as Result;assert.equal(result.reason,"MOVED");results.push(result);
    const messages=a.trace()!.entries.filter(e=>e.kind==="published").map(e=>e.message);
    const command=messages.find(m=>m.type==="RequestNavigationStep")!,event=messages.find(m=>m.type==="NavigationStepResolved")!;
    assert.equal(command.sourceSystemId,id);assert.deepEqual(event.causationIds,[command.messageId]);assert.equal(event.correlationId,command.correlationId);
    assert.equal(command.emittedPhase,"decision");assert.equal(event.emittedPhase,"movement");assert.equal(a.close().ok,true);
  }
  assert.deepEqual(results[0],results[1]);
});
test("host bindings own immutable permission snapshots and reject invalid command ownership",()=>{
  const sources:{systemId:string;phases:("decision")[]}[]=[{systemId:"decision-a",phases:["decision"]}];
  const contracts=bindNavigationContracts({navigationId:"navigation",requestProducers:sources});
  sources[0]!.systemId="intruder";
  assert.equal(contracts.find(c=>c.kind==="command")!.producers[0]!.systemId,"decision-a");
  assert.throws(()=>{(contracts[0]!.fields as any).unexpected={type:"boolean"};},TypeError);
  assert.throws(()=>bindMessage(NAVIGATION_MESSAGES[1],{producers:[]}),{code:"CONFIG_INVALID"});
});
