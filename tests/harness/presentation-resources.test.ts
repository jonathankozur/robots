import test from 'node:test';
import assert from 'node:assert/strict';
import { ResourcePool } from '../../src/presentation/graphics/resources.ts';
test('visual resources are shared until their final lease releases, exactly once', async () => {
    let loaded = 0, disposed = 0;
    const p = new ResourcePool(async () => { loaded++; return {}; }, () => disposed++);
    const [a, b] = await Promise.all([p.acquire('same'), p.acquire('same')]);
    assert.equal(loaded, 1);
    assert.equal(a.value, b.value);
    a.release();
    a.release();
    assert.equal(disposed, 0);
    b.release();
    assert.equal(disposed, 1);
    assert.equal(p.count(), 0);
    p.close();
});
test('closing during an asynchronous load disposes its late result and rejects stale acquisition', async () => {
    let resolve!: (v: object) => void, disposed = 0;
    const p = new ResourcePool(() => new Promise<object>(r => resolve = r), () => disposed++);
    const pending = p.acquire('late');
    await Promise.resolve();
    p.close();
    resolve({});
    await assert.rejects(pending, /closed/);
    assert.equal(disposed, 1);
    assert.equal(p.count(), 0);
    await assert.rejects(p.acquire('again'), /closed/);
});
test('failed resource loading is retryable and repeated lifecycles do not accumulate leases', async () => {
    let attempts = 0, disposed = 0;
    const p = new ResourcePool(async () => { if (++attempts === 1)
        throw Error('missing'); return {}; }, () => disposed++);
    await assert.rejects(p.acquire('k'), /missing/);
    const lease = await p.acquire('k');
    lease.release();
    assert.equal(p.count(), 0);
    p.close();
    for (let i = 0; i < 20; i++) {
        const pool = new ResourcePool(async () => ({}), () => disposed++);
        const l = await pool.acquire('asset');
        pool.close();
        l.release();
        assert.equal(pool.count(), 0);
    }
    assert.equal(disposed, 21);
});
