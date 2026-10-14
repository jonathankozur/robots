export interface Asset {
    readonly resourceId: string;
    readonly url: string;
    readonly sha256: string;
    readonly sockets: readonly string[];
}
export interface Manifest {
    readonly version: 1;
    readonly revision: string;
    readonly assets: readonly Asset[];
}
import { frozen, fail } from './plain.ts';
export function validateManifest(value: unknown): Manifest {
    const m = frozen(value) as Manifest;
    const shape = (v: object, keys: string) => { if (Object.keys(v).sort().join(',') !== keys)
        fail('Unknown/missing manifest fields'); };
    if (!m || typeof m !== 'object')
        fail('Invalid manifest');
    shape(m, 'assets,revision,version');
    if (m.version !== 1 || typeof m.revision !== 'string' || !/^[a-zA-Z0-9._-]{1,128}$/.test(m.revision) || !Array.isArray(m.assets) || m.assets.length < 1 || m.assets.length > 32)
        fail('Invalid manifest version/limits');
    const ids = new Set<string>();
    for (const a of m.assets) {
        if (!a || typeof a !== 'object')
            fail('Invalid asset');
        shape(a, 'resourceId,sha256,sockets,url');
        if (typeof a.resourceId !== 'string' || !/^resource\.[a-z][a-z0-9._-]{0,118}$/.test(a.resourceId) || ids.has(a.resourceId) || typeof a.url !== 'string' || !/^\/assets\/presentation\/[a-z0-9-]+\.glb$/.test(a.url) || typeof a.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(a.sha256) || !Array.isArray(a.sockets) || a.sockets.length > 32 || new Set(a.sockets).size !== a.sockets.length || a.sockets.some((s: unknown) => typeof s !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(s)))
            fail('Invalid asset identity/location/digest/sockets');
        ids.add(a.resourceId);
    }
    return frozen({ version: 1, revision: m.revision, assets: [...m.assets].sort((a, b) => a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0).map(a => ({ resourceId: a.resourceId, url: a.url, sha256: a.sha256, sockets: [...a.sockets].sort() })) });
}
