import { mkdir, writeFile, appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
export class LogStore {
  #folder: string;
  #logs = new Map<string, { path: string; last: number; lines: Map<number, string>; tail: Promise<void> }>();
  constructor(folder: string) { this.#folder = folder; }
  async create(): Promise<{ id: string; path: string }> {
    await mkdir(this.#folder, { recursive: true });
    const id = randomUUID(); const path = join(this.#folder, "session-" + id + ".jsonl");
    await writeFile(path, "", { flag: "wx", encoding: "utf8" });
    this.#logs.set(id, { path, last: 0, lines: new Map(), tail: Promise.resolve() }); return { id, path };
  }
  async append(id: string, records: unknown[]): Promise<void> {
    const log = this.#logs.get(id); if (!log) throw new Error("Unknown debug log");
    if (!Array.isArray(records) || records.length > 10000) throw new Error("Invalid log batch");
    const operation = log.tail.then(async () => {
      let expected = log.last + 1;
      const additions: { sequence: number; line: string }[] = [];
      let previous = 0;
      for (const item of records) {
        if (!item || typeof item !== "object") throw new Error("Invalid log record");
        const record = item as Record<string, unknown>;
        const sequence = record.sequence;
        if (!Number.isSafeInteger(sequence) || (sequence as number) <= previous) throw new Error("Invalid sequence order");
        if (record.kind !== "trace" && record.kind !== "manifest") throw new Error("Invalid record kind");
        if (typeof record[record.kind === "trace" ? "entry" : "manifest"] !== "object") throw new Error("Missing log content");
        const line = JSON.stringify(record); previous = sequence as number;
        if ((sequence as number) <= log.last) {
          if (log.lines.get(sequence as number) !== line) throw new Error("Conflicting sequence retry");
          continue;
        }
        if (sequence !== expected++) throw new Error("Debug sequence gap");
        additions.push({ sequence: sequence as number, line });
      }
      if (!additions.length) return;
      await appendFile(log.path, additions.map(item => item.line + "\n").join(""), "utf8");
      for (const item of additions) log.lines.set(item.sequence, item.line);
      log.last = additions.at(-1)!.sequence;
    });
    log.tail = operation.catch(() => {}); return operation;
  }
  async read(id: string): Promise<string> {
    const log = this.#logs.get(id); if (!log) throw new Error("Unknown debug log");
    await log.tail; return readFile(log.path, "utf8");
  }
}
export function logMiddleware(folder: string) {
  const store = new LogStore(folder);
  return (request: IncomingMessage, response: ServerResponse, next: () => void): void => {
    const path = (request.url ?? "").split("?")[0]!;
    if (!path.startsWith("/__debug-log")) { next(); return; }
    const send = (status: number, value: unknown): void => { response.statusCode = status; response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(value)); };
    if (request.headers.origin && request.headers.origin !== "http://" + request.headers.host) { send(403, { error: "Same-origin requests required" }); return; }
    void (async () => {
      if (path === "/__debug-log" && request.method === "POST") { send(200, await store.create()); return; }
      const match = /^\/__debug-log\/([a-f0-9-]{36})$/.exec(path);
      if (!match) { send(404, { error: "Unknown log route" }); return; }
      if (request.method === "GET") {
        const contents = await store.read(match[1]!); response.setHeader("Content-Type", "application/x-ndjson");
        response.setHeader("Content-Disposition", 'attachment; filename="debug-' + match[1] + '.jsonl"'); response.end(contents); return;
      }
      if (request.method !== "POST") { send(405, { error: "Method not allowed" }); return; }
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of request) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += bytes.length;
        if (size > 2_097_152) throw new Error("Log request exceeds 2 MiB"); chunks.push(bytes);
      }
      const records: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!Array.isArray(records)) throw new Error("Expected log record array");
      await store.append(match[1]!, records); send(200, { written: records.length });
    })().catch(error => send(400, { error: error instanceof Error ? error.message : String(error) }));
  };
}
