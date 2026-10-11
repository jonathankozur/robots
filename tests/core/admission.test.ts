import assert from "node:assert/strict";
import test from "node:test";
import { snapshotPayload } from "../../src/core/messaging/immutable.ts";
import { Session } from "../../src/core/scheduler/session.ts";
import { COMMAND, options } from "./fixtures.ts";
import type { Payload } from "../../src/core/messaging/contracts.ts";

test("admitted nested values are detached, deeply frozen and stable", () => {
  const original = { robot: { hp: 100 }, positions: [1, 2] };
  const message = snapshotPayload(original);
  original.robot.hp = 1;
  original.positions.push(3);
  assert.deepEqual(message, { robot: { hp: 100 }, positions: [1, 2] });
  assert.ok(Object.isFrozen(message));
  assert.throws(() => { (message.robot as unknown as { hp: number }).hp = 0; }, TypeError);
});
test("payload rejects capabilities, non-finite numbers, prototypes and cycles", () => {
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  for (const payload of [{ callback: () => {} }, { n: NaN }, { object: new Date() }, cycle]) {
    assert.throws(() => snapshotPayload(payload), { code: "PAYLOAD_INVALID" });
  }
});
test("payload rejects accessors without executing them", () => {
  let reads = 0;
  const payload = Object.defineProperty({}, "n", { enumerable: true, get() { reads++; return 1; } });
  assert.throws(() => snapshotPayload(payload), { code: "PAYLOAD_INVALID" });
  assert.equal(reads, 0);
});
test("payload byte budget includes UTF-8 and rejects excess", () => {
  assert.throws(() => snapshotPayload({ value: "ññ" }, 14), { code: "PAYLOAD_CAPACITY" });
  assert.deepEqual(snapshotPayload({ n: 1 }, 7), { n: 1 });
});
test("command configuration requires its one declared owner", () => {
  const session = new Session(options());
  assert.throws(() => session.start(), { code: "CONFIG_INVALID" });
});
test("duplicate receiver and invalid phases are configuration errors", () => {
  const session = new Session(options());
  session.subscribe("worker", COMMAND.type, 1, "action", () => {});
  assert.throws(() => session.subscribe("worker", COMMAND.type, 1, "action", () => {}), { code: "CONFIG_INVALID" });
  const invalid = new Session(options({ systems: [{ id: "producer" }, { id: "producer" }] }));
  assert.throws(() => invalid.start(), { code: "CONFIG_INVALID" });
});
test("valid catalogue permits unobserved events and fixes subscriptions at start", () => {
  const session = new Session(options());
  session.subscribe("worker", COMMAND.type, 1, "action", () => {});
  session.start();
  assert.throws(() => session.subscribe("observer-a", "PruebaEvento", 1, "resolution", () => {}), { code: "STATE_INVALID" });
});
test("configuration owns a snapshot of contracts, not a mutable caller reference", () => {
  const fields = { operationId: { type: "string" as const, minLength: 1 } };
  const session = new Session(options({ contracts: [{ ...COMMAND, fields }] }));
  fields.operationId.minLength = -1;
  session.subscribe("worker", COMMAND.type, 1, "action", () => {});
  session.start();
});
