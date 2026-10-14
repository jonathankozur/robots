import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationController } from '@robots/application-host';
import { presentationRecipe, presentationRequest } from './presentation-fixture.ts';
import { navigationPresets } from './navigation-fixture.ts';
import type { View } from '@robots/protocol/presentation/v1';
const app = () => new ApplicationController({ instanceId: 'pre', runtime: 'pre-tests', recipe: presentationRecipe() });
const view = (a: ApplicationController) => a.snapshot().observations.presentation as unknown as View;
function boot(a: ApplicationController, data = presentationRequest()) { const r = a.request(data); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(a.advance().ok, true); assert.equal(a.advance().ok, true); }
test('presentation consumes confirmed positions after publication and preserves immutable private views', () => {
    const a = app();
    boot(a);
    const v = view(a);
    assert.equal(v.world.boardRevision, 2);
    assert.equal(v.movements.length, 2);
    assert.equal(v.contextId, a.snapshot().contextId);
    assert.throws(() => { (v.world.robots[0] as any).q = 99; }, TypeError);
    const before = structuredClone(v);
    a.advance();
    assert.deepEqual(v, before);
    assert.notEqual(view(a), v);
    a.close();
});
test('presentation excludes duplicate and rejected steps from visual movements', () => {
    const s = navigationPresets().find(x => x.id === 'duplicate')!.scenario;
    const a = app();
    boot(a, presentationRequest(s));
    for (let i = 0; i < 8; i++)
        a.advance();
    const published = a.trace()!.entries.filter(e => e.kind === 'published').map(e => e.message), results = published.filter(m => m.type === 'NavigationStepResolved'), visual = published.filter(m => m.type === 'PresentationViewPublished').flatMap(m => (m.payload as unknown as View).movements);
    assert.ok(results.some(m => m.payload.duplicate === true));
    assert.equal(visual.length, 1);
    assert.ok(visual.every(r => r.accepted && !r.duplicate));
    assert.equal(visual[0]!.sourceMessageId, results.find(m => !m.payload.duplicate)!.messageId);
    a.close();
});
test('presentation replay and mixed controls reconstruct fresh independent owners', () => {
    const a = app(), b = app();
    boot(a);
    boot(b);
    const untouched = b.snapshot();
    for (let i = 0; i < 30; i++)
        a.advance();
    assert.deepEqual(b.snapshot(), untouched);
    const recording = a.exportReplay(), r = app();
    assert.equal(r.loadReplay(recording).ok, true);
    for (let i = 0; i < recording.completedTicks; i++)
        assert.equal(r.advance().ok, true);
    assert.deepEqual(r.trace(), a.trace());
    assert.deepEqual(view(r), view(a));
    a.close();
    b.close();
    r.close();
});
test('invalid replacement keeps the previous view and maximum board/assemblies fit unchanged budgets', () => {
    const a = app();
    boot(a);
    const before = a.snapshot(), bad = presentationRequest(undefined, 'bad');
    (bad.content as any).definitions.chassis[0].visual.resourceId = 'resource.missing';
    assert.equal(a.request(bad).ok, false);
    assert.deepEqual(a.snapshot(), before);
    a.close();
    const s = presentationRequest().selection as unknown as import('./navigation-fixture.ts').Scenario;
    s.width = s.height = 12;
    s.tiles = Array.from({ length: 144 }, (_, i) => ({ q: i % 12, r: Math.floor(i / 12), terrainId: 'terrain.floor' }));
    s.robots = Array.from({ length: 16 }, (_, i) => ({ robotId: 'id-' + i + '-' + 'x'.repeat(56), definitionId: i % 2 ? 'robot.unarmed' : 'robot.scout', q: i % 12, r: Math.floor(i / 12) }));
    s.order = s.robots.map(r => r.robotId);
    s.config.autoEnabled = false;
    s.config.goals = [];
    const max = app();
    boot(max, presentationRequest(s));
    assert.equal(view(max).assemblies.length, 16);
    assert.equal(view(max).world.tiles.length, 144);
    max.close();
});
test('presentation rejects inconsistent bootstrap identity and duplicate assemblies visibly', () => {
    for (const corrupt of ['board', 'duplicate']) {
        const recipe = presentationRecipe(), prepare = recipe.prepare;
        const a = new ApplicationController({ instanceId: 'bad', runtime: 'pre-tests', recipe: { ...recipe, prepare(c, s) { const v = prepare(c, s), p = v.presentation as any; if (corrupt === 'board')
                    p.boardId = 'wrong';
                else
                    p.assemblies.push(p.assemblies[0]); return v; } } });
        assert.equal(a.request(presentationRequest()).ok, true);
        a.advance();
        a.advance();
        assert.equal(a.snapshot().state, 'faulted');
        assert.ok(a.snapshot().failure);
        a.close();
    }
});
