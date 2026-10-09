import type { SettingsHandle } from '../../../shared/settings/store';
import type { SyncSettings } from '../settings';
import { nextDelay } from '../core/schedule';
import type { SyncService } from './sync-service';

/**
 * Automatic sync on this device, after obsidian-git's AutomaticsManager (src/automaticsManager.ts, MIT): a
 * commit-and-sync interval (or commit only, with a separate push interval), a pull interval, pull on start, and
 * "after the last edit" mode. Each clock continues from the last run recorded for this device, so short sessions
 * still sync. Runs skip while a merge or rebase waits for the user, and nothing runs while paused.
 */
export class Automatics {
	private timers = new Map<'commit' | 'pull' | 'push', number>();
	private editTimer?: number;
	private stopped = false;

	constructor(
		private readonly service: SyncService,
		private readonly settings: SettingsHandle<SyncSettings>,
		private readonly win: Window,
		private readonly now: () => number = () => Date.now(),
	) {}

	start(): void {
		this.stopped = false;
		this.schedule();
		const settings = this.settings.get();
		if (settings.autoPullOnBoot && this.active) void this.service.pull({ auto: true }).catch(() => undefined);
	}

	stop(): void {
		this.stopped = true;
		for (const timer of this.timers.values()) this.win.clearTimeout(timer);
		this.timers.clear();
		this.win.clearTimeout(this.editTimer);
		this.editTimer = undefined;
	}

	private get active(): boolean {
		return !this.stopped && this.service.ready && !this.service.snapshot.device.paused;
	}

	/** Set every clock again from the settings and the last recorded runs. */
	schedule(): void {
		for (const timer of this.timers.values()) this.win.clearTimeout(timer);
		this.timers.clear();
		if (!this.active) {
			this.win.clearTimeout(this.editTimer);
			return;
		}
		const settings = this.settings.get();
		const device = this.service.snapshot.device;
		const now = this.now();
		if (!settings.autoBackupAfterFileChange) this.arm('commit', nextDelay(settings.autoSaveInterval, device.lastCommit, now));
		this.arm('pull', nextDelay(settings.autoPullInterval, device.lastPull, now));
		if (settings.differentIntervalCommitAndPush) this.arm('push', nextDelay(settings.autoPushInterval, device.lastPush, now));
	}

	private arm(kind: 'commit' | 'pull' | 'push', delay: number | null): void {
		if (delay === null) return;
		this.timers.set(kind, this.win.setTimeout(() => void this.run(kind), delay));
	}

	/** A file in the vault changed; in "after the last edit" mode the commit clock restarts. */
	fileChanged(): void {
		const settings = this.settings.get();
		if (!settings.autoBackupAfterFileChange || !(settings.autoSaveInterval > 0) || !this.active || this.service.writingFiles) return;
		this.win.clearTimeout(this.editTimer);
		this.editTimer = this.win.setTimeout(() => void this.run('commit'), settings.autoSaveInterval * 60_000);
	}

	private async run(kind: 'commit' | 'pull' | 'push'): Promise<void> {
		this.timers.delete(kind);
		if (!this.active) return;
		const snapshot = this.service.snapshot;
		// A stopped merge or rebase waits for the user; the conflict status row already says so.
		const waiting = !!snapshot.operation || !!snapshot.status?.conflicted.length;
		try {
			if (!waiting) {
				const settings = this.settings.get();
				if (kind === 'pull') await this.service.pull({ auto: true });
				else if (kind === 'push') await this.service.push({ auto: true });
				else if (settings.differentIntervalCommitAndPush) await this.service.commit('all', { auto: true });
				else await this.service.commitAndSync('all', { auto: true });
			}
		} catch {
			// Cancelled by dispose, or reported by the service.
		} finally {
			// Runs that did not happen still move the clock, so a blocked repository is not retried in a tight loop.
			if (!this.stopped && !this.timers.has(kind)) {
				const settings = this.settings.get();
				const minutes = kind === 'pull' ? settings.autoPullInterval : kind === 'push' ? settings.autoPushInterval : settings.autoSaveInterval;
				const once = kind === 'commit' && settings.autoBackupAfterFileChange;
				if (this.active && !once) this.arm(kind, nextDelay(minutes, this.now(), this.now()));
			}
		}
	}
}
