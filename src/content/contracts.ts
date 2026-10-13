export const CONTENT_LIMITS = Object.freeze({ maxBytes: 1_048_576, maxDepth: 32, maxEntries: 256, maxSlots: 32, maxSockets: 64, maxIssues: 128 });
export const COMPONENT_CATEGORIES = Object.freeze(["core", "locomotion", "ai", "sensor", "weapon", "defense", "utility"] as const);
export type ComponentCategory = typeof COMPONENT_CATEGORIES[number];
export interface Definition { readonly schemaVersion: 1; readonly id: string; readonly name: string }
export interface Visual { readonly resourceId: string }
export interface Mounting { readonly mountTypeId: string; readonly sizeId: string }
export interface Slot extends Mounting { readonly id: string; readonly category: ComponentCategory; readonly socketId?: string }
export interface Resource extends Definition { readonly sockets: readonly string[] }
export interface Chassis extends Definition { readonly rarityId: string; readonly technologyId: string; readonly integrityUnits: number; readonly slots: readonly Slot[]; readonly visual?: Visual }
export interface Component extends Definition { readonly rarityId: string; readonly technologyId: string; readonly mounting: Mounting; readonly energyCostUnits: number; readonly visual?: Visual }
export interface Core extends Component { readonly energyCapacityUnits: number }
export interface Locomotion extends Component { readonly moveDurationTicks: number }
export interface Ai extends Component { readonly behaviorId: "fixture.observe-v1" | "fixture.pressure-v1" }
export interface Sensor extends Component { readonly rangeHexes: number }
export interface Weapon extends Component { readonly behaviorId: "fixture.direct-v1"; readonly impactUnits: number; readonly reloadTicks: number; readonly rangeHexes: number }
export interface Terrain extends Definition { readonly passable: boolean }
export interface Equipment { readonly slotId: string; readonly componentId: string }
export interface Robot extends Definition { readonly chassisId: string; readonly equipment: readonly Equipment[] }
export interface ContentBundle {
  readonly schemaVersion: 1; readonly bundleId: string; readonly contentRevision: string;
  readonly vocabularies: { readonly rarities: readonly Definition[]; readonly technologies: readonly Definition[]; readonly mountTypes: readonly Definition[]; readonly sizes: readonly Definition[]; readonly resources: readonly Resource[] };
  readonly definitions: { readonly chassis: readonly Chassis[]; readonly cores: readonly Core[]; readonly locomotions: readonly Locomotion[]; readonly ais: readonly Ai[]; readonly sensors: readonly Sensor[]; readonly weapons: readonly Weapon[]; readonly terrains: readonly Terrain[]; readonly robots: readonly Robot[] };
}
export interface ContentIssue { readonly code: string; readonly path: string; readonly message: string; readonly definitionId?: string }
export type ContentResult = { readonly ok: true; readonly content: ContentBundle } | { readonly ok: false; readonly issues: readonly ContentIssue[] };
