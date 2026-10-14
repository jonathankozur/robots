import { Session, PHASES, ProtocolError } from "@robots/runtime";
import type { Contract, JsonValue, Payload, Phase, Publisher, Message, SessionOptions } from "@robots/runtime";

export type Fault = "throw" | "async" | "reenter" | "restart" | "close" | "unsubscribe" | "export" | "impersonate"
  | "mutate" | "fabricatedCause" | "duplicateCause" | "foreignCause" | "mixedRoots"
  | "cycle" | "accessor" | "undefined" | "function" | "sparse" | "prototype" | "symbol" | "hidden" | "nonFinite" | "depth";
export interface Action {
  op: "send" | "emit" | "remember" | "set" | "increment" | "clear" | "fault";
  type?: string; version?: number; payload?: Record<string, JsonValue>; key?: string; value?: JsonValue;
  causes?: "remembered"; fault?: Fault;
}
export interface Rule {
  systemId: string;
  trigger: { kind: "receive"; type: string; version: number } | { kind: "loop"; phase: Phase };
  condition?: { key: string; test: "exists" | "equals" | "lt"; value?: JsonValue };
  actions: Action[];
}
export interface Scenario {
  name: string; sessionId: string; revision: string; runtime: string; initialState: Payload;
  limits: { maxDeliveries: number; maxExternalInputs: number; maxPayloadBytes: number; traceCapacity: number; maxMessageId: number; maxTicks: number };
  systems: { id: string; kind: "system" | "adapter"; loopPhase?: Phase; state: Record<string, JsonValue> }[];
  contracts: Contract[];
  subscriptions: { systemId: string; type: string; version: number; phase: Phase }[];
  rules: Rule[];
  inputs: { tick: number; source: string; type: string; version: number; payload: Record<string, JsonValue> }[];
}
export interface Lab {
  session: Session; states: Map<string, Record<string, JsonValue>>; scenario: Scenario;
  stageScheduled(): void;
}
export interface Preset { id: string; name: string; description: string; scenario: Scenario; expectedCode?: string; ticks?: number }
const base: Scenario = {
  name: "Cadena causal con dos destinos", sessionId: "lab-session", revision: "lab-fixtures-v2", runtime: "robots-lab-v2",
  initialState: {}, limits: { maxDeliveries: 128, maxExternalInputs: 32, maxPayloadBytes: 4096, traceCapacity: 20000, maxMessageId: 100000, maxTicks: 1000 },
  systems: [ { id: "adapter", kind: "adapter", state: {} }, { id: "planner", kind: "system", loopPhase: "decision", state: {} },
    { id: "processor", kind: "system", loopPhase: "action", state: { received: 0 } },
    { id: "observer-a", kind: "system", state: {} }, { id: "observer-b", kind: "system", state: {} } ],
  contracts: [
    { type: "Input", version: 1, kind: "event", producers: [{ systemId: "adapter", phases: ["input"] }], fields: { operationId: { type: "string", minLength: 1, maxLength: 64 } } },
    { type: "Request", version: 1, kind: "command", responsibleSystemId: "processor", producers: [{ systemId: "planner", phases: ["decision"] }], fields: { operationId: { type: "string", minLength: 1, maxLength: 64 } } },
    { type: "Result", version: 1, kind: "event", producers: [{ systemId: "processor", phases: ["action"] }], fields: { operationId: { type: "string", minLength: 1, maxLength: 64 } } },
  ],
  subscriptions: [ { systemId: "planner", type: "Input", version: 1, phase: "input" }, { systemId: "processor", type: "Request", version: 1, phase: "action" },
    { systemId: "observer-a", type: "Result", version: 1, phase: "resolution" }, { systemId: "observer-b", type: "Result", version: 1, phase: "perception" } ],
  rules: [
    { systemId: "planner", trigger: { kind: "receive", type: "Input", version: 1 }, actions: [{ op: "remember", key: "pending" }] },
    { systemId: "planner", trigger: { kind: "loop", phase: "decision" }, condition: { key: "pending", test: "exists" }, actions: [
      { op: "send", type: "Request", version: 1, payload: { operationId: "$state.pending.operationId" }, causes: "remembered" }, { op: "clear", key: "pending" } ] },
    { systemId: "processor", trigger: { kind: "receive", type: "Request", version: 1 }, actions: [
      { op: "increment", key: "received" }, { op: "emit", type: "Result", version: 1, payload: { operationId: "$input.payload.operationId" } } ] },
    { systemId: "observer-a", trigger: { kind: "receive", type: "Result", version: 1 }, actions: [{ op: "remember", key: "last" }] },
    { systemId: "observer-b", trigger: { kind: "receive", type: "Result", version: 1 }, actions: [{ op: "remember", key: "last" }] },
  ], inputs: [{ tick: 0, source: "adapter", type: "Input", version: 1, payload: { operationId: "op-001" } }],
};
export const presets: Preset[] = [{ id: "chain", name: base.name, description: "Input → comando → evento. Resolución en tick 0, percepción en tick 1.", scenario: base }];
const faultNames: Fault[] = ["throw", "async", "reenter", "restart", "close", "unsubscribe", "export", "impersonate", "mutate",
  "fabricatedCause", "duplicateCause", "foreignCause", "mixedRoots", "cycle", "accessor", "undefined", "function", "sparse", "prototype", "symbol", "hidden", "nonFinite", "depth"];
function requireValue(condition: unknown, message: string): asserts condition { if (!condition) throw new ProtocolError("CONFIG_INVALID", message); }
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
export function validateScenario(value: unknown): asserts value is Scenario {
  requireValue(object(value), "Scenario must be an object");
  for (const key of ["name", "sessionId", "revision", "runtime"]) requireValue(typeof value[key] === "string" && value[key], "Missing " + key);
  requireValue(object(value.initialState) && object(value.limits), "Initial state and limits must be objects");
  for (const key of ["systems", "contracts", "subscriptions", "rules", "inputs"]) requireValue(Array.isArray(value[key]), "Expected array: " + key);
  const scenario = value as unknown as Scenario;
  for (const system of scenario.systems) {
    requireValue(object(system) && typeof system.id === "string" && system.id && object(system.state), "Invalid system/state");
    requireValue(["system", "adapter"].includes(system.kind), "Invalid system kind");
    requireValue(system.loopPhase === undefined || PHASES.includes(system.loopPhase), "Invalid loop phase");
  }
  for (const rule of scenario.rules) {
    requireValue(object(rule) && scenario.systems.some(system => system.id === rule.systemId && system.kind === "system"), "Unknown rule system");
    requireValue(object(rule.trigger) && Array.isArray(rule.actions), "Invalid rule trigger/actions");
    if (rule.trigger.kind === "loop") requireValue(scenario.systems.some(system => system.id === rule.systemId && system.loopPhase === (rule.trigger as { phase: Phase }).phase), "Rule loop phase does not match system");
    else requireValue(rule.trigger.kind === "receive" && typeof rule.trigger.type === "string" && Number.isSafeInteger(rule.trigger.version), "Invalid receive trigger");
    if (rule.condition) requireValue(typeof rule.condition.key === "string" && ["exists", "equals", "lt"].includes(rule.condition.test), "Invalid condition");
    for (const action of rule.actions) {
      requireValue(object(action) && ["send", "emit", "remember", "set", "increment", "clear", "fault"].includes(action.op), "Unknown action");
      if (action.op === "send" || action.op === "emit") requireValue(typeof action.type === "string" && Number.isSafeInteger(action.version) && object(action.payload), "Invalid publication action");
      if (["remember", "set", "increment", "clear"].includes(action.op)) requireValue(typeof action.key === "string" && action.key && !["__proto__", "constructor", "prototype"].includes(action.key), "Invalid state action key");
      if (action.op === "fault") requireValue(faultNames.includes(action.fault!), "Unknown fault fixture");
      requireValue(action.causes === undefined || action.causes === "remembered", "Unknown causes mode");
    }
  }
  for (const input of scenario.inputs) requireValue(object(input) && Number.isSafeInteger(input.tick) && input.tick >= 0 && typeof input.source === "string" && typeof input.type === "string" && Number.isSafeInteger(input.version) && object(input.payload), "Invalid scheduled input");
}
function template(value: JsonValue, input: Message | undefined, state: Record<string, JsonValue>, tick: number, phase: Phase): JsonValue {
  if (typeof value === "string" && value.startsWith("$")) {
    const parts = value.slice(1).split(".");
    let result: unknown = { input, state, tick, phase };
    for (const key of parts) {
      requireValue(object(result) && Object.hasOwn(result, key), "Template path not found: " + value);
      result = result[key];
    }
    return structuredClone(result) as JsonValue;
  }
  if (Array.isArray(value)) return value.map(item => template(item, input, state, tick, phase));
  if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, template(item as JsonValue, input, state, tick, phase)]));
  return value;
}
export function createLab(source: Scenario, debug = false): Lab {
  validateScenario(source);
  const scenario = structuredClone(source);
  const states = new Map(scenario.systems.map(system => [system.id, structuredClone(system.state)]));
  const remembered = new Map<string, Message>();
  const ports = new Map<string, Publisher>();
  let session: Session;
  function fault(name: Fault, port: Publisher, message: Message | undefined): unknown {
    if (name === "throw") throw new Error("Excepción ficticia del escenario");
    if (name === "async") return Promise.resolve();
    if (name === "reenter") return session.step();
    if (name === "restart") return session.start();
    if (name === "close") return session.close();
    if (name === "export") return session.exportReplay();
    if (name === "unsubscribe") return session.subscribe("processor", "Request", 1, "action", () => {});
    if (name === "impersonate") return session.publisher("planner").send("Request", 1, { operationId: "spoof" });
    if (name === "mutate") { (message!.payload as Record<string, JsonValue>).operationId = "mutated"; return; }
    const value: Record<string, unknown> = { operationId: "fault" };
    if (name === "duplicateCause") return port.emit("Result", 1, value as Payload, { causes: [message!, message!] });
    if (name === "fabricatedCause") return port.emit("Result", 1, value as Payload, { causes: [{ ...message! }] });
    if (name === "foreignCause") {
      let foreignMessage: Message | undefined;
      const foreign = new Session({ sessionId: "foreign", revision: "fixture", runtime: "fixture", contracts: [scenario.contracts.find(contract => contract.type === "Result")!],
        systems: [{ id: "processor", loopPhase: "action", loop: () => { foreign.publisher("processor").emit("Result", 1, { operationId: "foreign" }); } }] });
      foreign.start(); foreign.advanceTick();
      for (const entry of foreign.trace().entries) if (entry.kind === "published") foreignMessage = entry.message;
      return port.emit("Result", 1, value as Payload, { causes: [foreignMessage!] });
    }
    if (name === "mixedRoots") {
      port.emit("Result", 1, value as Payload, { causes: [] }); port.emit("Result", 1, value as Payload, { causes: [] });
      const messages = session.trace().entries.filter(entry => entry.kind === "published").map(entry => entry.message);
      return port.emit("Result", 1, value as Payload, { causes: messages.slice(-2) });
    }
    if (name === "cycle") value.self = value;
    if (name === "accessor") Object.defineProperty(value, "getter", { enumerable: true, get: () => { throw new Error("Getter must not execute"); } });
    if (name === "undefined") value.extra = undefined;
    if (name === "function") value.extra = () => {};
    if (name === "sparse") value.extra = new Array(2);
    if (name === "prototype") Object.setPrototypeOf(value, { hidden: true });
    if (name === "symbol") Object.defineProperty(value, Symbol("hidden"), { value: true });
    if (name === "hidden") Object.defineProperty(value, "extra", { value: true, enumerable: false });
    if (name === "nonFinite") value.extra = Infinity;
    if (name === "depth") { let nested = value; for (let i = 0; i < 34; i++) { const next = {}; nested.extra = next; nested = next; } }
    return port.emit("Result", 1, value as Payload);
  }
  function run(systemId: string, kind: "receive" | "loop", tick: number, phase: Phase, message?: Message): unknown {
    const state = states.get(systemId)!; const port = ports.get(systemId)!;
    for (const rule of scenario.rules) {
      if (rule.systemId !== systemId || rule.trigger.kind !== kind) continue;
      if (rule.trigger.kind === "receive" && (rule.trigger.type !== message?.type || rule.trigger.version !== message?.contractVersion)) continue;
      if (rule.trigger.kind === "loop" && rule.trigger.phase !== phase) continue;
      if (rule.condition) {
        const actual = state[rule.condition.key]; const { test, value } = rule.condition;
        if (test === "exists" ? actual === undefined : test === "equals" ? JSON.stringify(actual) !== JSON.stringify(value) : typeof actual !== "number" || typeof value !== "number" || actual >= value) continue;
      }
      for (const action of rule.actions) {
        if (action.op === "remember") { requireValue(message, "Remember requires a received message"); state[action.key!] = structuredClone(message.payload); remembered.set(systemId, message); }
        else if (action.op === "set") state[action.key!] = template(action.value ?? null, message, state, tick, phase);
        else if (action.op === "increment") { const number = state[action.key!] ?? 0; requireValue(typeof number === "number", "Increment requires numeric state"); state[action.key!] = number + 1; }
        else if (action.op === "clear") delete state[action.key!];
        else if (action.op === "fault") return fault(action.fault!, port, message);
        else {
          const payload = template(action.payload!, message, state, tick, phase) as Payload;
          const causes = action.causes === "remembered" ? { causes: [remembered.get(systemId)!] } : undefined;
          port[action.op](action.type!, action.version!, payload, causes);
        }
      }
    }
  }
  const options: SessionOptions = { sessionId: scenario.sessionId, revision: scenario.revision, runtime: scenario.runtime,
    initialState: { ...scenario.initialState, fixtureStates: Object.fromEntries(states), rules: scenario.rules as unknown as JsonValue },
    contracts: scenario.contracts, ...scenario.limits, debug,
    systems: scenario.systems.map(system => ({ id: system.id, kind: system.kind,
      ...(system.loopPhase ? { loopPhase: system.loopPhase, loop: (context: { tick: number; phase: Phase }) => run(system.id, "loop", context.tick, context.phase) } : {}) })),
  };
  session = new Session(options);
  for (const system of scenario.systems) if (system.kind === "system") ports.set(system.id, session.publisher(system.id));
  for (const route of scenario.subscriptions) session.subscribe(route.systemId, route.type, route.version, route.phase,
    (message, context) => run(route.systemId, "receive", context.tick, context.phase, message));
  const staged = new Set<number>();
  return { session, states, scenario, stageScheduled() {
    const progress = session.diagnostics();
    if (progress.tickInProgress || progress.nextPhase !== "input") return;
    scenario.inputs.forEach((input, index) => {
      if (!staged.has(index) && input.tick === progress.nextTick) {
        session.stageExternalInput(input.source, { sessionId: scenario.sessionId, type: input.type, version: input.version, payload: input.payload });
        staged.add(index);
      }
    });
  } };
}
export function compareRuns(a: Lab, b: Lab): { equal: boolean; detail: string } {
  const left = a.session.trace(); const right = b.session.trace();
  if (!left.complete || !right.complete) return { equal: false, detail: "Traza incompleta: no se puede certificar igualdad." };
  if (JSON.stringify(left.manifest) !== JSON.stringify(right.manifest)) return { equal: false, detail: "El manifiesto es diferente." };
  const first = left.entries.findIndex((entry, i) => JSON.stringify(entry) !== JSON.stringify(right.entries[i]));
  if (first >= 0 || left.entries.length !== right.entries.length) return { equal: false, detail: "Primera diferencia en registro " + (first >= 0 ? first + 1 : Math.min(left.entries.length, right.entries.length) + 1) };
  const equal = JSON.stringify([...a.states]) === JSON.stringify([...b.states]);
  return { equal, detail: equal ? "Traza completa y estados propios idénticos." : "Los estados propios finales difieren." };
}
function variant(id: string, name: string, description: string, change: (scenario: Scenario) => void, expectedCode?: string, ticks = 2): void {
  const scenario = structuredClone(base); scenario.name = name; change(scenario);
  presets.push({ id, name, description, scenario, ticks, ...(expectedCode ? { expectedCode } : {}) });
}
variant("same-phase", "Destino en la fase actual", "Una emisión en action dirigida a action espera al próximo tick.", s => { s.subscriptions[2]!.phase = "action"; });
variant("no-consumers", "Evento sin consumidores", "Result conserva ID y traza, sin reservar entregas.", s => { s.subscriptions = s.subscriptions.filter(route => route.type !== "Result"); });
variant("reverse", "Registro inverso y orden estable", "Las rutas se registran al revés; messageId y receptor definen el consumo.", s => { s.subscriptions.reverse(); });
variant("roots", "Dos operaciones independientes", "Dos entradas raíz en el mismo corte, cada una con su correlación.", s => {
  s.rules[0]!.actions = [{ op: "send", type: "Request", version: 1, payload: { operationId: "$input.payload.operationId" } }];
  s.contracts[1] = { ...s.contracts[1]!, producers: [{ systemId: "planner", phases: ["input"] }] };
  s.inputs.push({ ...s.inputs[0]!, payload: { operationId: "op-002" } });
});
variant("business", "Rechazo de negocio", "Un resultado con motivo tipado conserva la sesión activa.", s => {
  s.contracts[2] = { ...s.contracts[2]!, fields: { ...s.contracts[2]!.fields, reason: { type: "string" } } };
  s.rules[2]!.actions[1]!.payload = { operationId: "$input.payload.operationId", reason: "acción no permitida" };
});
variant("queue", "Fan-out sin capacidad", "No se reserva ninguna ruta parcial cuando se supera el presupuesto.", s => { s.limits.maxDeliveries = 2; }, "QUEUE_CAPACITY");
variant("external", "Buffer externo lleno", "La segunda entrada excede el límite y identifica al adaptador.", s => { s.limits.maxExternalInputs = 1; s.inputs.push(structuredClone(s.inputs[0]!)); }, "EXTERNAL_CAPACITY");
variant("bytes", "Payload excede bytes UTF-8", "El tamaño serializado incluye los bytes de las claves y valores.", s => { s.limits.maxPayloadBytes = 7; }, "PAYLOAD_CAPACITY");
variant("ids", "Secuencia de mensajes agotada", "El tercer mensaje falla antes de repetir un identificador.", s => { s.limits.maxMessageId = 2; }, "ID_EXHAUSTED");
variant("ticks", "Horizonte de ticks agotado", "No se vuelve a ejecutar un tick fuera del horizonte.", s => { s.limits.maxTicks = 1; }, "TICK_EXHAUSTED");
variant("truncated", "Traza acotada incompleta", "La simulación continúa; replay queda bloqueado. Debug conserva el journal.", s => { s.limits.traceCapacity = 4; });
variant("missing-owner", "Comando sin responsable inscrito", "Una configuración inválida no puede iniciarse.", s => { s.subscriptions = s.subscriptions.filter(route => route.type !== "Request"); }, "CONFIG_INVALID");
variant("duplicate", "Inscripción duplicada", "No se permiten dos receptores del mismo sistema y contrato.", s => { s.subscriptions.push(structuredClone(s.subscriptions[1]!)); }, "CONFIG_INVALID");
variant("version", "Versión no declarada", "El scheduler se detiene ante una versión ajena al catálogo.", s => { s.rules[1]!.actions[0]!.version = 2; }, "CONTRACT_INVALID");
variant("wrong-kind", "Comando publicado como evento", "send y emit respetan la clase del contrato.", s => { s.rules[1]!.actions[0]!.op = "emit"; }, "CONTRACT_INVALID");
variant("phase", "Productor en fase no autorizada", "La fase de emisión se valida antes de admitir la salida.", s => { s.contracts[1] = { ...s.contracts[1]!, producers: [{ systemId: "planner", phases: ["movement"] }] }; }, "SOURCE_INVALID");
variant("payload", "Campo desconocido", "Los payloads deben respetar los campos del esquema.", s => { s.inputs[0]!.payload.extra = true; }, "PAYLOAD_INVALID");
variant("nested", "Datos anidados y campos opcionales", "Objetos, arrays densos, booleanos e enteros seguros permanecen inmutables durante el fan-out.", s => {
  const fields: Contract["fields"] = { operationId: { type: "string", minLength: 1, maxLength: 64 }, note: { type: "string", optional: true, maxLength: 32 },
    data: { type: "object", fields: { active: { type: "boolean" }, values: { type: "array", maxLength: 4, items: { type: "number", integer: true, min: 0, max: 10 } } } } };
  s.contracts = s.contracts.map(contract => ({ ...contract, fields }));
  s.inputs[0]!.payload.data = { active: true, values: [1, 2, 3] };
  s.rules[1]!.actions[0]!.payload!.data = "$state.pending.data";
  s.rules[2]!.actions[1]!.payload!.data = "$input.payload.data";
});
for (const name of faultNames) {
  const expected = ["throw", "mutate"].includes(name) ? "CALLBACK_FAILED" : name === "async" ? "ASYNC_INVALID"
    : ["reenter", "close"].includes(name) ? "REENTRANT" : ["restart", "unsubscribe"].includes(name) ? "STATE_INVALID"
    : name === "export" || name === "impersonate" ? "CONTEXT_INVALID" : name.includes("Cause") || name === "mixedRoots" ? "CAUSE_INVALID" : "PAYLOAD_INVALID";
  variant("fault-" + name, "Inyección: " + name, "Fixture controlado; resultado esperado " + expected + ".", s => { s.rules[2]!.actions = [{ op: "fault", fault: name }]; }, expected);
}
const matrix = structuredClone(base);
matrix.name = "Matriz completa de fases (49 rutas)"; matrix.systems = []; matrix.contracts = []; matrix.subscriptions = []; matrix.rules = []; matrix.inputs = [];
for (const phase of PHASES) {
  matrix.systems.push({ id: "source-" + phase, kind: "system", loopPhase: phase, state: {} }, { id: "target-" + phase, kind: "system", state: {} });
  matrix.contracts.push({ type: "From-" + phase, version: 1, kind: "event", producers: [{ systemId: "source-" + phase, phases: [phase] }], fields: {} });
  matrix.rules.push({ systemId: "source-" + phase, trigger: { kind: "loop", phase }, actions: [{ op: "emit", type: "From-" + phase, version: 1, payload: {} }] });
  for (const destination of PHASES) matrix.subscriptions.push({ systemId: "target-" + destination, type: "From-" + phase, version: 1, phase: destination });
}
presets.push({ id: "matrix", name: matrix.name, description: "Cada origen emite a las siete fases; compara tick actual y siguiente.", scenario: matrix });
variant("cycle", "Ciclo de mensajes acotado", "Cuatro respuestas en la misma fase atraviesan cuatro ticks sin recursión.", s => {
  s.contracts.push({ type: "Echo", version: 1, kind: "event", producers: [{ systemId: "processor", phases: ["action"] }], fields: {} });
  s.subscriptions.push({ systemId: "processor", type: "Echo", version: 1, phase: "action" });
  s.rules[2]!.actions.push({ op: "emit", type: "Echo", version: 1, payload: {} });
  s.rules.push({ systemId: "processor", trigger: { kind: "receive", type: "Echo", version: 1 }, condition: { key: "received", test: "lt", value: 4 },
    actions: [{ op: "increment", key: "received" }, { op: "emit", type: "Echo", version: 1, payload: {} }] });
}, undefined, 5);
