import {checkedAdd} from "@robots/values/numeric";import type {Payload,Publisher,Message} from "@robots/system-api";import type {Actor,ActorContext} from "@robots/system-api";import {distance,inside,key,same} from "@robots/values/hex-grid";import type {Board,Step,Result,RobotState} from "@robots/protocol/navigation/v1";import {validateBoard,copyData,fail} from "./data.ts";
export function createNavigationActor(inputIdentity:Payload,context:ActorContext={systemId:"navigation"}):Actor{
 const systemId=context.systemId;
 if(typeof systemId!=="string"||systemId.length<1||systemId.length>128)fail("NAV_IDENTITY","Invalid actor system ID");
 const identity=copyData(inputIdentity);let publisher:Publisher,board:Board|undefined,enabled=false,revision=0;
 const robots=new Map<string,RobotState>(),occupied=new Map<string,string>(),queue:Message[]=[];
 const requests=new Map<string,{high:number;entries:Map<number,{body:string;result:Result}>}>();
 function result(p:Step,tick:number,reason:string,duplicate=false):Result{const r=robots.get(p.robotId);return {boardId:board?.boardId??p.boardId,requestBoardId:p.boardId,robotId:p.robotId,requestSequence:p.requestSequence,accepted:reason==="MOVED",reason,duplicate,resolvedTick:tick,boardRevision:revision,from:p.from,to:p.to,...(r?{robotState:{position:{q:r.q,r:r.r},robotRevision:r.robotRevision,readyAtTick:r.readyAtTick}}:{})};}
 function evaluate(p:Step,tick:number):Result{
  if(board&&p.boardId!==board.boardId)return result(p,tick,"BOARD_MISMATCH");
  if(!enabled||!board)return result(p,tick,"NOT_READY");
  const r=robots.get(p.robotId);if(!r)return result(p,tick,"ROBOT_UNKNOWN");
  if(p.knownBoardRevision>revision)return result(p,tick,"VIEW_IN_FUTURE");
  if(p.expectedRobotRevision!==r.robotRevision||!same(p.from,r))return result(p,tick,"STALE_POSITION");
  if(!inside(board,p.to))return result(p,tick,"OUT_OF_BOARD");
  if(distance(r,p.to)!==1)return result(p,tick,"NOT_ADJACENT");
  if(!board.tiles.find(t=>same(t,p.to))!.passable)return result(p,tick,"TERRAIN_BLOCKED");
  if(occupied.has(key(p.to)))return result(p,tick,"DESTINATION_OCCUPIED");
  if(tick<r.readyAtTick)return result(p,tick,"COOLDOWN_ACTIVE");
  const nextRevision=checkedAdd(revision,1),robotRevision=checkedAdd(r.robotRevision,1),readyAtTick=checkedAdd(tick,r.moveCooldownTicks);
  occupied.delete(key(r));occupied.set(key(p.to),p.robotId);robots.set(p.robotId,{...r,...p.to,robotRevision,readyAtTick});revision=nextRevision;
  return result(p,tick,"MOVED");
 }
 return {
  connect(port){publisher=port;},
  initialize(m){
   if(board)fail("NAV_INIT_DUPLICATE","Board already initialized");
   if(m.sessionId!==identity.contextId)fail("NAV_IDENTITY","Wrong session");
   for(const k of ["contextId","attemptId","bundleId","contentRevision"])if(Object.hasOwn(m.payload,k)&&m.payload[k]!==identity[k])fail("NAV_IDENTITY","Wrong bootstrap identity");
   board=validateBoard(m.payload.view as unknown as Board);
   for(const r of board.robots){robots.set(r.robotId,{...r,robotRevision:0,readyAtTick:0});occupied.set(key(r),r.robotId);}
   publisher.emit("ApplicationParticipantInitialized",1,{...identity,participantId:systemId});
  },
  activate(m,c){if(!board||enabled||m.sessionId!==identity.contextId)fail("NAV_ACTIVATION","Invalid activation");enabled=true;publisher.emit("NavigationWorldReady",1,{...board,boardRevision:revision,effectiveTick:c.tick,robots:[...robots.values()]} as unknown as Payload);},
  subscriptions:[{type:"RequestNavigationStep",version:1,phase:"movement",handler(m){if(queue.length>=256)fail("NAV_QUEUE_CAPACITY","Too many pending steps");queue.push(m);}}],
  loopPhase:"movement",loop(c){
   queue.sort((a,b)=>a.messageId-b.messageId);
   for(const m of queue){const p=m.payload as unknown as Step,pair=JSON.stringify([m.sourceSystemId,p.robotId]),body=JSON.stringify(p);
    let registry=requests.get(pair),out:Result;const cached=registry?.entries.get(p.requestSequence);
    if(cached)out=cached.body===body?{...cached.result,duplicate:true}:result(p,c.tick,"REQUEST_CONFLICT");
    else if(registry&&p.requestSequence<=registry.high)out=result(p,c.tick,"REQUEST_EXPIRED");
    else if(!registry&&requests.size>=32)out=result(p,c.tick,"REQUEST_CAPACITY");
    else{if(!registry){registry={high:0,entries:new Map()};requests.set(pair,registry);}out=evaluate(p,c.tick);registry.high=p.requestSequence;registry.entries.set(p.requestSequence,{body,result:copyData(out)});if(registry.entries.size>64)registry.entries.delete(registry.entries.keys().next().value!);}
    publisher.emit("NavigationStepResolved",1,out as unknown as Payload,{causes:[m]});
   }queue.length=0;
  }
 };
}
