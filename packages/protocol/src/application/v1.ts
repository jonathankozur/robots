import type { FieldRule, MessageDefinition } from "@robots/system-api";
import { snapshotData } from "@robots/values/json";
const text = { type:"string",minLength:1,maxLength:128 } as const;
const num = { type:"number",integer:true,min:1,max:Number.MAX_SAFE_INTEGER } as const;
export const APPLICATION_IDENTITY_KEYS = Object.freeze(["contextId","attemptId","bundleId","contentRevision"] as const);
export const APPLICATION_IDENTITY_FIELDS = snapshotData({contextId:text,attemptId:num,bundleId:text,contentRevision:text}) as Readonly<Record<string,FieldRule>>;
const strings: FieldRule = { type:"array",items:text,maxLength:32 };
export const APPLICATION_MESSAGES = snapshotData([
 {type:"ApplicationParticipantInitialized",version:1,kind:"event",fields:{...APPLICATION_IDENTITY_FIELDS,participantId:text}},
 {type:"ApplicationParticipantRejected",version:1,kind:"event",fields:{...APPLICATION_IDENTITY_FIELDS,participantId:text,reason:text}},
 {type:"ApplicationContextReady",version:1,kind:"event",fields:{...APPLICATION_IDENTITY_FIELDS,participants:strings}},
 {type:"ApplicationInitializationRejected",version:1,kind:"event",fields:{...APPLICATION_IDENTITY_FIELDS,reason:text,pendingParticipants:strings}},
]) as unknown as readonly MessageDefinition[];
export function beginContextDefinition(viewFields: Readonly<Record<string,FieldRule>>): MessageDefinition {
 return {type:"BeginApplicationContext",version:1,kind:"command",fields:{...APPLICATION_IDENTITY_FIELDS,requiredParticipants:strings,initializationMaxTicks:{type:"number",integer:true,min:1,max:10000},views:{type:"object",fields:viewFields}}};
}
export function initializationDefinition(type:string, fields:Readonly<Record<string,FieldRule>>):MessageDefinition {
 return {type,version:1,kind:"command",fields:{...APPLICATION_IDENTITY_FIELDS,view:{type:"object",fields}}};
}
