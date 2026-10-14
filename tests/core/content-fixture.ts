import { Session, createSimulationEnvironment } from "../../src/core/index.ts";
import type { Contract, Payload, Message, SystemDefinition } from "../../src/core/index.ts";
import { protocol } from "../../src/core/messaging/contracts.ts";
import { snapshotPayload } from "../../src/core/messaging/immutable.ts";
import { validateContentBundle } from "../../src/content/index.ts";

export interface ContentFixtureOptions { readonly runtime?: string; readonly debug?: boolean; readonly robotId?: string; readonly terrainId?: string }
export interface ContentFixture { readonly session: Session; initialize(): void; snapshot(): { readonly navigation: Payload | null; readonly combat: Payload | null } }
const idField = { type: "string", minLength: 1, maxLength: 128 } as const;
const integerField = { type: "number", integer: true, min: 1 } as const;
const navigationType = "FixtureInitializeNavigationContent", combatType = "FixtureInitializeCombatContent";
const contracts: readonly Contract[] = [
  { type: navigationType, version: 2, kind: "command", responsibleSystemId: "content-navigation-fixture", producers: [{ systemId: "content-bootstrap", phases: ["input"] }],
    fields: { bundleId: idField, contentRevision: idField, terrainId: idField, passable: { type: "boolean" }, locomotionId: idField, moveCooldownTicks: integerField } },
  { type: combatType, version: 1, kind: "command", responsibleSystemId: "content-combat-fixture", producers: [{ systemId: "content-bootstrap", phases: ["input"] }],
    fields: { bundleId: idField, contentRevision: idField, chassisId: idField, integrityUnits: integerField, weaponId: idField, impactUnits: integerField } },
];
function owner(expected: Payload) {
  let view: Payload | null = null;
  return {
    receive(message: Message): void {
      if (view !== null) protocol("CONTENT_INIT_DUPLICATE", "Fixture content is fixed and initialized once per session");
      if (JSON.stringify(message.payload) !== JSON.stringify(expected)) protocol("CONTENT_INIT_MISMATCH", "Initialization must match this session's pinned content");
      view = message.payload;
    },
    snapshot: () => view,
  };
}
export function createContentFixture(input: unknown, options: ContentFixtureOptions = {}): ContentFixture {
  const result = validateContentBundle(input);
  if (!result.ok) throw new Error("CONTENT_INVALID: " + result.issues.map(i => i.code + " at " + i.path).join("; "));
  const content = result.content, definitions = content.definitions;
  const robot = definitions.robots.find(r => r.id === (options.robotId ?? "robot.scout"));
  const terrain = definitions.terrains.find(t => t.id === (options.terrainId ?? "terrain.floor"));
  const chassis = definitions.chassis.find(c => c.id === robot?.chassisId);
  const locomotionId = robot?.equipment.find(e => e.componentId.startsWith("locomotion."))?.componentId;
  const weaponId = robot?.equipment.find(e => e.componentId.startsWith("weapon."))?.componentId;
  const locomotion = definitions.locomotions.find(l => l.id === locomotionId);
  const weapon = definitions.weapons.find(w => w.id === weaponId);
  if (!robot || !terrain || !chassis || !locomotion || !weapon) throw new Error("CONTENT_FIXTURE_CONFIGURATION: choose an existing armed robot and terrain");
  const identity = { bundleId: content.bundleId, contentRevision: content.contentRevision };
  const navigationData = snapshotPayload({ ...identity, terrainId: terrain.id, passable: terrain.passable, locomotionId: locomotion.id, moveCooldownTicks: locomotion.moveCooldownTicks });
  const combatData = snapshotPayload({ ...identity, chassisId: chassis.id, integrityUnits: chassis.integrityUnits, weaponId: weapon.id, impactUnits: weapon.impactUnits });
  const navigation = owner(navigationData), combat = owner(combatData);
  const systems: readonly SystemDefinition[] = [{ id: "content-bootstrap", kind: "adapter" }, { id: "content-navigation-fixture" }, { id: "content-combat-fixture" }];
  const sessionId = "content-fixture";
  const session = new Session({ sessionId, revision: "content-fixture-v2", runtime: options.runtime ?? "content-fixture-test",
    debug: options.debug ?? false, environment: createSimulationEnvironment("0123456789abcdef", [], systems),
    initialState: { content: content as unknown as Payload }, contracts, systems });
  session.subscribe("content-navigation-fixture", navigationType, 2, "movement", navigation.receive);
  session.subscribe("content-combat-fixture", combatType, 1, "resolution", combat.receive);
  return Object.freeze({
    session,
    initialize(): void {
      session.stageExternalInput("content-bootstrap", { sessionId, type: navigationType, version: 2, payload: navigationData });
      session.stageExternalInput("content-bootstrap", { sessionId, type: combatType, version: 1, payload: combatData });
    },
    snapshot: () => Object.freeze({ navigation: navigation.snapshot(), combat: combat.snapshot() }),
  });
}
