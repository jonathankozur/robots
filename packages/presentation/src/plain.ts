import { ProtocolError } from "@robots/system-api";
import { freezeIntegerData } from "@robots/values/integers";
export function fail(message:string):never {throw new ProtocolError("PRESENTATION_INVALID",message);}
export const frozen=<T>(value:T):T=>freezeIntegerData(value,"PRESENTATION_INVALID");
