import type { Contract, FieldRule, Handler, Payload, Phase, Publisher, SystemDefinition, Session } from "../core/index.ts";
import type { ContentBundle } from "../content/index.ts";
export type ApplicationState = "idle" | "preparing" | "initializing" | "ready" | "closing" | "faulted";
export interface Actor {
  connect(publisher: Publisher): void;
  initialize: Handler; activate: Handler;
  readonly subscriptions?: readonly { type: string; phase: Phase; handler: Handler }[];
  readonly loopPhase?: Phase; readonly loop?: SystemDefinition["loop"];
}
export interface Participant {
  readonly id: string; readonly initializationType: string; readonly phase: Phase;
  readonly fields: Readonly<Record<string, FieldRule>>;
  create(identity: Payload, ownResource: (dispose: () => void) => void): Actor;
}
export interface Recipe {
  readonly id: string; readonly revision: string; readonly participants: readonly Participant[];
  readonly contracts: readonly Contract[]; readonly outputTypes: readonly string[];
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