export const PHASES = [
  "input", "perception", "decision", "movement", "action", "resolution", "publication",
] as const;
export type Phase = typeof PHASES[number];
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | Payload;
export interface Payload { readonly [key: string]: JsonValue }
export type FieldRule = (
  | { readonly type: "string"; readonly minLength?: number; readonly maxLength?: number }
  | { readonly type: "number"; readonly integer?: boolean; readonly min?: number; readonly max?: number }
  | { readonly type: "boolean" }
  | { readonly type: "object"; readonly fields: Readonly<Record<string, FieldRule>> }
  | { readonly type: "array"; readonly items: FieldRule; readonly maxLength: number }
) & { readonly optional?: boolean };
export interface Contract {
  readonly type: string;
  readonly version: number;
  readonly kind: "command" | "event";
  readonly producers: readonly { readonly systemId: string; readonly phases: readonly Phase[] }[];
  readonly fields: Readonly<Record<string, FieldRule>>;
  readonly responsibleSystemId?: string;
}
export interface Message {
  readonly messageId: number;
  readonly sessionId: string;
  readonly type: string;
  readonly contractVersion: number;
  readonly sourceSystemId: string;
  readonly emittedTick: number;
  readonly emittedPhase: Phase;
  readonly correlationId: number;
  readonly causationIds: readonly number[];
  readonly payload: Payload;
}
export interface PublishOptions { readonly causes?: readonly Message[] }
export interface ExternalInput {
  readonly sessionId: string;
  readonly type: string;
  readonly version: number;
  readonly payload: Payload;
}
export interface Publisher {
  send(type: string, version: number, payload: Payload, options?: PublishOptions): number;
  emit(type: string, version: number, payload: Payload, options?: PublishOptions): number;
}
export interface LoopContext { readonly tick: number; readonly phase: Phase }
export type Handler = (message: Message, context: LoopContext) => void;
export interface SystemDefinition {
  readonly id: string;
  readonly kind?: "system" | "adapter";
  readonly loopPhase?: Phase;
  readonly loop?: (context: LoopContext) => void;
}
export interface SessionOptions {
  readonly sessionId: string;
  readonly revision: string;
  readonly runtime: string;
  readonly initialState?: Payload;
  readonly contracts: readonly Contract[];
  readonly systems: readonly SystemDefinition[];
  readonly maxDeliveries?: number;
  readonly maxExternalInputs?: number;
  readonly maxPayloadBytes?: number;
  readonly traceCapacity?: number;
  readonly maxMessageId?: number;
  readonly maxTicks?: number;
  readonly debug?: boolean;
}
export class ProtocolError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
  }
}
export function protocol(code: string, message: string): never {
  throw new ProtocolError(code, message);
}
export function compareIds(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
export function contractKey(type: string, version: number): string {
  return JSON.stringify([type, version]);
}
