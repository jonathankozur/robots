import { checkedInteger, checkedAdd, checkedSubtract, ProtocolError } from "../../core/index.ts";
export interface Hex { readonly q:number; readonly r:number }
export interface Grid { readonly width:number; readonly height:number; readonly tiles:readonly (Hex & {readonly passable:boolean})[] }
export const key=(h:Hex):string=>h.q+","+h.r;
export const same=(a:Hex,b:Hex):boolean=>a.q===b.q&&a.r===b.r;
export function validHex(h:Hex):void{checkedInteger(h.q);checkedInteger(h.r);}
export function neighbors(h:Hex):readonly Hex[]{validHex(h);return Object.freeze([[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]].map(([q,r])=>Object.freeze({q:checkedAdd(h.q,q!),r:checkedAdd(h.r,r!)})));}
export function distance(a:Hex,b:Hex):number{validHex(a);validHex(b);const q=checkedSubtract(a.q,b.q),r=checkedSubtract(a.r,b.r);return Math.max(Math.abs(q),Math.abs(r),Math.abs(checkedAdd(q,r)));}
export function inside(g:Pick<Grid,"width"|"height">,h:Hex):boolean{return h.q>=0&&h.q<g.width&&h.r>=0&&h.r<g.height;}
export function validateGrid(g:Grid):void{
 if(!Number.isSafeInteger(g.width)||!Number.isSafeInteger(g.height)||g.width<1||g.width>12||g.height<1||g.height>12||!Array.isArray(g.tiles)||g.tiles.length!==g.width*g.height)throw new ProtocolError("NAV_INVALID_GRID","Expected complete bounded grid");
 const seen=new Set<string>();for(const t of g.tiles){validHex(t);if(!inside(g,t)||typeof t.passable!=="boolean"||seen.has(key(t)))throw new ProtocolError("NAV_INVALID_GRID","Invalid or repeated tile");seen.add(key(t));}
}
export interface PathResult { readonly status:"FOUND"|"NO_PATH"|"ALREADY_THERE";readonly path:readonly Hex[];readonly explored:number }
export function findPath(g:Grid,from:Hex,to:Hex,occupied:readonly Hex[]=[]):PathResult{
 validateGrid(g);validHex(from);validHex(to);
 const finish=(status:PathResult["status"],path:Hex[],explored:number):PathResult=>Object.freeze({status,path:Object.freeze(path.map(p=>Object.freeze({...p}))),explored});
 const free=new Set(g.tiles.filter(t=>t.passable).map(key));
 for(const h of occupied){validHex(h);if(!same(h,from))free.delete(key(h));}
 if(!free.has(key(from))||!free.has(key(to)))return finish("NO_PATH",[],0);
 if(same(from,to))return finish("ALREADY_THERE",[],1);
 const queue:Hex[]=[{...from}],previous=new Map<string,Hex|null>([[key(from),null]]);let explored=0;
 for(let i=0;i<queue.length;i++){const p=queue[i]!;explored++;if(same(p,to)){const path:Hex[]=[];let current=p;while(!same(current,from)){path.push(current);current=previous.get(key(current))!;}return finish("FOUND",path.reverse(),explored);}
  for(const next of neighbors(p))if(free.has(key(next))&&!previous.has(key(next))){previous.set(key(next),p);queue.push(next);}
 }
 return finish("NO_PATH",[],explored);
}
