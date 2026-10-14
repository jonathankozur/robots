import test from "node:test";
import assert from "node:assert/strict";
import { createPresentationActor } from "@robots/presentation";
import type { Message, Payload, Publisher } from "@robots/system-api";
import type { World, Result } from "@robots/protocol/navigation/v1";
import type { View } from "@robots/protocol/presentation/v1";
import { snapshotPayload } from "@robots/values/json";
const identity={contextId:"solo-presentation",attemptId:1,bundleId:"bundle.test",contentRevision:"test-1"};
function harness() {
  let next=0;const emitted:{type:string;payload:Payload}[]=[];
  const port:Publisher={send(){assert.fail("Projection emits views");},emit(type,_version,payload){emitted.push({type,payload:snapshotPayload(payload)});return ++next;}};
  const actor=createPresentationActor(identity);actor.connect(Object.freeze(port));
  const message=(type:string,payload:unknown):Message=>Object.freeze({messageId:++next,sessionId:identity.contextId,type,contractVersion:1,sourceSystemId:"synthetic-provider",emittedTick:0,emittedPhase:"input",correlationId:1,causationIds:[],payload:snapshotPayload(payload)});
  actor.initialize(message("InitializePresentationView",{...identity,view:{boardId:"board",assemblies:[{robotId:"a",chassisResourceId:"resource.chassis",parts:[]}]}}),{tick:0,phase:"action"});
  actor.activate(message("ApplicationContextReady",{}),{tick:1,phase:"input"});
  const deliver=(type:string,payload:unknown,tick:number)=>{const m=message(type,payload);actor.subscriptions!.find(s=>s.type===type)!.handler(m,{tick,phase:"action"});return m;};
  return {actor,emitted,deliver};
}
const world=():World=>({boardId:"board",width:2,height:1,tiles:[{q:0,r:0,terrainId:"terrain.floor",passable:true},{q:1,r:0,terrainId:"terrain.floor",passable:true}],robots:[{robotId:"a",definitionId:"robot.scout",q:0,r:0,moveCooldownTicks:3,robotRevision:0,readyAtTick:0}],boardRevision:0,effectiveTick:1});
const move=():Result=>({boardId:"board",requestBoardId:"board",robotId:"a",requestSequence:1,accepted:true,reason:"MOVED",duplicate:false,resolvedTick:2,boardRevision:1,from:{q:0,r:0},to:{q:1,r:0},robotState:{position:{q:1,r:0},robotRevision:1,readyAtTick:5}});
test("presentation exists without a navigation implementation and waits when no world arrives",()=>{
  const h=harness();for(let tick=1;tick<6;tick++)h.actor.loop!({tick,phase:"action"});
  assert.deepEqual(h.emitted.map(x=>x.type),["ApplicationParticipantInitialized"]);
});
test("synthetic conforming messages drive an immutable projection with no navigation package",()=>{
  const h=harness(),data=world();h.deliver("NavigationWorldReady",data,1);h.actor.loop!({tick:1,phase:"action"});
  (data.robots[0] as any).q=99;
  const first=h.emitted.at(-1)!.payload as unknown as View;
  assert.equal(first.world.robots[0]!.q,0);
  const input=h.deliver("NavigationStepResolved",move(),2);h.actor.loop!({tick:2,phase:"action"});
  const second=h.emitted.at(-1)!.payload as unknown as View;
  assert.equal(second.world.robots[0]!.q,1);assert.equal(second.movements[0]!.sourceMessageId,input.messageId);
  const count=h.emitted.length;h.deliver("NavigationStepResolved",{...move(),duplicate:true},3);h.actor.loop!({tick:3,phase:"action"});
  assert.equal(h.emitted.length,count);assert.equal(first.world.robots[0]!.q,0);
  assert.throws(()=>{(second.world.robots[0] as any).q=9;},TypeError);
});
test("contradictory revisions still fail visibly rather than inventing a neighboring state",()=>{
  const h=harness();h.deliver("NavigationWorldReady",world(),1);
  assert.throws(()=>h.deliver("NavigationStepResolved",{...move(),boardRevision:3},2),{code:"PRESENTATION_INVALID"});
});
