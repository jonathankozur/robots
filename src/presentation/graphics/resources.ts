export class ResourcePool<T> {
    #load: (key: string) => Promise<T>;
    #dispose: (resource: T) => void;
    #closed = false;
    #entries = new Map<string, {
        refs: number;
        value: T | undefined;
        ready: Promise<T>;
    }>();
    constructor(load: (key: string) => Promise<T>, dispose: (resource: T) => void) { this.#load = load; this.#dispose = dispose; }
    async acquire(key: string): Promise<{
        value: T;
        release(): void;
    }> {
        if (this.#closed)
            throw Error('Resource pool closed');
        let entry = this.#entries.get(key);
        if (!entry) {
            entry = { refs: 0, value: undefined, ready: undefined as unknown as Promise<T> };
            const current = entry;
            current.ready = Promise.resolve().then(() => this.#load(key)).then(value => { if (this.#closed) {
                this.#dispose(value);
                throw Error('Resource pool closed during load');
            } current.value = value; return value; }).catch(error => { if (this.#entries.get(key) === current)
                this.#entries.delete(key); throw error; });
            this.#entries.set(key, current);
        }
        const current = entry;
        current.refs++;
        const value = await current.ready;
        let released = false;
        return { value, release: () => { if (released)
                return; released = true; if (this.#closed)
                return; if (--current.refs === 0) {
                this.#entries.delete(key);
                this.#dispose(value);
                current.value = undefined;
            } } };
    }
    close(): void { if (this.#closed)
        return; this.#closed = true; for (const e of this.#entries.values())
        if (e.value !== undefined)
            this.#dispose(e.value); this.#entries.clear(); }
    count(): number { return this.#entries.size; }
}
