import { pathToFileURL } from 'node:url';
const repo = process.env.NAND_REPO || process.cwd();
import assert from 'node:assert/strict';
const { AutomationService } = await import(
	new URL('./src/core/automations/service.ts', pathToFileURL(repo + '/')).href
);
const { nextOccurrence, latestOccurrence } = await import(
	new URL('./src/core/automations/schedule.ts', pathToFileURL(repo + '/')).href
);
const files = new Map();
const storage = {
	exists: async (p) => files.has(p),
	read: async (p) => files.get(p),
	write: async (p, t) => {
		files.set(p, t);
	},
	mkdir: async (p) => {
		files.set(p, '');
	},
};
const sources = {
	list: async () => [],
	save: async () => {},
	remove: async () => {},
	open: async () => {},
	createTask: async () => {
		throw Error('No file actions allowed in probe');
	},
};
const deliveries = [];
const service = new AutomationService(
	storage,
	'fixture/automation.json',
	'fixture-device',
	sources,
	() => undefined,
	async (r) => {
		deliveries.push(r.scheduledFor);
	},
);
await service.load();
const schedule = { kind: 'recurring', expression: '0 * * * *', start: Date.parse('2026-10-31T00:00:00-04:00') };
await service.save({
	id: 'hourly',
	name: 'Fixture hourly reminder',
	enabled: true,
	deviceId: 'fixture-device',
	revision: 1,
	schedule,
	action: { kind: 'notify', body: 'No external delivery' },
	channels: ['in-app'],
	notifyOn: 'always',
	graceMinutes: 720,
	createdAt: 0,
	updatedAt: 0,
});
const times = [
	'2026-11-01T01:00:00-04:00',
	'2026-11-01T01:00:00-05:00',
	'2026-11-01T01:15:00-05:00',
	'2026-11-01T01:59:00-05:00',
	'2026-11-01T02:00:00-05:00',
];
const steps = [];
for (const time of times) {
	const now = Date.parse(time);
	await service.tick(now);
	steps.push({
		now: new Date(now).toString(),
		latest: new Date(latestOccurrence(schedule, now)).toString(),
		next: new Date(nextOccurrence(schedule, now)).toString(),
		runCount: service.state.runs.length,
		deliveries: deliveries.map((n) => new Date(n).toISOString()),
	});
}
assert.equal(service.state.runs.length, 3);
assert.deepEqual(deliveries, [Date.parse(times[0]), Date.parse(times[1]), Date.parse(times[4])]);
for (const expression of ['0 * * * *', '30 * * * *', 'FREQ=HOURLY;BYMINUTE=30']) {
	const rule = { ...schedule, expression };
	for (let now = Date.parse('2026-11-01T04:59:30Z'); now < Date.parse('2026-11-01T08:00:00Z'); now += 30000) {
		assert.ok(nextOccurrence(rule, now) > now, expression);
		assert.ok(latestOccurrence(rule, now) <= now, expression);
	}
}
console.log('Automation DST: both repeated hours execute once; next/latest remain monotonic');

// Half-hour DST rollback and spring-forward use epoch ordering as well.
process.env.TZ = 'Australia/Lord_Howe';
for (const window of [
	['2026-04-04T14:00:00Z', '2026-04-04T17:00:00Z'],
	['2026-10-03T14:00:00Z', '2026-10-03T17:00:00Z'],
]) {
	for (const expression of ['0 * * * *', '30 * * * *', 'FREQ=HOURLY;BYMINUTE=30']) {
		const rule = { ...schedule, expression, start: Date.parse('2026-01-01T00:00:00Z') };
		for (let now = Date.parse(window[0]); now < Date.parse(window[1]); now += 30000) {
			assert.ok(nextOccurrence(rule, now) > now);
			assert.ok(latestOccurrence(rule, now) <= now);
		}
	}
}
console.log('Automation DST: Lord Howe half-hour transitions remain monotonic');
