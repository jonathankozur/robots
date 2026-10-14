import { compareIds, protocol, ProtocolError } from "@robots/system-api";
import type { SimulationEnvironment, StreamDeclaration, SystemDefinition } from "@robots/system-api";
import { snapshotData, snapshotPayload } from "@robots/values/json";
import { deriveStream, masterSeed, streamIdentifier } from "@robots/values/rng";
function environmentOperation<T>(operation: () => T): T {
  try { return operation(); }
  catch (error) {
    if (error instanceof ProtocolError && error.code === "ENVIRONMENT_INVALID") throw error;
    protocol("ENVIRONMENT_INVALID", error instanceof Error ? error.message : "Invalid simulation environment");
  }
}
function order(a: StreamDeclaration, b: StreamDeclaration): number { return compareIds(a.systemId, b.systemId) || compareIds(a.purpose, b.purpose); }
export function createSimulationEnvironment(seed: string, declarations: readonly StreamDeclaration[], systems: readonly SystemDefinition[]): SimulationEnvironment {
  return environmentOperation(() => {
    masterSeed(seed);
    const owners = new Map<string, string>();
    for (const system of systems) {
      streamIdentifier(system.id);
      if (owners.has(system.id) || (system.kind !== undefined && !["adapter", "system"].includes(system.kind))) protocol("ENVIRONMENT_INVALID", "Duplicate or invalid registered owner");
      owners.set(system.id, system.kind ?? "system");
    }
    const data = snapshotData(declarations, 1_048_576) as unknown as readonly StreamDeclaration[];
    if (!Array.isArray(data) || data.length > 256) protocol("ENVIRONMENT_INVALID", "Expected up to 256 stream declarations");
    const keys = new Set<string>(); const states = new Set<string>();
    const streams = [...data].map(declaration => {
      if (!declaration || typeof declaration !== "object" || Array.isArray(declaration)
        || Object.keys(declaration).sort().join(",") !== "purpose,systemId") protocol("ENVIRONMENT_INVALID", "Invalid stream declaration");
      const systemId = streamIdentifier(declaration.systemId), purpose = streamIdentifier(declaration.purpose);
      if (owners.get(systemId) !== "system") protocol("ENVIRONMENT_INVALID", "Stream owner must be a registered simulation system");
      const key = JSON.stringify([systemId, purpose]);
      if (keys.has(key)) protocol("ENVIRONMENT_INVALID", "Duplicate stream declaration");
      keys.add(key);
      const initial = deriveStream(seed, systemId, purpose);
      const stateKey = JSON.stringify(initial.words);
      if (states.has(stateKey)) protocol("ENVIRONMENT_INVALID", "Derived state collision between distinct streams");
      states.add(stateKey);
      return { systemId, purpose, initial };
    }).sort(order);
    return snapshotPayload({ version: 1, tickRate: 20, quantityScale: 1000, probabilityScale: 10000,
      numericProfile: "safe-integer-v1", damageRounding: "floor", durationRounding: "ceil",
      rngAlgorithm: "xoshiro128**-1.1", seedDerivation: "fnv1a64-splitmix64-v1", masterSeed: seed, streams }, 1_048_576) as unknown as SimulationEnvironment;
  });
}
export function validateEnvironment(environment: SimulationEnvironment, systems: readonly SystemDefinition[]): SimulationEnvironment {
  return environmentOperation(() => {
    const copied = snapshotPayload(environment, 1_048_576) as unknown as SimulationEnvironment;
    if (!Array.isArray(copied.streams)) protocol("ENVIRONMENT_INVALID", "Streams must be an array");
    const declarations = copied.streams.map(stream => {
      if (!stream || typeof stream !== "object" || Array.isArray(stream)) protocol("ENVIRONMENT_INVALID", "Invalid stream data");
      return { systemId: stream.systemId, purpose: stream.purpose };
    });
    const expected = createSimulationEnvironment(copied.masterSeed, declarations, systems);
    const canonical = snapshotPayload({ ...copied, streams: [...copied.streams].sort(order) }, 1_048_576);
    if (JSON.stringify(canonical) !== JSON.stringify(expected)) protocol("ENVIRONMENT_INVALID", "Environment profile or initial stream state does not match v1 derivation");
    return expected;
  });
}
