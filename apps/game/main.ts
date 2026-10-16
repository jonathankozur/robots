import {ApplicationController} from "@robots/application-host";
import {PresentationRenderer} from "@robots/presentation-three";
import {validateManifest} from "@robots/protocol/presentation/manifest-v1";
import type {CombatView} from "@robots/protocol/presentation/v2";
import type {CombatReport} from "@robots/protocol/battle/v1";
import content from "../../content/scenarios/combat-mvp-v1.json" with {type:"json"};
import manifestData from "../../content/presentation/prototype-v1.json" with {type:"json"};
import {combatRecipe} from "./composition.ts";
import {GameRunner} from "./runner.ts";
import {integrity,eventText,resultText,reportSummaryText,combatantStatsSummary} from "./view-model.ts";

const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const start=element<HTMLButtonElement>("start-btn"),viewport=element("viewport"),status=element("status");
const pauseBtn=element<HTMLButtonElement>("pause-btn"),replayBtn=element<HTMLButtonElement>("replay-btn"),reportBtn=element<HTMLButtonElement>("report-btn");
const replayFile=element<HTMLInputElement>("replay-file"),reportDialog=element("report-dialog"),closeReportBtn=element<HTMLButtonElement>("close-report-btn");
const reportSummary=element("report-summary"),reportStats=element("report-stats");
const downloadReplayBtn=element<HTMLButtonElement>("download-replay-btn"),downloadReportBtn=element<HTMLButtonElement>("download-report-btn");

let renderer:PresentationRenderer|undefined,lastSequence=0;
const createController=()=>new ApplicationController({instanceId:"combat-game",runtime:"browser-v1",recipe:combatRecipe()});
const runner=new GameRunner(createController(),{requestId:"combat-start",seed:"0123456789abcdef",content,selection:{scenarioId:"combat-mvp-v1"}},{
 async prepare(view){
  renderer=new PresentationRenderer(viewport,validateManifest(manifestData),{onLost:()=>runner.fail("Se perdió el contexto gráfico.")});
  await renderer.prepare(view);
  if(renderer.diagnostics.length)throw Error(renderer.diagnostics.join("; "));
 },
 accept(view){if(view.sequence===lastSequence)return;lastSequence=view.sequence;renderer?.acceptCombat(view);render(view);},
 change(state,error){
  const copy={
   idle:"Inicia el encuentro para observar a los robots.",
   loading:"Preparando el tablero y los robots…",
   running:runner.isReplay?"Reproducción en curso…":"Combate en curso. Los robots actúan automáticamente.",
   paused:"Combate pausado.",
   finished:runner.isReplay?"Reproducción finalizada.":"Combate finalizado.",
   error:"No se pudo continuar el combate.",
   closed:"Encuentro cerrado."
  };
  status.textContent=copy[state];status.classList.toggle("error",state==="error");
  pauseBtn.hidden=!(state==="running"||state==="paused");
  pauseBtn.textContent=state==="paused"?"Reanudar":"Pausar";
  if(state==="loading"){start.disabled=true;start.textContent="Preparando…";element("empty").querySelector("h1")!.textContent="Preparando combate";}
  if(state==="running"){start.disabled=true;start.textContent=runner.isReplay?"Reproduciendo":"Combate en curso";element("empty").hidden=true;}
  if(state==="finished"){
   start.disabled=true;start.textContent="Finalizado";element("stage").textContent="Finalizado";
   replayBtn.hidden=!runner.replay;
   if(runner.report){
    reportBtn.hidden=false;
    renderReport(runner.report);
    reportDialog.hidden=false;
   }
  }
  if(state==="error"){start.disabled=true;start.textContent="Detenido";element("stage").textContent="Error";element("empty").hidden=true;renderer?.close();console.error(error);}
 }
}, undefined, createController);

function renderReport(report:CombatReport){
 reportSummary.textContent=reportSummaryText(report);
 reportStats.replaceChildren(...report.combatants.map(c=>{
  const s=combatantStatsSummary(c);
  const card=document.createElement("div");card.className="report-stat-card "+(c.teamId==="team.beta"?"beta":"alpha");
  card.innerHTML=`<div class="stat-card-title"><h3>${s.name}</h3><span class="stat-badge">${s.statusText}</span></div>
  <dl class="stat-dl">
   <div><dt>Vida final</dt><dd>${s.integrityText}</dd></div>
   <div><dt>Daño infligido</dt><dd>${s.damageDealtText}</dd></div>
   <div><dt>Daño recibido</dt><dd>${s.damageTakenText}</dd></div>
   <div><dt>Precisión</dt><dd>${s.accuracyText}</dd></div>
   <div><dt>Movimiento</dt><dd>${s.movementText}</dd></div>
  </dl>`;
  return card;
 }));
}

function download(name:string,data:unknown){
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}

function render(view:CombatView){
 for(const hp of view.combatants){
  element(hp.robotId+"-health").textContent=integrity(hp.integrityUnits)+" / "+integrity(hp.maxIntegrityUnits);
  element(hp.robotId+"-state").textContent=hp.status==="ACTIVE"?"Activo":"Derrotado";
  const bar=element<HTMLProgressElement>(hp.robotId+"-bar");bar.max=hp.maxIntegrityUnits;bar.value=hp.integrityUnits;bar.setAttribute("aria-valuetext",integrity(hp.integrityUnits)+" de "+integrity(hp.maxIntegrityUnits));
 }
 element("stage").textContent=view.stage==="FINISHED"?"Finalizado":view.stage==="ACTIVE"?"En combate":"Listo";
 const seconds=Math.max(0,Math.floor((view.observedTick-(view.started?.startedTick??view.observedTick))*0.05));
 element("elapsed").textContent=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
 const rows=view.events.filter(e=>e.kind!=="DECISION").slice(-6).reverse();
 if(rows.length){element("events").replaceChildren(...rows.map(e=>{const li=document.createElement("li"),time=document.createElement("time"),text=document.createElement("span");time.textContent=(Math.max(0,e.tick-(view.started?.startedTick??0))*0.05).toFixed(1)+"s";text.textContent=eventText(e);li.append(time,text);return li;}));element("activity-mark").textContent="EN VIVO";}
 const title=resultText(view);if(title){element("result").textContent=title;element("result").hidden=false;element("activity-mark").textContent="FINAL";}
}

start.addEventListener("click",()=>runner.start());
pauseBtn.addEventListener("click",()=>{if(runner.state==="running")runner.pause();else if(runner.state==="paused")runner.resume();});
replayBtn.addEventListener("click",()=>{if(runner.replay)runner.startReplay(runner.replay);});
reportBtn.addEventListener("click",()=>{reportDialog.hidden=false;});
closeReportBtn.addEventListener("click",()=>{reportDialog.hidden=true;});
downloadReplayBtn.addEventListener("click",()=>{if(runner.replay)download("combat-replay.json",runner.replay);});
downloadReportBtn.addEventListener("click",()=>{if(runner.report)download("combat-report.json",runner.report);});
replayFile.addEventListener("change",()=>{
 const file=replayFile.files?.[0];if(!file)return;
 const reader=new FileReader();
 reader.onload=()=>{
  try{const data=JSON.parse(reader.result as string);runner.startReplay(data);}
  catch(e){alert("Error al leer el archivo de replay: "+(e instanceof Error?e.message:String(e)));}
 };
 reader.readAsText(file);replayFile.value="";
});

window.addEventListener("pagehide",()=>{runner.close();renderer?.close();},{once:true});
const diagnosticWindow=window as unknown as {render_game_to_text:()=>string};
diagnosticWindow.render_game_to_text=()=>JSON.stringify({
 state:runner.state,coordinates:"axiales q,r; origen superior izquierdo; q hacia la derecha; r diagonal abajo",
 view:runner.view?{stage:runner.view.stage,tick:runner.view.observedTick,robots:runner.view.world.robots.map(r=>({id:r.robotId,q:r.q,r:r.r})),combatants:runner.view.combatants,result:runner.view.result,events:runner.view.events.slice(-6)}:null,
 report:runner.report??null
});
