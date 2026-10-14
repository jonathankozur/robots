import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { validateManifest } from '@robots/protocol/presentation/manifest-v1';
import { validateContentBundle } from '@robots/content';
const manifest = validateManifest(JSON.parse(readFileSync(new URL('../../content/presentation/prototype-v1.json', import.meta.url), 'utf8')));
test('Blender GLB exports are self contained, match their digests and expose unique sockets with correct axes', async () => {
    const loaded = new Map<string, THREE.Group>();
    for (const a of manifest.assets) {
        const bytes = readFileSync(new URL('../../public' + a.url, import.meta.url));
        assert.equal(bytes.readUInt32LE(0), 0x46546c67);
        assert.equal(bytes.readUInt32LE(4), 2);
        assert.equal(bytes.readUInt32LE(8), bytes.length);
        assert.equal(createHash('sha256').update(bytes).digest('hex'), a.sha256);
        const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
        assert.ok((json.buffers ?? []).every((b: any) => b.uri === undefined));
        assert.equal((json.images ?? []).length, 0);
        const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
        gltf.scene.updateMatrixWorld(true);
        loaded.set(a.resourceId, gltf.scene);
        for (const socket of a.sockets) {
            let count = 0;
            gltf.scene.traverse(o => { if (o.name === socket)
                count++; });
            assert.equal(count, 1, socket);
        }
        const box = new THREE.Box3().setFromObject(gltf.scene);
        assert.ok([box.min.x, box.max.x, box.min.y, box.max.y, box.min.z, box.max.z].every(Number.isFinite));
    }
    const chassis = loaded.get('resource.chassis')!, sensor = chassis.getObjectByName('sensor')!;
    const at = sensor.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(at.y - .62) < 1e-5);
    assert.ok(Math.abs(at.z - .20) < 1e-5);
    const floor = new THREE.Box3().setFromObject(loaded.get('resource.floor')!);
    assert.ok(Math.abs(floor.max.x - Math.sqrt(3) / 2) < 1e-5);
    assert.ok(Math.abs(floor.max.z - 1) < 1e-5);
    for (const drive of ['resource.wheels', 'resource.tracks']) {
        const root = chassis.clone(true);
        root.getObjectByName('drive')!.add(loaded.get(drive)!.clone(true));
        const box = new THREE.Box3().setFromObject(root);
        assert.ok(Math.hypot(Math.max(Math.abs(box.min.x), Math.abs(box.max.x)), Math.max(Math.abs(box.min.z), Math.abs(box.max.z))) < .81);
    }
    const fixture = validateContentBundle(JSON.parse(readFileSync(new URL('../../content/fixtures/presentation-v2.json', import.meta.url), 'utf8')));
    assert.equal(fixture.ok, true);
    if (fixture.ok) {
        assert.equal(fixture.content.definitions.locomotions.length, 2);
        for (const r of fixture.content.vocabularies.resources)
            assert.ok(manifest.assets.some(a => a.resourceId === r.id));
    }
    for (const group of loaded.values())
        group.traverse(o => { if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            for (const m of Array.isArray(o.material) ? o.material : [o.material])
                m.dispose();
        } });
});
