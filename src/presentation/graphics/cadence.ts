export class RenderCadence {
    #next = 0;
    #last = -1;
    #fps = 0;
    ready(now: number, fps: number): boolean {
        if (!Number.isFinite(now) || now < 0 || now < this.#last || !Number.isFinite(fps) || fps <= 0)
            throw Error('Invalid render cadence');
        this.#last = now;
        const interval = 1000 / fps;
        if (fps !== this.#fps) {
            this.#fps = fps;
            this.#next = now;
        }
        if (now + 1e-6 < this.#next)
            return false;
        this.#next = now - this.#next > interval * 3 ? now + interval : this.#next + interval;
        return true;
    }
}
