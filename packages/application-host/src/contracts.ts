import type { Actor, ActorContext, Contract, FieldRule, MessageReference, Payload, Phase } from "@robots/system-api";
import type { Session } from "@robots/runtime";
import type { ContentBundle } from "@robots/protocol/content/v2";
export type ApplicationState = "idle" | "preparing" | "initializing" | "ready" | "closing" | "faulted";
export type {Actor} from "@robots/system-api";
export interface Participant {
  readonly id: string; readonly initializationType: string; readonly phase: Phase;
  readonly fields: Readonly<Record<string, FieldRule>>;
  create(identity: Payload, ownResource: (dispose: () => void) => void, context: ActorContext): Actor;
}
export interface Recipe {
  readonly id: string; readonly revision: string; readonly participants: readonly Participant[];
  readonly contracts: readonly Contract[]; readonly outputTypes: readonly MessageReference[];
  prepare(content: ContentBundle, selection: Payload): Readonly<Record<string, Payload>>;
}
export interface RestoredParts {
  readonly version: 1; readonly recipeId: string; readonly checkpointId: string; readonly revision: string;
  readonly parts: readonly { readonly ownerId: string; readonly version: 1; readonly revision: string; readonly data: Payload }[];
}
export interface Request {
  readonly requestId: string; readonly seed: string; readonly content: unknown; readonly selection: Payload;
  readonly initializationMaxTicks?: number; readonly debug?: boolean; readonly restore?: RestoredParts;
}
export type Result = { readonly ok: true; readonly contextId: string; readonly code?: never; readonly message?: never } | { readonly ok: false; readonly code: string; readonly message: string; readonly contextId?: never };

export interface ApplicationSnapshot {
  readonly state: ApplicationState; readonly contextId: string | null; readonly attemptId: number | null;
  readonly pendingParticipants: readonly string[]; readonly observations: Readonly<Record<string,Payload>>;
  readonly progress: ReturnType<Session["diagnostics"]> | null; readonly failure: Payload | null; readonly resourcesPending: number;
}
