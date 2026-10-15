import { checkedInteger, checkedAdd, checkedSubtract, checkedMultiply } from "./numeric.ts";
import { ProtocolError } from "@robots/system-api";
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


/** Closed hex supercover: a wall touched only at an edge or vertex still blocks. */
export function hasLineOfSight(grid:Grid,from:Hex,to:Hex):boolean {
 validateGrid(grid);
 for(const p of [from,to])if(!Number.isSafeInteger(p.q)||!Number.isSafeInteger(p.r)||!inside(grid,p))
  throw new ProtocolError("HEX_LOS_INVALID","Visibility endpoints must be bounded integer hexes");
 if(same(from,to))return true;
 const project=(p:Hex)=>({x:checkedAdd(checkedMultiply(2,p.q),p.r),z:checkedMultiply(3,p.r)});
 const a=project(from),b=project(to),dx=checkedSubtract(b.x,a.x),dz=checkedSubtract(b.z,a.z);
 const planes:readonly (readonly [number,number,number])[]=[[1,0,1],[-1,0,1],[1,1,2],[-1,-1,2],[-1,1,2],[1,-1,2]];
 const after=(n:number,d:number,m:number,e:number)=>checkedMultiply(n,e)>checkedMultiply(m,d);
 for(const tile of grid.tiles){
  if(tile.passable||same(tile,from)||same(tile,to))continue;
  const c=project(tile),x=checkedSubtract(a.x,c.x),z=checkedSubtract(a.z,c.z);
  let ln=0,ld=1,un=1,ud=1,intersects=true;
  for(const [nx,nz,bound] of planes){
   const p=checkedAdd(checkedMultiply(nx,dx),checkedMultiply(nz,dz));
   const q=checkedSubtract(bound,checkedAdd(checkedMultiply(nx,x),checkedMultiply(nz,z)));
   if(p===0){if(q<0){intersects=false;break;}continue;}
   if(p>0){if(after(un,ud,q,p)){un=q;ud=p;}}
   else if(after(-q,-p,ln,ld)){ln=-q;ld=-p;}
   if(after(ln,ld,un,ud)){intersects=false;break;}
  }
  if(intersects)return false;
 }
 return true;
}
