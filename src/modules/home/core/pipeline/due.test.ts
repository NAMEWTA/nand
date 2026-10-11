import { expect, test } from 'vitest';
import { isDefinition } from '../../../../shared/automation/metadata';
import { pipelineDue, pipelineDueFields } from './due';

test('due dates validate actual calendar days and clock values in the existing field format', () => {
	for (const input of ['2026-02-29', '2026-13-01', '2026-10-10 25:00', '2026-10-10 12:61', 'tomorrow']) expect(pipelineDue(input)).toBeUndefined();
	expect(pipelineDue('2028-02-29 12:30')).toEqual({ date: '2028-02-29', time: '12:30', at: new Date(2028, 1, 29, 12, 30).getTime() });
});

test('reminders use scheduler definitions, retain identity/settings and never replace foreign metadata', () => {
	const options = { id: 'test', title: 'Review', deviceId: 'device-a', now: 100 };
	const first = pipelineDueFields({}, '2026-10-11 09:30', true, options);
	expect(isDefinition(first.nandAutomation)).toBe(true);
	const next = pipelineDueFields(first, '2026-10-12', true, { ...options, id: 'new', now: 200 });
	expect(next.nandAutomation).toMatchObject({ id: 'pipeline:test', createdAt: 100, revision: 200, deviceId: 'device-a', schedule: { kind: 'once', at: new Date(2026, 9, 12).getTime() } });
	expect(pipelineDueFields(next, '', false, options)).toEqual({ due: undefined, remind: undefined, nandAutomation: undefined });
	expect(() => pipelineDueFields({ nandAutomation: { unrelated: true } }, '2026-10-12', true, options)).toThrow('home.pipeline.automationConflict');
});
