import { ProtocolError } from "@robots/runtime";
import type { Payload, Publisher, Contract, FieldRule } from "@robots/runtime";
import type { Recipe } from "@robots/application-host";
export const nav="app-navigation-fixture", combat="app-combat-fixture";
const text={type:"string",minLength:1,maxLength:128} as const;
const number={type:"number",integer:true,min:0} as const;
const navigationFields:Record<string,FieldRule>={terrainId:text,passable:{type:"boolean"},locomotionId:text,moveCooldownTicks:{...number,min:1},count:number};
const combatFields:Record<string,FieldRule>={chassisId:text,integrityUnits:{...number,min:1},weaponId:text,impactUnits:{...number,min:1},count:number};
export type Mode="normal"|"missing"|"reject"|"duplicate"|"conflict"|"crash"|"late-conflict";
export function fixtureRecipe(options:{mode?:Mode;disposed?:string[];failCleanup?:()=>boolean;duringCreate?:()=>void;badRoute?:boolean}={}):Recipe {
  const observed:Contract={type:"FixtureEquipmentObserved",version:1,kind:"event",producers:[{systemId:nav,phases:["input","movement"]},{systemId:combat,phases:["input","resolution"]}],fields:{ownerId:text,count:number,amount:number}};
  const operation:Contract={type:"OperateNavigation",version:1,kind:"command",responsibleSystemId:nav,producers:[{systemId:"app-bootstrap",phases:["input"]}],fields:{delta:number}};
  return {
    id:"application.fixture",revision:"application-fixture-v2-"+(options.mode??"normal"),contracts:[observed,operation],outputTypes:[{type:"FixtureEquipmentObserved",version:1}],
    prepare(content,selection){
      const d=content.definitions,robot=d.robots.find(r=>r.id===selection.robotId),terrain=d.terrains.find(t=>t.id===selection.terrainId);
      const chassis=d.chassis.find(c=>c.id===robot?.chassisId),equipped=robot?.equipment.map(e=>e.componentId)??[];
      const locomotion=d.locomotions.find(p=>equipped.includes(p.id)),weapon=d.weapons.find(p=>equipped.includes(p.id));
      if(!robot||!terrain||!chassis||!locomotion||!weapon)throw new Error("Choose an existing armed robot and terrain");
      const views:Record<string,Payload>={
        [nav]:{terrainId:terrain.id,passable:terrain.passable,locomotionId:locomotion.id,moveCooldownTicks:locomotion.moveCooldownTicks,count:0},
        [combat]:{chassisId:chassis.id,integrityUnits:chassis.integrityUnits,weaponId:weapon.id,impactUnits:weapon.impactUnits,count:0}
      };return views;
    },
    participants:[nav,combat].map((id,index)=>({
      id,initializationType:index===0?"FixtureInitializeNavigationCooldown":"FixtureInitializeCombat",phase:index===0?"movement":"resolution",fields:index===0?navigationFields:combatFields,
      create(identity,ownResource){
        options.duringCreate?.();
        ownResource(()=>{if(options.failCleanup?.())throw new Error("cleanup blocked");options.disposed?.push(id);});
        let publisher:Publisher,view:Payload|null=null,enabled=false,count=0;
        const emit=()=>{publisher.emit("FixtureEquipmentObserved",1,{ownerId:id,count,amount:view![id===nav?"moveCooldownTicks":"integrityUnits"]!});};
        return {
          connect(port){publisher=port;},
          initialize(message){
            if(view)throw new ProtocolError("APP_INIT_DUPLICATE","Owner initialized twice");
            view=message.payload.view as Payload;count=view.count as number;
            if(id===combat&&options.mode==="crash")throw new Error("fixture crash");
            if(id===combat&&options.mode==="missing")return;
            if(id===combat&&options.mode==="reject"){publisher.emit("ApplicationParticipantRejected",1,{...identity,participantId:id,reason:"FIXTURE_REJECTED"});return;}
            publisher.emit("ApplicationParticipantInitialized",1,{...identity,participantId:id});
            if(id===combat&&(options.mode==="duplicate"||options.mode==="conflict"))publisher.emit("ApplicationParticipantInitialized",1,{...identity,participantId:options.mode==="conflict"?nav:id});
          },
          activate(){enabled=true;emit();},
          subscriptions:id===nav&&!options.badRoute?[{type:"OperateNavigation",version:1,phase:"movement",handler(message){
            if(!enabled)throw new ProtocolError("APP_NOT_READY","Fixture is not ready");
            const next=count+(message.payload.delta as number);
            if(!Number.isSafeInteger(next))throw new ProtocolError("NUMERIC_OVERFLOW","Fixture counter overflow");
            count=next;
            if(options.mode==="late-conflict"){publisher.emit("ApplicationParticipantRejected",1,{...identity,participantId:id,reason:"LATE_REJECTION"});return;}
            emit();
          }}]:[]
        };
      }
    }))
  };
}
