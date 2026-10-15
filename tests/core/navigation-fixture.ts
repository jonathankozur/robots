import {bindNavigationContracts} from "@robots/application-host/bindings";
import basic from "../../content/fixtures/basic-v2.json" with {type:"json"};
import {checkedAdd,ProtocolError} from "@robots/runtime";
import type {Payload,Publisher,FieldRule,Message} from "@robots/runtime";
import type {Recipe,Actor,Request} from "@robots/application-host";
import type {ContentBundle} from "@robots/content";
import {createNavigationActor,BOARD_FIELDS,WORLD_FIELDS,STEP_FIELDS,RESULT_FIELDS,validateBoard} from "@robots/navigation";
import type {Board,World,Step,Result,RobotState} from "@robots/navigation";
import {findPath,same} from "@robots/values/hex-grid";
export interface Goal {robotId:string;q:number;r:number}
export interface RawStep {dueTick:number;step:Step}
export interface FixtureConfig {configSequence:number;autoEnabled:boolean;goals:readonly Goal[];rawSteps:readonly RawStep[]}
export interface Scenario {version:1;boardId:string;width:number;height:number;tiles:readonly {q:number;r:number;terrainId:string}[];robots:readonly {robotId:string;definitionId:string;q:number;r:number}[];order:readonly string[];config:FixtureConfig}
const num=(min=0):FieldRule=>({type:"number",integer:true,min,max:Number.MAX_SAFE_INTEGER}),str=(max=64,min=1):FieldRule=>({type:"string",minLength:min,maxLength:max}),obj=(fields:Record<string,FieldRule>):FieldRule=>({type:"object",fields}),arr=(items:FieldRule,maxLength:number):FieldRule=>({type:"array",items,maxLength});
const goalFields={robotId:str(),q:num(),r:num()};
export const CONFIG_FIELDS={configSequence:num(1),autoEnabled:{type:"boolean"} as const,goals:arr(obj(goalFields),16),rawSteps:arr(obj({dueTick:num(1),step:obj(STEP_FIELDS)}),256)};
const agentFields={boardId:str(),config:obj(CONFIG_FIELDS),order:arr(str(),16)};
const planFields={robotId:str(),status:str(),path:arr(obj({q:num(),r:num()}),144),explored:num()};
const AGENT_FIELDS={boardId:str(),knownBoardRevision:num(),decisionTick:num(),configSequence:num(1),autoEnabled:{type:"boolean"} as const,searches:num(),explored:num(),configError:str(64,0),robots:WORLD_FIELDS.robots,plans:arr(obj(planFields),16)};
const LAB_FIELDS={world:obj(WORLD_FIELDS),observedTick:num(),results:arr(obj(RESULT_FIELDS),16),omittedResults:num()};
const asPayload=(value:unknown)=>value as Payload;
function error(message:string):never{throw new ProtocolError("NAV_FIXTURE_INVALID",message);}
export function fixtureContent():unknown{const data=JSON.parse(JSON.stringify(basic));data.definitions.locomotions.push({...data.definitions.locomotions[0],id:"locomotion.slow",name:"Slow fixture",moveCooldownTicks:20});data.definitions.robots[1].equipment.find((e:any)=>e.slotId==="drive").componentId="locomotion.slow";data.contentRevision="navigation-fixture-1";return data;}
export function scenario():Scenario{return {version:1,boardId:"board",width:7,height:7,tiles:Array.from({length:49},(_,i)=>({q:i%7,r:Math.floor(i/7),terrainId:"terrain.floor"})),robots:[{robotId:"a",definitionId:"robot.scout",q:0,r:2},{robotId:"b",definitionId:"robot.unarmed",q:6,r:4}],order:["a","b"],config:{configSequence:1,autoEnabled:true,goals:[{robotId:"a",q:6,r:2},{robotId:"b",q:0,r:4}],rawSteps:[]}};}
export function request(s=scenario(),requestId="nav-run",debug=false):Request{return {requestId,seed:"0123456789abcdef",content:fixtureContent(),selection:s as unknown as Payload,debug};}
export function prepare(content:ContentBundle,value:Payload):Record<string,Payload>{
 const s=value as unknown as Scenario;if(s.version!==1||Object.keys(s).sort().join(",")!=="boardId,config,height,order,robots,tiles,version,width")error("Invalid scenario shape");
 const tiles=s.tiles.map(t=>{const terrain=content.definitions.terrains.find(x=>x.id===t.terrainId);if(!terrain||Object.keys(t).sort().join(",")!=="q,r,terrainId")error("Invalid terrain");return {...t,passable:terrain.passable};});
 const robots=s.robots.map(r=>{const definition=content.definitions.robots.find(x=>x.id===r.definitionId);const equipped=definition?.equipment.map(e=>e.componentId)??[];const locomotion=content.definitions.locomotions.find(x=>equipped.includes(x.id));if(!definition||!locomotion||Object.keys(r).sort().join(",")!=="definitionId,q,r,robotId")error("Invalid robot");return {...r,moveCooldownTicks:locomotion.moveCooldownTicks};});
 const board=validateBoard({boardId:s.boardId,width:s.width,height:s.height,tiles,robots});
 if(!Array.isArray(s.order)||s.order.length!==robots.length||new Set(s.order).size!==robots.length||s.order.some(id=>!robots.some(r=>r.robotId===id)))error("Invalid entity order");checkConfig(s.config,{...board,robots:board.robots.map(r=>({...r,robotRevision:0,readyAtTick:0}))},0);
 return {navigation:asPayload(board),"navigation-agent-fixture":asPayload({boardId:s.boardId,config:s.config,order:s.order}),"navigation-lab-observer":{boardId:s.boardId}};
}
function applyResult(world:World,result:Result):World{
 if(!result.accepted||result.duplicate)return world;
 if(result.boardId!==world.boardId||result.boardRevision!==world.boardRevision+1||!result.robotState)error("Observer revision gap");
 const previous=world.robots.find(r=>r.robotId===result.robotId);if(!previous||!same(previous,result.from)||result.robotState.robotRevision!==previous.robotRevision+1)error("Observer position contradiction");
 return {...world,boardRevision:result.boardRevision,effectiveTick:result.resolvedTick,robots:world.robots.map(r=>r.robotId===result.robotId?{...r,...result.robotState!.position,robotRevision:result.robotState!.robotRevision,readyAtTick:result.robotState!.readyAtTick}:r)};
}
function checkConfig(c:FixtureConfig,b:Pick<World,"robots"|"width"|"height">,tick:number):void{
 if(!Number.isSafeInteger(c.configSequence)||c.configSequence<1||typeof c.autoEnabled!=="boolean"||!Array.isArray(c.goals)||c.goals.length>16||!Array.isArray(c.rawSteps)||c.rawSteps.length>256)error("Invalid fixture config");
 const ids=new Set<string>();for(const g of c.goals){if(ids.has(g.robotId)||!b.robots.some(r=>r.robotId===g.robotId)||!Number.isSafeInteger(g.q)||!Number.isSafeInteger(g.r)||g.q<0||g.q>=b.width||g.r<0||g.r>=b.height)error("Invalid goal");ids.add(g.robotId);}
 for(const raw of c.rawSteps)if(!Number.isSafeInteger(raw.dueTick)||raw.dueTick<Math.max(1,tick))error("Past step tick");
}
function agent(identity:Payload):Actor{
 let publisher:Publisher,enabled=false,initialized=false,boardId="",config:FixtureConfig,order:readonly string[]=[],world:World|undefined,dirty=false,high=0,configError="",searches=0,expanded=0;
 let raw:RawStep[]=[];const configs=new Map<number,string>(),incoming:Message[]=[],sequences=new Map<string,number>(),noPath=new Map<string,string>();
 const plans=new Map<string,{robotId:string;status:string;path:readonly {q:number;r:number}[];explored:number}>();
 function setConfig(next:FixtureConfig,tick:number):void{
  const body=JSON.stringify(next),prior=configs.get(next.configSequence);
  if(prior!==undefined){configError=prior===body?"CONFIG_DUPLICATE":"CONFIG_CONFLICT";dirty=true;return;}
  if(next.configSequence<=high){configError="CONFIG_EXPIRED";dirty=true;return;}
  if(world)checkConfig(next,world,tick);
  config=next;raw=next.rawSteps.map(x=>({...x}));high=next.configSequence;configs.set(high,body);if(configs.size>16)configs.delete(configs.keys().next().value!);noPath.clear();plans.clear();configError="";dirty=true;
 }
 function plan(robotId:string,status:string,path:readonly {q:number;r:number}[]=[],explored=0):void{const v={robotId,status,path,explored};if(JSON.stringify(plans.get(robotId))!==JSON.stringify(v)){plans.set(robotId,v);dirty=true;}}
 return {connect(p){publisher=p;},
 initialize(m){if(initialized)error("Repeated agent initialization");initialized=true;const view=m.payload.view as unknown as {boardId:string;config:FixtureConfig;order:readonly string[]};boardId=view.boardId;order=view.order;setConfig(view.config,0);publisher.emit("ApplicationParticipantInitialized",1,{...identity,participantId:"navigation-agent-fixture"});},
 activate(){if(!initialized||enabled)error("Invalid agent activation");enabled=true;},
 subscriptions:[
 {type:"NavigationWorldReady",version:1,phase:"decision",handler(m){if(world||m.payload.boardId!==boardId)error("Invalid initial world");world=m.payload as unknown as World;checkConfig(config,world,0);dirty=true;}},
 {type:"NavigationStepResolved",version:1,phase:"decision",handler(m){if(!world)error("No world");world=applyResult(world,m.payload as unknown as Result);dirty=true;}},
 {type:"ConfigureNavigationFixture",version:1,phase:"decision",handler(m){if(incoming.length>=256)error("Too many configurations");incoming.push(m);}}],
 loopPhase:"decision",loop(c){
  if(!enabled||!world)return;
  for(const m of incoming){try{setConfig(m.payload as unknown as FixtureConfig,c.tick);}catch(e){configError="CONFIG_INVALID";dirty=true;}}incoming.length=0;
  const due=raw.filter(r=>r.dueTick<=c.tick);raw=raw.filter(r=>r.dueTick>c.tick);const manual=new Set<string>();
  for(const r of due){publisher.send("RequestNavigationStep",1,r.step as unknown as Payload);manual.add(r.step.robotId);if(world.robots.some(x=>x.robotId===r.step.robotId))sequences.set(r.step.robotId,Math.max(sequences.get(r.step.robotId)??0,r.step.requestSequence));plan(r.step.robotId,"RAW_STEP");}
  if(config.autoEnabled)for(const robotId of order){
   const goal=config.goals.find(g=>g.robotId===robotId),robot=world.robots.find(r=>r.robotId===robotId);if(!goal||!robot||manual.has(robotId))continue;
   if(c.tick<robot.readyAtTick){plan(robotId,"COOLDOWN");continue;}
   if(same(robot,goal)){plan(robotId,"ALREADY_THERE");continue;}
   const cached=world.boardRevision+":"+goal.q+","+goal.r;if(noPath.get(robotId)===cached)continue;
   const route=findPath(world,robot,goal,world.robots);searches=checkedAdd(searches,1);expanded=checkedAdd(expanded,route.explored);plan(robotId,route.status,route.path,route.explored);
   if(route.status!=="FOUND"){noPath.set(robotId,cached);continue;}noPath.delete(robotId);
   const seq=checkedAdd(sequences.get(robotId)??0,1);sequences.set(robotId,seq);
   publisher.send("RequestNavigationStep",1,{boardId,robotId,requestSequence:seq,from:{q:robot.q,r:robot.r},to:route.path[0]!,expectedRobotRevision:robot.robotRevision,knownBoardRevision:world.boardRevision} as unknown as Payload);
  }
  if(dirty){publisher.emit("NavigationAgentObserved",1,{boardId,knownBoardRevision:world.boardRevision,decisionTick:c.tick,configSequence:config.configSequence,autoEnabled:config.autoEnabled,searches,explored:expanded,configError,robots:world.robots,plans:[...plans.values()].filter(p=>world!.robots.some(r=>r.robotId===p.robotId)).slice(0,16)} as unknown as Payload,{causes:[]});dirty=false;}
 }};
}
function observer(identity:Payload):Actor{
 let publisher:Publisher,enabled=false,world:World|undefined,dirty=false,omitted=0,initialized=false;const results:Result[]=[];
 return {connect(p){publisher=p;},initialize(){if(initialized)error("Repeated observer initialization");initialized=true;publisher.emit("ApplicationParticipantInitialized",1,{...identity,participantId:"navigation-lab-observer"});},activate(){enabled=true;},
 subscriptions:[{type:"NavigationWorldReady",version:1,phase:"action",handler(m){if(world)error("Repeated world");world=m.payload as unknown as World;dirty=true;}},{type:"NavigationStepResolved",version:1,phase:"action",handler(m){if(!world)error("No world");const result=m.payload as unknown as Result;world=applyResult(world,result);results.push(result);if(results.length>16){results.shift();omitted=checkedAdd(omitted,1);}dirty=true;}}],
 loopPhase:"action",loop(c){if(enabled&&world&&dirty){publisher.emit("NavigationLabObserved",1,{world,observedTick:c.tick,results,omittedResults:omitted} as unknown as Payload,{causes:[]});dirty=false;}}};
}
export function navigationRecipe():Recipe{return {id:"navigation.fixture",revision:"navigation-fixture-v1",prepare,contracts:[...bindNavigationContracts({navigationId:"navigation",requestProducers:[{systemId:"navigation-agent-fixture",phases:["decision"]}]}),{type:"ConfigureNavigationFixture",version:1,kind:"command",responsibleSystemId:"navigation-agent-fixture",producers:[{systemId:"app-bootstrap",phases:["input"]}],fields:CONFIG_FIELDS},{type:"NavigationAgentObserved",version:1,kind:"event",producers:[{systemId:"navigation-agent-fixture",phases:["decision"]}],fields:AGENT_FIELDS},{type:"NavigationLabObserved",version:1,kind:"event",producers:[{systemId:"navigation-lab-observer",phases:["action"]}],fields:LAB_FIELDS}],outputTypes:[{type:"NavigationLabObserved",version:1},{type:"NavigationAgentObserved",version:1}],participants:[
 {id:"navigation",initializationType:"InitializeNavigationBoard",phase:"movement",fields:BOARD_FIELDS,create:(identity,_resource,context)=>createNavigationActor(identity,context)},
 {id:"navigation-agent-fixture",initializationType:"InitializeNavigationAgentFixture",phase:"decision",fields:agentFields,create:agent},
 {id:"navigation-lab-observer",initializationType:"InitializeNavigationObserverFixture",phase:"action",fields:{boardId:str()},create:observer}]};}


export function navigationPresets():readonly {id:string;name:string;expected:string;scenario:Scenario}[]{
 const presets:{id:string;name:string;expected:string;scenario:Scenario}[]=[];
 const add=(id:string,name:string,expected:string,s:Scenario)=>{presets.push({id,name,expected,scenario:s});};
 add('speed','Velocidades distintas','a tiene CD3; b CD20. Cada paso cambia la ocupación y luego espera.',scenario());
 const collision=scenario();collision.robots=[{robotId:'a',definitionId:'robot.scout',q:0,r:0},{robotId:'b',definitionId:'robot.unarmed',q:2,r:0}];collision.config.goals=[{robotId:'a',q:1,r:0},{robotId:'b',q:1,r:0}];add('collision','Competencia por una casilla','a gana; b recibe DESTINATION_OCCUPIED y reconsidera.',collision);
 const reversed=structuredClone(collision);reversed.order=['b','a'];add('reverse','Orden invertido','b gana; a recibe DESTINATION_OCCUPIED.',reversed);
 const one=scenario();one.robots=[{robotId:'a',definitionId:'robot.scout',q:0,r:0}];one.order=['a'];one.config={configSequence:1,autoEnabled:false,goals:[],rawSteps:[]};
 const raw=(dueTick:number,requestSequence:number,from={q:0,r:0},to={q:1,r:0},revision=0):RawStep=>({dueTick,step:{boardId:'board',robotId:'a',requestSequence,from,to,expectedRobotRevision:revision,knownBoardRevision:revision}});
 const dup=structuredClone(one);dup.config.rawSteps=[raw(2,1),raw(2,1)];add('duplicate','Solicitud duplicada','Un solo cambio de posición; segundo resultado duplicate=true.',dup);
 const cd=structuredClone(one);cd.config.rawSteps=[raw(2,1),raw(3,2,{q:1,r:0},{q:1,r:1},1),raw(5,3,{q:1,r:0},{q:1,r:1},1)];add('cooldown','CD y límite exacto','Paso en tick2, rechazo en3 y nuevo paso en5 (CD3).',cd);
 const blocked=structuredClone(one);blocked.tiles=blocked.tiles.map(t=>((t.q===1&&t.r===0)||(t.q===0&&t.r===1))?{...t,terrainId:'terrain.wall'}:t);blocked.config={configSequence:1,autoEnabled:true,goals:[{robotId:'a',q:3,r:0}],rawSteps:[]};add('blocked','Sin camino','NO_PATH, una búsqueda; no repite BFS si la ocupación no cambia.',blocked);
 const opening=scenario();opening.robots=[{robotId:'a',definitionId:'robot.scout',q:0,r:0},{robotId:'b',definitionId:'robot.unarmed',q:1,r:0},{robotId:'c',definitionId:'robot.unarmed',q:0,r:1}];opening.order=['a','b','c'];opening.config.goals=[{robotId:'a',q:3,r:0},{robotId:'b',q:2,r:0},{robotId:'c',q:0,r:2}];add('opening','El paso queda libre','a comienza sin ruta; b/c se apartan y a recalcula en el siguiente tick.',opening);
 const swap=structuredClone(collision);swap.robots=[{robotId:'a',definitionId:'robot.scout',q:0,r:0},{robotId:'b',definitionId:'robot.unarmed',q:1,r:0}];swap.config={configSequence:1,autoEnabled:false,goals:[],rawSteps:[{...raw(2,1)}, {dueTick:2,step:{...raw(2,1).step,robotId:'b',from:{q:1,r:0},to:{q:0,r:0}}}]};add('swap','Intercambio bloqueado','Ambos pasos rechazados: las dos casillas están ocupadas.',swap);
 return presets;
}
