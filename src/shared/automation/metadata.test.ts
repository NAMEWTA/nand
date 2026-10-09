import { describe, expect, it } from 'vitest';
import { isDefinition } from './metadata';

const definition = (channels: unknown[]) => ({
	id: 'a', name: 'Test', enabled: true, deviceId: 'device', revision: 1,
	schedule: { kind: 'once', at: 1000 }, action: { kind: 'notify', body: 'hello' },
	channels, notifyOn: 'always', graceMinutes: 720, createdAt: 0, updatedAt: 0,
});

describe('automation definitions', () => {
	it('accept the in-app and system channels', () => {
		const value = definition(['in-app', 'system']);
		expect(isDefinition(value)).toBe(true);
		expect(value.channels).toEqual(['in-app', 'system']);
	});

	it('reject unknown channels', () => {
		expect(isDefinition(definition(['in-app', 'pager']))).toBe(false);
		expect(isDefinition(definition(['email']))).toBe(false);
	});
});
