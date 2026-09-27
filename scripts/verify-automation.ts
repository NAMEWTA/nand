import { DashboardAutomationSource } from '../src/dashboard-view/persist/automation';
import { DEFAULT_SETTINGS } from '../src/dashboard-view/types';
import { automationArgs, RESUME_FLAGS } from '../src/terminal-agent/launch/automation-runtime';
import { AUTOMATION_AGENTS } from '../src/terminal-agent/launch/automation-catalog';
import type { AgentId } from '../src/terminal-agent/launch/types';
import { parseNativeSession } from '../src/terminal-agent/sessions/automation-scan';
import { PtyClient } from '../src/terminal-agent/server/pty-client';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { App } from 'obsidian';
import { AutomationService } from '../src/automation/service';
import { JsonStore } from '../src/shared/json-store';
import { NotificationService } from '../src/notifications/service';
import { latestOccurrence, nextOccurrence, validateSchedule } from '../src/automation/schedule';
import { readTaskMeta, taskMetaSuffix } from '../src/shared/automation/metadata';
import { patchReminders, readReminders } from '../src/contacts/reminders';
import { parse, serialize } from '../src/dashboard-view/parser';
import type {
	AgentRunHandle,
	AgentRuntimePort,
	AutomationDefinition,
	AutomationSourcePort,
} from '../src/shared/automation/types';
import { mergeNativeHooks } from '../src/terminal-agent/launch/automation-hooks';

function memory() {
	const files = new Map<string, string>();
	let failing = false;
	const app = {
		vault: {
			adapter: {
				exists: async (p: string) => files.has(p),
				mkdir: async (p: string) => {
					files.set(p, '');
				},
				read: async (p: string) => {
					if (!files.has(p)) throw new Error('missing');
					return files.get(p)!;
				},
				write: async (p: string, text: string) => {
					if (failing) throw new Error('disk full');
					files.set(p, text);
				},
				rename: async (from: string, to: string) => {
					if (files.has(to)) throw new Error('Destination file already exists!');
					files.set(to, files.get(from)!);
					files.delete(from);
				},
			},
		},
		workspace: { containerEl: { win: {} } },
	} as unknown as App;
	return {
		app,
		files,
		fail: (value = true) => {
			failing = value;
		},
	};
}
function definition(patch: Partial<AutomationDefinition> = {}): AutomationDefinition {
	return {
		id: 'a',
		name: 'Test',
		enabled: true,
		deviceId: 'device',
		revision: 1,
		schedule: { kind: 'once', at: 1000 },
		action: { kind: 'notify', body: 'hello' },
		channels: ['in-app'],
		notifyOn: 'always',
		graceMinutes: 720,
		createdAt: 0,
		updatedAt: 0,
		...patch,
	};
}
function fixture(agent?: AgentRuntimePort) {
	const m = memory();
	const effects: string[] = [];
	const notified: string[] = [];
	const source: AutomationSourcePort = {
		list: async () => [],
		save: async () => {},
		remove: async () => {},
		open: async () => {},
		createTask: async (_, id) => {
			effects.push(id);
		},
	};
	const make = () =>
		new AutomationService(
			m.app,
			'.nand/automation/test.json',
			'device',
			source,
			() => agent,
			async (run) => {
				notified.push(run.id);
			},
		);
	return { ...m, source, effects, notified, make };
}

test('manual, once, cron and supported RRULE honor start times and reject unsupported rules', () => {
	assert.equal(latestOccurrence({ kind: 'manual' }, Date.now()), null);
	assert.equal(latestOccurrence({ kind: 'once', at: 100 }, 99), null);
	assert.equal(latestOccurrence({ kind: 'once', at: 100 }, 100), 100);
	const at = new Date(2026, 8, 28, 9).getTime();
	assert.equal(latestOccurrence({ kind: 'recurring', expression: '0 9 * * MON-FRI', start: at }, at + 1000), at);
	assert.equal(
		nextOccurrence({ kind: 'recurring', expression: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0', start: at }, at),
		new Date(2026, 8, 29, 9).getTime(),
	);
	for (const expression of ['* *', '0 0 31 2 *', 'FREQ=DAILY;INTERVAL=3', 'FREQ=HOURLY;COUNT=2', '0/100 * * * *'])
		assert.throws(() => validateSchedule({ kind: 'recurring', expression, start: 0 }));
});

test('daily recurrence remains at local 9am through daylight-saving changes', () => {
	const before = new Date(2026, 2, 7, 9).getTime();
	for (const expression of ['0 9 * * *', 'FREQ=DAILY;BYHOUR=9']) {
		const spec = { kind: 'recurring' as const, expression, start: before };
		const next = nextOccurrence(spec, before)!;
		assert.equal(next, new Date(2026, 2, 8, 9).getTime());
		assert.equal(latestOccurrence(spec, next + 60_000), next);
	}
});

test('a due occurrence executes once across concurrent ticks, leaf independence and restart', async () => {
	const f = fixture(),
		service = f.make();
	await service.load();
	await service.save(definition());
	await Promise.all([service.tick(2000), service.tick(2000), service.tick(2000)]);
	assert.equal(service.state.runs.length, 1);
	assert.equal(f.notified.length, 1);
	const restarted = f.make();
	await restarted.load();
	await restarted.tick(3000);
	assert.equal(restarted.state.runs.length, 1);
});

test('late occurrences are skipped, foreign devices never execute, recent missed occurrence alone runs', async () => {
	const f = fixture(),
		service = f.make();
	await service.load();
	await service.save(definition({ graceMinutes: 0 }));
	await service.tick(121001);
	assert.equal(service.state.runs[0]?.status, 'skipped');
	await service.save(definition({ id: 'foreign', deviceId: 'elsewhere' }));
	await service.tick(121001);
	assert.equal(service.state.runs.length, 1);
	await service.save(
		definition({
			id: 'hourly',
			schedule: { kind: 'recurring', expression: '0 * * * *', start: new Date(2026, 8, 20).getTime() },
		}),
	);
	await service.tick(new Date(2026, 8, 28, 10, 2).getTime());
	assert.equal(service.state.runs.filter((r) => r.automationId === 'hourly').length, 1);
});

test('active agents do not overlap; a slow agent startup does not hold reminders', async () => {
	let launch!: (handle: AgentRunHandle) => void;
	let finish!: (result: Awaited<AgentRunHandle['completion']>) => void;
	const agent: AgentRuntimePort = {
		listAgents: () => [],
		listSessions: async () => [],
		open: async () => {},
		stop: async () => {},
		start: () =>
			new Promise((resolve) => {
				launch = resolve;
			}),
	};
	const f = fixture(agent),
		service = f.make();
	await service.load();
	const d = definition({
		action: { kind: 'agent', agentId: 'codex', cwd: '/vault', prompt: 'test', sessionMode: 'fresh' },
	});
	await service.save(d);
	await service.save(definition({ id: 'reminder' }));
	const tick = service.tick(2000);
	for (let i = 0; i < 50; i++) await Promise.resolve();
	assert.equal(service.state.runs.find((r) => r.automationId === 'reminder')?.status, 'succeeded');
	launch({
		terminalId: 't',
		completion: new Promise((resolve) => {
			finish = resolve;
		}),
	});
	await tick;
	await service.run(d);
	assert.equal(service.state.runs.filter((r) => r.automationId === d.id).length, 1);
	await service.stop(service.state.runs.find((r) => r.automationId === d.id)!);
	finish({ status: 'succeeded', message: 'late completion' });
	await Promise.resolve();
	assert.equal(service.state.runs.find((r) => r.automationId === d.id)?.status, 'cancelled');
});

test('failure committing pending state prevents external task creation', async () => {
	const f = fixture(),
		service = f.make();
	await service.load();
	const d = definition({ action: { kind: 'create-task', path: 'Board.md', cardId: 'c', text: 'todo' } });
	await service.save(d);
	f.fail();
	await assert.rejects(service.run(d));
	assert.equal(f.effects.length, 0);
});

test('restart marks unconfirmed runs interrupted rather than executing them again', async () => {
	const agent: AgentRuntimePort = {
		listAgents: () => [],
		listSessions: async () => [],
		open: async () => {},
		stop: async () => {},
		start: async () => ({ terminalId: 't', completion: new Promise(() => {}) }),
	};
	const f = fixture(agent),
		service = f.make();
	await service.load();
	await service.save(
		definition({
			action: { kind: 'agent', agentId: 'codex', cwd: '/vault', prompt: 'test', sessionMode: 'fresh' },
		}),
	);
	await service.tick(2000);
	const next = f.make();
	await next.load();
	await next.tick(3000);
	assert.equal(next.state.runs.length, 1);
	assert.equal(next.state.runs[0]?.status, 'interrupted');
});

test('corrupt primary recovers the backup and supports subsequent saves without losing corrupt evidence', async () => {
	const m = memory();
	const check = (v: unknown): v is { n: number } =>
		!!v && typeof v === 'object' && typeof (v as { n: number }).n === 'number';
	const store = new JsonStore(m.app, '.nand/state.json', check);
	await store.load({ n: 0 });
	await store.save({ n: 1 });
	await store.save({ n: 2 });
	m.files.set('.nand/state.json', 'broken');
	const recovered = new JsonStore(m.app, '.nand/state.json', check);
	assert.deepEqual(await recovered.load({ n: 0 }), { n: 1 });
	await recovered.save({ n: 3 });
	assert.equal(m.files.get('.nand/state.json.corrupt'), 'broken');
	assert.equal(JSON.parse(m.files.get('.nand/state.json')!).n, 3);
});

test('notification deliveries are idempotent across concurrent calls and restart', async () => {
	const m = memory();
	const service = new NotificationService(m.app, '.nand/notifications.json', async () => {});
	await service.load();
	const request = { id: 'run', title: 'title', body: 'body', channels: ['in-app', 'email'] as const };
	await Promise.all([
		service.send({ ...request, channels: [...request.channels] }),
		service.send({ ...request, channels: [...request.channels] }),
	]);
	assert.equal(service.records.length, 1);
	assert.equal(service.records[0]?.deliveries['in-app'], 'sent');
	assert.equal(service.records[0]?.deliveries.email, 'failed');
	const reloaded = new NotificationService(m.app, '.nand/notifications.json', async () => {});
	await reloaded.load();
	await reloaded.send({ ...request, channels: [...request.channels] });
	assert.equal(reloaded.records.length, 1);
});

test('task identities and automation metadata survive nested task serialization', () => {
	const d = definition();
	const suffix = taskMetaSuffix({ id: 'child', automation: d, runId: 'run' });
	const raw = `# Board\n\n## Column\n\n### Tasks\n\n- [ ] Parent\n  - [ ] Child${suffix}\n`;
	const output = serialize(parse(raw));
	const child = output.split('\n').find((line) => line.includes('Child'))!;
	assert.equal(readTaskMeta(child).id, 'child');
	assert.equal(readTaskMeta(child).automation?.id, d.id);
	assert.equal(readTaskMeta(child).runId, 'run');
});

test('archive reminders preserve note text and malformed regions refuse edits', () => {
	const raw = '---\nname: Ada\n---\n\nPersonal notes\n';
	const d = definition();
	const next = patchReminders(raw, d);
	assert.ok(next.startsWith(raw));
	assert.equal(readReminders(next)[0]?.id, d.id);
	assert.equal(readReminders(patchReminders(next, d, true)).length, 0);
	assert.throws(() => patchReminders('<!-- nand:reminders -->\nbroken', d));
});

test('native hook installation preserves unrelated hooks and remains idempotent', () => {
	const original = { theme: 'dark', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo existing' }] }] } };
	const next = mergeNativeHooks(original, '/tmp/nand-automation-hook.cjs', ['Stop', 'SessionStart']);
	assert.equal(next.theme, 'dark');
	assert.deepEqual(mergeNativeHooks(next, '/tmp/nand-automation-hook.cjs', ['Stop', 'SessionStart']), next);
	assert.ok(JSON.stringify(next).includes('echo existing'));
	assert.throws(() => mergeNativeHooks({ hooks: 'invalid' }, '', ['Stop']));
});

test('all CLI prompt transports preserve text and the native resume flags stay explicit', () => {
	const prompt = '你好\n$(not-a-shell) --flag';
	for (const [id, config] of Object.entries(AUTOMATION_AGENTS)) {
		const result = automationArgs(id as AgentId, prompt, []);
		assert.equal(result.paste, config.mode === 'stdin-after-start', id);
		if (!result.paste) assert.equal(result.args[result.args.length - 1], prompt, id);
	}
	assert.equal(Object.keys(RESUME_FLAGS).length, 17);
	const session = {
		agentId: 'antigravity',
		sessionId: 'historic',
		title: '',
		cwd: '/vault',
		accountKey: '{}',
		modifiedAtMs: 0,
	};
	assert.deepEqual(automationArgs('antigravity', prompt, [], session).args.slice(0, 2), [
		'--conversation',
		'historic',
	]);
	assert.equal(
		automationArgs('copilot', prompt, [], { ...session, agentId: 'copilot' }).args[0],
		'--resume=historic',
	);
	assert.throws(() => automationArgs('pi', prompt, [], { ...session, agentId: 'pi' }));
	assert.equal(
		automationArgs('pi', prompt, [], { ...session, agentId: 'pi', transcriptPath: '/sessions/history.jsonl' })
			.args[1],
		'/sessions/history.jsonl',
	);
});

test('native session discovery requires exact metadata and ignores subagent sessions', () => {
	const raw = JSON.stringify({ type: 'session', id: 'original', cwd: '/vault', title: 'old work' });
	assert.equal(parseNativeSession('pi', raw, '/history.jsonl', 10, 'linux')?.sessionId, 'original');
	assert.equal(
		parseNativeSession(
			'pi',
			JSON.stringify({ type: 'session', id: 'child', cwd: '/vault', parentSessionId: 'main' }),
			'/child.jsonl',
			10,
			'linux',
		),
		undefined,
	);
	assert.equal(
		parseNativeSession(
			'grok',
			JSON.stringify({ info: { id: 'grok-id', cwd: '/vault' } }),
			'/summary.json',
			10,
			'linux',
		)?.cwd,
		'/vault',
	);
	assert.equal(
		parseNativeSession('pi', JSON.stringify({ type: 'session', id: 'missing-cwd' }), '/unknown.jsonl', 10, 'linux'),
		undefined,
	);
});

test('PTY listeners attach synchronously before immediate exit and legacy status stays unverified', async () => {
	const previous = globalThis.window;
	(globalThis as unknown as { window: unknown }).window = { setTimeout, clearTimeout };
	try {
		class ImmediatePty extends PtyClient {
			constructor(private reliable: boolean) {
				super();
			}
			protected override send(type: string): void {
				if (type !== 'init') return;
				this.handleMessage({
					module: 'pty',
					type: 'init_complete',
					session_id: 's',
					success: true,
					exit_status: this.reliable,
				});
				this.handleMessage({ module: 'pty', type: 'exit', session_id: 's', code: 7 });
			}
		}
		for (const reliable of [false, true]) {
			const client = new ImmediatePty(reliable);
			let code: number | undefined;
			await client.init({}, (id) => {
				client.onSessionExit(id, (value) => {
					code = value;
				});
			});
			assert.equal(code, reliable ? 7 : -1);
			client.destroy();
		}
	} finally {
		(globalThis as unknown as { window: unknown }).window = previous;
	}
});

test('editing the action alone does not replay an already consumed one-time occurrence', async () => {
	const f = fixture(),
		service = f.make();
	await service.load();
	await service.save(definition());
	await service.tick(2000);
	await service.save({ ...service.definitions[0]!, action: { kind: 'notify', body: 'edited content' } });
	await service.tick(3000);
	assert.equal(service.state.runs.length, 1);
	assert.equal(f.notified.length, 1);
});

test('completed delivery is not replayed even after notification retention has trimmed its record', async () => {
	const f = fixture(),
		service = f.make();
	await service.load();
	await service.save(definition());
	await service.tick(2000);
	assert.equal(service.state.runs[0]?.notificationAttempted, true);
	const reloaded = f.make();
	await reloaded.load();
	assert.equal(f.notified.length, 1);
});

test('dashboard source migrates stable ownership, suppresses completed tasks and creates each run once', async () => {
	let raw = '# Board\n\n## Column\n\n### Tasks\n\n- [ ] Parent\n  - [ ] Nested ⏰ 2026-09-27 09:00\n';
	const file = { path: 'Board.md', basename: 'Board' };
	const settings = { ...structuredClone(DEFAULT_SETTINGS), dashboardFile: 'Board', workspaceFiles: [] };
	const app = { vault: { getFileByPath: (p: string) => p === file.path ? file : null, read: async () => raw, process: async (_: unknown, edit: (text: string) => string) => { raw = edit(raw); return raw; } }, workspace: { getLeavesOfType: () => [] } } as unknown as App;
	const source = new DashboardAutomationSource(app, () => settings, 'first-device', async () => {});
	const [original] = await source.list(); assert.ok(original?.source?.id); assert.equal(original.deviceId, 'first-device');
	const other = new DashboardAutomationSource(app, () => settings, 'other-device', async () => {});
	assert.equal((await other.list())[0]?.deviceId, 'first-device');
	raw = raw.replace('- [ ] Nested', '- [x] Nested'); assert.equal((await source.list()).length, 0);
	const [target] = await source.targets(); assert.ok(target);
	const action = { kind: 'create-task' as const, ...target, text: 'Scheduled todo' };
	await source.createTask(action, 'one-run'); await source.createTask(action, 'one-run');
	assert.equal(raw.split('Scheduled todo').length - 1, 1);
	assert.equal(readTaskMeta(raw.split('\n').find(line => line.includes('Scheduled todo'))!).runId, 'one-run');
});

test('failed state commits are invisible and retry preserves scheduler cursors', async () => {
	const f = fixture(), service = f.make();
	await service.load();
	await service.save(definition());
	f.fail();
	await assert.rejects(service.save(definition({ name: 'lost edit' })));
	assert.equal(service.definitions[0]?.name, 'Test');
	await assert.rejects(service.run(service.definitions[0]!, 'scheduled', 1000, 1000));
	assert.equal(service.state.runs.length, 0);
	assert.deepEqual(service.state.cursors, {});
	f.fail(false);
	await service.tick(1000);
	assert.equal(service.state.runs[0]?.status, 'succeeded');
	assert.equal(f.notified.length, 1);
});

test('edits keep list order and deletion retains run snapshots', async () => {
	const f = fixture(), service = f.make();
	await service.load();
	await service.save(definition());
	await service.save(definition({ id: 'b' }));
	await service.save(definition({ name: 'edited' }));
	assert.deepEqual(service.definitions.map((d) => d.id), ['a', 'b']);
	await service.run(service.definitions[0]!);
	await service.remove(service.definitions[0]!);
	assert.equal(service.state.runs[0]?.definition?.name, 'edited');
});

test('clearing read notifications preserves delivery receipts across restart', async () => {
	const m = memory();
	const request = { id: 'once', title: 'title', body: 'body', channels: ['in-app' as const] };
	const first = new NotificationService(m.app, 'inbox.json', async () => {});
	await first.load();
	m.fail();
	await assert.rejects(first.send(request));
	assert.equal(first.records.length, 0);
	m.fail(false);
	await first.send(request);
	await Promise.all([first.markRead(), first.clearRead()]);
	assert.equal(first.records.length, 0);
	const second = new NotificationService(m.app, 'inbox.json', async () => {});
	await second.load();
	await second.send(request);
	assert.equal(second.records.length, 0);
});

test('partial primary write recovers last valid data and a later write can succeed', async () => {
	const m = memory();
	const validate = (v: unknown): v is { revision: number } => !!v && typeof v === 'object' && typeof (v as { revision?: unknown }).revision === 'number';
	const store = new JsonStore(m.app, 'store.json', validate);
	await store.load({ revision: 0 });
	await store.save({ revision: 1 });
	await store.save({ revision: 2 });
	m.files.set('store.json', '{"revision":');
	const restarted = new JsonStore(m.app, 'store.json', validate);
	assert.deepEqual(await restarted.load({ revision: 0 }), { revision: 1 });
	await restarted.save({ revision: 3 });
	assert.equal(JSON.parse(m.files.get('store.json')!).revision, 3);
	assert.equal(m.files.get('store.json.corrupt'), '{"revision":');
});

test('failed inbox load cannot overwrite unreadable receipts and a successful retry emits state', async () => {
	const m = memory();
	m.files.set('inbox.json', '{broken');
	const inbox = new NotificationService(m.app, 'inbox.json', async () => {});
	await assert.rejects(inbox.load());
	await assert.rejects(inbox.clearRead());
	await assert.rejects(inbox.markRead());
	assert.equal(m.files.get('inbox.json'), '{broken');
	let changed = 0;
	inbox.subscribe(() => { changed++; });
	m.files.set('inbox.json', JSON.stringify({ records: [], receipts: {} }));
	await inbox.load();
	assert.equal(changed, 1);
	await inbox.send({ id: 'retry', title: 'test', body: 'test', channels: ['in-app'] });
	assert.equal(inbox.unread, 1);
});
