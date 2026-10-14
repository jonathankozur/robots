import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { batchRigidAsset } from '@robots/presentation-three/batching';
test('rigid batching reduces repeated same-material meshes while preserving world bounds and sockets', () => {
    const g = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    for (const x of [-1, 1]) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .5), material);
        mesh.position.x = x;
        g.add(mesh);
    }
    const socket = new THREE.Object3D();
    socket.name = 'mount';
    socket.position.set(1, 2, 3);
    g.add(socket);
    g.rotation.y = .4;
    g.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(g), at = socket.getWorldPosition(new THREE.Vector3()), batched = batchRigidAsset(g, ['mount']);
    let count = 0;
    batched.traverse(o => { if (o instanceof THREE.Mesh)
        count++; });
    assert.equal(count, 1);
    batched.updateMatrixWorld(true);
    const actual = new THREE.Box3().setFromObject(batched);
    assert.ok(bounds.min.distanceTo(actual.min) < 1e-6);
    assert.ok(bounds.max.distanceTo(actual.max) < 1e-6);
    assert.ok(at.distanceTo(batched.getObjectByName('mount')!.getWorldPosition(new THREE.Vector3())) < 1e-6);
    assert.throws(() => batchRigidAsset(g, ['absent']));
});
