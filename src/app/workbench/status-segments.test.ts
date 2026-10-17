import { expect, test } from 'vitest';
import type { StatusSegment } from '../contracts/workbench';
import { STATUS_ITEMS, collectStatusSegments, itemShown, segmentGroup, visibleSegments, withItemShown } from './status-segments';

const segment = (id: string, order: number): StatusSegment => ({ id, icon: 'bell', label: id, order });

test('segments are collected from every contribution and ordered, without any workbench leaf', () => {
	const rows = collectStatusSegments([
		{ statusSegments: () => [segment('notifications', 90), segment('sync:repo', 50)] },
		{},
		{ statusSegments: () => [segment('agents-waiting', 10)] },
	]);
	expect(rows.map((row) => row.id)).toEqual(['agents-waiting', 'sync:repo', 'notifications']);
});

test('preferences switch off a whole group, and a missing key means shown', () => {
	expect(segmentGroup('dashboard-save:Boards/a.md')).toBe('dashboard-save');
	expect(segmentGroup('notifications')).toBe('notifications');
	const preferences = { segments: { sync: false, 'agents-running': true } };
	expect(itemShown(preferences, 'sync:one')).toBe(false);
	expect(itemShown(preferences, 'sync')).toBe(false);
	expect(itemShown(preferences, 'agents-running')).toBe(true);
	expect(itemShown(preferences, 'notifications')).toBe(true);
	const rows = [segment('sync:one', 50), segment('sync:two', 51), segment('notifications', 90)];
	expect(visibleSegments(rows, preferences).map((row) => row.id)).toEqual(['notifications']);
});

test('toggling an item writes its group key and keeps the usage preferences', () => {
	const base = { segments: { sync: false }, usageMode: 'compact', usageDisplay: 'remaining' } as const;
	const hidden = withItemShown(base, 'usage', false);
	expect(hidden).toEqual({ segments: { sync: false, usage: false }, usageMode: 'compact', usageDisplay: 'remaining' });
	expect(withItemShown(hidden, 'sync', true).segments).toEqual({ sync: true, usage: false });
	expect(base.segments).toEqual({ sync: false });
});

test('every togglable item is a distinct preference key with a startup dictionary label', () => {
	expect(new Set(STATUS_ITEMS.map((item) => item.id)).size).toBe(STATUS_ITEMS.length);
	expect(STATUS_ITEMS.map((item) => item.id)).toContain('usage');
});
