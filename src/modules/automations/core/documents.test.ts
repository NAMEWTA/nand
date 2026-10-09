import { describe, expect, it } from 'vitest';
import { automationDocuments } from './documents';
import { systemTimeZone } from './schedule';

describe('automation documents', () => {
	it('write recurring schedules without a time zone in the device time zone', () => {
		const [document] = automationDocuments.encode({
			definitions: [{
				id: 'auto-0000-0000-daily', name: 'Daily', enabled: true, deviceId: 'device', revision: 1,
				schedule: { kind: 'recurring', expression: '0 9 * * *', start: Date.UTC(2026, 9, 1) },
				action: { kind: 'notify', body: 'Hello' }, channels: ['in-app'], notifyOn: 'always', graceMinutes: 0, createdAt: 0, updatedAt: 0,
			}],
		});
		expect(document?.properties.timezone).toBe(systemTimeZone());
		expect(systemTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
	});
});
