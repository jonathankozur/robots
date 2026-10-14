import { snapshotData } from "@robots/values/json";
import { ProtocolError } from "@robots/system-api";
import { CONTENT_LIMITS } from "@robots/protocol/content/v2";
import type { ContentBundle, ContentResult } from "@robots/protocol/content/v2";
import { Diagnostics } from "./validation.ts";
import { validateSchema } from "./schema.ts";
import { validateReferences } from "./references.ts";
import { canonicalBundle } from "./canonical.ts";
export function validateContentBundle(value: unknown): ContentResult {
  const diagnostics = new Diagnostics();
  let copied: unknown;
  try { copied = snapshotData(value, CONTENT_LIMITS.maxBytes, CONTENT_LIMITS.maxDepth); }
  catch (error) {
    diagnostics.add(error instanceof ProtocolError && error.code === "PAYLOAD_CAPACITY" ? "CONTENT_CAPACITY" : "CONTENT_DATA", "$", "Content must be bounded plain JSON data");
    return diagnostics.rejection();
  }
  validateSchema(copied, diagnostics);
  if (diagnostics.failed) return diagnostics.rejection();
  validateReferences(copied as ContentBundle, diagnostics);
  if (diagnostics.failed) return diagnostics.rejection();
  return Object.freeze({ ok: true, content: canonicalBundle(copied as ContentBundle) });
}
function scanMembers(text: string, diagnostics: Diagnostics): void {
  // JSON.parse has already checked syntax. Quoted tokens are decoded as data,
  // so escaped spelling of a key cannot bypass duplicate detection.
  const tokens = text.match(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]:,]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? [];
  const stack: (Set<string> | null)[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (/^-?\d/.test(token) && (!/^-?(0|[1-9]\d*)$/.test(token) || !Number.isSafeInteger(Number(token)))) {
      diagnostics.add("CONTENT_NUMBER_LITERAL", "$", "Numbers must be literal safe integers without decimal or exponent notation"); return;
    }
    if (token === "{" || token === "[") {
      stack.push(token === "{" ? new Set<string>() : null);
      if (stack.length > CONTENT_LIMITS.maxDepth + 1) { diagnostics.add("CONTENT_DATA", "$", "Content exceeds its depth budget"); return; }
    } else if (token === "}" || token === "]") stack.pop();
    else if (token.startsWith('"') && tokens[i + 1] === ":" && stack.at(-1)) {
      const key: string = JSON.parse(token);
      const keys = stack.at(-1)!;
      if (keys.has(key)) { diagnostics.add("CONTENT_DUPLICATE_KEY", "$", "Repeated JSON member: " + key.slice(0, 128)); return; }
      keys.add(key);
    }
  }
}
export function parseContentJson(text: unknown): ContentResult {
  const diagnostics = new Diagnostics();
  if (typeof text !== "string") { diagnostics.add("CONTENT_JSON", "$", "Expected JSON text"); return diagnostics.rejection(); }
  if (text.length > CONTENT_LIMITS.maxBytes || new TextEncoder().encode(text).length > CONTENT_LIMITS.maxBytes) {
    diagnostics.add("CONTENT_CAPACITY", "$", "JSON text exceeds its UTF-8 byte budget"); return diagnostics.rejection();
  }
  let data: unknown;
  try { data = JSON.parse(text); }
  catch { diagnostics.add("CONTENT_JSON", "$", "Invalid JSON syntax"); return diagnostics.rejection(); }
  scanMembers(text, diagnostics);
  return diagnostics.failed ? diagnostics.rejection() : validateContentBundle(data);
}
