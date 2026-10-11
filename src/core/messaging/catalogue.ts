import { PHASES, compareIds, contractKey, protocol } from "./contracts.ts";
import type { Contract, FieldRule, Handler, JsonValue, Phase, Payload, SystemDefinition } from "./contracts.ts";
import { snapshotData } from "./immutable.ts";

export interface Subscription {
  readonly systemId: string; readonly type: string; readonly version: number;
  readonly phase: Phase; readonly handler: Handler;
}
function valid(condition: unknown, message: string): asserts condition {
  if (!condition) protocol("CONFIG_INVALID", message);
}
export function positive(value: number, name: string): number {
  valid(Number.isSafeInteger(value) && value > 0, name + " must be a positive safe integer");
  return value;
}
function validateRule(rule: FieldRule): void {
  valid(rule && typeof rule === "object", "Invalid field rule");
  const allowed: readonly string[] | undefined = {
    string: ["minLength", "maxLength"], number: ["integer", "min", "max"], boolean: [],
    array: ["items", "maxLength"], object: ["fields"],
  }[rule.type];
  valid(Array.isArray(allowed) && Object.keys(rule).every(key => key === "type" || key === "optional" || allowed.includes(key)),
    "Undeclared field rule option");
  valid(rule.optional === undefined || typeof rule.optional === "boolean", "Invalid optional rule");
  const bound = (n: number | undefined) => n === undefined || Number.isSafeInteger(n) && n >= 0;
  switch (rule.type) {
    case "string":
      valid(bound(rule.minLength) && bound(rule.maxLength), "Invalid string bounds");
      valid(rule.minLength === undefined || rule.maxLength === undefined || rule.minLength <= rule.maxLength, "Reversed string bounds"); break;
    case "number":
      valid(rule.integer === undefined || typeof rule.integer === "boolean", "Invalid integer rule");
      valid((rule.min === undefined || Number.isFinite(rule.min)) && (rule.max === undefined || Number.isFinite(rule.max)), "Invalid number bounds");
      valid(rule.min === undefined || rule.max === undefined || rule.min <= rule.max, "Reversed number bounds"); break;
    case "boolean": break;
    case "array":
      valid(bound(rule.maxLength) && rule.maxLength !== undefined, "Array bound required");
      validateRule(rule.items); break;
    case "object": validateFields(rule.fields); break;
    default: protocol("CONFIG_INVALID", "Unknown field rule");
  }
}
function validateFields(fields: Readonly<Record<string, FieldRule>>): void {
  valid(fields && typeof fields === "object" && !Array.isArray(fields), "Invalid fields");
  for (const rule of Object.values(fields)) validateRule(rule);
}
export function validatePayload(payload: Payload, fields: Readonly<Record<string, FieldRule>>): void {
  function checkObject(value: Payload, rules: Readonly<Record<string, FieldRule>>): void {
    for (const key of Object.keys(value)) if (!Object.hasOwn(rules, key)) protocol("PAYLOAD_INVALID", "Undeclared field: " + key);
    for (const [key, rule] of Object.entries(rules)) {
      if (!Object.hasOwn(value, key)) { if (!rule.optional) protocol("PAYLOAD_INVALID", "Missing field: " + key); }
      else check(value[key]!, rule);
    }
  }
  function check(value: JsonValue, rule: FieldRule): void {
    let accepted = false;
    switch (rule.type) {
      case "string":
        accepted = typeof value === "string" && (rule.minLength === undefined || value.length >= rule.minLength)
          && (rule.maxLength === undefined || value.length <= rule.maxLength); break;
      case "number":
        accepted = typeof value === "number" && (!rule.integer || Number.isSafeInteger(value))
          && (rule.min === undefined || value >= rule.min) && (rule.max === undefined || value <= rule.max); break;
      case "boolean": accepted = typeof value === "boolean"; break;
      case "array":
        accepted = Array.isArray(value) && value.length <= rule.maxLength;
        if (accepted) for (const item of value as readonly JsonValue[]) check(item, rule.items); break;
      case "object":
        accepted = value !== null && typeof value === "object" && !Array.isArray(value);
        if (accepted) checkObject(value as Payload, rule.fields); break;
    }
    if (!accepted) protocol("PAYLOAD_INVALID", "Field violates its rule");
  }
  checkObject(payload, fields);
}
export class Catalogue {
  readonly contracts: readonly Contract[];
  readonly systems: readonly SystemDefinition[];
  #subscriptions: Subscription[] = [];
  #frozen = false;
  constructor(contracts: readonly Contract[], systems: readonly SystemDefinition[]) {
    this.contracts = snapshotData(contracts, 1_048_576, 128) as unknown as readonly Contract[];
    this.systems = Object.freeze(systems.map(system => Object.freeze({ ...system })));
  }
  contract(type: string, version: number): Contract {
    const contract = this.contracts.find(item => item.type === type && item.version === version);
    if (!contract) protocol("CONTRACT_INVALID", "Unknown contract or exact version");
    return contract;
  }
  system(id: string): SystemDefinition {
    const system = this.systems.find(item => item.id === id);
    if (!system) protocol("SOURCE_INVALID", "Unregistered system");
    return system;
  }
  subscribe(subscription: Subscription): () => boolean {
    if (this.#frozen) protocol("STATE_INVALID", "Subscriptions are fixed during an active session");
    valid(PHASES.includes(subscription.phase), "Unknown receiving phase");
    valid(typeof subscription.handler === "function", "Receiver handler required");
    this.system(subscription.systemId); this.contract(subscription.type, subscription.version);
    valid(!this.#subscriptions.some(item => item.systemId === subscription.systemId && item.type === subscription.type
      && item.version === subscription.version), "Duplicate receiver");
    this.#subscriptions.push(subscription);
    let removed = false;
    return () => {
      if (removed) return false;
      if (!this.#subscriptions.includes(subscription)) { removed = true; return false; }
      if (this.#frozen) protocol("STATE_INVALID", "Cannot remove an active subscription");
      this.#subscriptions = this.#subscriptions.filter(item => item !== subscription);
      removed = true;
      return true;
    };
  }
  routes(type: string, version: number): readonly Subscription[] {
    return this.#subscriptions.filter(item => item.type === type && item.version === version)
      .sort((a, b) => compareIds(a.systemId, b.systemId));
  }
  start(): void {
    const ids = new Set<string>();
    for (const system of this.systems) {
      valid(typeof system.id === "string" && system.id.length > 0 && !ids.has(system.id), "Invalid or duplicate system");
      ids.add(system.id);
      valid(system.kind === undefined || system.kind === "system" || system.kind === "adapter", "Unknown system kind");
      valid((system.loop === undefined) === (system.loopPhase === undefined), "Loop and phase must be declared together");
      valid(system.loopPhase === undefined || PHASES.includes(system.loopPhase), "Unknown loop phase");
      valid(system.loop === undefined || typeof system.loop === "function", "Invalid loop");
      valid(system.kind !== "adapter" || system.loop === undefined, "Adapters cannot run simulation loops");
    }
    const keys = new Set<string>();
    for (const contract of this.contracts) {
      valid(typeof contract.type === "string" && contract.type.length > 0, "Contract name required");
      positive(contract.version, "Contract version");
      const key = contractKey(contract.type, contract.version);
      valid(!keys.has(key), "Duplicate contract"); keys.add(key);
      valid(contract.kind === "command" || contract.kind === "event", "Unknown contract kind");
      validateFields(contract.fields);
      valid(Array.isArray(contract.producers) && contract.producers.length > 0, "Declared producers required");
      const producers = new Set<string>();
      for (const producer of contract.producers) {
        valid(ids.has(producer.systemId) && !producers.has(producer.systemId), "Invalid or duplicate producer");
        producers.add(producer.systemId);
        valid(Array.isArray(producer.phases) && producer.phases.length > 0 && new Set(producer.phases).size === producer.phases.length
          && producer.phases.every((phase: Phase) => PHASES.includes(phase)), "Invalid producer phases");
        if (this.system(producer.systemId).kind === "adapter") {
          valid(producer.phases.length === 1 && producer.phases[0] === "input", "External adapters emit only at input admission");
        }
      }
      const routes = this.routes(contract.type, contract.version);
      valid(routes.every(route => this.system(route.systemId).kind !== "adapter"), "Adapters cannot consume simulation messages");
      if (contract.kind === "command") {
        valid(routes.length === 1 && routes[0]!.systemId === contract.responsibleSystemId, "Command requires its single declared owner");
      } else valid(contract.responsibleSystemId === undefined, "Events have no command owner");
    }
    this.#frozen = true;
  }
  close(): void { this.#subscriptions = []; this.#frozen = false; }
  manifest(): JsonValue {
    return {
      contracts: [...this.contracts].sort((a, b) => compareIds(contractKey(a.type, a.version), contractKey(b.type, b.version))) as unknown as JsonValue,
      systems: this.systems.map(system => ({ id: system.id, kind: system.kind ?? "system", loopPhase: system.loopPhase ?? null })),
      routes: [...this.#subscriptions].sort((a, b) => compareIds(contractKey(a.type, a.version), contractKey(b.type, b.version))
        || compareIds(a.systemId, b.systemId)).map(({ systemId, type, version, phase }) => ({ systemId, type, version, phase })),
    };
  }
}
