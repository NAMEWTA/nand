import { expect, test, vi } from 'vitest';
import type { SettingsHandle } from '../../../shared/settings/store';
import type { NewsSettings } from '../settings';
import { NewsRefreshSchedule } from './refresh-schedule';

test('periodic collection has no clock by default and releases its clock and settings listener on disposal', async () => {
	vi.useFakeTimers();
	const config: NewsSettings = { enabled: true, sources: [], views: [], interest: '', analysisEnabled: false, writeDailyNote: false, autoRefresh: false };
	let listener: (() => void) | undefined;
	const off = vi.fn(() => { listener = undefined; });
	const settings: Pick<SettingsHandle<NewsSettings>, 'get' | 'subscribe'> = { get: () => config, subscribe: callback => { listener = callback; return off; } };
	const service = { refreshDue: vi.fn(async () => {}), refreshFromPolicy: vi.fn(async () => {}), settingsChanged: vi.fn() };
	const schedule = new NewsRefreshSchedule(service, settings, { set: (callback, ms) => setTimeout(callback, ms), clear: timer => clearTimeout(timer as ReturnType<typeof setTimeout>) });
	try {
		schedule.start();
		expect(vi.getTimerCount()).toBe(0);
		expect(service.refreshFromPolicy).toHaveBeenCalledWith('startup');
		config.autoRefresh = true; listener!();
		expect(vi.getTimerCount()).toBe(1);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(service.refreshDue).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(1);
		config.enabled = false; listener!();
		expect(vi.getTimerCount()).toBe(0);
		config.enabled = true; listener!();
		schedule.dispose();
		expect(off).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(120_000);
		expect(service.refreshDue).toHaveBeenCalledTimes(1);
	} finally { schedule.dispose(); vi.useRealTimers(); }
});
