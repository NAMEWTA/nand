import { expect, test } from 'vitest';
import { DEFAULT_DASHBOARD_SETTINGS } from './types/model';
import { widgetChoices } from './widget-choices';
import { retainSkillAssignments, skillGroup } from '../skills/groups';
test('instance choices preserve distinct countdown and anniversary identities after removal and re-add', () => {
	const settings = structuredClone(DEFAULT_DASHBOARD_SETTINGS);
	settings.countdowns = ['one', 'two'].map((id) => ({
		id,
		label: id,
		targetDate: '2030-01-01',
		displayMode: 'days',
		reminderDays: 0,
	}));
	settings.anniversaries = ['first', 'second'].map((id) => ({
		id,
		label: id,
		startDate: '2020-01-01',
		precision: 'days',
		annualReminder: true,
	}));
	const choices = widgetChoices(settings, ['countdown', 'anniversary', 'pomodoro']);
	expect(choices.map((c) => [c.kind, c.instanceId])).toEqual([
		['countdown', 'one'],
		['countdown', 'two'],
		['anniversary', 'first'],
		['anniversary', 'second'],
		['pomodoro', 'default'],
	]);
	const members = choices.filter((c) => c.instanceId !== 'two');
	expect(
		choices
			.filter((c) => !members.some((m) => m.kind === c.kind && m.instanceId === c.instanceId))
			.map((c) => c.instanceId),
	).toEqual(['two']);
	expect(widgetChoices({ ...settings, countdowns: [] }, ['countdown'])).toEqual([
		{ key: 'countdown', kind: 'countdown' },
	]);
});
test('deleted and already-orphaned group assignments remain visible in the ungrouped bucket', () => {
	const config = {
		groups: [
			{ id: 'gone', name: 'Gone' },
			{ id: 'keep', name: 'Keep', keywords: 'review' },
		],
		assignments: { review: 'gone', other: 'keep', orphan: 'old' },
	};
	const groups = config.groups.filter((g) => g.id !== 'gone');
	expect(skillGroup('review', { ...config, groups })).toBe('_none');
	expect(retainSkillAssignments(config, groups)).toEqual({ review: '_none', other: 'keep', orphan: '_none' });
	expect(skillGroup('new-review', { ...config, groups })).toBe('keep');
});
