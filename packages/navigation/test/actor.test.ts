import test from "node:test";
import assert from "node:assert/strict";
import { createNavigationActor } from "@robots/navigation";
import type { Message, Payload, Publisher } from "@robots/system-api";
import type { Board, Step, Result, World } from "@robots/protocol/navigation/v1";
import { snapshotPayload } from "@robots/values/json";
const identity = { contextId: "solo-navigation", attemptId: 1, bundleId: "bundle.test", contentRevision: "test-1" };
const board = (): Board => ({ boardId: "board", width: 3, height: 2,
  tiles: Array.from({length:6},(_,i)=>({q:i%3,r:Math.floor(i/3),terrainId:"terrain.floor",passable:true})),
  robots:[{robotId:"a",definitionId:"robot.scout",q:0,r:0,moveCooldownTicks:3}] });
function harness() {
  let next = 0;
  const emitted: {type:string;payload:Payload;causes:readonly Message[]}[]=[];
  const publisher:Publisher={send(){assert.fail("Navigation emits facts");},emit(type,_version,payload,options){
    emitted.push({type,payload:snapshotPayload(payload),causes:options?.causes??[]});return ++next;
  }};
  const actor=createNavigationActor(identity);actor.connect(Object.freeze(publisher));
  const message=(type:string,payload:unknown):Message=>Object.freeze({messageId:++next,sessionId:identity.contextId,type,contractVersion:1,sourceSystemId:"test-host",emittedTick:0,emittedPhase:"input",correlationId:1,causationIds:[],payload:snapshotPayload(payload)});
  actor.initialize(message("InitializeNavigationBoard",{...identity,view:board()}),{tick:0,phase:"movement"});
  actor.activate(message("ApplicationContextReady",{}),{tick:1,phase:"input"});
  return {actor,emitted,message};
}
test("navigation runs with only an injected port and public messages, preserves cooldown and causal duplicates",()=>{
  const h=harness();
  const step:Step={boardId:"board",robotId:"a",requestSequence:1,from:{q:0,r:0},to:{q:1,r:0},expectedRobotRevision:0,knownBoardRevision:0};
  const input=h.message("RequestNavigationStep",step);
  h.actor.subscriptions![0]!.handler(input,{tick:1,phase:"movement"});h.actor.loop!({tick:1,phase:"movement"});
  const first=h.emitted.at(-1)!;const result=first.payload as unknown as Result;
  assert.equal(result.reason,"MOVED");assert.equal(result.robotState!.readyAtTick,4);assert.deepEqual(first.causes,[input]);
  h.actor.subscriptions![0]!.handler(h.message("RequestNavigationStep",step),{tick:2,phase:"movement"});h.actor.loop!({tick:2,phase:"movement"});
  assert.equal(h.emitted.at(-1)!.payload.duplicate,true);
  const reverse={...step,requestSequence:2,from:{q:1,r:0},to:{q:0,r:0},expectedRobotRevision:1,knownBoardRevision:1};
  h.actor.subscriptions![0]!.handler(h.message("RequestNavigationStep",reverse),{tick:2,phase:"movement"});h.actor.loop!({tick:2,phase:"movement"});
  assert.equal(h.emitted.at(-1)!.payload.reason,"COOLDOWN_ACTIVE");
  assert.equal(h.emitted.at(-1)!.payload.boardRevision,1);
});
test("navigation can remain idle with no decision producer and fresh instances share no state",()=>{
  const a=harness(),b=harness();
  for(let tick=1;tick<5;tick++)a.actor.loop!({tick,phase:"movement"});
  assert.equal(a.emitted.length,2);
  const world=b.emitted.find(x=>x.type==="NavigationWorldReady")!.payload as unknown as World;
  assert.equal(world.robots[0]!.q,0);assert.equal(world.boardRevision,0);
  assert.throws(()=>{(world.robots[0] as any).q=9;},TypeError);
});
