import {copyIntegerData} from "@robots/values/integers";
import {ProtocolError} from "@robots/system-api";import {validateGrid,inside,key} from "@robots/values/hex-grid";import type {Board} from "@robots/protocol/navigation/v1";
export function fail(code:string,message:string):never{throw new ProtocolError(code,message);}
export const copyData=<T>(value:T):T=>copyIntegerData(value,"NAV_DATA");
export function validateBoard(value:Board):Board{
 const b=copyData(value);validateGrid(b);
 if(typeof b.boardId!=="string"||!/^[a-zA-Z0-9._-]{1,64}$/.test(b.boardId)||!Array.isArray(b.robots)||b.robots.length>16)fail("NAV_INVALID_BOARD","Invalid board or entities");
 const tileMap=new Map(b.tiles.map(t=>[key(t),t]));for(const t of b.tiles)if(typeof t.terrainId!=="string"||!/^terrain\.[a-z][a-z0-9._-]*$/.test(t.terrainId)||t.terrainId.length>128)fail("NAV_INVALID_BOARD","Invalid terrain reference");
 const ids=new Set<string>(),occupied=new Set<string>();
 for(const r of b.robots){if(typeof r.robotId!=="string"||!/^[a-zA-Z0-9._-]{1,64}$/.test(r.robotId)||ids.has(r.robotId)||typeof r.definitionId!=="string"||!/^robot\.[a-z][a-z0-9._-]*$/.test(r.definitionId)||r.definitionId.length>128||!Number.isSafeInteger(r.q)||!Number.isSafeInteger(r.r)||!inside(b,r)||!tileMap.get(key(r))?.passable||occupied.has(key(r))||!Number.isSafeInteger(r.moveCooldownTicks)||r.moveCooldownTicks<1)fail("NAV_INVALID_BOARD","Invalid entity placement/cooldown");ids.add(r.robotId);occupied.add(key(r));}
 return b;
}
