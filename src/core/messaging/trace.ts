import { protocol } from "./contracts.ts";
import type { ExternalInput, Message, Payload, Phase } from "./contracts.ts";
import { snapshotData, snapshotPayload } from "./immutable.ts";

export type TraceEntry =
  | { readonly kind: "started" }
  | { readonly kind: "published"; readonly message: Message }
  | { readonly kind: "routed" | "discarded" | "consumption_started" | "consumption_finished";
      readonly messageId: number; readonly receiver: string; readonly tick: number; readonly phase: Phase }
  | { readonly kind: "external_admitted"; readonly source: string; readonly input: ExternalInput; readonly tick: number; readonly order: number }
  | { readonly kind: "external_rejected"; readonly source: string; readonly reason: string; readonly sessionId: string; readonly tick: number }
  | { readonly kind: "failed" | "rejected"; readonly code: string; readonly message: string; readonly tick: number;
      readonly phase: Phase | null; readonly systemId: string | null; readonly causeId: number | null }
  | { readonly kind: "loop_started" | "loop_finished"; readonly systemId: string; readonly tick: number; readonly phase: Phase }
  | { readonly kind: "tick_completed"; readonly tick: number }
  | { readonly kind: "phase_started" | "phase_finished"; readonly tick: number; readonly phase: Phase }
  | { readonly kind: "closed"; readonly reason: string; readonly discardedDeliveries: number;
      readonly discardedExternalInputs: number; readonly lastCompletedTick: number | null };
export interface TraceSnapshot {
  readonly manifest: Payload | null;
  readonly entries: readonly TraceEntry[];
  readonly complete: boolean;
  readonly droppedEntries: number;
}
export interface AdmittedInput {
  readonly source: string; readonly input: ExternalInput; readonly tick: number; readonly order: number;
}
export interface ReplayRecording {
  readonly formatVersion: 1;
  readonly manifest: Payload;
  readonly completedTicks: number;
  readonly inputs: readonly AdmittedInput[];
}
export type DebugRecord =
  | { readonly sequence: number; readonly kind: "manifest"; readonly manifest: Payload }
  | { readonly sequence: number; readonly kind: "trace"; readonly entry: TraceEntry };
export class TraceLog {
  #capacity: number;
  #manifest: Payload | null = null;
  #entries: TraceEntry[] = [];
  #dropped = 0;
  #debug: boolean;
  #journal: DebugRecord[] = [];
  #sequence = 0;
  constructor(capacity: number, debug = false) { this.#capacity = capacity; this.#debug = debug; }
  configure(manifest: Payload): void {
    this.#manifest = snapshotPayload(manifest, Number.MAX_SAFE_INTEGER, 256);
    if (this.#debug) this.#journal.push(Object.freeze({ sequence: ++this.#sequence, kind: "manifest", manifest: this.#manifest }));
  }
  append(entry: TraceEntry): void {
    const copied = this.#debug || this.#entries.length < this.#capacity
      ? snapshotData(entry, Number.MAX_SAFE_INTEGER) as unknown as TraceEntry : null;
    if (this.#debug) this.#journal.push(Object.freeze({ sequence: ++this.#sequence, kind: "trace", entry: copied! }));
    if (this.#entries.length >= this.#capacity) { this.#dropped++; return; }
    this.#entries.push(copied!);
  }
  drainDebug(): readonly DebugRecord[] {
    const batch = Object.freeze(this.#journal); this.#journal = []; return batch;
  }
  snapshot(): TraceSnapshot {
    return Object.freeze({
      manifest: this.#manifest, entries: Object.freeze([...this.#entries]), complete: this.#dropped === 0, droppedEntries: this.#dropped,
    });
  }
  replay(completedTicks: number): ReplayRecording {
    if (this.#dropped) protocol("TRACE_INCOMPLETE", "An incomplete trace cannot certify replay");
    if (!this.#manifest) protocol("REPLAY_INVALID", "Session has not started");
    return Object.freeze({
      formatVersion: 1, manifest: this.#manifest, completedTicks,
      inputs: Object.freeze(this.#entries.filter((entry): entry is Extract<TraceEntry, { kind: "external_admitted" }> => entry.kind === "external_admitted")
        .map(({ source, input, tick, order }) => Object.freeze({ source, input, tick, order }))),
    });
  }
}
