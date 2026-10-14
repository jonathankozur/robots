import type { World, Result } from '../navigation/v1.ts';
import { WORLD_FIELDS, RESULT_FIELDS } from '../navigation/v1.ts';
import type { MessageDefinition } from '@robots/system-api';
import { freezeIntegerData } from '@robots/values/integers';
const frozen=<T>(value:T):T=>freezeIntegerData(value,'PRESENTATION_INVALID');
export interface VisualPart {
    readonly slotId: string;
    readonly socketId: string;
    readonly resourceId: string;
}
export interface Assembly {
    readonly robotId: string;
    readonly chassisResourceId: string;
    readonly parts: readonly VisualPart[];
}
export interface View {
    readonly contextId: string;
    readonly boardId: string;
    readonly sequence: number;
    readonly observedTick: number;
    readonly world: World;
    readonly assemblies: readonly Assembly[];
    readonly movements: readonly (Result & {
        readonly sourceMessageId: number;
    })[];
}
const text = { type: 'string', minLength: 1, maxLength: 128 } as const;
const integer = { type: 'number', integer: true, min: 0, max: Number.MAX_SAFE_INTEGER } as const;
const parts = { type: 'array', maxLength: 32, items: { type: 'object', fields: { slotId: text, socketId: text, resourceId: text } } } as const;
const assemblies = { type: 'array', maxLength: 16, items: { type: 'object', fields: { robotId: text, chassisResourceId: text, parts } } } as const;
export const INITIAL_FIELDS = frozen({ boardId: text, assemblies });
export const VIEW_FIELDS = frozen({ contextId: text, boardId: text, sequence: integer, observedTick: integer, world: { type: 'object', fields: WORLD_FIELDS }, assemblies, movements: { type: 'array', maxLength: 16, items: { type: 'object', fields: { ...RESULT_FIELDS, sourceMessageId: integer } } } } as const);

export const PRESENTATION_MESSAGES = frozen([{ type: 'PresentationViewPublished', version: 1, kind: 'event', fields: VIEW_FIELDS }] as const satisfies readonly MessageDefinition[]);
