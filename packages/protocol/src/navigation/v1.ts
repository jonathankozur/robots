import {copyIntegerData} from "@robots/values/integers";
const copyData=<T>(value:T):T=>copyIntegerData(value,"NAV_DATA");
import type {FieldRule,MessageDefinition} from "@robots/system-api";
import type {Hex,Grid} from "@robots/values/hex-grid";
export interface Tile extends Hex{readonly terrainId:string;readonly passable:boolean}
export interface Robot extends Hex{readonly robotId:string;readonly definitionId:string;readonly moveCooldownTicks:number}
export interface Board extends Grid{readonly boardId:string;readonly tiles:readonly Tile[];readonly robots:readonly Robot[]}
export interface RobotState extends Robot{readonly robotRevision:number;readonly readyAtTick:number}
export interface World extends Omit<Board,"robots">{readonly robots:readonly RobotState[];readonly boardRevision:number;readonly effectiveTick:number}
export interface Step{readonly boardId:string;readonly robotId:string;readonly requestSequence:number;readonly from:Hex;readonly to:Hex;readonly expectedRobotRevision:number;readonly knownBoardRevision:number}
export interface Result{readonly boardId:string;readonly requestBoardId:string;readonly robotId:string;readonly requestSequence:number;readonly accepted:boolean;readonly reason:string;readonly duplicate:boolean;readonly resolvedTick:number;readonly boardRevision:number;readonly from:Hex;readonly to:Hex;readonly robotState?:{readonly position:Hex;readonly robotRevision:number;readonly readyAtTick:number}}
export const text=(max=64):FieldRule=>({type:"string",minLength:1,maxLength:max});
export const number=(min=0,max=Number.MAX_SAFE_INTEGER):FieldRule=>({type:"number",integer:true,min,max});
const object=(fields:Readonly<Record<string,FieldRule>>):FieldRule=>({type:"object",fields});
const array=(items:FieldRule,maxLength:number):FieldRule=>({type:"array",items,maxLength});
export const HEX_FIELDS=copyData({q:number(-Number.MAX_SAFE_INTEGER),r:number(-Number.MAX_SAFE_INTEGER)});
const robotFields={...HEX_FIELDS,robotId:text(),definitionId:text(128),moveCooldownTicks:number(1)};
export const BOARD_FIELDS=copyData({boardId:text(),width:number(1,12),height:number(1,12),tiles:array(object({...HEX_FIELDS,terrainId:text(128),passable:{type:"boolean"}}),144),robots:array(object(robotFields),16)});
export const WORLD_FIELDS=copyData({...BOARD_FIELDS,boardRevision:number(),effectiveTick:number(),robots:array(object({...robotFields,robotRevision:number(),readyAtTick:number()}),16)});
export const STEP_FIELDS=copyData({boardId:text(),robotId:text(),requestSequence:number(1),from:object(HEX_FIELDS),to:object(HEX_FIELDS),expectedRobotRevision:number(),knownBoardRevision:number()});
export const RESULT_FIELDS=copyData({boardId:text(),requestBoardId:text(),robotId:text(),requestSequence:number(1),accepted:{type:"boolean"} as const,reason:text(),duplicate:{type:"boolean"} as const,resolvedTick:number(),boardRevision:number(),from:object(HEX_FIELDS),to:object(HEX_FIELDS),robotState:{...object({position:object(HEX_FIELDS),robotRevision:number(),readyAtTick:number()}),optional:true}});

export type NavigationWorldReadyPayloadV1 = World;
export type NavigationStepResolvedPayloadV1 = Result;
export const NAVIGATION_MESSAGES = copyData([
 {type:"NavigationWorldReady",version:1,kind:"event",fields:WORLD_FIELDS},
 {type:"RequestNavigationStep",version:1,kind:"command",fields:STEP_FIELDS},
 {type:"NavigationStepResolved",version:1,kind:"event",fields:RESULT_FIELDS},
] as const satisfies readonly MessageDefinition[]);
