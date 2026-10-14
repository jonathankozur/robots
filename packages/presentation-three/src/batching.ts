import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export function batchRigidAsset(source: THREE.Group, sockets: readonly string[]): THREE.Group {
    source.updateMatrixWorld(true);
    for (const name of sockets)
        if (!source.getObjectByName(name))
            throw Error('Missing socket ' + name);
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>(), out = new THREE.Group();
    source.traverse(o => { if (o instanceof THREE.Mesh) {
        if (o instanceof THREE.SkinnedMesh || Array.isArray(o.material))
            throw Error('Expected rigid single-material primitives');
        let list = buckets.get(o.material);
        if (!list) {
            list = [];
            buckets.set(o.material, list);
        }
        list.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
    } });
    for (const [material, parts] of buckets) {
        const merged = mergeGeometries(parts, false);
        for (const p of parts)
            p.dispose();
        if (!merged)
            throw Error('Incompatible primitive attributes');
        out.add(new THREE.Mesh(merged, material));
    }
    for (const name of sockets) {
        const original = source.getObjectByName(name)!, node = new THREE.Object3D();
        node.name = name;
        original.matrixWorld.decompose(node.position, node.quaternion, node.scale);
        out.add(node);
    }
    return out;
}
