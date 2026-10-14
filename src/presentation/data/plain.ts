import { ProtocolError } from '../../core/index.ts';
export function fail(message: string): never { throw new ProtocolError('PRESENTATION_INVALID', message); }
export function frozen<T>(value: T): T {
    const seen = new Set<object>();
    function walk(v: unknown, depth = 0): unknown {
        if (depth > 32)
            fail('Data too deep');
        if (v === null || typeof v === 'string' || typeof v === 'boolean')
            return v;
        if (typeof v === 'number' && Number.isSafeInteger(v))
            return v;
        if (!v || typeof v !== 'object' || seen.has(v))
            fail('Expected acyclic data');
        const array = Array.isArray(v);
        if (Object.getPrototypeOf(v) !== (array ? Array.prototype : Object.prototype))
            fail('Unexpected prototype');
        seen.add(v);
        const descriptors = Object.getOwnPropertyDescriptors(v), out: any = array ? [] : {};
        for (const k of Reflect.ownKeys(v)) {
            if (k === 'length' && array)
                continue;
            if (typeof k !== 'string')
                fail('Symbol key');
            const d = descriptors[k]!;
            if (!d.enumerable || !('value' in d))
                fail('Hidden field/accessor');
            Object.defineProperty(out, k, { value: walk(d.value, depth + 1), enumerable: true });
        }
        if (array && Object.keys(out).length !== (v as unknown[]).length)
            fail('Sparse array');
        seen.delete(v);
        return Object.freeze(out);
    }
    return walk(value) as T;
}
