import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { validateContentBundle, fitsSlot } from "../../src/content/index.ts";
const fresh = () => JSON.parse(readFileSync(new URL("../../content/fixtures/basic-v2.json", import.meta.url), "utf8"));
function reject(data: unknown, code: string) {
  const result = validateContentBundle(data); assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected atomic rejection");
  assert.ok(result.issues.some(i => i.code === code), JSON.stringify(result));
}
test("duplicate identifiers reject every definition and vocabulary family atomically", () => {
  for (const group of ["definitions", "vocabularies"]) for (const key of Object.keys(fresh()[group])) {
    const data = fresh(); data[group][key].push(structuredClone(data[group][key][0])); reject(data, "CONTENT_DUPLICATE_ID");
  }
});
test("every reference is resolved, including unselected pieces and independent metadata dimensions", () => {
  const data = fresh(); data.definitions.weapons[0].rarityId = "rarity.missing"; data.definitions.weapons[0].technologyId = "technology.missing";
  data.definitions.locomotions[0].mounting.mountTypeId = "mount.missing"; data.definitions.chassis[0].slots[0].sizeId = "size.missing";
  reject(data, "CONTENT_REFERENCE");
  const result = validateContentBundle(data);
  assert.ok(!result.ok && result.issues.length >= 4);
  data.definitions.weapons[0].visual.resourceId = "weapon.pulse"; reject(data, "CONTENT_FIELD");
});
test("unknown chasses, components and slots in robot prototypes reject explicitly", () => {
  for (const target of ["chassis", "component", "slot"]) {
    const data = fresh();
    if (target === "chassis") data.definitions.robots[0].chassisId = "chassis.absent";
    if (target === "component") data.definitions.robots[0].equipment[0].componentId = "core.absent";
    if (target === "slot") data.definitions.robots[0].equipment[0].slotId = "absent";
    reject(data, "CONTENT_REFERENCE");
  }
});
test("compatibility uses category and exact mount type and size with no implicit smaller fit", () => {
  const data = fresh(), slot = data.definitions.chassis[0].slots.find((s: { id: string }) => s.id === "weapon-a");
  assert.equal(fitsSlot(slot, data.definitions.weapons[0]), true);
  assert.equal(fitsSlot(slot, data.definitions.cores[0]), false);
  for (const change of [{ category: "sensor" }, { mountTypeId: "mount.internal" }, { sizeId: "size.large" }]) {
    const variant = fresh(); Object.assign(variant.definitions.chassis[0].slots.find((s: { id: string }) => s.id === "weapon-a"), change);
    reject(variant, "CONTENT_INCOMPATIBLE");
  }
});
test("prepared robot prototypes require exactly one core, locomotion, AI and sensor, but no weapon", () => {
  for (const id of ["core", "drive", "ai", "sensor"]) {
    const data = fresh(); data.definitions.robots[0].equipment = data.definitions.robots[0].equipment.filter((e: {slotId: string}) => e.slotId !== id);
    reject(data, "CONTENT_REQUIRED_COMPONENT");
  }
  const data = fresh(); data.definitions.chassis[0].slots = data.definitions.chassis[0].slots.filter((s: {id: string}) => s.id !== "sensor");
  reject(data, "CONTENT_REQUIRED_COMPONENT");
  assert.equal(validateContentBundle(fresh()).ok, true);
});
test("slot assignments cannot duplicate; model definitions can repeat in different compatible slots", () => {
  const data = fresh(); data.definitions.robots[0].equipment.push({ slotId: "weapon-a", componentId: "weapon.pulse" }); reject(data, "CONTENT_DUPLICATE_SLOT");
  const valid = fresh(); valid.definitions.robots[0].equipment.push({ slotId: "weapon-b", componentId: "weapon.pulse" });
  assert.equal(validateContentBundle(valid).ok, true);
  const twoCores = fresh(); const slot = { ...twoCores.definitions.chassis[0].slots[0], id: "core-two", socketId: undefined };
  delete slot.socketId; delete twoCores.definitions.chassis[0].visual;
  for (const s of twoCores.definitions.chassis[0].slots) delete s.socketId;
  twoCores.definitions.chassis[0].slots.push(slot); twoCores.definitions.robots[0].equipment.push({ slotId: "core-two", componentId: "core.basic" });
  reject(twoCores, "CONTENT_REQUIRED_COMPONENT");
});
test("energy uses checked sums, includes the core's cost and accepts exact capacity", () => {
  const exact = fresh(); exact.definitions.cores[0].energyCapacityUnits = 60000;
  assert.equal(validateContentBundle(exact).ok, true);
  exact.definitions.cores[0].energyCostUnits = 1; reject(exact, "CONTENT_ENERGY");
  const overflow = fresh(); overflow.definitions.cores[0].energyCapacityUnits = Number.MAX_SAFE_INTEGER;
  overflow.definitions.weapons[0].energyCostUnits = Number.MAX_SAFE_INTEGER; reject(overflow, "CONTENT_ENERGY_OVERFLOW");
});
test("slots and resource sockets have unique local identity and valid mounting references", () => {
  const duplicated = fresh(); duplicated.definitions.chassis[0].slots.push(structuredClone(duplicated.definitions.chassis[0].slots[0])); reject(duplicated, "CONTENT_DUPLICATE_LOCAL_ID");
  const sockets = fresh(); sockets.vocabularies.resources[0].sockets.push("core"); reject(sockets, "CONTENT_DUPLICATE_LOCAL_ID");
  const absent = fresh(); absent.definitions.chassis[0].slots[0].socketId = "missing"; reject(absent, "CONTENT_SOCKET_REFERENCE");
  const reused = fresh(); reused.definitions.chassis[0].slots[1].socketId = "core"; reject(reused, "CONTENT_DUPLICATE_SOCKET");
  const noSocket = fresh(); delete noSocket.definitions.chassis[0].slots[0].socketId; reject(noSocket, "CONTENT_SOCKET_REFERENCE");
});
test("headless content is valid; declared visuals must resolve but do not claim real assets exist", () => {
  const data = fresh(); delete data.definitions.chassis[0].visual;
  for (const slot of data.definitions.chassis[0].slots) delete slot.socketId;
  delete data.definitions.weapons[0].visual; assert.equal(validateContentBundle(data).ok, true);
  const missing = fresh(); missing.definitions.weapons[0].visual.resourceId = "resource.absent"; reject(missing, "CONTENT_REFERENCE");
  const orphan = fresh(); delete orphan.definitions.chassis[0].visual; reject(orphan, "CONTENT_SOCKET_REFERENCE");
});
