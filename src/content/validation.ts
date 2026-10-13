import type { ContentIssue, ContentResult } from "./contracts.ts";
import { CONTENT_LIMITS } from "./contracts.ts";
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
export class Diagnostics {
  #issues: ContentIssue[] = [];
  add(code: string, path: string, message: string, definitionId?: string): void {
    if (this.#issues.length >= CONTENT_LIMITS.maxIssues) return;
    if (this.#issues.length === CONTENT_LIMITS.maxIssues - 1) {
      this.#issues.push(Object.freeze({ code: "CONTENT_DIAGNOSTIC_LIMIT", path: "$", message: "Too many content errors; remaining diagnostics omitted" })); return;
    }
    this.#issues.push(Object.freeze({ code, path, message, ...(definitionId === undefined ? {} : { definitionId }) }));
  }
  get failed(): boolean { return this.#issues.length > 0; }
  rejection(): ContentResult {
    const issues = [...this.#issues].sort((a, b) => compare(a.path, b.path) || compare(a.code, b.code) || compare(a.definitionId ?? "", b.definitionId ?? "") || compare(a.message, b.message));
    return Object.freeze({ ok: false, issues: Object.freeze(issues) });
  }
}
