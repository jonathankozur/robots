import test from "node:test";import assert from "node:assert/strict";
import {VisualMotion,hexPosition,CombatFeedback} from "@robots/presentation-three";
import type {CombatView} from "@robots/protocol/presentation/v2";
function frame(sequence:number,q:number,sourceMessageId:number):CombatView{return {contextId:"visual",sequence,world:{robots:[{robotId:"alpha",q,r:0,moveCooldownTicks:3}]},combatants:[{robotId:"alpha",integrityUnits:20000}],events:[{kind:"ATTACK",tick:sequence,sourceMessageId,robotId:"alpha",targetRobotId:"beta",weaponSlotId:"weapon-a"}]} as unknown as CombatView;}
test("cosmetic frame rate changes neither confirmed HP nor the final robot pose or attack count",()=>{
 const initial=frame(1,0,10),next=frame(2,1,20),original=JSON.stringify(next);
 function run(fps:number){const motion=new VisualMotion(),feedback=new CombatFeedback();motion.accept(initial,0,true);motion.pause(false,0);feedback.accept(initial);motion.accept(next,0);let count=feedback.accept(next).length;for(let i=1;i<=fps;i++){motion.poses(i*1000/fps);count+=feedback.accept(next).length;}return {pose:motion.poses(1000).get("alpha"),count};}
 assert.deepEqual(run(30),run(60));assert.equal(run(60).count,1);assert.equal(run(60).pose!.x,hexPosition(1,0).x);assert.equal(JSON.stringify(next),original);
});
test("a consumer skipping projections snaps to the full position without replaying stale attacks",()=>{const motion=new VisualMotion(),feedback=new CombatFeedback();motion.accept(frame(1,0,1),0,true);motion.pause(false,0);feedback.accept(frame(1,0,1));motion.accept(frame(5,3,5),50);assert.deepEqual(feedback.accept(frame(5,3,5)),[]);assert.equal(motion.poses(50).get("alpha")!.x,hexPosition(3,0).x);});
