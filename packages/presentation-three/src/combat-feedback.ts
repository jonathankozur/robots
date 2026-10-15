import type {CombatView,RecentEvent} from "@robots/protocol/presentation/v2";
/** Visual events have no authority over simulation. Gaps snap to the full snapshot. */
export class CombatFeedback {
 #context="";#sequence=0;#high=0;
 accept(view:CombatView):readonly RecentEvent[]{
  if(view.contextId===this.#context&&view.sequence<=this.#sequence)return [];
  const continuous=view.contextId===this.#context&&view.sequence===this.#sequence+1;
  if(view.contextId!==this.#context)this.#high=0;
  const fresh=continuous?view.events.filter(e=>e.sourceMessageId>this.#high&&(e.kind==="ATTACK"||e.kind==="DAMAGE")):[];
  this.#context=view.contextId;this.#sequence=view.sequence;
  for(const e of view.events)this.#high=Math.max(this.#high,e.sourceMessageId);
  return fresh;
 }
 reset():void{this.#context="";this.#sequence=0;this.#high=0;}
}
