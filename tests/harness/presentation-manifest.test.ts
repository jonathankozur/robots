import test from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest } from '@robots/protocol/presentation/manifest-v1';
const good = () => ({ version: 1, revision: 'v1', assets: [{ resourceId: 'resource.chassis', url: '/assets/presentation/chassis.glb', sha256: 'a'.repeat(64), sockets: ['drive'] }] });
test('visual manifest rejects foreign URLs, duplicate identifiers/sockets and unknown fields before loading', () => {
    for (const mutation of [(v: any) => v.assets[0].url = 'https://other/a.glb', (v: any) => v.assets.push({ ...v.assets[0] }), (v: any) => v.assets[0].sockets.push('drive'), (v: any) => v.assets[0].extra = true, (v: any) => v.assets[0].sha256 = 'bad']) {
        const v = good();
        mutation(v);
        assert.throws(() => validateManifest(v));
    }
    const v = good(), result = validateManifest(v);
    v.assets[0]!.sockets[0] = 'changed';
    assert.equal(result.assets[0]!.sockets[0], 'drive');
    assert.ok(Object.isFrozen(result.assets));
});
test('visual manifest canonicalization ignores meaningless member and socket ordering', () => { const one = good(); one.assets[0]!.sockets = ['drive', 'core']; const a = one.assets[0]!; const reordered = { assets: [{ sockets: ['core', 'drive'], sha256: a.sha256, url: a.url, resourceId: a.resourceId }], revision: one.revision, version: one.version }; assert.equal(JSON.stringify(validateManifest(one)), JSON.stringify(validateManifest(reordered))); });
