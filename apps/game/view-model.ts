import type {CombatView,RecentEvent} from "@robots/protocol/presentation/v2";
const name=(id:string|undefined)=>id==="alpha"||id==="team.alpha"?"Alpha":id==="beta"||id==="team.beta"?"Beta":id??"Robot";
export function integrity(units:number):string{
 if(!Number.isSafeInteger(units)||units<0)throw RangeError("Invalid integrity units");
 const remainder=units%1000,whole=(units-remainder)/1000;
 return whole.toLocaleString("es")+(remainder?","+String(remainder).padStart(3,"0").replace(/0+$/,""):"");
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
