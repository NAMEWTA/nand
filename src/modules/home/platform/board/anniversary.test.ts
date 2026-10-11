import { expect, test, vi } from 'vitest';
import type { App } from 'obsidian';
import { normalizeDashboardSettings } from '../../core/board/settings';
import { anniversaryDateThisYear } from '../../core/anniversaries/calendar';
import { lunarLookup } from '../../core/anniversaries/lunar-calendar';
import { DashboardAutomationSource } from './automation';

test('annual reminders use the widget lunar date, preserve original dates and reschedule at Lunar New Year', async () => {
	vi.useFakeTimers({ now: new Date(2021, 0, 1), toFake: ['Date'] });
	try {
		const settings = normalizeDashboardSettings({ dashboardFile: 'Board', workspaceFiles: ['Board'], countdownEnabled: false, anniversaryEnabled: true, anniversaries: [
			{ id: 'winter', label: 'Winter', startDate: '2020-01-01T12:34:56', precision: 'hours', calendar: 'lunar', annualReminder: true },
			{ id: 'solar', label: 'Solar', startDate: '2020-02-29', precision: 'days', annualReminder: true },
			{ id: 'invalid', label: 'Invalid', startDate: '2025-02-30', precision: 'days', calendar: 'lunar', annualReminder: true },
		] });
		const app = { vault: { getFileByPath: () => null } } as unknown as App;
		const save = vi.fn(async () => {});
		const source = new DashboardAutomationSource(app, () => settings, 'device', save, () => true);
		const rows = await source.list();
		expect(rows).toHaveLength(2);
		const expected = anniversaryDateThisYear(new Date(2020, 0, 1, 12, 34, 56), new Date(), 'lunar', lunarLookup).getTime();
		expect(rows[0]).toMatchObject({ id: 'widget:winter', deviceId: 'device', revision: expected, schedule: { kind: 'once', at: new Date(2021, 0, 19).getTime() }, action: { kind: 'notify' } });
		expect(rows[1]!.schedule).toEqual({ kind: 'once', at: new Date(2021, 2, 1).getTime() });
		expect(save).toHaveBeenCalledTimes(1);
		await source.list();
		expect(save).toHaveBeenCalledTimes(1);
		vi.setSystemTime(new Date(2021, 1, 12));
		expect((await source.list())[0]!.schedule).toEqual({ kind: 'once', at: new Date(2022, 0, 9).getTime() });
		expect(settings.anniversaries[0]).toMatchObject({ startDate: '2020-01-01T12:34:56', precision: 'hours', calendar: 'lunar' });
	} finally { vi.useRealTimers(); }
});
