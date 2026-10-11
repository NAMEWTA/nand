import { expect, test } from 'vitest';
import { NewsHeatSchedule } from './heat-schedule';

const HOUR = 3_600_000, MINUTE = 60_000;
test('only a continuously observed hour closes; activation, suspension and disable leave gaps', async () => {
	let now = HOUR / 2, callback: (() => void) | undefined;
	const observed: number[] = [];
	const schedule = new NewsHeatSchedule(async hour => { observed.push(hour); }, { set: work => { callback = work; return 1; }, clear: () => { callback = undefined; } }, () => now);
	const tick = async (at: number): Promise<void> => { now = at; const work = callback; callback = undefined; work?.(); await Promise.resolve(); await Promise.resolve(); };
	schedule.update(true);
	for (let at = now + MINUTE; at <= 2 * HOUR; at += MINUTE) await tick(at);
	expect(observed).toEqual([2 * HOUR]);
	await tick(5 * HOUR + HOUR / 2);
	for (let at = now + MINUTE; at <= 7 * HOUR; at += MINUTE) await tick(at);
	expect(observed).toEqual([2 * HOUR, 7 * HOUR]);
	schedule.update(false); expect(callback).toBeUndefined();
	now = 10 * HOUR + HOUR / 2; schedule.update(true);
	for (let at = now + MINUTE; at <= 12 * HOUR; at += MINUTE) await tick(at);
	expect(observed).toEqual([2 * HOUR, 7 * HOUR, 12 * HOUR]);
	schedule.dispose(); expect(callback).toBeUndefined();
});

test('disposing during a pending snapshot cannot install another timer', async () => {
	let now = 0, callback: (() => void) | undefined, release!: () => void;
	const schedule = new NewsHeatSchedule(() => new Promise<void>(resolve => { release = resolve; }), { set: work => { callback = work; return 1; }, clear: () => { callback = undefined; } }, () => now);
	schedule.update(true);
	for (now = MINUTE; now <= HOUR; now += MINUTE) { const work = callback; callback = undefined; work?.(); await Promise.resolve(); await Promise.resolve(); }
	expect(release).toBeDefined();
	schedule.dispose(); release(); await Promise.resolve(); await Promise.resolve();
	expect(callback).toBeUndefined();
});
