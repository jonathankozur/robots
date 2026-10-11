import type { Session, DebugRecord } from "../../src/core/index.ts";
export class DebugFile {
  id = "";
  path = "";
  written = 0;
  error = "";
  #pending: DebugRecord[] = [];
  async flush(session: Session): Promise<void> {
    this.#pending.push(...session.drainDebugLog());
    try {
      if (!this.id) {
        const response = await fetch("/__debug-log", { method: "POST" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "No se pudo crear el log");
        this.id = result.id; this.path = result.path;
      }
      while (this.#pending.length) {
        let size = 0; let count = 0;
        for (const record of this.#pending.slice(0, 10000)) {
          const bytes = new TextEncoder().encode(JSON.stringify(record)).length + 1;
          if (bytes > 2_000_000) throw new Error("Un registro excede 2 MB; exporta la evidencia local.");
          if (size + bytes > 2_000_000) break;
          size += bytes; count++;
        }
        const response = await fetch("/__debug-log/" + this.id, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(this.#pending.slice(0, count)) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "No se pudo escribir el log");
        this.#pending.splice(0, count); this.written += count;
      }
      this.error = "";
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error); throw error;
    }
  }
  get pending(): number { return this.#pending.length; }
  pendingRecords(): readonly DebugRecord[] { return [...this.#pending]; }
}
