export { CONTENT_LIMITS } from "@robots/protocol/content/v2";
export type { ContentBundle, ContentResult, ContentIssue, Definition, Chassis, Core, Locomotion, Ai, Sensor, Weapon, Terrain, Robot, Resource, Slot, Component, Equipment } from "@robots/protocol/content/v2";
export { validateContentBundle, parseContentJson } from "./catalog.ts";
export { fitsSlot } from "./references.ts";
