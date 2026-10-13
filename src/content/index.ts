export { CONTENT_LIMITS } from "./contracts.ts";
export type { ContentBundle, ContentResult, ContentIssue, Definition, Chassis, Core, Locomotion, Ai, Sensor, Weapon, Terrain, Robot, Resource, Slot, Component, Equipment } from "./contracts.ts";
export { validateContentBundle, parseContentJson } from "./catalog.ts";
export { fitsSlot } from "./references.ts";
