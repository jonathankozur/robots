import type { View } from '@robots/protocol/presentation/v1';
export const hexPosition = (q: number, r: number) => ({ x: Math.sqrt(3) * (q + r / 2), z: 1.5 * r });
export interface Pose {
    x: number;
    z: number;
    yaw: number;
}
export class VisualMotion {
    #last = 0;
    #time = 0;
    #paused = true;
    #speed = 1;
    #context = '';
    #sequence = 0;
    #moves = new Map<string, {
        from: Pose;
        to: Pose;
        start: number;
        duration: number;
    }>();
    #update(now: number): void { if (!Number.isFinite(now) || now < this.#last)
        throw Error('Invalid visual clock'); if (!this.#paused)
        this.#time += (now - this.#last) * this.#speed; this.#last = now; }
    #pose(m: {
        from: Pose;
        to: Pose;
        start: number;
        duration: number;
    }): Pose { const t = m.duration === 0 ? 1 : Math.min(1, Math.max(0, (this.#time - m.start) / m.duration)); return { x: m.from.x + (m.to.x - m.from.x) * t, z: m.from.z + (m.to.z - m.from.z) * t, yaw: m.to.yaw }; }
    accept(view: View, now: number, snap = false): void {
        this.#update(now);
        if (view.contextId === this.#context && view.sequence === this.#sequence) {
            if (snap)
                for (const m of this.#moves.values())
                    m.duration = 0;
            return;
        }
        const reset = view.contextId !== this.#context || view.sequence !== this.#sequence + 1;
        if (view.contextId === this.#context && view.sequence < this.#sequence)
            throw Error('Stale visual publication');
        if (view.contextId !== this.#context)
            this.#moves.clear();
        const ids = new Set(view.world.robots.map(r => r.robotId));
        for (const k of this.#moves.keys())
            if (!ids.has(k))
                this.#moves.delete(k);
        for (const r of view.world.robots) {
            const previous = this.#moves.get(r.robotId), position = hexPosition(r.q, r.r);
            if (previous && previous.to.x === position.x && previous.to.z === position.z && !snap && !reset)
                continue;
            const from = previous ? this.#pose(previous) : { ...position, yaw: 0 }, dx = position.x - from.x, dz = position.z - from.z;
            const to = { ...position, yaw: dx || dz ? Math.atan2(dx, dz) : from.yaw };
            this.#moves.set(r.robotId, { from, to, start: this.#time, duration: !previous || snap || reset ? 0 : Math.min(120, r.moveCooldownTicks * 50) });
        }
        this.#context = view.contextId;
        this.#sequence = view.sequence;
    }
    poses(now: number): ReadonlyMap<string, Pose> { this.#update(now); return new Map([...this.#moves].map(([k, m]) => [k, Object.freeze(this.#pose(m))])); }
    pause(paused: boolean, now: number): void { this.#update(now); this.#paused = paused; }
    speed(value: number, now: number): void { if (!Number.isFinite(value) || value <= 0 || value > 100)
        throw Error('Invalid visual speed'); this.#update(now); this.#speed = value; }
}
