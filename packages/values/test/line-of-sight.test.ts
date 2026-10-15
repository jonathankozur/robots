import test from "node:test";
import assert from "node:assert/strict";
import { hasLineOfSight } from "../src/hex-grid.ts";
const grid=(walls:string[]=[])=>({width:4,height:4,tiles:Array.from({length:16},(_,i)=>({q:i%4,r:Math.floor(i/4),passable:!walls.includes(i%4+","+Math.floor(i/4))}))});
test("supercover blocks intermediate walls and grazing edges symmetrically",()=>{
 for(const [from,to,wall] of [
  [{q:0,r:0},{q:2,r:0},"1,0"],
  [{q:0,r:0},{q:1,r:1},"1,0"],
  [{q:0,r:0},{q:1,r:1},"0,1"]
 ] as const){
  assert.equal(hasLineOfSight(grid(),from,to),true);
  assert.equal(hasLineOfSight(grid([wall]),from,to),false,wall);
  assert.equal(hasLineOfSight(grid([wall]),to,from),false,wall+" reversed");
 }
});
test("endpoint walls are ignored, off-ray walls do not block, invalid endpoints fail",()=>{
 assert.equal(hasLineOfSight(grid(["0,0","1,0","3,3"]),{q:0,r:0},{q:1,r:0}),true);
 assert.equal(hasLineOfSight(grid(["0,0"]),{q:0,r:0},{q:0,r:0}),true);
 assert.throws(()=>hasLineOfSight(grid(),{q:-1,r:0},{q:1,r:0}),{code:"HEX_LOS_INVALID"});
 assert.throws(()=>hasLineOfSight(grid(),{q:0.5,r:0},{q:1,r:0}),{code:"HEX_LOS_INVALID"});
});
test("visibility is symmetric for every pair on a bounded board",()=>{
 const g=grid(["1,0","0,2","3,1"]);
 for(const a of g.tiles)for(const b of g.tiles)assert.equal(hasLineOfSight(g,a,b),hasLineOfSight(g,b,a));
});
test("a wall touched at a single hex vertex blocks in both directions",()=>{const g={width:5,height:2,tiles:Array.from({length:10},(_,i)=>({q:i%5,r:Math.floor(i/5),passable:!(i%5===3&&Math.floor(i/5)===0)}))};assert.equal(hasLineOfSight(g,{q:0,r:0},{q:4,r:1}),false);assert.equal(hasLineOfSight(g,{q:4,r:1},{q:0,r:0}),false);});
