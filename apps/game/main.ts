import {ApplicationController} from "@robots/application-host";
import {PresentationRenderer} from "@robots/presentation-three";
import {validateManifest} from "@robots/protocol/presentation/manifest-v1";
import type {CombatView} from "@robots/protocol/presentation/v2";
import content from "../../content/scenarios/combat-mvp-v1.json" with {type:"json"};
import manifestData from "../../content/presentation/prototype-v1.json" with {type:"json"};
import {combatRecipe} from "./composition.ts";
import {GameRunner} from "./runner.ts";
import {integrity,eventText,resultText} from "./view-model.ts";
const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const start=element<HTMLButtonElement>("start-btn"),viewport=element("viewport"),status=element("status");
let renderer:PresentationRenderer|undefined,lastSequence=0;
const controller=new ApplicationController({instanceId:"combat-game",runtime:"browser-v1",recipe:combatRecipe()});
const runner=new GameRunner(controller,{requestId:"combat-start",seed:"0123456789abcdef",content,selection:{scenarioId:"combat-mvp-v1"}},{
 async prepare(view){
  renderer=new PresentationRenderer(viewport,validateManifest(manifestData),{onLost:()=>runner.fail("Se perdió el contexto gráfico.")});
  await renderer.prepare(view);
  if(renderer.diagnostics.length)throw Error(renderer.diagnostics.join("; "));
 },
 accept(view){if(view.sequence===lastSequence)return;lastSequence=view.sequence;renderer?.acceptCombat(view);render(view);},
 change(state,error){
  const copy={idle:"Inicia el encuentro para observar a los robots.",loading:"Preparando el tablero y los robots…",running:"Combate en curso. Los robots actúan automáticamente.",finished:"Combate finalizado.",error:"No se pudo continuar el combate.",closed:"Encuentro cerrado."};
  status.textContent=copy[state];status.classList.toggle("error",state==="error");
  if(state==="loading"){start.disabled=true;start.textContent="Preparando…";element("empty").querySelector("h1")!.textContent="Preparando combate";}
  if(state==="running"){start.disabled=true;start.textContent="Combate en curso";element("empty").hidden=true;}
  if(state==="finished"){start.disabled=true;start.textContent="Combate finalizado";element("stage").textContent="Finalizado";}
  if(state==="error"){start.disabled=true;start.textContent="Combate detenido";element("stage").textContent="Error";element("empty").hidden=true;renderer?.close();console.error(error);}
 }
});
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
window.addEventListener("pagehide",()=>{runner.close();renderer?.close();},{once:true});
const diagnosticWindow=window as unknown as {render_game_to_text:()=>string};
diagnosticWindow.render_game_to_text=()=>JSON.stringify({state:runner.state,coordinates:"axiales q,r; origen superior izquierdo; q hacia la derecha; r diagonal abajo",view:runner.view?{stage:runner.view.stage,tick:runner.view.observedTick,robots:runner.view.world.robots.map(r=>({id:r.robotId,q:r.q,r:r.r})),combatants:runner.view.combatants,result:runner.view.result,events:runner.view.events.slice(-6)}:null});
