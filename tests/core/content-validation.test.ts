import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseContentJson, validateContentBundle, CONTENT_LIMITS } from "../../src/content/index.ts";
import type { ContentResult } from "../../src/content/index.ts";
const text = readFileSync(new URL("../../content/fixtures/basic-v2.json", import.meta.url), "utf8");
const fresh = () => JSON.parse(text);
function issues(result: ContentResult) { assert.equal(result.ok, false); if (result.ok) throw new Error("Expected rejection"); assert.equal("content" in result, false); return result.issues; }
function rejects(value: unknown, code: string, path?: string) {
  const found = issues(validateContentBundle(value));
  assert.ok(found.some(i => i.code === code && (path === undefined || i.path === path)), JSON.stringify(found));
}
test("validated JSON preserves the complete prototype definitions", () => {
  const result = parseContentJson(text); assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected valid content");
  assert.equal(result.content.definitions.robots.length, 2);
  assert.equal(result.content.definitions.weapons[0]!.impactUnits, 2500);
});
test("syntax, non-string text and repeated JSON object keys are rejected explicitly", () => {
  for (const source of ["{", 17, null]) assert.ok(issues(parseContentJson(source)).some(i => i.code === "CONTENT_JSON"));
  const repeated = text.replace('"schemaVersion": 2', '"schemaVersion": 2, "schemaVersion": 2');
  assert.ok(issues(parseContentJson(repeated)).some(i => i.code === "CONTENT_DUPLICATE_KEY"));
  assert.equal(parseContentJson(text.replace('"name": "Basic lab"', '"name": "String with \\"key\\": inside"')).ok, true);
});
test("byte, depth and collection limits reject before admitting content", () => {
  assert.ok(issues(parseContentJson(" ".repeat(CONTENT_LIMITS.maxBytes + 1))).some(i => i.code === "CONTENT_CAPACITY"));
  const deep: Record<string, unknown> = {}; let cursor = deep;
  for (let i = 0; i < 40; i++) { const next = {}; cursor.n = next; cursor = next; } rejects(deep, "CONTENT_DATA");
  const data = fresh(); data.definitions.weapons = Array.from({ length: 257 }, () => data.definitions.weapons[0]);
  rejects(data, "CONTENT_CAPACITY", "$.definitions.weapons");
});
test("unknown and missing fields have precise deterministic diagnostic paths", () => {
  const data = fresh(); data.definitions.weapons[0].formula = "eval()"; delete data.definitions.cores[0].energyCapacityUnits;
  const found = issues(validateContentBundle(data));
  assert.ok(found.some(i => i.code === "CONTENT_UNKNOWN_FIELD" && i.path === "$.definitions.weapons[0].formula" && i.definitionId === "weapon.pulse"));
  assert.ok(found.some(i => i.code === "CONTENT_REQUIRED_FIELD" && i.path === "$.definitions.cores[0].energyCapacityUnits"));
  assert.deepEqual(found.map(i => i.path), [...found.map(i => i.path)].sort());
});
test("unsupported bundle and family schemas are never defaulted", () => {
  const data = fresh(); data.schemaVersion = 3; data.definitions.weapons[0].schemaVersion = 3;
  rejects(data, "CONTENT_VERSION", "$.schemaVersion");
  rejects(data, "CONTENT_VERSION", "$.definitions.weapons[0].schemaVersion");
});
test("wrong structures and family-specific fields reject without reference processing", () => {
  for (const value of [null, [], 4, { schemaVersion: 1 }]) assert.ok(issues(validateContentBundle(value)).length);
  const data = fresh(); data.definitions.locomotions[0].reloadTicks = 4; data.definitions.robots[0].equipment = null;
  rejects(data, "CONTENT_UNKNOWN_FIELD"); rejects(data, "CONTENT_FIELD");
});
test("quantities, durations and hex distances use explicit safe integer bounds", () => {
  for (const invalid of [-1, 1.25, Number.MAX_SAFE_INTEGER + 1]) { const data = fresh(); data.definitions.weapons[0].impactUnits = invalid; rejects(data, "CONTENT_FIELD"); }
  const data = fresh(); data.definitions.weapons[0].reloadTicks = 0; rejects(data, "CONTENT_FIELD");
  data.definitions.sensors[0].rangeHexes = 1.5; rejects(data, "CONTENT_FIELD");
});
test("identifiers are stable lowercase prefixed values, never normalized from names", () => {
  for (const id of ["Pulse", "weapon.Pulse", " weapon.pulse", "core.pulse", "weapon." ]) { const data = fresh(); data.definitions.weapons[0].id = id; rejects(data, "CONTENT_FIELD"); }
  const data = fresh(); data.contentRevision = ""; rejects(data, "CONTENT_FIELD");
});
test("plain-data admission rejects hidden fields, getters, cycles and capabilities without invoking accessors", () => {
  let called = false; const getter = fresh(); Object.defineProperty(getter, "hidden", { enumerable: true, get() { called = true; return 1; } });
  rejects(getter, "CONTENT_DATA"); assert.equal(called, false);
  const cycle = fresh(); cycle.loop = cycle;
  for (const value of [cycle, { ...fresh(), callback() {} }, Object.assign(new Date(), fresh()), { ...fresh(), n: Infinity }]) rejects(value, "CONTENT_DATA");
});
test("diagnostics have an explicit bound and successful results never escape with partial data", () => {
  const data = fresh(); data.definitions.weapons = Array.from({ length: 160 }, (_, n) => ({ ...data.definitions.weapons[0], id: "weapon.x" + n, energyCostUnits: -1 }));
  const found = issues(validateContentBundle(data)); assert.ok(found.length <= CONTENT_LIMITS.maxIssues);
  assert.ok(found.some(i => i.code === "CONTENT_DIAGNOSTIC_LIMIT"));
});
test("visual and component nested fields are strict and executable behaviors are not data", () => {
  const data = fresh(); data.definitions.weapons[0].visual.extra = true; data.definitions.ais[0].behaviorId = "return attack()";
  rejects(data, "CONTENT_UNKNOWN_FIELD"); rejects(data, "CONTENT_FIELD");
});

test("CAT-002 accepts explicit cooldown v2 and rejects legacy, mixed versions and invalid cooldown", () => {
  const v2=fresh();
  function upgrade(value: any): void { if(value && typeof value==='object'){ if(Object.hasOwn(value,'schemaVersion'))value.schemaVersion=2; if(Object.hasOwn(value,'moveDurationTicks')){value.moveCooldownTicks=value.moveDurationTicks;delete value.moveDurationTicks;} for(const child of Object.values(value))upgrade(child); } }
  upgrade(v2); v2.contentRevision='lab-2';
  assert.equal(validateContentBundle(v2).ok,true);
  const legacy=structuredClone(v2);function downgrade(value:any):void{if(value&&typeof value==="object"){if(Object.hasOwn(value,"schemaVersion"))value.schemaVersion=1;if(Object.hasOwn(value,"moveCooldownTicks")){value.moveDurationTicks=value.moveCooldownTicks;delete value.moveCooldownTicks;}for(const child of Object.values(value))downgrade(child);}}downgrade(legacy);legacy.contentRevision="lab-1";assert.equal(validateContentBundle(legacy).ok,false);
  const mixed=structuredClone(v2);mixed.definitions.locomotions[0].schemaVersion=1;assert.equal(validateContentBundle(mixed).ok,false);
  for(const n of [0,-1,1.5]){const wrong=structuredClone(v2);wrong.definitions.locomotions[0].moveCooldownTicks=n;assert.equal(validateContentBundle(wrong).ok,false);}
  const oldField=structuredClone(v2);oldField.definitions.locomotions[0].moveDurationTicks=3;assert.equal(validateContentBundle(oldField).ok,false);
});