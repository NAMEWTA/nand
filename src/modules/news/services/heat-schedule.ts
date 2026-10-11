import type { SettingsTimers } from '../../../shared/settings/store';

const HOUR = 3_600_000;
const TICK = 60_000;

/** Records only hours observed while this module was running; sleep and offline time stay gaps. */
export class NewsHeatSchedule {
	private timer: unknown;
	private enabled = false;
	private generation = 0;
	private observedFrom = 0;
	private lastTick = 0;
	private lastHour = 0;
	constructor(private readonly observe: (hour: number) => Promise<void>, private readonly timers: SettingsTimers, private readonly now: () => number = Date.now) {}
	update(enabled: boolean): void {
		if (enabled === this.enabled) return;
		this.enabled = enabled;
		this.generation++;
		if (this.timer !== undefined) this.timers.clear(this.timer);
		this.timer = undefined;
		if (!enabled) return;
		this.observedFrom = this.lastTick = this.now();
		this.lastHour = Math.floor(this.lastTick / HOUR) * HOUR;
		this.schedule(this.generation);
	}
	private schedule(generation: number): void {
		if (!this.enabled || generation !== this.generation) return;
		this.timer = this.timers.set(() => {
			if (!this.enabled || generation !== this.generation) return;
			this.timer = undefined;
			const now = this.now(), hour = Math.floor(now / HOUR) * HOUR;
			if (now < this.lastTick || now - this.lastTick > 2 * TICK) this.observedFrom = now;
			const complete = hour > this.lastHour && this.observedFrom <= hour - HOUR;
			this.lastTick = now;
			this.lastHour = hour;
			const work = complete ? this.observe(hour) : Promise.resolve();
			// A failed write leaves a gap; it cannot justify inventing an observed value.
			void work.catch(() => undefined).finally(() => this.schedule(generation));
		}, Math.min(TICK, HOUR - this.now() % HOUR));
	}
	dispose(): void { this.update(false); }
}
