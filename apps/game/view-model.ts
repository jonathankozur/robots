import type {CombatView,RecentEvent} from "@robots/protocol/presentation/v2";
import type {CombatReport,CombatantStats} from "@robots/protocol/battle/v1";
export const name=(id:string|undefined)=>id==="alpha"||id==="team.alpha"?"Alpha":id==="beta"||id==="team.beta"?"Beta":id??"Robot";
export function integrity(units:number):string{
 if(!Number.isSafeInteger(units)||units<0)throw RangeError("Invalid integrity units");
 const remainder=units%1000,whole=(units-remainder)/1000;
 return whole.toLocaleString("es")+(remainder?","+String(remainder).padStart(3,"0").replace(/0+$/,""):"");
}
export function secondsText(ticks:number):string{
 const sec=(ticks*0.05).toFixed(1);
 return sec.replace(".",",")+"s";
}
const reasons:Record<string,string>={OUT_OF_RANGE:"objetivo fuera de alcance",LINE_BLOCKED:"línea de tiro bloqueada",WEAPON_NOT_READY:"arma recargando",STALE_OBSERVATION:"observación vencida",TARGET_NOT_VISIBLE:"objetivo no visible",TARGET_DEFEATED:"objetivo derrotado",ATTACKER_DEFEATED:"robot derrotado",NO_VISIBLE_TARGET:"buscando objetivo",NO_PATH:"sin camino",MOVEMENT_COOLDOWN:"preparando movimiento",WEAPON_COOLDOWN:"recargando",NO_OBSERVATION:"esperando observación",APPROACH_ADJACENT:"se acerca al rival",APPROACH_WEAPON_RANGE:"busca posición de tiro",TARGET_IN_RANGE:"objetivo al alcance"};
export function eventText(e:RecentEvent):string{
 switch(e.kind){
  case "DAMAGE":return name(e.robotId)+" inflige "+integrity(e.amountUnits!)+" de daño a "+name(e.targetRobotId);
  case "ATTACK":return name(e.robotId)+" dispara a "+name(e.targetRobotId);
  case "MOVE":return name(e.robotId)+" avanza";
  default:return name(e.robotId)+": "+(reasons[e.reasonCode!]??"acción rechazada");
 }
}
export function resultText(v:CombatView):string{
 const r=v.result;if(!r)return "";
 return r.outcome==="WIN"?"Victoria de "+name(r.winnerTeamId):r.reason==="ELIMINATION"?"Empate por doble derrota":"Empate por tiempo";
}
export function reportSummaryText(report:CombatReport):string{
 const time=secondsText(report.durationTicks)+" ("+report.durationTicks+" ticks)";
 const outcomeText=report.outcome==="WIN"?"Victoria de "+name(report.winnerTeamId):report.reason==="ELIMINATION"?"Empate por doble derrota":"Empate por tiempo";
 return outcomeText+" en "+time;
}
export function combatantStatsSummary(c:CombatantStats):{
 name:string;integrityText:string;damageDealtText:string;damageTakenText:string;
 accuracyText:string;movementText:string;statusText:string;
}{
 return {
  name:name(c.robotId),
  statusText:c.status==="ACTIVE"?"Activo":"Derrotado",
  integrityText:integrity(c.finalIntegrityUnits)+" / "+integrity(c.maxIntegrityUnits),
  damageDealtText:integrity(c.damageDealtUnits),
  damageTakenText:integrity(c.damageTakenUnits),
  accuracyText:c.accuracyPercentage+"% ("+c.attacksLanded+"/"+c.attacksAttempted+")",
  movementText:c.movementSteps+(c.movementSteps===1?" paso":" pasos")
 };
}
