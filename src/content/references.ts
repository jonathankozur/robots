import { checkedAdd } from "../core/determinism/numeric.ts";
import { ProtocolError } from "../core/messaging/contracts.ts";
import type { ContentBundle, Definition, Component, Core, Slot, Resource, Chassis } from "./contracts.ts";
import type { Diagnostics } from "./validation.ts";

const requiredCategories = ["core", "locomotion", "ai", "sensor"] as const;
export function fitsSlot(slot: Slot, component: Component): boolean {
  return slot.category === component.id.split(".")[0] && slot.mountTypeId === component.mounting.mountTypeId && slot.sizeId === component.mounting.sizeId;
}
export function validateReferences(content: ContentBundle, diagnostics: Diagnostics): void {
  const index = new Map<string, Definition>();
  function unique(values: readonly string[], path: string, owner: string, code: string): void {
    const seen = new Set<string>();
    values.forEach((id, i) => { if (seen.has(id)) diagnostics.add(code, path + "[" + i + "]", "Repeated local identity: " + id, owner); seen.add(id); });
  }
  for (const [groupName, group] of Object.entries({ vocabularies: content.vocabularies, definitions: content.definitions })) {
    for (const [family, records] of Object.entries(group)) records.forEach((definition: Definition, i: number) => {
      const path = "$." + groupName + "." + family + "[" + i + "].id";
      if (index.has(definition.id)) diagnostics.add("CONTENT_DUPLICATE_ID", path, "Definition identity is repeated", definition.id);
      else index.set(definition.id, definition);
    });
  }
  content.vocabularies.resources.forEach((resource, i) => unique(resource.sockets, "$.vocabularies.resources[" + i + "].sockets", resource.id, "CONTENT_DUPLICATE_LOCAL_ID"));
  content.definitions.chassis.forEach((chassis, i) => unique(chassis.slots.map(s => s.id), "$.definitions.chassis[" + i + "].slots", chassis.id, "CONTENT_DUPLICATE_LOCAL_ID"));
  content.definitions.robots.forEach((robot, i) => unique(robot.equipment.map(e => e.slotId), "$.definitions.robots[" + i + "].equipment", robot.id, "CONTENT_DUPLICATE_SLOT"));
  // Ambiguous identities cannot be resolved by choosing a definition arbitrarily.
  if (diagnostics.failed) return;
  function reference(id: string, path: string, owner: string): Definition | undefined {
    const value = index.get(id);
    if (!value) diagnostics.add("CONTENT_REFERENCE", path, "Referenced definition does not exist: " + id, owner);
    return value;
  }
  function visual(definition: { readonly id: string; readonly visual?: { readonly resourceId: string } }, path: string): Resource | undefined {
    return definition.visual ? reference(definition.visual.resourceId, path + ".visual.resourceId", definition.id) as Resource | undefined : undefined;
  }
  function metadata(definition: { readonly id: string; readonly rarityId: string; readonly technologyId: string }, path: string): void {
    reference(definition.rarityId, path + ".rarityId", definition.id);
    reference(definition.technologyId, path + ".technologyId", definition.id);
  }
  for (const [family, parts] of Object.entries({ cores: content.definitions.cores, locomotions: content.definitions.locomotions, ais: content.definitions.ais, sensors: content.definitions.sensors, weapons: content.definitions.weapons })) {
    parts.forEach((part: Component, i: number) => {
      const path = "$.definitions." + family + "[" + i + "]";
      metadata(part, path); visual(part, path);
      reference(part.mounting.mountTypeId, path + ".mounting.mountTypeId", part.id);
      reference(part.mounting.sizeId, path + ".mounting.sizeId", part.id);
    });
  }
  content.definitions.chassis.forEach((chassis, i) => {
    const path = "$.definitions.chassis[" + i + "]";
    metadata(chassis, path); const resource = visual(chassis, path);
    const usedSockets = new Set<string>();
    chassis.slots.forEach((slot, j) => {
      const slotPath = path + ".slots[" + j + "]";
      reference(slot.mountTypeId, slotPath + ".mountTypeId", chassis.id); reference(slot.sizeId, slotPath + ".sizeId", chassis.id);
      if ((chassis.visual && !slot.socketId) || (slot.socketId && !chassis.visual) || (slot.socketId && resource && !resource.sockets.includes(slot.socketId))) {
        diagnostics.add("CONTENT_SOCKET_REFERENCE", slotPath + ".socketId", "Slot socket must be declared by the chassis visual resource", chassis.id);
      }
      if (slot.socketId) {
        if (usedSockets.has(slot.socketId)) diagnostics.add("CONTENT_DUPLICATE_SOCKET", slotPath + ".socketId", "Two slots cannot occupy the same socket", chassis.id);
        usedSockets.add(slot.socketId);
      }
    });
    for (const category of requiredCategories) if (!chassis.slots.some(slot => slot.category === category)) diagnostics.add("CONTENT_REQUIRED_COMPONENT", path + ".slots", "Chassis requires a slot for " + category, chassis.id);
  });
  content.definitions.robots.forEach((robot, i) => {
    const path = "$.definitions.robots[" + i + "]";
    const chassis = reference(robot.chassisId, path + ".chassisId", robot.id) as Chassis | undefined;
    const placed: Component[] = []; let total = 0, overflow = false;
    robot.equipment.forEach((equipment, j) => {
      const equipmentPath = path + ".equipment[" + j + "]";
      const part = reference(equipment.componentId, equipmentPath + ".componentId", robot.id) as Component | undefined;
      const slot = chassis?.slots.find(slot => slot.id === equipment.slotId);
      if (chassis && !slot) diagnostics.add("CONTENT_REFERENCE", equipmentPath + ".slotId", "Slot is not declared by the selected chassis", robot.id);
      if (!part || !slot) return;
      if (!fitsSlot(slot, part)) diagnostics.add("CONTENT_INCOMPATIBLE", equipmentPath, "Component category, mount type and size must match the slot", robot.id);
      placed.push(part);
      if (!overflow) {
        try { total = checkedAdd(total, part.energyCostUnits); }
        catch (error) {
          if (!(error instanceof ProtocolError) || error.code !== "NUMERIC_OVERFLOW") throw error;
          overflow = true; diagnostics.add("CONTENT_ENERGY_OVERFLOW", equipmentPath, "Equipment energy total exceeds safe integer range", robot.id);
        }
      }
    });
    if (!chassis) return;
    for (const category of requiredCategories) if (placed.filter(part => part.id.startsWith(category + ".")).length !== 1) diagnostics.add("CONTENT_REQUIRED_COMPONENT", path + ".equipment", "Prepared robot requires exactly one " + category, robot.id);
    const core = placed.find(part => part.id.startsWith("core.")) as Core | undefined;
    if (!overflow && core && total > core.energyCapacityUnits) diagnostics.add("CONTENT_ENERGY", path + ".equipment", "Equipment energy exceeds core capacity", robot.id);
  });
}
