import { snapshotData } from "@robots/values/json";
import { CONTENT_LIMITS } from "@robots/protocol/content/v2";
import type { ContentBundle } from "@robots/protocol/content/v2";
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function byId<T extends { readonly id: string }>(items: readonly T[]): T[] { return [...items].sort((a, b) => compare(a.id, b.id)); }
export function canonicalBundle(content: ContentBundle): ContentBundle {
  const { vocabularies: v, definitions: d } = content;
  return snapshotData({ ...content,
    vocabularies: {
      rarities: byId(v.rarities), technologies: byId(v.technologies), mountTypes: byId(v.mountTypes), sizes: byId(v.sizes),
      resources: byId(v.resources).map(resource => ({ ...resource, sockets: [...resource.sockets].sort(compare) })),
    },
    definitions: {
      chassis: byId(d.chassis).map(chassis => ({ ...chassis, slots: byId(chassis.slots) })),
      cores: byId(d.cores), locomotions: byId(d.locomotions), ais: byId(d.ais), sensors: byId(d.sensors), weapons: byId(d.weapons), terrains: byId(d.terrains),
      robots: byId(d.robots).map(robot => ({ ...robot, equipment: [...robot.equipment].sort((a, b) => compare(a.slotId, b.slotId)) })),
    },
  }, CONTENT_LIMITS.maxBytes, CONTENT_LIMITS.maxDepth) as unknown as ContentBundle;
}
