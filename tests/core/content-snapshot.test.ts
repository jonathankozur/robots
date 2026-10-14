import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseContentJson, validateContentBundle } from "@robots/content";
import type { ContentBundle } from "@robots/content";
const text = readFileSync(new URL("../../content/fixtures/basic-v2.json", import.meta.url), "utf8");
const fresh = () => JSON.parse(text);
function content(data: unknown): ContentBundle { const result = validateContentBundle(data); assert.equal(result.ok, true); if (!result.ok) throw new Error(JSON.stringify(result)); return result.content; }
test("canonical snapshots ignore meaningless collection, slot, socket, equipment and object-key ordering", () => {
  const a = fresh(), b = fresh();
  for (const group of [b.vocabularies, b.definitions]) for (const entries of Object.values(group) as unknown[][]) entries.reverse();
  for (const chassis of b.definitions.chassis) chassis.slots.reverse();
  for (const resource of b.vocabularies.resources) resource.sockets.reverse();
  for (const robot of b.definitions.robots) robot.equipment.reverse();
  const reordered = { definitions: b.definitions, vocabularies: b.vocabularies, contentRevision: b.contentRevision, bundleId: b.bundleId, schemaVersion: b.schemaVersion };
  assert.equal(JSON.stringify(content(a)), JSON.stringify(content(reordered)));
});
test("every nested result is frozen and detached from both caller input and another package", () => {
  const source = fresh(); const first = content(source), second = content(source);
  function frozen(value: unknown): void {
    if (value !== null && typeof value === "object") { assert.ok(Object.isFrozen(value)); for (const child of Object.values(value)) frozen(child); }
  }
  frozen(first); source.definitions.weapons[0].impactUnits = 9999; source.definitions.chassis[0].slots.length = 0;
  assert.equal(first.definitions.weapons[0]!.impactUnits, 2500);
  assert.throws(() => { (first.definitions.weapons[0] as unknown as {impactUnits: number}).impactUnits = 1; }, TypeError);
  assert.throws(() => { (first.definitions.robots as unknown[]).pop(); }, TypeError);
  assert.notEqual(first, second); assert.notEqual(first.definitions, second.definitions); assert.deepEqual(first, second);
});
test("JSON numerical tokens cannot silently round fractional or exponent literals into admitted integers", () => {
  for (const token of ["1.00000000000000001", "9007199254740990.9", "1e2", "1.0", "9007199254740992"]) {
    const result = parseContentJson(text.replace('"integrityUnits": 100000', '"integrityUnits": ' + token));
    assert.equal(result.ok, false, token); assert.ok(!result.ok && result.issues.some(i => i.code === "CONTENT_NUMBER_LITERAL"));
  }
  const exact = parseContentJson(text.replace('"integrityUnits": 100000', '"integrityUnits": 9007199254740991'));
  assert.equal(exact.ok, true);
});
test("escaped repeated JSON member names and prototype pollution keys cannot bypass validation", () => {
  const escapedDuplicate = text.replace('"schemaVersion": 2', '"\\u0073chemaVersion": 1, "schemaVersion": 2');
  const duplicate = parseContentJson(escapedDuplicate); assert.ok(!duplicate.ok && duplicate.issues.some(i => i.code === "CONTENT_DUPLICATE_KEY"));
  const poisoned = parseContentJson(text.replace('"bundleId":', '"__proto__": {"polluted": true}, "bundleId":'));
  assert.ok(!poisoned.ok && poisoned.issues.some(i => i.code === "CONTENT_UNKNOWN_FIELD"));
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});
test("rejections and issues are immutable; direct-object byte overrun is visible", () => {
  const result = validateContentBundle({ ...fresh(), tooLarge: "á".repeat(600000) });
  assert.ok(!result.ok && result.issues.some(i => i.code === "CONTENT_CAPACITY"));
  assert.ok(Object.isFrozen(result));
  if (!result.ok) { assert.ok(Object.isFrozen(result.issues)); assert.ok(result.issues.every(Object.isFrozen)); }
});
