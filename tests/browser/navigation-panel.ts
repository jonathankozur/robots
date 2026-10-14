import {ApplicationController} from "../../src/application/index.ts";
import type {Result as ApplicationResult} from "../../src/application/index.ts";
import type {DebugRecord,Payload,ReplayRecording} from "../../src/core/index.ts";
import {parseContentJson} from "../../src/content/index.ts";
import type {World,Result} from "../../src/navigation/index.ts";
import {navigationRecipe,navigationPresets,fixtureContent} from "../core/navigation-fixture.ts";
import type {Scenario,FixtureConfig} from "../core/navigation-fixture.ts";
import {runTickBatch} from "./navigation-run.ts";
import type {TickBatchProgress,TickBatchResult} from "./navigation-run.ts";
const escape=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
export function mountNavigationPanel(container:HTMLElement):void{
 const presets=navigationPresets();
 container.innerHTML='<section class="navigation-panel"><div class="section-title"><div><span class="eyebrow">TABLERO / NAV-001</span><h2>Movimiento como habilidad</h2></div><span>Laboratorio de desarrollo</span></div>'
 +'<p class="muted">Un paso confirmado cambia la casilla y activa su CD. La IA de prueba reconsidera cada paso; la cola decide conflictos.</p>'
 +'<div class="navigation-toolbar"><label>Escenario<select id="nav-preset">'+presets.map(p=>'<option value="'+p.id+'">'+escape(p.name)+'</option>').join("")+'</select></label><label><input type="checkbox" id="nav-debug" checked> Debug a archivo</label><button id="nav-start" class="primary">Preparar encuentro</button><button id="nav-close">Cerrar</button><button id="nav-new">Nuevo controlador</button></div><p id="nav-expected" class="muted"></p>'
 +'<div class="navigation-controls"><button id="nav-step">Paso</button><button id="nav-phase">Fase</button><button id="nav-tick">Tick</button><label>Ticks<input id="nav-count" type="number" min="1" max="1000" value="20"></label><button id="nav-n">Ejecutar N ticks</button><button id="nav-run">Ejecutar continuo</button><button id="nav-pause">Pausar</button><label>Ritmo<select id="nav-speed"><option value="250">Lento</option><option value="50" selected>20 ticks/s</option><option value="0">Rápido</option></select></label></div><p id="nav-batch" class="muted small" aria-live="polite">Todavía no se ejecutó una tanda.</p>'
 +'<div id="nav-status" class="status-strip" aria-live="polite"></div><div id="nav-notice" class="notice" role="status">Prepara un encuentro y avanza para ver sus confirmaciones.</div>'
 +'<div class="navigation-layout"><section><div id="nav-map" class="navigation-map">Sin tablero inicializado.</div><div id="nav-position" class="navigation-legend"></div><div class="navigation-intents"><h3>Mensajes de IA ficticia</h3><label>Robot<select id="nav-robot"></select></label><label>q<input id="nav-q" type="number" value="6"></label><label>r<input id="nav-r" type="number" value="2"></label><label><input id="nav-auto" type="checkbox" checked> Autopiloto</label><button id="nav-goal">Cambiar objetivo de prueba</button><button id="nav-manual">Solicitar un paso</button><button id="nav-repeat">Repetir configuración</button><p class="muted small">Selecciona una casilla para completar q/r. Estas entradas son fixtures, no órdenes del jugador en el juego.</p></div><h3>Resultados de movimiento</h3><div id="nav-results"></div></section>'
 +'<aside><h3>Vista del agente</h3><pre id="nav-agent"></pre><h3>Cursor y diagnóstico</h3><pre id="nav-cursor"></pre><h3>Mensajes, rutas y causas</h3><input id="nav-filter" placeholder="Filtrar traza" aria-label="Filtrar traza de navegación"><div id="nav-trace" class="content-trace"></div></aside></div>'
 +'<details><summary>Editar escenario y contenido del próximo encuentro</summary><div class="navigation-editors"><label>Escenario JSON<textarea id="nav-scenario" spellcheck="false"></textarea></label><label>Catálogo v2<textarea id="nav-content" spellcheck="false"></textarea></label></div><p class="muted small">Cambia dimensiones, terreno, entidades, orden o parámetros de locomoción antes de preparar. Un encuentro nuevo valida antes de cerrar el anterior.</p></details>'
 +'<div class="navigation-controls"><button id="nav-save">Exportar escenario</button><label class="content-file">Importar escenario<input id="nav-import" type="file" accept=".json,application/json"></label><button id="nav-export-replay">Exportar replay</button><button id="nav-replay">Reproducir y comparar</button><label class="content-file">Importar replay<input id="nav-import-replay" type="file" accept=".json,application/json"></label><button id="nav-isolation">Comparar segunda sesión</button><button id="nav-late">Entrada antigua</button><button id="nav-report">Exportar reporte</button><button id="nav-retry">Reintentar log</button><button id="nav-download">Descargar debug</button></div><pre id="nav-log"></pre></section>';
 const get=<T extends HTMLElement=HTMLElement>(id:string)=>container.querySelector<T>("#"+id)!;
 let controller:ApplicationController|undefined,activeScenario:Scenario|undefined,config:FixtureConfig|undefined,lastConfig:FixtureConfig|undefined,requestSeq=0,configSeq=1;
 let running=false,busy=false,runToken=0,generation=0,oldContext:string|null=null,runStatus="Todavía no se ejecutó una tanda.";const history:string[]=[],batchHistory:TickBatchResult[]=[];
 const logs=new Map<string,{id:string;path:string;written:number;pending:DebugRecord[];all:DebugRecord[]}>();
 function notice(v:unknown):void{const s=typeof v==="string"?v:JSON.stringify(v);get("nav-notice").textContent=s;history.push(s);if(history.length>100)history.shift();}
 function result(v:ApplicationResult):void{notice(v.ok?"Solicitud aceptada · "+v.contextId:v.code+" · "+v.message);}
 function create():ApplicationController{return new ApplicationController({instanceId:"navigation-lab-"+crypto.randomUUID()+"-"+(++generation),runtime:navigator.userAgent,recipe:navigationRecipe()});}
 function editorPreset():void{const p=presets.find(p=>p.id===get<HTMLSelectElement>("nav-preset").value)!;get<HTMLTextAreaElement>("nav-scenario").value=JSON.stringify(p.scenario,null,2);get<HTMLTextAreaElement>("nav-content").value=JSON.stringify(fixtureContent(),null,2);get("nav-expected").textContent=p.expected;}
 function visual():{world:World;observedTick:number;results:readonly Result[];omittedResults:number}|undefined{return controller?.snapshot().observations["navigation-lab-observer"] as unknown as ReturnType<typeof visual>;}
 function draw():void{
  const observed=visual();if(!observed){get("nav-map").textContent="Esperando inicialización y evento NavigationWorldReady.";return;}
  const w=observed.world,chosen=get<HTMLSelectElement>("nav-robot").value,agent=controller!.snapshot().observations["navigation-agent-fixture"] as any;
  const radius=32,point=(q:number,r:number)=>({x:50+Math.sqrt(3)*radius*(q+r/2),y:50+1.5*radius*r}),width=100+Math.sqrt(3)*radius*(w.width-1+(w.height-1)/2),height=100+1.5*radius*(w.height-1);
  const paths=(agent?.plans??[]).map((p:any)=>{const robot=w.robots.find(r=>r.robotId===p.robotId);if(!robot||!p.path?.length)return "";const nodes=[robot,...p.path].map((h:any)=>{const pos=point(h.q,h.r);return pos.x+","+pos.y;}).join(" ");return '<polyline points="'+nodes+'" class="nav-route" />';}).join("");
  let cells="";for(const tile of w.tiles){const pos=point(tile.q,tile.r),robot=w.robots.find(r=>r.q===tile.q&&r.r===tile.r),selected=robot?.robotId===chosen;
   const polygon=Array.from({length:6},(_,i)=>{const angle=(60*i-30)*Math.PI/180;return (pos.x+radius*Math.cos(angle))+","+(pos.y+radius*Math.sin(angle));}).join(" ");
   const label="Casilla "+tile.q+","+tile.r+(robot?" · robot "+robot.robotId:tile.passable?" · libre":" · bloqueada");
   cells+='<g data-q="'+tile.q+'" data-r="'+tile.r+'" role="button" tabindex="0" aria-label="'+escape(label)+'"><title>'+escape(label)+'</title><polygon points="'+polygon+'" class="nav-hex '+(tile.passable?"":"blocked")+'"/><text x="'+pos.x+'" y="'+(pos.y+17)+'" class="nav-coordinate">'+tile.q+","+tile.r+'</text>'+(robot?'<circle cx="'+pos.x+'" cy="'+(pos.y-4)+'" r="16" class="nav-unit '+(selected?"selected":"")+'"/><text x="'+pos.x+'" y="'+pos.y+'" class="nav-unit-label">'+escape(robot.robotId.slice(0,6))+'</text>':"")+'</g>';
  }
  get("nav-map").innerHTML='<svg viewBox="0 0 '+width+" "+height+'" aria-label="Tablero hexagonal de navegación">'+cells+paths+'</svg>';
  const d=controller!.snapshot().progress!,tick=d.tickInProgress?d.nextTick:(d.lastCompletedTick??0);
  get("nav-position").innerHTML='<span>Tablero · revisión '+w.boardRevision+' · observado en tick '+observed.observedTick+'</span>'+w.robots.map(r=>'<span><strong>'+escape(r.robotId)+'</strong> ('+r.q+","+r.r+') · CD '+r.moveCooldownTicks+' · disponible desde '+r.readyAtTick+' · faltan '+Math.max(0,r.readyAtTick-tick)+'</span>').join("");
  get("nav-results").innerHTML=observed.results.length?'<table class="trace-table"><thead><tr><th>Robot / solicitud</th><th>Tick</th><th>Resultado</th></tr></thead><tbody>'+observed.results.slice().reverse().map(r=>'<tr><td>'+escape(r.robotId)+' / '+r.requestSequence+'</td><td>'+r.resolvedTick+'</td><td>'+escape(r.reason)+(r.duplicate?" · duplicado":"")+'</td></tr>').join("")+'</tbody></table><p class="muted small">'+observed.omittedResults+' resultados anteriores omitidos de esta vista; consultar traza/debug.</p>':"Todavía no hay solicitudes resueltas.";
 }
 function render():void{
  const s=controller?.snapshot(),d=s?.progress;
  get("nav-status").textContent=(s?.state??"idle")+" · "+(s?.contextId??"sin contexto")+" · tick "+(d?.nextTick??"—")+" / "+(d?.phase??"entre ticks")+(running?" · ejecución externa activa":" · pausado");
  get("nav-batch").textContent=runStatus;
  get("nav-agent").textContent=JSON.stringify(s?.observations["navigation-agent-fixture"]??{},null,2);get("nav-cursor").textContent=JSON.stringify({cursor:d,failure:s?.failure,resources:s?.resourcesPending},null,2);
  const world=visual()?.world,current=get<HTMLSelectElement>("nav-robot").value;
  get<HTMLSelectElement>("nav-robot").innerHTML=(world?.robots??[]).map(r=>'<option value="'+escape(r.robotId)+'"'+(r.robotId===current?" selected":"")+'>'+escape(r.robotId)+'</option>').join("");
  const trace=controller?.trace(),filter=get<HTMLInputElement>("nav-filter").value.toLowerCase();let entries=trace?.entries??[];if(filter)entries=entries.filter(e=>JSON.stringify(e).toLowerCase().includes(filter));
  get("nav-trace").innerHTML=(trace&&!trace.complete?'<p class="error">Traza incompleta: '+trace.droppedEntries+' registros omitidos.</p>':"")+entries.slice(-100).map(e=>'<details><summary>'+escape(e.kind)+(e.kind==="published"?" · "+escape(e.message.type)+" #"+e.message.messageId:"")+'</summary><pre>'+escape(JSON.stringify(e,null,2))+'</pre></details>').join("");
  container.querySelectorAll<HTMLButtonElement>("button").forEach(b=>{b.disabled=busy;});
  const executable=!!s&&["initializing","ready"].includes(s.state);
  for(const id of ["nav-step","nav-phase","nav-tick","nav-n","nav-run"])get<HTMLButtonElement>(id).disabled=busy||!executable||running;
  for(const id of ["nav-goal","nav-manual","nav-repeat"])get<HTMLButtonElement>(id).disabled=busy||s?.state!=="ready"||running||(id==="nav-repeat"&&!lastConfig);
  for(const id of ["nav-export-replay","nav-replay"])get<HTMLButtonElement>(id).disabled=busy||s?.state!=="ready"||!!d?.tickInProgress||!trace?.complete||running;
  get<HTMLButtonElement>("nav-pause").disabled=!running;get<HTMLButtonElement>("nav-new").disabled=busy||running||(!!s&&s.state!=="idle");get<HTMLButtonElement>("nav-start").disabled=busy||running;get<HTMLButtonElement>("nav-close").disabled=busy||!controller;get<HTMLButtonElement>("nav-late").disabled=busy||!oldContext||running;
  get("nav-log").textContent=[...logs].map(([context,l])=>context+" · "+(l.path||"archivo pendiente")+" · "+l.written+" escritos · "+l.pending.length+" pendientes").join("\n")||"Debug todavía sin registros.";
  draw();
 }
 function collect():void{for(const g of controller?.drainDebugLog()??[]){let l=logs.get(g.contextId);if(!l){l={id:"",path:"",written:0,pending:[],all:[]};logs.set(g.contextId,l);}l.pending.push(...g.records);l.all.push(...g.records);}}
 async function flush():Promise<void>{collect();for(const l of logs.values()){if(!l.pending.length)continue;if(!l.id){const response=await fetch("/__debug-log",{method:"POST"}),data=await response.json();if(!response.ok)throw Error(data.error??"Error creando log");l.id=data.id;l.path=data.path;}while(l.pending.length){let count=0,bytes=0;for(const r of l.pending.slice(0,1000)){const size=new TextEncoder().encode(JSON.stringify(r)).length+1;if(size>2_000_000)throw Error("Registro demasiado grande; descarga debug");if(bytes+size>2_000_000)break;bytes+=size;count++;}const response=await fetch("/__debug-log/"+l.id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(l.pending.slice(0,count))}),data=await response.json();if(!response.ok)throw Error(data.error??"Error de log; conserva pendientes");l.pending.splice(0,count);l.written+=count;}}}
 async function perform(action:()=>void):Promise<{ok:true}|{ok:false;message:string}>{if(busy)return{ok:false,message:"Otra operación está en curso."};busy=true;render();try{action();await flush();return{ok:true};}catch(e){running=false;const message=String(e);notice(message);return{ok:false,message};}finally{busy=false;render();}}
 function download(name:string,value:unknown,raw=false):void{const url=URL.createObjectURL(new Blob([raw?String(value):JSON.stringify(value,null,2)],{type:raw?"application/x-ndjson":"application/json"}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);}
 function prepare():void{
  const parsed=parseContentJson(get<HTMLTextAreaElement>("nav-content").value);if(!parsed.ok){notice(parsed.issues);return;}const s=JSON.parse(get<HTMLTextAreaElement>("nav-scenario").value) as Scenario;
  if(!controller)controller=create();const old=controller.snapshot().contextId;
  const reply=controller.request({requestId:"navigation-request-"+(++requestSeq),seed:"0123456789abcdef",content:parsed.content,selection:s as unknown as Payload,debug:get<HTMLInputElement>("nav-debug").checked});result(reply);
  if(reply.ok){activeScenario=s;config=structuredClone(s.config);configSeq=config.configSequence;lastConfig=undefined;get<HTMLInputElement>("nav-auto").checked=config.autoEnabled;if(old)oldContext=old;}
 }
 function configuration(raw=false):void{
  const w=visual()?.world,r=w?.robots.find(r=>r.robotId===get<HTMLSelectElement>("nav-robot").value);if(!w||!r||!config)throw Error("Selecciona una entidad disponible");
  const q=Number(get<HTMLInputElement>("nav-q").value),row=Number(get<HTMLInputElement>("nav-r").value),d=controller!.snapshot().progress!,dueTick=d.nextTick+(d.tickInProgress?1:0);
  const goals=config.goals.filter(g=>g.robotId!==r.robotId);if(!raw)goals.push({robotId:r.robotId,q,r:row});
  const sequence=Math.max(0,...(visual()?.results??[]).filter(x=>x.robotId===r.robotId).map(x=>x.requestSequence),...((controller!.trace()?.entries??[]).flatMap(e=>e.kind==="published"&&e.message.type==="RequestNavigationStep"&&e.message.payload.robotId===r.robotId?[e.message.payload.requestSequence as number]:[])))+1;
  const next:FixtureConfig={configSequence:++configSeq,autoEnabled:raw?false:get<HTMLInputElement>("nav-auto").checked,goals:raw?config.goals:goals,rawSteps:raw?[{dueTick,step:{boardId:w.boardId,robotId:r.robotId,requestSequence:sequence,from:{q:r.q,r:r.r},to:{q,r:row},expectedRobotRevision:r.robotRevision,knownBoardRevision:w.boardRevision}}]:[]};
  if(controller!.stage(controller!.snapshot().contextId,"ConfigureNavigationFixture",next as unknown as Payload)){config=next;lastConfig=next;notice("Configuración encolada para decision; avanza para consumirla.");}else notice("Configuración rechazada antes de admitirla.");
 }
 function playback(data:unknown):ApplicationController{
  const a=create(),accepted=a.loadReplay(data);if(!accepted.ok)throw Error(accepted.code+" · "+accepted.message);const horizon=(data as ReplayRecording).completedTicks;if(horizon>5000){a.close();throw Error("Comparación manual limitada a 5000 ticks");}
  try{for(let i=0;i<horizon;i++){const r=a.advance();if(!r.ok)throw Error(r.message);}return a;}catch(e){a.close();throw e;}
 }
 function describeBatch(status:"en curso"|TickBatchResult["status"],progress:TickBatchProgress,error?:string):string{
  const label=status==="completed"?"completada":status==="paused"?"pausada":status==="failed"?"fallida":status;
  const target=progress.targetTick===null?"continuo":String(progress.targetTick);
  return "Tanda "+label+" · cursor inicial "+progress.startTick+" · cursor objetivo "+target+" · ticks ejecutados "+progress.actualTicks+" · cursor final "+progress.finalTick+(error?" · "+error:"");
 }
 async function run(count:number,continuous=false):Promise<void>{
  if(running||busy)return;const token=++runToken;const startTick=controller?.snapshot().progress?.nextTick;
  if(startTick===undefined){runStatus="No se pudo iniciar la tanda: el controlador no tiene cursor de simulación.";render();return;}
  running=true;runStatus=describeBatch("en curso",{startTick,targetTick:continuous?null:startTick+count,finalTick:startTick,actualTicks:0});render();
  const outcome=await runTickBatch({
   requestedTicks:count,continuous,
   readTick:()=>controller!.snapshot().progress!.nextTick,
   advanceTick:async()=>{
    let applicationResult:ApplicationResult|undefined;
    const operation=await perform(()=>{applicationResult=controller!.advance("tick");if(!applicationResult.ok)throw Error(applicationResult.code+" · "+applicationResult.message);});
    return operation.ok?{ok:true}:{ok:false,message:operation.message};
   },
   isActive:()=>running&&token===runToken,
   onProgress:(progress:TickBatchProgress)=>{runStatus=describeBatch("en curso",progress);render();},
   afterTick:()=>new Promise<void>(resolve=>setTimeout(resolve,Number(get<HTMLSelectElement>("nav-speed").value))),
  });
  if(token===runToken){running=false;batchHistory.push(outcome);if(batchHistory.length>100)batchHistory.shift();runStatus=describeBatch(outcome.status,outcome,outcome.error);if(outcome.status==="failed")notice("Tanda detenida: "+outcome.error);render();}
 }
 get("nav-preset").addEventListener("change",editorPreset);
 get("nav-start").addEventListener("click",()=>void perform(prepare));
 get("nav-close").addEventListener("click",()=>{running=false;runToken++;runStatus="Tanda interrumpida al cerrar el encuentro.";render();void perform(()=>{if(!controller)return;oldContext=controller.snapshot().contextId;result(controller.close());});});
 get("nav-new").addEventListener("click",()=>void perform(()=>{if(controller&&controller.snapshot().state!=="idle")throw Error("Cierra y limpia el encuentro primero");controller=create();lastConfig=undefined;config=undefined;activeScenario=undefined;configSeq=1;notice("Controlador nuevo: prepara un encuentro para comenzar.");}));
for(const [id,kind]of [["nav-step","step"],["nav-phase","phase"],["nav-tick","tick"]] as const)get(id).addEventListener("click",()=>void perform(()=>result(controller!.advance(kind))));
 get("nav-n").addEventListener("click",event=>{if(event.detail>1){notice("Doble clic ignorado; cada tanda comienza con un clic simple.");return;}const n=Number(get<HTMLInputElement>("nav-count").value);if(!Number.isInteger(n)||n<1||n>1000){notice("Cantidad de ticks: 1..1000");return;}void run(n);});
 get("nav-run").addEventListener("click",()=>void run(Number.MAX_SAFE_INTEGER,true));get("nav-pause").addEventListener("click",()=>{running=false;runStatus="Pausa solicitada; el avance actual terminará antes de detenerse.";render();});
 get("nav-goal").addEventListener("click",()=>void perform(()=>configuration()));get("nav-manual").addEventListener("click",()=>void perform(()=>configuration(true)));
 get("nav-repeat").addEventListener("click",()=>void perform(()=>notice(controller!.stage(controller!.snapshot().contextId,"ConfigureNavigationFixture",lastConfig as unknown as Payload)?"Configuración repetida encolada":"Configuración no admitida")));
 function cell(event:Event):void{const target=(event.target as Element).closest<SVGGElement>("[data-q]");if(!target)return;get<HTMLInputElement>("nav-q").value=target.dataset.q!;get<HTMLInputElement>("nav-r").value=target.dataset.r!;}
 get("nav-map").addEventListener("click",cell);get("nav-map").addEventListener("keydown",e=>{if((e as KeyboardEvent).key==="Enter")cell(e);});
 get("nav-filter").addEventListener("input",render);
 get("nav-retry").addEventListener("click",()=>void perform(()=>notice("Reintentando log pendiente")));
 get("nav-download").addEventListener("click",()=>{collect();for(const [id,l]of logs)download(id+".jsonl",l.all.map(r=>JSON.stringify(r)).join("\n")+"\n",true);});
 get("nav-save").addEventListener("click",()=>void perform(()=>download("navigation-scenario.json",{formatVersion:1,scenario:JSON.parse(get<HTMLTextAreaElement>("nav-scenario").value),content:JSON.parse(get<HTMLTextAreaElement>("nav-content").value)})));
 get<HTMLInputElement>("nav-import").addEventListener("change",async()=>{const f=get<HTMLInputElement>("nav-import").files?.[0];if(!f)return;try{if(f.size>2_097_152)throw Error("Archivo excede 2 MiB");const data=JSON.parse(await f.text());if(data.formatVersion!==1||!data.scenario||!data.content)throw Error("Escenario incompatible");get<HTMLTextAreaElement>("nav-scenario").value=JSON.stringify(data.scenario,null,2);get<HTMLTextAreaElement>("nav-content").value=JSON.stringify(data.content,null,2);notice("Escenario importado para el próximo encuentro; prepara para validar.");}catch(e){notice(String(e));}get<HTMLInputElement>("nav-import").value="";});
 get("nav-export-replay").addEventListener("click",()=>void perform(()=>download("navigation-replay.json",controller!.exportReplay())));
 get("nav-replay").addEventListener("click",()=>void perform(()=>{const a=playback(controller!.exportReplay());try{const equal=JSON.stringify(a.trace())===JSON.stringify(controller!.trace())&&JSON.stringify(a.snapshot().observations)===JSON.stringify(controller!.snapshot().observations);notice(equal?"Replay idéntico: traza, posiciones y vistas coinciden.":"Replay diferente: revisa la evidencia.");}finally{a.close();}}));
 get<HTMLInputElement>("nav-import-replay").addEventListener("change",async()=>{const f=get<HTMLInputElement>("nav-import-replay").files?.[0];if(!f)return;try{if(f.size>32_000_000)throw Error("Replay excede 32 MB");const data=JSON.parse(await f.text());await perform(()=>{const a=playback(data);if(controller){const closed=controller.close();if(!closed.ok){a.close();throw Error(closed.message);}}controller=a;activeScenario=(data.manifest.initialState.selection as Scenario);config=structuredClone(activeScenario.config);configSeq=config.configSequence;notice("Replay importado y reconstruido; ingreso vivo deshabilitado.");});}catch(e){notice(String(e));}get<HTMLInputElement>("nav-import-replay").value="";});
 get("nav-isolation").addEventListener("click",()=>void perform(()=>{const p=parseContentJson(get<HTMLTextAreaElement>("nav-content").value);if(!p.ok)throw Error("Catálogo inválido");const s=JSON.parse(get<HTMLTextAreaElement>("nav-scenario").value) as Scenario;s.config.autoEnabled=false;s.config.rawSteps=[];const a=create(),before=controller?.snapshot();try{const r=a.request({requestId:"isolated",seed:"0123456789abcdef",content:p.content,selection:s as unknown as Payload});if(!r.ok)throw Error(r.message);a.advance();a.advance();for(let i=0;i<10;i++)a.advance();const world=a.snapshot().observations["navigation-lab-observer"] as any;notice(JSON.stringify(before)===JSON.stringify(controller?.snapshot())&&world.world.boardRevision===0?"Segunda sesión independiente: encuentro original intacto.":"Revisa evidencia de aislamiento.");}finally{a.close();}}));
 get("nav-late").addEventListener("click",()=>void perform(()=>notice(controller!.stage(oldContext,"ConfigureNavigationFixture",{configSequence:configSeq+1,autoEnabled:false,goals:[],rawSteps:[]})?"Entrada admitida":"Entrada antigua rechazada; encuentro actual intacto.")));
get("nav-report").addEventListener("click",()=>download("navigation-report.json",{snapshot:controller?.snapshot(),trace:controller?.trace(),history,batches:batchHistory,oldContext,scenario:activeScenario}));
 editorPreset();render();
}
