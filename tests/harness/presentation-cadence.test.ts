import test from 'node:test';
import assert from 'node:assert/strict';
import { RenderCadence } from '../../src/presentation/graphics/cadence.ts';
test('render cadence preserves fractional remainder on 60/90/144 Hz displays', () => { for (const hz of [60, 90, 144])
    for (const fps of [15, 30, 60]) {
        const c = new RenderCadence();
        let frames = 0;
        for (let i = 0; i < hz; i++)
            if (c.ready(i * 1000 / hz, fps))
                frames++;
        assert.equal(frames, fps, `${hz} Hz / ${fps} FPS`);
    } });
test('resuming after a long hidden interval renders once without a frame backlog', () => { const c = new RenderCadence(); assert.equal(c.ready(0, 60), true); assert.equal(c.ready(1000000, 60), true); assert.equal(c.ready(1000000, 60), false); assert.equal(c.ready(1000001, 30), true); assert.throws(() => c.ready(-1, 30)); });
