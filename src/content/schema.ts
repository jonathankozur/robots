import { CONTENT_LIMITS, COMPONENT_CATEGORIES } from "./contracts.ts";
import type { Diagnostics } from "./validation.ts";
interface Rule {
  readonly type: "object" | "array" | "string" | "integer" | "boolean";
  readonly fields?: Readonly<Record<string, Rule>>;
  readonly item?: Rule; readonly max?: number; readonly min?: number;
  readonly values?: readonly unknown[]; readonly pattern?: RegExp; readonly optional?: boolean;
}
const object = (fields: Readonly<Record<string, Rule>>): Rule => ({ type: "object", fields });
const array = (item: Rule, max: number = CONTENT_LIMITS.maxEntries): Rule => ({ type: "array", item, max });
const string: Rule = { type: "string", min: 1, max: 128 };
const integer = (min = 0): Rule => ({ type: "integer", min, max: Number.MAX_SAFE_INTEGER });
const version: Rule = { type: "integer", values: [1] };
const id = (prefix: string): Rule => ({ ...string, pattern: new RegExp("^" + prefix + "\\.[a-z][a-z0-9._-]*$") });
const localId: Rule = { type: "string", min: 1, max: 64, pattern: /^[a-z][a-z0-9_-]*$/ };
const common = (prefix: string) => ({ schemaVersion: version, id: id(prefix), name: string });
const visual: Rule = { ...object({ resourceId: id("resource") }), optional: true };
const mounting = object({ mountTypeId: id("mount"), sizeId: id("size") });
const part = (prefix: string) => ({ ...common(prefix), rarityId: id("rarity"), technologyId: id("technology"), mounting, energyCostUnits: integer(), visual });
const slot = object({ id: localId, category: { type: "string", values: COMPONENT_CATEGORIES }, mountTypeId: id("mount"), sizeId: id("size"), socketId: { ...localId, optional: true } });
const fields: Rule = object({
  schemaVersion: version, bundleId: id("bundle"), contentRevision: { ...string, pattern: /^[a-z0-9][a-z0-9._-]*$/ },
  vocabularies: object({
    rarities: array(object(common("rarity"))), technologies: array(object(common("technology"))),
    mountTypes: array(object(common("mount"))), sizes: array(object(common("size"))),
    resources: array(object({ ...common("resource"), sockets: array(localId, CONTENT_LIMITS.maxSockets) })),
  }),
  definitions: object({
    chassis: array(object({ ...common("chassis"), rarityId: id("rarity"), technologyId: id("technology"), integrityUnits: integer(1), slots: array(slot, CONTENT_LIMITS.maxSlots), visual })),
    cores: array(object({ ...part("core"), energyCapacityUnits: integer(1) })),
    locomotions: array(object({ ...part("locomotion"), moveDurationTicks: integer(1) })),
    ais: array(object({ ...part("ai"), behaviorId: { type: "string", values: ["fixture.observe-v1", "fixture.pressure-v1"] } })),
    sensors: array(object({ ...part("sensor"), rangeHexes: integer() })),
    weapons: array(object({ ...part("weapon"), behaviorId: { type: "string", values: ["fixture.direct-v1"] }, impactUnits: integer(1), reloadTicks: integer(1), rangeHexes: integer() })),
    terrains: array(object({ ...common("terrain"), passable: { type: "boolean" } })),
    robots: array(object({ ...common("robot"), chassisId: id("chassis"), equipment: array(object({ slotId: localId, componentId: { ...string, pattern: /^(core|locomotion|ai|sensor|weapon)\.[a-z][a-z0-9._-]*$/ } }), CONTENT_LIMITS.maxSlots) })),
  }),
});
export function validateSchema(data: unknown, diagnostics: Diagnostics): void {
  function check(value: unknown, rule: Rule, path: string, owner?: string): void {
    if (rule.type === "object") {
      if (value === null || typeof value !== "object" || Array.isArray(value)) { diagnostics.add("CONTENT_FIELD", path, "Expected an object", owner); return; }
      const record = value as Readonly<Record<string, unknown>>;
      const currentOwner = typeof record.id === "string" ? record.id : owner;
      for (const key of Object.keys(record)) if (!Object.hasOwn(rule.fields!, key)) diagnostics.add("CONTENT_UNKNOWN_FIELD", path + "." + key, "Undeclared field", currentOwner);
      for (const [key, child] of Object.entries(rule.fields!)) {
        if (!Object.hasOwn(record, key)) { if (!child.optional) diagnostics.add("CONTENT_REQUIRED_FIELD", path + "." + key, "Required field is absent", currentOwner); }
        else check(record[key], child, path + "." + key, currentOwner);
      }
      return;
    }
    if (rule.type === "array") {
      if (!Array.isArray(value)) { diagnostics.add("CONTENT_FIELD", path, "Expected an array", owner); return; }
      if (value.length > rule.max!) { diagnostics.add("CONTENT_CAPACITY", path, "Collection exceeds its entry budget", owner); return; }
      value.forEach((item: unknown, index: number) => check(item, rule.item!, path + "[" + index + "]", owner)); return;
    }
    let valid = false;
    switch (rule.type) {
      case "integer": valid = typeof value === "number" && Number.isSafeInteger(value) && (rule.min === undefined || value >= rule.min) && (rule.max === undefined || value <= rule.max); break;
      case "string": valid = typeof value === "string" && (rule.min === undefined || value.length >= rule.min) && (rule.max === undefined || value.length <= rule.max) && (!rule.pattern || rule.pattern.test(value)); break;
      case "boolean": valid = typeof value === "boolean"; break;
    }
    if (valid && rule.values) valid = rule.values.includes(value);
    if (!valid) diagnostics.add(rule === version ? "CONTENT_VERSION" : "CONTENT_FIELD", path, rule === version ? "Unsupported schema version" : "Value violates its declared type or bounds", owner);
  }
  check(data, fields, "$");
}
