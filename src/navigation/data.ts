import {ProtocolError} from "../core/index.ts";import {validateGrid,inside,key} from "../shared/hex-grid/index.ts";import type {Board} from "./contracts.ts";
export function fail(code:string,message:string):never{throw new ProtocolError(code,message);}
export function copyData<T>(value:T):T{
 const active=new Set<object>();function walk(v:unknown,depth:number):unknown{
  if(depth>32)fail("NAV_DATA","Data depth exceeded");if(v===null||typeof v==="string"||typeof v==="boolean")return v;if(typeof v==="number"&&Number.isSafeInteger(v))return v===0?0:v;
  if(typeof v!=="object"||!v||active.has(v))fail("NAV_DATA","Expected acyclic plain data");
  const array=Array.isArray(v),proto=Object.getPrototypeOf(v);if(proto!==(array?Array.prototype:Object.prototype)&&!(proto===null&&!array))fail("NAV_DATA","Unexpected prototype");
  const descriptors=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(v);active.add(v);
  if(keys.some(k=>typeof k!=="string"))fail("NAV_DATA","Symbol data forbidden");
  let result:unknown;if(array){const n=(v as unknown[]).length;if(keys.length!==n+1)fail("NAV_DATA","Sparse/decorated array");const out:unknown[]=[];for(let i=0;i<n;i++){const d=descriptors[String(i)];if(!d||!d.enumerable||!("value"in d))fail("NAV_DATA","Array accessor");out.push(walk(d.value,depth+1));}result=Object.freeze(out);}
  else{const out:Record<string,unknown>={};for(const k of (keys as string[]).sort()){const d=descriptors[k]!;if(!d.enumerable||!("value"in d))fail("NAV_DATA","Accessor/hidden field");Object.defineProperty(out,k,{value:walk(d.value,depth+1),enumerable:true});}result=Object.freeze(out);}
  active.delete(v);return result;
 }const out=walk(value,0);if(new TextEncoder().encode(JSON.stringify(out)).length>65536)fail("NAV_DATA","Data byte budget exceeded");return out as T;
}
export function validateBoard(value:Board):Board{
 const b=copyData(value);validateGrid(b);
 if(typeof b.boardId!=="string"||!/^[a-zA-Z0-9._-]{1,64}$/.test(b.boardId)||!Array.isArray(b.robots)||b.robots.length>16)fail("NAV_INVALID_BOARD","Invalid board or entities");
 const tileMap=new Map(b.tiles.map(t=>[key(t),t]));for(const t of b.tiles)if(typeof t.terrainId!=="string"||!/^terrain\.[a-z][a-z0-9._-]*$/.test(t.terrainId)||t.terrainId.length>128)fail("NAV_INVALID_BOARD","Invalid terrain reference");
 const ids=new Set<string>(),occupied=new Set<string>();
 for(const r of b.robots){if(typeof r.robotId!=="string"||!/^[a-zA-Z0-9._-]{1,64}$/.test(r.robotId)||ids.has(r.robotId)||typeof r.definitionId!=="string"||!/^robot\.[a-z][a-z0-9._-]*$/.test(r.definitionId)||r.definitionId.length>128||!Number.isSafeInteger(r.q)||!Number.isSafeInteger(r.r)||!inside(b,r)||!tileMap.get(key(r))?.passable||occupied.has(key(r))||!Number.isSafeInteger(r.moveCooldownTicks)||r.moveCooldownTicks<1)fail("NAV_INVALID_BOARD","Invalid entity placement/cooldown");ids.add(r.robotId);occupied.add(key(r));}
 return b;
}
