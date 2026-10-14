import assert from "node:assert/strict";
import test from "node:test";
import reference from "./migration-baseline-v1.json" with { type: "json" };
import { migrationCases, measureMigrationCase } from "./migration-baseline.ts";
for (const entry of migrationCases) test("migration preserves the pre-extraction trace, phases, causality and replay: " + entry.id, () => {
  const expected = (reference as Record<string, unknown>)[entry.id];
  assert.ok(expected, "Every case has a reference captured from main e05aac9");
  assert.deepEqual(measureMigrationCase(entry), expected);
});
