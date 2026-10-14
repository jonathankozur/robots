import { protocol } from "@robots/system-api";
import type { JsonValue, Payload } from "@robots/system-api";

export function snapshotData(value: unknown, maxBytes = 65_536, maxDepth = 256): JsonValue {
  const ancestors = new Set<object>();
  function copy(input: unknown, depth: number): JsonValue {
    if (depth > maxDepth) protocol("PAYLOAD_INVALID", "Data exceeds nesting limit");
    if (input === null || typeof input === "string" || typeof input === "boolean") return input;
    if (typeof input === "number" && Number.isFinite(input)) return Object.is(input, -0) ? 0 : input;
    if (typeof input !== "object" || input === null) protocol("PAYLOAD_INVALID", "Only finite JSON data is admitted");
    if (ancestors.has(input)) protocol("PAYLOAD_INVALID", "Cyclic data");
    const array = Array.isArray(input);
    const prototype = Object.getPrototypeOf(input);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
      protocol("PAYLOAD_INVALID", "Special object prototypes are not data");
    }
    // Admission does not invoke arbitrary getters.
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (Reflect.ownKeys(input).some(key => typeof key === "symbol")) protocol("PAYLOAD_INVALID", "Symbol keys");
    ancestors.add(input);
    let result: JsonValue;
    if (array) {
      const length = input.length;
      if (Object.keys(descriptors).length !== length + 1) protocol("PAYLOAD_INVALID", "Sparse or extended array");
      const items: JsonValue[] = [];
      for (let index = 0; index < length; index++) {
        const descriptor = descriptors[String(index)];
        if (!descriptor?.enumerable || !("value" in descriptor)) protocol("PAYLOAD_INVALID", "Array accessor or hole");
        items.push(copy(descriptor.value, depth + 1));
      }
      result = Object.freeze(items);
    } else {
      const object: Record<string, JsonValue> = {};
      for (const key of Object.keys(descriptors).sort()) {
        const descriptor = descriptors[key]!;
        if (!descriptor.enumerable || !("value" in descriptor)) protocol("PAYLOAD_INVALID", "Hidden property or accessor");
        Object.defineProperty(object, key, { value: copy(descriptor.value, depth + 1), enumerable: true });
      }
      result = Object.freeze(object);
    }
    ancestors.delete(input);
    return result;
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) protocol("CONFIG_INVALID", "Positive safe byte budget required");
  const result = copy(value, 0);
  if (new TextEncoder().encode(JSON.stringify(result)).length > maxBytes) protocol("PAYLOAD_CAPACITY", "Data byte budget exceeded");
  return result;
}
export function snapshotPayload(value: unknown, maxBytes = 65_536, maxDepth = 32): Payload {
  const data = snapshotData(value, maxBytes, maxDepth);
  if (data === null || typeof data !== "object" || Array.isArray(data)) protocol("PAYLOAD_INVALID", "Payload must be an object");
  return data as Payload;
}
