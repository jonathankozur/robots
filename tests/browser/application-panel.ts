import { ApplicationController } from "@robots/application-host";
import type { Request, Result } from "@robots/application-host";
import { parseContentJson } from "@robots/content";
import { fixtureRecipe, nav, combat } from "../core/application-fixture.ts";
import type { Mode } from "../core/application-fixture.ts";
import basic from "../../content/fixtures/basic-v2.json" with { type:"json" };
import type { DebugRecord } from "@robots/runtime";

export function mountApplicationPanel(container:HTMLElement):void {
  container.innerHTML='<section class="application-panel"><div class="section-title"><div><span class="eyebrow">CICLO DE APLICACIÓN / APP-001</span><h2>Preparar, iniciar y cerrar encuentros</h2></div><span>Laboratorio de desarrollo</span></div>'
    +'<p class="muted">Dos propietarios ficticios. El avance es manual; disponibilidad requiere todas las confirmaciones. Editar el siguiente paquete conserva el encuentro actual.</p>'
    +'<div class="application-config"><label>Escenario<select id="app-mode"><option value="normal">Normal</option><option value="missing">Confirmación ausente</option><option value="reject">Rechazo de propietario</option><option value="duplicate">Confirmación duplicada</option><option value="conflict">Confirmación contradictoria</option><option value="crash">Excepción de propietario</option></select></label>'
    +'<label>Robot<input id="app-robot" value="robot.scout"></label><label>Terreno<input id="app-terrain" value="terrain.floor"></label><label>Límite de inicialización (ticks)<input id="app-limit" type="number" min="1" max="10000" value="3"></label>'
    +'<label><input id="app-restored" type="checkbox"> Usar partes restauradas de prueba (contador 7, integridad 70000)</label><label><input id="app-debug" type="checkbox" checked> Debug a archivo</label><label><input id="app-cleanup-fail" type="checkbox"> Fallar limpieza de recursos</label></div>'
    +'<details><summary>JSON del próximo encuentro</summary><textarea id="app-json" aria-label="JSON del próximo encuentro" spellcheck="false"></textarea></details>'
    +'<div class="application-controls"><button id="app-prepare" class="primary">Preparar encuentro</button><button id="app-repeat">Repetir solicitud</button><button id="app-step">Paso</button><button id="app-phase">Fase</button><button id="app-tick">Tick</button><button id="app-operate">Enviar operación (+1)</button><button id="app-late">Entrada tardía</button><button id="app-close">Cerrar contexto</button><button id="app-new">Nuevo controlador</button></div>'
    +'<div id="app-status" class="status-strip" aria-live="polite"></div><div id="app-result" class="notice" role="status" aria-live="polite">Prepara el primer encuentro. Para cambiar escenario, cierra y crea un controlador nuevo.</div>'
    +'<div class="application-workspace"><section><h3>Confirmaciones y contexto</h3><pre id="app-context"></pre><h3>Vistas públicas de los propietarios</h3><pre id="app-owners"></pre><h3>Registro del controlador</h3><pre id="app-history"></pre></section>'
    +'<section><h3>Traza del encuentro</h3><div id="app-trace" class="content-trace"></div><details><summary>Manifiesto fijado</summary><pre id="app-manifest"></pre></details></section></div>'
    +'<div class="application-controls"><button id="app-replay">Reproducir y comparar</button><button id="app-export">Exportar replay</button><button id="app-report">Exportar reporte</button><button id="app-retry-log">Reintentar log</button><button id="app-download-log">Descargar debug</button></div><pre id="app-log"></pre></section>';
  const get=<T extends HTMLElement=HTMLElement>(id:string)=>container.querySelector<T>("#"+id)!;
  const escape=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
  let controller:ApplicationController|undefined,instance=0,sequence=0,mode:Mode="normal",lastRequest:Request|undefined,previousContext:string|null=null,busy=false;
  const history:string[]=[],logs=new Map<string,{id:string;path:string;written:number;pending:DebugRecord[];all:DebugRecord[]}>();
  const labels:Record<string,string>={idle:"Sin contexto",preparing:"Preparando",initializing:"Inicializando",ready:"Disponible",closing:"Cerrando",faulted:"Fallido"};
  get<HTMLTextAreaElement>("app-json").value=JSON.stringify(basic,null,2);
  function create():void {
    mode=get<HTMLSelectElement>("app-mode").value as Mode;
    controller=new ApplicationController({instanceId:"application-lab-"+crypto.randomUUID()+"-"+(++instance),runtime:navigator.userAgent,
      recipe:fixtureRecipe({mode,failCleanup:()=>get<HTMLInputElement>("app-cleanup-fail").checked})});
    lastRequest=undefined;
  }
  function show(value:unknown):void {
    const text=typeof value==="string"?value:JSON.stringify(value);
    get("app-result").textContent=text;history.push(text);if(history.length>100)history.shift();
  }
  function result(r:Result):void {show(r.ok?"Solicitud aceptada · "+r.contextId:r.code+" · "+r.message);}
  function render():void {
    const s=controller?.snapshot();
    get("app-status").textContent=(labels[s?.state??"idle"]??s?.state)+" · "+(s?.contextId??"sin sesión")+" · avance manual";
    get("app-context").textContent=JSON.stringify(s?{estado:s.state,contexto:s.contextId,intento:s.attemptId,pendientes:s.pendingParticipants,recursos:s.resourcesPending,cursor:s.progress,fallo:s.failure}:{estado:"idle"},null,2);
    get("app-owners").textContent=JSON.stringify(s?.observations??{},null,2);
    get("app-history").textContent=history.slice(-12).join("\n");
    const trace=controller?.trace();get("app-manifest").textContent=JSON.stringify(trace?.manifest??{},null,2);
    get("app-trace").innerHTML=trace?.entries.slice(-160).map((e,i)=>'<details><summary>'+(i+1)+'. '+escape(e.kind)+(e.kind==="published"?" · "+escape(e.message.type):"")+'</summary><pre>'+escape(JSON.stringify(e,null,2))+'</pre></details>').join("")||"Sin mensajes";
    container.querySelectorAll<HTMLButtonElement>("button").forEach(button=>{button.disabled=busy;});
    for(const id of ["app-step","app-phase","app-tick"])get<HTMLButtonElement>(id).disabled=busy||!s||!["ready","initializing"].includes(s.state);
    get<HTMLButtonElement>("app-operate").disabled=busy||s?.state!=="ready";
    get<HTMLButtonElement>("app-repeat").disabled=busy||!lastRequest;
    get<HTMLButtonElement>("app-late").disabled=busy||!previousContext;
    get<HTMLButtonElement>("app-new").disabled=busy||!!s&&s.state!=="idle";
    const replayable=s?.state==="ready"&&!s.progress?.tickInProgress;
    for(const id of ["app-replay","app-export"])get<HTMLButtonElement>(id).disabled=busy||!replayable;
    get<HTMLSelectElement>("app-mode").disabled=busy||!!s&&s.state!=="idle";
    get("app-log").textContent=[...logs].map(([context,l])=>context+" · "+(l.path||"archivo pendiente")+" · "+l.written+" escritos · "+l.pending.length+" pendientes").join("\n")||"Debug aún sin registros.";
  }
  function collect():void {
    for(const group of controller?.drainDebugLog()??[]){
      let log=logs.get(group.contextId);if(!log){log={id:"",path:"",written:0,pending:[],all:[]};logs.set(group.contextId,log);}
      log.pending.push(...group.records);log.all.push(...group.records);
    }
  }
  async function flush():Promise<void> {
    collect();
    for(const log of logs.values()){
      if(!log.pending.length)continue;
      if(!log.id){const response=await fetch("/__debug-log",{method:"POST"});const data=await response.json();if(!response.ok)throw new Error(data.error??"No se pudo crear el log");log.id=data.id;log.path=data.path;}
      while(log.pending.length){
        let bytes=0,count=0;
        for(const entry of log.pending.slice(0,2000)){const n=new TextEncoder().encode(JSON.stringify(entry)).length+1;if(n>2_000_000)throw new Error("Registro demasiado grande; descarga debug.");if(bytes+n>2_000_000)break;bytes+=n;count++;}
        const response=await fetch("/__debug-log/"+log.id,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(log.pending.slice(0,count))});
        const data=await response.json();if(!response.ok)throw new Error(data.error??"Error de escritura");log.pending.splice(0,count);log.written+=count;
      }
    }
  }
  async function perform(action:()=>void):Promise<void> {
    if(busy)return;busy=true;render();
    try{action();await flush();}catch(e){show(e instanceof Error?e.message:String(e));}finally{busy=false;render();}
  }
  function download(name:string,value:unknown,raw=false):void {
    const url=URL.createObjectURL(new Blob([raw?String(value):JSON.stringify(value,null,2)],{type:raw?"application/x-ndjson":"application/json"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download=name;anchor.click();URL.revokeObjectURL(url);
  }
  get("app-prepare").addEventListener("click",()=>void perform(()=>{
    if(!controller)create();
    const parsed=parseContentJson(get<HTMLTextAreaElement>("app-json").value);if(!parsed.ok){show(parsed.issues);return;}
    const selection={robotId:get<HTMLInputElement>("app-robot").value,terrainId:get<HTMLInputElement>("app-terrain").value};
    const r:Request={requestId:"request-"+(++sequence),seed:"0123456789abcdef",content:parsed.content,selection,
      initializationMaxTicks:Number(get<HTMLInputElement>("app-limit").value),debug:get<HTMLInputElement>("app-debug").checked};
    if(get<HTMLInputElement>("app-restored").checked){
      const views=fixtureRecipe().prepare(parsed.content,selection);
      const restore={version:1 as const,recipeId:"application.fixture",checkpointId:"fixture-checkpoint",revision:"fixture-r1",parts:[
        {ownerId:nav,version:1 as const,revision:"fixture-r1",data:{...views[nav],count:7}},
        {ownerId:combat,version:1 as const,revision:"fixture-r1",data:{...views[combat],integrityUnits:70000,count:0}}]};
      lastRequest={...r,restore};
    }else lastRequest=r;
    const old=controller!.snapshot().contextId,reply=controller!.request(lastRequest);
    if(reply.ok&&old&&old!==reply.contextId)previousContext=old;
    result(reply);
  }));
  get("app-repeat").addEventListener("click",()=>void perform(()=>result(controller!.request(lastRequest!))));
  for(const [id,kind]of [["app-step","step"],["app-phase","phase"],["app-tick","tick"]]as const)get(id).addEventListener("click",()=>void perform(()=>result(controller!.advance(kind))));
  get("app-operate").addEventListener("click",()=>void perform(()=>show(controller!.stage(controller!.snapshot().contextId,"OperateNavigation",{delta:1})?"Operación encolada; avanza para consumirla.":"Operación rechazada.")));
  get("app-late").addEventListener("click",()=>void perform(()=>show(controller!.stage(previousContext,"OperateNavigation",{delta:99})?"Entrada aceptada":"Entrada antigua rechazada; contexto nuevo intacto.")));
  get("app-close").addEventListener("click",()=>void perform(()=>{if(!controller)return;previousContext=controller.snapshot().contextId??previousContext;result(controller.close());}));
  get("app-new").addEventListener("click",()=>void perform(()=>{if(controller&&controller.snapshot().state!=="idle")throw new Error("Cierra el contexto y limpia recursos primero.");create();show("Controlador nuevo: "+instance);}));
  get("app-retry-log").addEventListener("click",()=>void perform(()=>show("Reintentando registros pendientes.")));
  get("app-export").addEventListener("click",()=>void perform(()=>download("application-replay.json",controller!.exportReplay())));
  get("app-report").addEventListener("click",()=>download("application-report.json",{snapshot:controller?.snapshot(),trace:controller?.trace(),history}));
  get("app-download-log").addEventListener("click",()=>{collect();for(const [context,l]of logs)download(context+".jsonl",l.all.map(r=>JSON.stringify(r)).join("\n")+"\n",true);});
  get("app-replay").addEventListener("click",()=>void perform(()=>{
    const recording=controller!.exportReplay();if(recording.completedTicks>5000)throw new Error("La comparación manual está limitada a 5000 ticks.");
    const replay=new ApplicationController({instanceId:"application-replay-"+(++sequence),runtime:navigator.userAgent,recipe:fixtureRecipe({mode})});
    const accepted=replay.loadReplay(recording);if(!accepted.ok){result(accepted);return;}
    try{
      for(let i=0;i<recording.completedTicks;i++){const r=replay.advance();if(!r.ok)throw new Error(r.message);}
      const equal=JSON.stringify(replay.trace())===JSON.stringify(controller!.trace())&&JSON.stringify(replay.snapshot().observations)===JSON.stringify(controller!.snapshot().observations);
      show(equal?"Replay idéntico: traza y vistas públicas coinciden.":"Replay diferente: revisa la evidencia.");
    }finally{replay.close();}
  }));
  render();
}
