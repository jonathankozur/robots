import type { Contract, SessionOptions } from "@robots/system-api";
export const COMMAND: Contract = {
  type: "PruebaComando", version: 1, kind: "command",
  producers: [{ systemId: "producer", phases: ["decision"] }],
  responsibleSystemId: "worker",
  fields: { operationId: { type: "string", minLength: 1, maxLength: 128 } },
};
export const EVENT: Contract = {
  type: "PruebaEvento", version: 1, kind: "event",
  producers: [{ systemId: "worker", phases: ["action"] }],
  fields: { operationId: { type: "string", minLength: 1, maxLength: 128 } },
};
export function options(overrides: Partial<SessionOptions> = {}): SessionOptions {
  return {
    sessionId: "fixture-session", revision: "fixtures-v1", runtime: "node-24.14.0",
    contracts: [COMMAND, EVENT],
    systems: [{ id: "producer" }, { id: "worker" }, { id: "observer-a" }, { id: "observer-b" }],
    maxDeliveries: 16, maxExternalInputs: 8, maxPayloadBytes: 1024, traceCapacity: 1000,
    ...overrides,
  };
}
