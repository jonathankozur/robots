import type {ApplicationController,Request} from "@robots/application-host";
import {validateMessage} from "@robots/protocol/presentation/v2";
import type {CombatView} from "@robots/protocol/presentation/v2";
export interface Clock{set(callback:()=>void,delay:number):unknown;clear(handle:unknown):void}
export type RunnerState="idle"|"loading"|"running"|"finished"|"error"|"closed";
export interface RunnerHooks{prepare(view:CombatView):Promise<void>;accept(view:CombatView):void;change(state:RunnerState,error?:string):void}
const clock:Clock={set:(cb,ms)=>setTimeout(cb,ms),clear:h=>clearTimeout(h as ReturnType<typeof setTimeout>)};
/** External 50 ms driver: no catch-up, no clock reaches a simulation actor. */
export class GameRunner {
 #state:RunnerState="idle";#view:CombatView|undefined;#used=false;#prepared=false;#timer:unknown;#generation=0;
 #controller:ApplicationController;#request:Request;#hooks:RunnerHooks;#clock:Clock;
 constructor(controller:ApplicationController,request:Request,hooks:RunnerHooks,timerClock:Clock=clock){this.#controller=controller;this.#request=request;this.#hooks=hooks;this.#clock=timerClock;}
 get state(){return this.#state;}get view(){return this.#view;}
 #change(state:RunnerState,error?:string){this.#state=state;this.#hooks.change(state,error);}
 start():boolean {
  if(this.#used)return false;this.#used=true;this.#generation++;
  const result=this.#controller.request(this.#request);if(!result.ok){this.fail(result.code+": "+result.message);return false;}
  this.#change("loading");this.#schedule();return true;
 }
 #schedule(){if(this.#state==="closed"||this.#state==="error"||this.#state==="finished")return;this.#timer=this.#clock.set(()=>{this.#timer=undefined;void this.#step();},50);}
 async #step(){
  const generation=this.#generation;
  try{
   const advanced=this.#controller.advance("tick");if(!advanced.ok)throw Error(advanced.code+": "+advanced.message);
   const snap=this.#controller.snapshot(),raw=snap.observations.presentation;
   if(raw){
    const view=validateMessage(raw);this.#view=view;
    if(!this.#prepared){await this.#hooks.prepare(view);if(generation!==this.#generation)return;this.#prepared=true;}
    this.#hooks.accept(view);
    if(view.stage==="FINISHED"){this.#change("finished");return;}
    this.#change("running");
   }
   if(generation===this.#generation)this.#schedule();
  }catch(error){if(generation===this.#generation)this.fail(error instanceof Error?error.message:String(error));}
 }
 fail(message:string):void{
  if(this.#state==="closed"||this.#state==="error")return;
  this.#generation++;if(this.#timer!==undefined)this.#clock.clear(this.#timer);this.#timer=undefined;
  this.#controller.close();this.#change("error",message);
 }
 close():void {
  if(this.#state==="closed")return;
  this.#generation++;if(this.#timer!==undefined)this.#clock.clear(this.#timer);this.#timer=undefined;
  this.#controller.close();this.#change("closed");
 }
}
