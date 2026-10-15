import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PHASES } from "@robots/system-api";
import type { Actor, ActorContext, FieldRule, Payload, Publisher } from "@robots/system-api";
import { Session } from "@robots/runtime";
import { beginContextDefinition, initializationDefinition } from "@robots/protocol/application/v1";
import { BOARD_FIELDS } from "@robots/protocol/navigation/v1";
import { INITIAL_FIELDS } from "@robots/protocol/presentation/v1";
import { createNavigationActor } from "@robots/navigation";
import { createPresentationActor } from "@robots/presentation";
import { ApplicationController } from "@robots/application-host";
import type { Recipe } from "@robots/application-host";
import { bindNavigationContracts, bindPresentationContracts } from "@robots/application-host/bindings";

const content = JSON.parse(readFileSync(new URL("../../content/fixtures/basic-v2.json", import.meta.url), "utf8"));
function controller(recipe: Recipe) {
  return new ApplicationController({ instanceId: recipe.id, runtime: "coupling-test", recipe });
}
function boot(recipe: Recipe) {
  const app = controller(recipe);
  assert.deepEqual(app.request({ requestId: "start", seed: "0123456789abcdef", content, selection: {} }),
    { ok: true, contextId: recipe.id + ":1" });
  for (let i = 0; i < 3; i++) assert.equal(app.advance().ok, true, JSON.stringify(app.snapshot().failure));
  assert.equal(app.snapshot().state, "ready");
  return app;
}

test("phase mutations cannot change active or future session execution and manifests", () => {
  const original = [...PHASES];
  const executed: string[] = [];
  const make = (sessionId: string) => new Session({ sessionId, revision: "v1", runtime: "test", contracts: [],
    systems: original.map(phase => ({ id: phase, loopPhase: phase, loop() { executed.push(phase); } })) });
  const first = make("first"); first.start();
  try {
    assert.throws(() => (PHASES as unknown as string[]).reverse(), TypeError);
    assert.throws(() => { (PHASES as unknown as string[])[0] = "publication"; }, TypeError);
    assert.throws(() => (PHASES as unknown as string[]).push("extra"), TypeError);
    first.advanceTick();
    const second = make("second"); second.start(); second.advanceTick();
    assert.deepEqual(executed, [...original, ...original]);
    assert.deepEqual((first.trace()!.manifest as Payload).phases, original);
    assert.deepEqual((second.trace()!.manifest as Payload).phases, original);
    second.close();
  } finally {
    // RED must not contaminate other tests in this process.
    if (!Object.isFrozen(PHASES)) (PHASES as unknown as string[]).splice(0, PHASES.length, ...original);
    first.close();
  }
});

test("begin-context definitions do not let one caller alter future hosts", () => {
  const a = beginContextDefinition({}), b = beginContextDefinition({});
  assert.notEqual(a.fields.requiredParticipants, b.fields.requiredParticipants);
  assert.throws(() => { (a.fields.requiredParticipants as { maxLength: number }).maxLength = 1; }, TypeError);
  assert.equal((beginContextDefinition({}).fields.requiredParticipants as { maxLength: number }).maxLength, 32);
  const first = boot(versionRecipe()), second = boot(versionRecipe());
  assert.deepEqual(first.snapshot().observations, second.snapshot().observations);
  first.close(); second.close();
});

for (const factory of ["begin", "initialize"] as const) {
  test(`${factory} factory snapshots caller fields and freezes every nested schema`, () => {
    const fields = { values: { type: "array", maxLength: 8, items: { type: "string", maxLength: 10 } } } satisfies Record<string, FieldRule>;
    const definition = factory === "begin" ? beginContextDefinition(fields) : initializationDefinition("InitializeExample", fields);
    const nested = definition.fields[factory === "begin" ? "views" : "view"] as unknown as { fields: typeof fields };
    fields.values.maxLength = 1; fields.values.items.maxLength = 2;
    assert.equal(nested.fields.values.maxLength, 8);
    assert.equal(nested.fields.values.items.maxLength, 10);
    assert.equal(Object.isFrozen(fields), false);
    assert.throws(() => { nested.fields.values.items.maxLength = 3; }, TypeError);
    assert.throws(() => { (definition as { version: number }).version = 2; }, TypeError);
  });
}

function versionRecipe(received: number[] = [], subscriptionVersion = 2, outputVersion = 2): Recipe {
  const basic = (identity: Payload, context: ActorContext): Actor => {
    let port: Publisher;
    return { connect(p) { port = p; }, initialize() {
      port.emit("ApplicationParticipantInitialized", 1, { ...identity, participantId: context.systemId });
    }, activate() {} };
  };
  return { id: "versions", revision: "versions-v1", prepare() { return { source: {}, sink: {} }; },
    contracts: [1, 2].map(version => ({ type: "Signal", version, kind: "event",
      producers: [{ systemId: "source", phases: ["input"] }], fields: { value: { type: "number", integer: true } } })),
    outputTypes: outputVersion === 0 ? [] : [{ type: "Signal", version: outputVersion }],
    participants: [
      { id: "source", initializationType: "InitializeSource", phase: "input", fields: {}, create(identity) {
        const actor = basic(identity, { systemId: "source" }); let port: Publisher;
        return { ...actor, connect(p) { port = p; actor.connect(p); }, activate() {
          port.emit("Signal", 1, { value: 11 }); port.emit("Signal", 2, { value: 22 });
        } };
      } },
      { id: "sink", initializationType: "InitializeSink", phase: "input", fields: {}, create(identity) {
        return { ...basic(identity, { systemId: "sink" }), subscriptions: [{ type: "Signal", version: subscriptionVersion, phase: "decision",
          handler(m) { received.push(m.payload.value as number); } }] };
      } }
    ] };
}

test("actor subscriptions select v2 even without host output observers", () => {
  const received: number[] = [], app = boot(versionRecipe(received, 2, 0));
  assert.deepEqual(received, [22]); app.close();
});

test("host subscriptions and output observations select v2 without consuming v1", () => {
  const received: number[] = [], recipe = versionRecipe(received), app = boot(recipe);
  assert.deepEqual(received, [22]); assert.equal(app.snapshot().observations.source!.value, 22);
  const messages = app.trace()!.entries.filter(e => e.kind === "published").map(e => e.message);
  assert.deepEqual(messages.filter(m => m.type === "Signal").map(m => m.contractVersion), [1, 2]);
  const recording = app.exportReplay(), replayReceived: number[] = [], replay = controller(versionRecipe(replayReceived));
  assert.equal(replay.loadReplay(recording).ok, true);
  for (let i = 0; i < recording.completedTicks; i++) assert.equal(replay.advance().ok, true);
  assert.deepEqual(replayReceived, received); assert.deepEqual(replay.trace(), app.trace());
  assert.deepEqual(replay.snapshot().observations, app.snapshot().observations);
  replay.close(); app.close();
});

test("unknown subscription and output versions are rejected explicitly", () => {
  for (const [sub, out] of [[3, 2], [2, 3]]) {
    const app = controller(versionRecipe([], sub, out));
    const result = app.request({ requestId: "start", seed: "0123456789abcdef", content, selection: {} });
    assert.equal(result.ok, false); assert.equal(result.code, "CONTRACT_INVALID"); app.close();
  }
});

test("v1 selections remain exact when a v2 producer is also present", () => {
  const received: number[] = [], app = boot(versionRecipe(received, 1, 1));
  assert.deepEqual(received, [11]); assert.equal(app.snapshot().observations.source!.value, 11); app.close();
});

test("an omitted actor subscription version is rejected instead of defaulting to v1", () => {
  const recipe = versionRecipe([], 1, 0), participant = recipe.participants[1]!;
  const invalid: Recipe = { ...recipe, participants: [recipe.participants[0]!, { ...participant,
    create(identity, resource, context) {
      const actor = participant.create(identity, resource, context);
      const {version: _version, ...sub} = actor.subscriptions![0]!;
      return { ...actor, subscriptions: [sub] } as unknown as Actor;
    } }] };
  const target = controller(invalid);
  const result = target.request({requestId:"start",seed:"0123456789abcdef",content,selection:{}});
  assert.equal(result.ok,false); assert.equal(result.code,"CONTRACT_INVALID"); target.close();
});

test("custom IDs do not allow two owners to consume the same command", () => {
  const recipe = renamedRecipe("nav-a", "pre-a");
  const duplicate: Recipe = { ...recipe, prepare(bundle, selection) {
    return { ...recipe.prepare(bundle, selection), "nav-b": board };
  }, participants: [...recipe.participants, {id:"nav-b",initializationType:"InitializeSecondNavigation",phase:"movement",fields:BOARD_FIELDS,
    create:(identity,_resource,context)=>createNavigationActor(identity,context)}] };
  const app=controller(duplicate), result=app.request({requestId:"start",seed:"0123456789abcdef",content,selection:{}});
  assert.equal(result.ok,false); assert.equal(result.code,"CONFIG_INVALID"); app.close();
});

const board: Payload = { boardId: "board", width: 2, height: 1,
  tiles: [{ q: 0, r: 0, terrainId: "terrain.floor", passable: true }, { q: 1, r: 0, terrainId: "terrain.floor", passable: true }],
  robots: [{ robotId: "a", definitionId: "robot.scout", q: 0, r: 0, moveCooldownTicks: 3 }] };
function renamedRecipe(navId: string, preId: string): Recipe {
  return { id: "renamed-" + navId, revision: "renamed-v1", prepare() {
    return { [navId]: board, [preId]: { boardId: "board", assemblies: [{ robotId: "a", chassisResourceId: "chassis", parts: [] }] } };
  }, contracts: [...bindNavigationContracts({ navigationId: navId, requestProducers: [{ systemId: "app-bootstrap", phases: ["input"] }] }),
    ...bindPresentationContracts(preId)], outputTypes: [{ type: "PresentationViewPublished", version: 1 }, { type: "NavigationStepResolved", version: 1 }],
    participants: [
      { id: navId, initializationType: "InitializeNavigationBoard", phase: "movement", fields: BOARD_FIELDS,
        create: (identity, _resource, context) => {
          assert.deepEqual(context, {systemId: navId}); assert.equal(Object.isFrozen(context), true);
          return createNavigationActor(identity, context);
        } },
      { id: preId, initializationType: "InitializePresentationView", phase: "action", fields: INITIAL_FIELDS,
        create: (identity, _resource, context) => createPresentationActor(identity, context) }
    ] };
}

test("host-assigned NAV/PRE identities preserve domain behavior, causality, replay and session isolation", () => {
  const recipe = renamedRecipe("nav-a", "pre-a"), app = boot(recipe), other = boot(renamedRecipe("nav-b", "pre-b"));
  const step = { boardId: "board", robotId: "a", requestSequence: 1, from: { q: 0, r: 0 }, to: { q: 1, r: 0 }, expectedRobotRevision: 0, knownBoardRevision: 0 };
  assert.equal(app.stage(app.snapshot().contextId, "RequestNavigationStep", step), true);
  assert.equal(app.advance().ok, true);
  assert.equal(app.snapshot().observations["nav-a"]!.reason, "MOVED");
  assert.equal((app.snapshot().observations["pre-a"]!.world as Payload).boardRevision, 1);
  assert.equal((other.snapshot().observations["pre-b"]!.world as Payload).boardRevision, 0);
  const messages = app.trace()!.entries.filter(e => e.kind === "published").map(e => e.message);
  const confirmations = messages.filter(m => m.type === "ApplicationParticipantInitialized");
  assert.deepEqual(confirmations.map(m => m.payload.participantId), ["nav-a", "pre-a"]);
  assert.ok(confirmations.every(m => m.sourceSystemId === m.payload.participantId));
  const command = messages.find(m => m.type === "RequestNavigationStep")!, result = messages.find(m => m.type === "NavigationStepResolved")!;
  assert.deepEqual(result.causationIds, [command.messageId]); assert.equal(result.correlationId, command.correlationId);
  assert.equal(result.emittedPhase, "movement");
  const recording = app.exportReplay(), replay = controller(recipe);
  assert.equal(replay.loadReplay(recording).ok, true);
  for (let i = 0; i < recording.completedTicks; i++) assert.equal(replay.advance().ok, true);
  assert.deepEqual(replay.trace(), app.trace()); assert.deepEqual(replay.snapshot().observations, app.snapshot().observations);
  replay.close(); other.close(); app.close();
});
