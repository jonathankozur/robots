import type {Recipe,Participant} from "@robots/application-host";
import {bindMessage,bindNavigationContracts} from "@robots/application-host/bindings";
import type {Payload,MessageDefinition,Phase,Actor} from "@robots/system-api";
import type {ContentBundle} from "@robots/protocol/content/v2";
import {createNavigationActor} from "@robots/navigation";
import {createDamageActor} from "@robots/damage";
import {createWeaponsActor} from "@robots/weapons";
import {createPerceptionActor} from "@robots/perception";
import {createDecisionActor} from "@robots/decision";
import {createBattleActor} from "@robots/battle";
import {createCombatPresentationActor} from "@robots/presentation";
import {BOARD_FIELDS} from "@robots/protocol/navigation/v1";
import * as D from "@robots/protocol/damage/v1";
import * as W from "@robots/protocol/weapons/v1";
import * as P from "@robots/protocol/perception/v1";
import * as A from "@robots/protocol/decision/v1";
import * as B from "@robots/protocol/battle/v1";
import * as V from "@robots/protocol/presentation/v2";
import {findPath,distance,hasLineOfSight,same} from "@robots/values/hex-grid";
import {validateManifest} from "@robots/protocol/presentation/manifest-v1";
import manifestData from "../../content/presentation/prototype-v1.json" with {type:"json"};
const payload=(v:unknown)=>v as Payload;
export function prepareCombat(content:ContentBundle,selection:Payload):Record<string,Payload>{
 const manifest=validateManifest(manifestData);
 W.ensure(Object.keys(selection).length===1&&selection.scenarioId==="combat-mvp-v1","Unknown combat scenario");
 const placement=[{robotId:"alpha",teamId:"team.alpha",definitionId:"robot.mvp-alpha",q:1,r:2},{robotId:"beta",teamId:"team.beta",definitionId:"robot.mvp-beta",q:5,r:2}];
 const terrain=content.definitions.terrains.find(x=>x.id==="terrain.floor");W.ensure(terrain?.passable,"Missing arena terrain");
 const tiles=Array.from({length:35},(_,i)=>({q:i%7,r:Math.floor(i/7),terrainId:terrain.id,passable:terrain.passable}));
 const rows=placement.map(r=>{
  const robot=content.definitions.robots.find(x=>x.id===r.definitionId);W.ensure(robot,"Missing combat robot");
  const chassis=content.definitions.chassis.find(x=>x.id===robot.chassisId);W.ensure(chassis?.visual,"Missing chassis visual");
  const equip=robot.equipment.map(e=>e.componentId);
  function one<T extends {id:string}>(family:readonly T[]):T{const found=family.filter(x=>equip.includes(x.id));W.ensure(found.length===1,"Combat requires one component per required family");return found[0]!;}
  one(content.definitions.cores);
  const locomotion=one(content.definitions.locomotions),ai=one(content.definitions.ais),sensor=one(content.definitions.sensors),weapon=one(content.definitions.weapons);
  W.ensure(robot.equipment.length===5&&weapon.behaviorId==="fixture.direct-v1","Unsupported equipment");
  const slot=robot.equipment.find(x=>x.componentId===weapon.id)!.slotId;
  const families=[...content.definitions.cores,...content.definitions.locomotions,...content.definitions.ais,...content.definitions.sensors,...content.definitions.weapons];
  const assembly={robotId:r.robotId,chassisResourceId:chassis.visual.resourceId,parts:robot.equipment.map(e=>{
   const part=families.find(f=>f.id===e.componentId),mount=chassis.slots.find(s=>s.id===e.slotId);
   W.ensure(part?.visual&&mount?.socketId&&content.vocabularies.resources.some(x=>x.id===part.visual!.resourceId),"Missing visual mounting");
   return {slotId:e.slotId,socketId:mount.socketId,resourceId:part.visual.resourceId};
  })};
  W.ensure([assembly.chassisResourceId,...assembly.parts.map(p=>p.resourceId),"resource.floor","resource.block"].every(id=>manifest.assets.some(a=>a.resourceId===id)),"Visual resource missing from manifest");
  W.ensure(assembly.parts.every(p=>manifest.assets.find(a=>a.resourceId===assembly.chassisResourceId)!.sockets.includes(p.socketId)),"Missing chassis socket in manifest");
  return {r,chassis,locomotion,ai,sensor,weapon,slot,assembly};
 });
 const board={boardId:"board.mvp",width:7,height:5,tiles,robots:rows.map(({r,locomotion})=>({robotId:r.robotId,definitionId:r.definitionId,q:r.q,r:r.r,moveCooldownTicks:locomotion.moveCooldownTicks}))};
 W.validateWorld({...board,boardRevision:0,effectiveTick:0,robots:board.robots.map(r=>({...r,robotRevision:0,readyAtTick:0}))});
 for(const row of rows){
  const other=rows.find(x=>x!==row)!;
  W.ensure(distance(row.r,other.r)<=row.sensor.rangeHexes&&hasLineOfSight(board,row.r,other.r),"Rival is initially invisible");
  W.ensure(board.tiles.some(t=>t.passable&&!same(t,other.r)&&distance(t,other.r)<=row.weapon.rangeHexes&&hasLineOfSight(board,t,other.r)&&findPath(board,row.r,t,[other.r]).status!=="NO_PATH"),"No reachable firing position");
 }
 const base={battleId:"battle.mvp",boardId:board.boardId};
 const damage=D.validateInitialView({battleId:base.battleId,robots:rows.map(({r,chassis})=>({robotId:r.robotId,teamId:r.teamId,integrityUnits:chassis.integrityUnits,maxIntegrityUnits:chassis.integrityUnits}))});
 const weapons=W.validateInitialView({...base,weapons:rows.map(({r,weapon,slot})=>({robotId:r.robotId,weaponSlotId:slot,impactUnits:weapon.impactUnits,reloadTicks:weapon.reloadTicks,rangeHexes:weapon.rangeHexes}))});
 const perception=P.validateInitialView({...base,sensors:rows.map(({r,sensor})=>({robotId:r.robotId,rangeHexes:sensor.rangeHexes}))});
 const decision=A.validateInitialView({...base,robots:rows.map(({r,ai,weapon,slot})=>({robotId:r.robotId,behaviorId:ai.behaviorId,weaponSlotId:slot,rangeHexes:weapon.rangeHexes}))});
 const battle=B.validateInitialView({...base,participants:placement.map(({robotId,teamId})=>({robotId,teamId})),maxBattleTicks:1200,startMaxTicks:10});
 const presentation=V.validateInitialView({...base,assemblies:rows.map(r=>r.assembly)});
 return {navigation:payload(board),damage:payload(damage),weapons:payload(weapons),perception:payload(perception),decision:payload(decision),battle:payload(battle),presentation:payload(presentation)};
}
export function combatRecipe():Recipe {
 const participant=(id:string,type:string,phase:Phase,fields:Participant["fields"],factory:(i:Payload,c:{systemId:string})=>Actor):Participant=>({id,initializationType:type,phase,fields,create:(i,_own,c)=>factory(i,c)});
 const events=(defs:readonly MessageDefinition[],systemId:string,phase:Phase)=>defs.map(d=>bindMessage(d,{producers:[{systemId,phases:[phase]}],...(d.kind==="command"?{responsibleSystemId:d.type==="RequestAttack"?"weapons":"damage"}:{})}));
 return {id:"automatic-combat-mvp",revision:"automatic-combat-mvp-v1",prepare:prepareCombat,
 participants:[
  participant("perception","InitializePerception","perception",P.INITIAL_FIELDS,createPerceptionActor),
  participant("decision","InitializeDecision","decision",A.INITIAL_FIELDS,createDecisionActor),
  participant("navigation","InitializeNavigationBoard","movement",BOARD_FIELDS,createNavigationActor),
  participant("weapons","InitializeWeapons","action",W.INITIAL_FIELDS,createWeaponsActor),
  participant("damage","InitializeDamageRoster","resolution",D.INITIAL_FIELDS,createDamageActor),
  participant("battle","InitializeBattle","resolution",B.INITIAL_FIELDS,createBattleActor),
  participant("presentation","InitializeCombatPresentation","action",V.INITIAL_FIELDS,createCombatPresentationActor)
 ],contracts:[
  ...bindNavigationContracts({navigationId:"navigation",requestProducers:[{systemId:"decision",phases:["decision"]}]}),
  ...W.WEAPONS_MESSAGES.map(d=>bindMessage(d,{producers:[{systemId:d.kind==="command"?"decision":"weapons",phases:[d.kind==="command"?"decision":"action"]}],...(d.kind==="command"?{responsibleSystemId:"weapons"}:{})})),
  ...D.DAMAGE_MESSAGES.map(d=>bindMessage(d,{producers:[{systemId:d.kind==="command"?"weapons":"damage",phases:[d.kind==="command"?"action":"resolution"]}],...(d.kind==="command"?{responsibleSystemId:"damage"}:{})})),
  ...events(P.PERCEPTION_MESSAGES,"perception","perception"),...events(A.DECISION_MESSAGES,"decision","decision"),...events(B.BATTLE_MESSAGES,"battle","publication"),...events(V.PRESENTATION_MESSAGES,"presentation","action")
 ],outputTypes:[{type:"PresentationViewPublished",version:2}]};
}
