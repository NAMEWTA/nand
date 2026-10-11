import type { SettingsHandle, SettingsTimers } from '../../../shared/settings/store';
import type { NewsSettings } from '../settings';
import type { NewsService } from './news-service';

/** Owns only the opt-in periodic clock. Due times and shared collection remain in NewsService. */
export class NewsRefreshSchedule {
	private timer: unknown;
	private stopped = false;
	private off: (() => void) | undefined;
	constructor(private readonly service: Pick<NewsService, 'refreshDue' | 'refreshFromPolicy' | 'settingsChanged'>, private readonly settings: Pick<SettingsHandle<NewsSettings>, 'get' | 'subscribe'>, private readonly timers: SettingsTimers) {}
	start(): void {
		this.off = this.settings.subscribe(() => { this.service.settingsChanged(); this.schedule(); });
		void this.service.refreshFromPolicy('startup').catch(() => undefined);
		this.schedule();
	}
	private schedule(): void {
		if (this.timer !== undefined) this.timers.clear(this.timer);
		this.timer = undefined;
		if (this.stopped || !this.settings.get().enabled || !this.settings.get().autoRefresh) return;
		this.timer = this.timers.set(() => {
			this.timer = undefined;
			// Per-source health is the visible failure result; background failures do not disable the module.
			void this.service.refreshDue().catch(() => undefined).finally(() => this.schedule());
		}, 60_000);
	}
	dispose(): void {
		this.stopped = true;
		this.off?.();
		if (this.timer !== undefined) this.timers.clear(this.timer);
		this.timer = undefined;
	}
}
