import assert from "node:assert/strict";
import test from "node:test";
import { Session } from "@robots/runtime";
import type { Contract } from "@robots/runtime";

const event: Contract = { type: "OptionalObservation", version: 1, kind: "event", producers: [], fields: { n: { type: "number", integer: true } } };
test("an installed consumer can wait for a known event with no producers", () => {
  let loops = 0, deliveries = 0;
  const s = new Session({ sessionId: "waiting", revision: "standalone-v1", runtime: "test", contracts: [event],
    systems: [{ id: "consumer", loopPhase: "action", loop() { loops++; } }] });
  s.subscribe("consumer", event.type, 1, "action", () => { deliveries++; });
  s.start();
  for (let i = 0; i < 4; i++) s.advanceTick();
  assert.equal(s.state, "active"); assert.equal(loops, 4); assert.equal(deliveries, 0);
  assert.equal(s.diagnostics().pendingDeliveries, 0);
});
test("an installed command owner can wait without a decision producer", () => {
  const command: Contract = { ...event, type: "OptionalRequest", kind: "command", responsibleSystemId: "owner" };
  const s = new Session({ sessionId: "owner-only", revision: "standalone-v1", runtime: "test", contracts: [command], systems: [{ id: "owner" }] });
  s.subscribe("owner", command.type, 1, "movement", () => { assert.fail("No authorized sender exists"); });
  s.start(); s.advanceTick(); assert.equal(s.state, "active");
});
test("empty producers never authorize an installed system to publish", () => {
  const s = new Session({ sessionId: "denied", revision: "standalone-v1", runtime: "test", contracts: [event],
    systems: [{ id: "intruder", loopPhase: "decision", loop() { port.emit(event.type, 1, { n: 1 }); } }] });
  const port = s.publisher("intruder");
  s.start(); assert.throws(() => s.advanceTick(), { code: "SOURCE_INVALID" });
  assert.equal(s.state, "failed");
});
test("no producers do not relax the unique command owner or registration checks", () => {
  for (const owner of [undefined, "missing"]) {
    const command: Contract = { ...event, kind: "command", ...(owner ? { responsibleSystemId: owner } : {}) };
    const s = new Session({ sessionId: "bad-owner", revision: "standalone-v1", runtime: "test", contracts: [command], systems: [{ id: "consumer" }] });
    s.subscribe("consumer", command.type, 1, "action", () => {});
    assert.throws(() => s.start(), { code: "CONFIG_INVALID" });
  }
  const s = new Session({ sessionId: "unknown-producer", revision: "standalone-v1", runtime: "test",
    contracts: [{ ...event, producers: [{ systemId: "missing", phases: ["input"] }] }], systems: [{ id: "consumer" }] });
  assert.throws(() => s.start(), { code: "CONFIG_INVALID" });
});
