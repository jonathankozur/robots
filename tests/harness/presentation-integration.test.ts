import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationController } from '../../src/application/index.ts';
import { presentationRecipe, presentationRequest } from '../core/presentation-fixture.ts';
import { VisualMotion } from '../../src/presentation/graphics/motion.ts';
import type { View } from '../../src/presentation/data/contracts.ts';
test('render 15/30/60 FPS, exact/smooth and mixed stepping leave the logical trace unchanged', () => {
    let baseline: unknown;
    for (const fps of [15, 30, 60])
        for (const exact of [false, true]) {
            const a = new ApplicationController({ instanceId: 'matrix', runtime: 'pre-test', recipe: presentationRecipe() }), motion = new VisualMotion();
            assert.equal(a.request(presentationRequest()).ok, true);
            let now = 0;
            motion.pause(false, 0);
            for (let i = 0; i < 40; i++) {
                if (exact) {
                    const target = a.snapshot().progress!.nextTick + 1;
                    while (a.snapshot().progress!.nextTick < target)
                        assert.equal(a.advance('phase').ok, true);
                }
                else
                    assert.equal(a.advance().ok, true);
                const v = a.snapshot().observations.presentation as unknown as View | undefined;
                if (v)
                    motion.accept(v, now, exact);
                for (let t = 0; t < 50; t += 1000 / fps)
                    motion.poses(now + t);
                now += 50;
            }
            const result = { trace: a.trace(), observations: a.snapshot().observations };
            if (baseline === undefined)
                baseline = result;
            else
                assert.deepEqual(result, baseline);
            a.close();
        }
});
