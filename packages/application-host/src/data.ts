import { ProtocolError } from "@robots/system-api";
import type { Payload, FieldRule } from "@robots/system-api";
export function fail(code: string, message: string): never { throw new ProtocolError(code, message); }
export function copy<T>(value: T, maxBytes=1_048_576, maxDepth=32): T {
  const active = new Set<object>();
  function visit(v: unknown, depth: number): unknown {
    if (depth > maxDepth) fail("INVALID_REQUEST", "Data depth exceeded");
    if (v === null || typeof v === "boolean" || typeof v === "string") return v;
    if (typeof v === "number" && Number.isSafeInteger(v)) return v === 0 ? 0 : v;
    if (typeof v !== "object" || v === null || active.has(v)) fail("INVALID_REQUEST", "Expected acyclic plain data");
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v);
    if (proto !== (array ? Array.prototype : Object.prototype) && !(proto === null && !array)) fail("INVALID_REQUEST", "Unexpected prototype");
    active.add(v);
    const descriptors = Object.getOwnPropertyDescriptors(v), keys = Reflect.ownKeys(v);
    if (keys.some(k => typeof k !== "string")) fail("INVALID_REQUEST", "Symbols are not data");
    let result: unknown;
    if (array) {
      const n = (v as unknown[]).length;
      if (keys.length !== n + 1) fail("INVALID_REQUEST", "Sparse or decorated array");
      const out: unknown[] = [];
      for(let i=0;i<n;i++) { const d=descriptors[String(i)]; if(!d || !d.enumerable || !("value" in d)) fail("INVALID_REQUEST","Array accessor"); out.push(visit(d.value,depth+1)); }
      result=Object.freeze(out);
    } else {
      const out: Record<string,unknown> = {};
      for(const key of (keys as string[]).sort()) { const d=descriptors[key]!; if(!d.enumerable || !("value" in d)) fail("INVALID_REQUEST","Hidden field or accessor");
        Object.defineProperty(out,key,{value:visit(d.value,depth+1),enumerable:true}); }
      result=Object.freeze(out);
    }
    active.delete(v); return result;
  }
  const result=visit(value,0);
  if(new TextEncoder().encode(JSON.stringify(result)).length>maxBytes) fail("INVALID_REQUEST","Data byte budget exceeded");
  return result as T;
}
export function shape(value: unknown, required: readonly string[], optional: readonly string[] = []): asserts value is Payload {
  if(value===null || typeof value!=="object" || Array.isArray(value)) fail("INVALID_REQUEST","Expected object");
  const keys=Object.keys(value);
  if(required.some(k=>!Object.hasOwn(value,k)) || keys.some(k=>!required.includes(k)&&!optional.includes(k))) fail("INVALID_REQUEST","Missing or unknown fields");
}
export function id(value: unknown, max=128): asserts value is string {
  if(typeof value!=="string" || value.length<1 || value.length>max) fail("INVALID_REQUEST","Invalid identifier");
}
export function validateFields(value: Payload, fields: Readonly<Record<string,FieldRule>>): void {
  shape(value,Object.keys(fields).filter(k=>!fields[k]!.optional),Object.keys(fields).filter(k=>fields[k]!.optional));
  for(const [key,rule] of Object.entries(fields)) {
    if(!Object.hasOwn(value,key)) continue;
    const v=value[key];
    if(rule.type==="object") { shape(v,[] as string[],Object.keys(rule.fields)); validateFields(v,rule.fields); }
    else if(rule.type==="array") {
      if(!Array.isArray(v)||v.length>rule.maxLength) fail("INVALID_REQUEST","Invalid array field");
      for(const item of v) validateFields({item},{item:rule.items});
    } else if(rule.type==="string") { if(typeof v!=="string" || v.length<(rule.minLength??0)||v.length>(rule.maxLength??Number.MAX_SAFE_INTEGER)) fail("INVALID_REQUEST","Invalid string field"); }
    else if(rule.type==="boolean") { if(typeof v!=="boolean") fail("INVALID_REQUEST","Invalid boolean field"); }
    else if(rule.type==="number") { if(typeof v!=="number" || !Number.isFinite(v) || (rule.integer&&!Number.isSafeInteger(v)) || v<(rule.min??-Infinity)||v>(rule.max??Infinity)) fail("INVALID_REQUEST","Invalid number field"); }
    else fail("INVALID_REQUEST","Invalid schema");
  }
}
