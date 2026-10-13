import { Session, createSimulationEnvironment, nextInt, chance, parseScaledDecimal, mulDiv, checkedAdd, msToTicks } from "../../src/core/index.ts";
import type { Publisher, Contract, Payload } from "../../src/core/index.ts";
import { snapshotData } from "../../src/core/messaging/immutable.ts";

export const DEFAULT_SEED = "0123456789abcdef";
export const FIXTURE_TICKS = 6;
export const fixtureContracts: readonly Contract[] = [
  { type: "LabCalculate", version: 1, kind: "command", responsibleSystemId: "beta", producers: [{ systemId: "alpha", phases: ["decision"] }],
    fields: { sample: { type: "number", integer: true, min: 0, max: 10000 }, amount: { type: "number", integer: true, min: 0 }, success: { type: "boolean" } } },
  { type: "LabResult", version: 1, kind: "event", producers: [{ systemId: "beta", phases: ["action"] }],
    fields: { sample: { type: "number", integer: true }, amount: { type: "number", integer: true }, success: { type: "boolean" }, bonus: { type: "number", integer: true }, total: { type: "number", integer: true } } },
];
export interface FixtureOptions { readonly seed?: string; readonly runtime?: string; readonly debug?: boolean; readonly extraBetaDraws?: number }
export function createEnvironmentFixture(options: FixtureOptions = {}) {
  const seed = options.seed ?? DEFAULT_SEED;
  const extra = options.extraBetaDraws ?? 0;
  if (!Number.isSafeInteger(extra) || extra < 0 || extra > 100) throw new Error("Extra draws require an integer in 0..100");
  const owners = [{ id: "alpha" }, { id: "beta" }, { id: "observer" }];
  const environment = createSimulationEnvironment(seed, [{ systemId: "alpha", purpose: "sample" }, { systemId: "alpha", purpose: "accuracy" }, { systemId: "beta", purpose: "sample" }], owners);
  const initial = (systemId: string, purpose: string) => environment.streams.find(s => s.systemId === systemId && s.purpose === purpose)!.initial;
  let alphaSample = initial("alpha", "sample"), alphaAccuracy = initial("alpha", "accuracy");
  let betaSample = initial("beta", "sample"), total = 0;
  const observations: Payload[] = [];
  let alpha: Publisher, beta: Publisher;
  const session = new Session({ sessionId: "environment-fixture", revision: "env-fixture-v1", runtime: options.runtime ?? "fixture-reference",
    environment, initialState: { extraBetaDraws: extra }, debug: options.debug ?? false, contracts: fixtureContracts,
    maxTicks: 1000, traceCapacity: 100000, systems: [
      { id: "alpha", loopPhase: "decision", loop() {
        const sample = nextInt(alphaSample, 0, 10001), accuracy = chance(alphaAccuracy, 7500);
        const amount = mulDiv(parseScaledDecimal("12.345"), sample.value, 10000, "floor");
        alphaSample = sample.state; alphaAccuracy = accuracy.state;
        alpha.send("LabCalculate", 1, { sample: sample.value, amount, success: accuracy.value });
      } }, { id: "beta" }, { id: "observer" },
    ] });
  alpha = session.publisher("alpha"); beta = session.publisher("beta");
  session.subscribe("beta", "LabCalculate", 1, "action", message => {
    let next = betaSample;
    for (let i = 0; i < extra; i++) next = nextInt(next, 0, 10001).state;
    const bonus = nextInt(next, 0, 1001);
    const newTotal = checkedAdd(total, checkedAdd(message.payload.amount as number, bonus.value));
    betaSample = bonus.state; total = newTotal;
    beta.emit("LabResult", 1, { ...message.payload, bonus: bonus.value, total });
  });
  session.subscribe("observer", "LabResult", 1, "publication", message => { observations.push(message.payload); });
  const snapshot = () => snapshotData({ alpha: { sample: alphaSample, accuracy: alphaAccuracy }, beta: { sample: betaSample, total }, observations }, 1_048_576) as unknown as {
    alpha: { sample: typeof alphaSample; accuracy: typeof alphaAccuracy }; beta: { sample: typeof betaSample; total: number }; observations: readonly Payload[];
  };
  return { session, snapshot };
}
export interface LogicalEvidence { readonly environment: unknown; readonly sessionManifest: unknown; readonly numeric: readonly number[]; readonly state: unknown; readonly entries: readonly unknown[] }
export interface EnvironmentEvidence { readonly format: "robots-environment-evidence-v1"; readonly seed: string; readonly completedTicks: number; readonly runtime: string; readonly logical: LogicalEvidence }
export function environmentEvidence(fixture: ReturnType<typeof createEnvironmentFixture>, seed: string, runtime: string): EnvironmentEvidence {
  const trace = fixture.session.trace(), progress = fixture.session.diagnostics();
  if (!trace.complete || progress.tickInProgress || progress.state !== "active") throw new Error("Evidence requires a healthy session between complete ticks");
  const { runtime: _runtimeMetadata, ...sessionManifest } = trace.manifest!;
  return snapshotData({ format: "robots-environment-evidence-v1", seed, completedTicks: progress.nextTick, runtime,
    logical: { environment: trace.manifest!.environment, sessionManifest, numeric: [msToTicks(125), parseScaledDecimal("12.345"), mulDiv(12345, 1250, 10000, "floor")], state: fixture.snapshot(), entries: trace.entries } }, 16_777_216) as unknown as EnvironmentEvidence;
}
export function runEnvironmentReference(seed = DEFAULT_SEED, runtime = "fixture-reference"): EnvironmentEvidence {
  const fixture = createEnvironmentFixture({ seed, runtime }); fixture.session.start();
  for (let i = 0; i < FIXTURE_TICKS; i++) fixture.session.advanceTick();
  return environmentEvidence(fixture, seed, runtime);
}
export function compareEnvironmentEvidence(a: unknown, b: EnvironmentEvidence): { equal: boolean; detail: string } {
  try {
    const copied = snapshotData(a, 16_777_216) as unknown as EnvironmentEvidence;
    if (!copied || copied.format !== "robots-environment-evidence-v1" || typeof copied.runtime !== "string" || !copied.runtime
      || copied.seed !== b.seed || copied.completedTicks !== b.completedTicks || JSON.stringify(copied.logical) !== JSON.stringify(snapshotData(b.logical, 16_777_216))) return { equal: false, detail: "Semilla, horizonte o evidencia lógica diferentes/inválidos." };
    return { equal: true, detail: "Mismos cálculos, estados RNG, resultados y traza lógica. Metadatos de runtime separados." };
  } catch { return { equal: false, detail: "El archivo no contiene evidencia de datos válida." }; }
}
