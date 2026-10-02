import { renderHomeSettings } from '../src/plugin/settings/home';
import type { DashboardSettingTab } from '../src/plugin/settings/settings-tab';
import { AutomationsPanel } from '../src/view/automations/AutomationsPanel';
import { parseHTML } from 'linkedom';
import { h, render } from 'preact';
import { InboxPanel } from '../src/view/notifications/InboxPanel';
import type { NotificationRecord } from '../src/core/notifications/service';
import { createNotificationDelivery } from '../src/platform/obsidian/notifications/delivery';
import { DashboardAutomationSource } from '../src/platform/obsidian/dashboard/automation';
import { DEFAULT_SETTINGS } from '../src/plugin/settings/model';
import { automationArgs, RESUME_FLAGS, TerminalAutomationRuntime } from '../src/plugin/workflows/agent-runtime';
import { AutomationEditor } from '../src/view/automations/editor';
import { AutomationError, automationMessage, automationOutcome } from '../src/shared/automation/errors';
import { normalizeAgentSettings } from '../src/core/agent-launch/defaults';
import { setLanguage, t } from '../src/shared/i18n/index';
import type { AutomationsApi } from '../src/core/automations/api';
import type { TerminalAgentController } from '../src/plugin/modules/terminal/controller';
import { Notice, Setting } from 'obsidian';
import type { StubControl } from './obsidian-stub';
import * as nodeFs from 'node:fs';
import * as nodePath from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { AUTOMATION_AGENTS } from '../src/core/agent-launch/automation-catalog';
import type { AgentId } from '../src/core/agent-launch/types';
import { parseNativeSession } from '../src/platform/desktop/ai-vault/automation-scan';
import { PtyClient } from '../src/platform/terminal-server/pty-client';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { App } from 'obsidian';
import { AutomationService } from '../src/core/automations/service';
import { JsonStore } from '../src/shared/json-store';
import { NotificationService, notificationBody } from '../src/core/notifications/service';
import { latestOccurrence, nextOccurrence, validateSchedule } from '../src/core/automations/schedule';
import { switchAutomationAction } from '../src/core/automations/switch-action';
import { readTaskMeta, taskMetaSuffix } from '../src/shared/automation/metadata';
import { patchReminders, readReminders } from '../src/core/contacts/reminders';
import { parse, serialize } from '../src/core/dashboard/parser/index';
import type {
	AgentRunHandle,
	AgentRuntimePort,
	AutomationDefinition,
	AutomationSourcePort,
} from '../src/shared/automation/types';
import { mergeNativeHooks } from '../src/platform/desktop/agent-hooks/automation-hooks';

test('agent editor uses the same availability set for defaults, controls and save, without replacing stale choices', async () => {
	const settings = Setting as unknown as {
		created: { name: string; desc: string; dropdowns: StubControl[]; buttons: StubControl[] }[];
	};
	const notices = Notice as unknown as { messages: string[] };
	let agents = [
		{ id: 'claude-code', title: 'Claude Code', enabled: true, installed: false, resumable: true },
		{ id: 'codex', title: 'Codex', enabled: true, installed: true, resumable: true },
	];
	const saved: AutomationDefinition[] = [];
	let runtimeAvailable = true;
	const api = {
		deviceId: 'device',
		agent: () => runtimeAvailable ? ({ listAgents: () => agents }) : undefined,
		save: async (value: AutomationDefinition) => {
			saved.push(structuredClone(value));
		},
		tick: async () => {},
	} as unknown as AutomationsApi;
	const inspect = (editor: AutomationEditor) =>
		editor as unknown as { draft: AutomationDefinition; save(): Promise<void> };
	try {
		for (const language of ['zh', 'en', 'zh'] as const) {
			setLanguage(language);
			const editor = new AutomationEditor({} as App, api, async () => [], '/vault');
			const state = inspect(editor);
			assert.equal(state.draft.action.kind === 'agent' && state.draft.action.agentId, 'codex');
			settings.created.length = 0;
			editor.onOpen();
			const row = settings.created.find((row) => row.name === t('automation.agent'))!;
			assert.deepEqual(row.dropdowns[0]!.options, ['', 'codex']);
			assert.equal(row.dropdowns[0]!.value, 'codex');
			state.draft.name = 'Untouched user title';
			if (state.draft.action.kind !== 'agent') throw Error('Expected agent draft');
			state.draft.action.prompt = 'Untouched user prompt';
			await state.save();
			assert.equal(
				saved[saved.length - 1]?.action.kind === 'agent' &&
					(saved[saved.length - 1]!.action as { agentId: string }).agentId,
				'codex',
			);
			const count = saved.length;
			agents[1]!.installed = false;
			await state.save();
			assert.equal(saved.length, count, 'Availability is rechecked after the editor opens');
			assert.equal(notices.messages[notices.messages.length - 1], t('automation.agentSelectionUnavailable'));
			const stale = new AutomationEditor({} as App, api, async () => [], '/vault', undefined, '', state.draft);
			settings.created.length = 0;
			stale.onOpen();
			const staleRow = settings.created.find((row) => row.name === t('automation.agent'))!;
			assert.equal(staleRow.desc, t('automation.agentSelectionUnavailable'));
			assert.equal(staleRow.dropdowns[0]!.value, 'codex');
			assert.ok(staleRow.dropdowns[0]!.labels?.codex?.includes(t('automation.unavailable')));
			await inspect(stale).save();
			assert.equal(saved.length, count);
			assert.deepEqual(
				inspect(stale).draft.action,
				state.draft.action,
				'Invalid editing preserves the selected identity and user input',
			);
			const empty = new AutomationEditor({} as App, api, async () => [], '/vault');
			const emptyState = inspect(empty);
			emptyState.draft.name = 'No CLI';
			if (emptyState.draft.action.kind !== 'agent') throw Error('Expected agent draft');
			assert.equal(emptyState.draft.action.agentId, '');
			emptyState.draft.action.prompt = 'Keep me';
			await emptyState.save();
			assert.equal(saved.length, count);
			agents[1]!.installed = true;
			agents[1]!.enabled = false;
			await state.save();
			assert.equal(saved.length, count, 'Disabled agents cannot be saved');
			agents[1]!.enabled = true;
			runtimeAvailable = false;
			await state.save();
			assert.equal(saved.length, count, 'A disabled terminal module cannot save an agent action');
			runtimeAvailable = true;
			editor.onClose();
			stale.onClose();
			empty.onClose();
		}
	} finally {
		setLanguage('zh');
	}
});

test('runtime preflight orders factual failures before permission and prevents all launch effects on rejection', async () => {
	const root = nodeFs.mkdtempSync(nodePath.join(tmpdir(), 'nand-preflight-'));
	const vault = nodePath.join(root, 'vault');
	const outside = nodePath.join(root, 'outside');
	nodeFs.mkdirSync(vault);
	nodeFs.mkdirSync(outside);
	const cli = nodePath.join(root, 'synthetic-cli');
	nodeFs.writeFileSync(cli, 'synthetic; never executed');
	const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
	Object.defineProperty(globalThis, 'window', {
		value: { require: createRequire(nodePath.join(process.cwd(), 'package.json')) },
		configurable: true,
	});
	const nativeFs = createRequire(nodePath.join(process.cwd(), 'package.json'))('node:fs') as typeof nodeFs;
	const exists = nativeFs.existsSync;
	const pathBefore = process.env.PATH;
	const extensions = ['.COM', '.EXE', '.BAT', '.CMD', '.PS1', ...(process.env.PATHEXT ?? '').split(';').filter(Boolean)];
	const grokNames = new Set(['grok', ...extensions.map((extension) => `grok${extension}`)].map((name) => name.toLowerCase()));
	// Exercise installed wrappers without depending on the developer's CLI setup.
	for (const name of process.platform === 'win32' ? [...grokNames].map((name) => name.toUpperCase()) : ['grok'])
		nodeFs.writeFileSync(nodePath.join(root, name), 'synthetic; never executed');
	process.env.PATH = [root, pathBefore ?? ''].filter(Boolean).join(nodePath.delimiter);
	nativeFs.existsSync = (file: nodeFs.PathLike) =>
		grokNames.has(nodePath.basename(String(file)).toLowerCase()) ? false : exists(file);
	const settings = normalizeAgentSettings({});
	settings.globalPermissionMode = 'yolo';
	settings.yoloAcknowledged = false;
	settings.agents.grok.enabled = true;
	settings.agents.grok.cliPath = nodePath.join(root, 'absent');
	let launches = 0,
		preparations = 0,
		writes = 0;
	const host = {
		settings: { agentSettings: settings },
		manifest: { dir: '.obsidian/plugins/nand' },
		app: {
			loadLocalStorage: () => '11111111-1111-4111-8111-111111111111',
			workspace: { containerEl: { win: {} } },
			vault: { adapter: { exists: async () => false, getBasePath: () => vault } },
		},
		getTerminalService: async () => ({
			createTerminal: async () => {
				launches++;
				return {
					id: 'synthetic',
					write: () => {
						writes++;
					},
				};
			},
		}),
	} as unknown as TerminalAgentController;
	const runtime = new TerminalAutomationRuntime(host);
	const internals = runtime as unknown as { hooks: { prepare(): Promise<unknown>; dispose(): void } };
	internals.hooks = {
		prepare: async () => {
			preparations++;
			return { env: {}, close() {} };
		},
		dispose() {},
	};
	const action: Extract<import('../src/shared/automation/types').AutomationAction, { kind: 'agent' }> = {
		kind: 'agent',
		agentId: 'grok',
		cwd: nodePath.join(vault, 'missing'),
		prompt: 'synthetic prompt',
		sessionMode: 'fresh',
	};
	const run = {
		id: 'synthetic-run',
		title: 'Synthetic',
		trigger: 'scheduled',
	} as import('../src/shared/automation/types').AutomationRun;
	const rejects = async (code: string) => {
		await assert.rejects(
			runtime.start(action, run),
			(error: unknown) =>
				error instanceof AutomationError && error.code === code && error.message === t(`automation.${code}`),
		);
		assert.equal(launches, 0);
		assert.equal(preparations, 0);
		assert.equal(writes, 0);
	};
	try {
		for (const language of ['zh', 'en'] as const) {
			setLanguage(language);
			settings.agents.grok.enabled = false;
			await rejects('agentDisabled');
			settings.agents.grok.enabled = true;
			settings.agents.grok.cliPath = nodePath.join(root, 'absent');
			await rejects('cliMissing');
			settings.agents.grok.cliPath = cli;
			action.cwd = nodePath.join(vault, 'missing');
			await rejects('cwdInvalid');
			action.cwd = outside;
			await rejects('cwdInvalid');
			if (process.platform !== 'win32') {
				const link = nodePath.join(vault, `escape-${language}`);
				nodeFs.symlinkSync(outside, link, 'dir');
				action.cwd = link;
				await rejects('cwdInvalid');
			}
			action.cwd = vault;
			settings.yoloAcknowledged = false;
			await rejects('permissionRequired');
			settings.yoloAcknowledged = true;
			action.sessionMode = 'specific';
			await rejects('sessionMissing');
			action.session = {
				agentId: 'grok',
				cwd: vault,
				sessionId: 'gone',
				title: 'gone',
				accountKey: '{invalid',
				modifiedAtMs: 0,
			};
			await rejects('sessionMissing');
			action.session.accountKey = '{}';
			action.session.transcriptPath = nodePath.join(root, 'missing-transcript');
			await rejects('sessionMissing');
			action.session.transcriptPath = undefined;
			runtime.listSessions = async () => [];
			await rejects('sessionMissing');
			action.sessionMode = 'fresh';
			action.session = undefined;
		}
		const handle = await runtime.start(action, run);
		assert.equal(handle.terminalId, 'synthetic');
		assert.equal(launches, 1);
		assert.equal(preparations, 1);
		action.sessionMode = 'specific';
		action.session = { agentId: 'grok', cwd: vault, sessionId: 'present', title: 'Present', accountKey: '{}', modifiedAtMs: 0 };
		runtime.listSessions = async () => [action.session!];
		assert.equal((await runtime.start(action, run)).terminalId, 'synthetic');
		assert.equal(launches, 2); assert.equal(preparations, 2);
	} finally {
		runtime.dispose();
		setLanguage('zh');
		nativeFs.existsSync = exists;
		if (pathBefore === undefined) delete process.env.PATH;
		else process.env.PATH = pathBefore;
		if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
		else Reflect.deleteProperty(globalThis, 'window');
		nodeFs.rmSync(root, { recursive: true, force: true });
	}
});

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
			m.app.vault.adapter,
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

test('Home execution gate survives restart, keeps history and cursors, and resumes only unhandled occurrences', async () => {
	const f = fixture();
	let service = f.make(); await service.load();
	await service.save(definition()); await service.tick(1000);
	await service.save(definition({ id: 'later', schedule: { kind: 'once', at: 2000 } }));
	await service.save(definition({ id: 'expired', schedule: { kind: 'once', at: -500000 }, graceMinutes: 0 }));
	await service.save(definition({ id: 'foreign', deviceId: 'another-device' }));
	const before = structuredClone(service.state), deliveries = f.notified.length;
	await service.setExecutionEnabled(false);
	await service.tick(3000);
	await assert.rejects(service.run(definition()), /./);
	await assert.rejects(service.save(definition()), /./);
	await assert.rejects(service.remove(definition()), /./);
	await assert.rejects(service.clearHistory(), /./);
	assert.deepEqual(JSON.parse(JSON.stringify(service.state)), JSON.parse(JSON.stringify(before)));
	service = new AutomationService(f.app.vault.adapter, '.nand/automation/test.json', 'device', f.source,
		() => undefined, async run => { f.notified.push(run.id); }, false);
	await service.load(); await service.tick(3000);
	assert.equal(service.executionEnabled, false); assert.deepEqual(JSON.parse(JSON.stringify(service.state)), JSON.parse(JSON.stringify(before)));
	assert.equal(f.notified.length, deliveries);
	for (let i = 0; i < 5; i++) {
		await service.setExecutionEnabled(true); await service.tick(3000);
		await service.setExecutionEnabled(false);
	}
	assert.equal(service.state.runs.length, 3); assert.equal(f.notified.length, deliveries + 1);
	assert.equal(service.state.runs.find(run => run.automationId === 'expired')?.status, 'skipped');
	assert.equal(service.state.runs.some(run => run.automationId === 'foreign'), false);
	assert.deepEqual(service.state.cursors, { 'a:1': 1000, 'later:1': 2000, 'expired:1': -500000 });
});

test('shutdown waits for an in-flight agent start and stops only its returned terminal before resolving', async () => {
	let launch!: (handle: AgentRunHandle) => void;
	let entered!: () => void;
	const starting = new Promise<void>(resolve => { entered = resolve; });
	const stopped: string[] = [];
	const agent: AgentRuntimePort = {
		listAgents: () => [], listSessions: async () => [], open: async () => {},
		stop: async id => { stopped.push(id); },
		start: () => new Promise(resolve => { launch = resolve; entered(); }),
	};
	const f = fixture(agent), service = f.make(); await service.load();
	const d = definition({ action: { kind: 'agent', agentId: 'codex', cwd: '/vault', prompt: 'test', sessionMode: 'fresh' } });
	await service.save(d);
	const run = service.run(d); await starting;
	let closed = false;
	const closing = service.setExecutionEnabled(false).then(() => { closed = true; });
	await Promise.resolve(); assert.equal(closed, false);
	await assert.rejects(service.run(d));
	launch({ terminalId: 'automation-owned', completion: new Promise(() => {}) });
	await Promise.all([run, closing]);
	assert.deepEqual(stopped, ['automation-owned']);
	assert.equal(service.state.runs[0]?.status, 'cancelled');
	assert.equal(JSON.parse(f.files.get('.nand/automation/test.json')!).runs[0].status, 'cancelled');
});

test('failed shutdown persistence or stop stays disabled and retries without losing owned execution', async () => {
	let stops = 0, failStop = false;
	const agent: AgentRuntimePort = {
		listAgents: () => [], listSessions: async () => [], open: async () => {},
		stop: async () => { stops++; if (failStop) throw Error('stop unavailable'); },
		start: async () => ({ terminalId: 'owned', completion: new Promise(() => {}) }),
	};
	const f = fixture(agent), service = f.make(); await service.load();
	const d = definition({ action: { kind: 'agent', agentId: 'codex', cwd: '/vault', prompt: 'test', sessionMode: 'fresh' } });
	await service.save(d); await service.run(d);
	f.fail(); await assert.rejects(service.setExecutionEnabled(false), /disk full/);
	assert.equal(service.executionEnabled, false); assert.equal(stops, 0);
	f.fail(false); failStop = true;
	await assert.rejects(service.setExecutionEnabled(false), /stop unavailable/);
	assert.equal(service.state.runs[0]?.status, 'unknown');
	failStop = false; await service.setExecutionEnabled(false);
	assert.equal(stops, 2); assert.equal(service.state.runs[0]?.status, 'cancelled');
	await service.setExecutionEnabled(true); assert.equal(service.executionEnabled, true);
});

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
	const store = new JsonStore(m.app.vault.adapter, '.nand/state.json', check);
	await store.load({ n: 0 });
	await store.save({ n: 1 });
	await store.save({ n: 2 });
	m.files.set('.nand/state.json', 'broken');
	const recovered = new JsonStore(m.app.vault.adapter, '.nand/state.json', check);
	assert.deepEqual(await recovered.load({ n: 0 }), { n: 1 });
	await recovered.save({ n: 3 });
	assert.equal(m.files.get('.nand/state.json.corrupt'), 'broken');
	assert.equal(JSON.parse(m.files.get('.nand/state.json')!).n, 3);
});

test('notification deliveries are idempotent across concurrent calls and restart', async () => {
	const m = memory();
	const service = new NotificationService(m.app.vault.adapter, '.nand/notifications.json', async () => {}, undefined, createNotificationDelivery(m.app));
	await service.load();
	const request = { id: 'run', title: 'title', body: 'body', channels: ['in-app', 'email'] as const };
	await Promise.all([
		service.send({ ...request, channels: [...request.channels] }),
		service.send({ ...request, channels: [...request.channels] }),
	]);
	assert.equal(service.records.length, 1);
	assert.equal(service.records[0]?.deliveries['in-app'], 'sent');
	assert.equal(service.records[0]?.deliveries.email, 'failed');
	const reloaded = new NotificationService(m.app.vault.adapter, '.nand/notifications.json', async () => {}, undefined, createNotificationDelivery(m.app));
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

test('dashboard source indexes explicit ownership, ignores old reminders and creates each run once', async () => {
	let raw = '# Board\n\n## Column\n\n### Tasks\n\n- [ ] Parent\n  - [ ] Nested ⏰ 2026-09-27 09:00\n';
	const file = { path: 'Board.md', basename: 'Board' };
	const settings = { ...structuredClone(DEFAULT_SETTINGS), dashboardFile: 'Board', workspaceFiles: [] };
	const app = { vault: { getFileByPath: (p: string) => p === file.path ? file : null, read: async () => raw, process: async (_: unknown, edit: (text: string) => string) => { raw = edit(raw); return raw; } }, workspace: { getLeavesOfType: () => [] } } as unknown as App;
	const source = new DashboardAutomationSource(app, () => settings, 'first-device', async () => {}, () => settings.modules.dashboard);
	assert.equal((await source.list()).length, 0, 'legacy reminder is not migrated');
	raw = raw.replace('Nested ⏰ 2026-09-27 09:00', 'Nested' + taskMetaSuffix({ id: 'nested-id', automation: definition({ deviceId: 'first-device' }) }));
	source.invalidate(file.path);
	const [original] = await source.list(); assert.ok(original?.source?.id); assert.equal(original.deviceId, 'first-device');
	const other = new DashboardAutomationSource(app, () => settings, 'other-device', async () => {}, () => settings.modules.dashboard);
	assert.equal((await other.list())[0]?.deviceId, 'first-device');
	raw = raw.replace('- [ ] Nested', '- [x] Nested'); source.invalidate(file.path); assert.equal((await source.list()).length, 0);
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
	const first = new NotificationService(m.app.vault.adapter, 'inbox.json', async () => {}, undefined, createNotificationDelivery(m.app));
	await first.load();
	m.fail();
	await assert.rejects(first.send(request));
	assert.equal(first.records.length, 0);
	m.fail(false);
	await first.send(request);
	await Promise.all([first.markRead(), first.clearRead()]);
	assert.equal(first.records.length, 0);
	const second = new NotificationService(m.app.vault.adapter, 'inbox.json', async () => {}, undefined, createNotificationDelivery(m.app));
	await second.load();
	await second.send(request);
	assert.equal(second.records.length, 0);
});

test('partial primary write recovers last valid data and a later write can succeed', async () => {
	const m = memory();
	const validate = (v: unknown): v is { revision: number } => !!v && typeof v === 'object' && typeof (v as { revision?: unknown }).revision === 'number';
	const store = new JsonStore(m.app.vault.adapter, 'store.json', validate);
	await store.load({ revision: 0 });
	await store.save({ revision: 1 });
	await store.save({ revision: 2 });
	m.files.set('store.json', '{"revision":');
	const restarted = new JsonStore(m.app.vault.adapter, 'store.json', validate);
	assert.deepEqual(await restarted.load({ revision: 0 }), { revision: 1 });
	await restarted.save({ revision: 3 });
	assert.equal(JSON.parse(m.files.get('store.json')!).revision, 3);
	assert.equal(m.files.get('store.json.corrupt'), '{"revision":');
});

test('failed inbox load cannot overwrite unreadable receipts and a successful retry emits state', async () => {
	const m = memory();
	m.files.set('inbox.json', '{broken');
	const inbox = new NotificationService(m.app.vault.adapter, 'inbox.json', async () => {}, undefined, createNotificationDelivery(m.app));
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

test('widget sources resolve canonical and legacy dashboard paths without changing reminder identity', async () => {
	for (const language of ['zh', 'en', 'zh'] as const) {
		setLanguage(language);
		for (const path of ['dashboard', 'Projects/My board', 'Projects/My board.md']) {
			const settings = structuredClone(DEFAULT_SETTINGS);
			settings.dashboardFile = path;
			settings.workspaceFiles = [path];
			settings.countdownEnabled = settings.anniversaryEnabled = true;
			settings.countdowns = [{ ...settings.countdowns[0]!, id: 'count', label: 'User countdown', targetDate: '2027-01-01', reminderDays: 1 }];
			settings.anniversaries = [{ ...settings.anniversaries[0]!, id: 'ann', label: 'User anniversary', startDate: '2020-01-01', annualReminder: true }];
			const file = { path: path.endsWith('.md') ? path : `${path}.md` };
			let exists = true, enabled = true, saves = 0;
			const app = { vault: { getFileByPath: (p: string) => exists && p === file.path ? file : null, read: async () => '' }, workspace: { getLeavesOfType: () => [] } } as unknown as App;
			const source = new DashboardAutomationSource(app, () => settings, 'original-device', async () => { saves++; }, () => enabled);
			const rows = await source.list();
			assert.equal(rows.length, 2);
			const persisted = JSON.stringify([settings.countdowns, settings.anniversaries]);
			assert.equal(saves, 1);
			for (const row of rows) {
				assert.equal(row.source?.path, file.path);
				assert.equal(source.resolveWidgetSource(row.source!), file);
				assert.equal(source.resolveWidgetSource({ ...row.source!, path: file.path.slice(0, -3) }), file);
				assert.equal(row.deviceId, 'original-device');
			}
			assert.deepEqual(await source.list(), rows);
			assert.equal(saves, 1, 'Reading/resolving never rewrites persisted definitions');
			const ref = rows[0]!.source!;
			exists = false;
			assert.throws(() => source.resolveWidgetSource(ref), { message: t('automation.widgetDashboardMissing') });
			exists = true;
			enabled = false;
			assert.throws(() => source.resolveWidgetSource(ref), { message: t('automation.widgetModuleDisabled') });
			enabled = true;
			settings.countdownEnabled = false;
			assert.throws(() => source.resolveWidgetSource(ref), { message: t('automation.widgetMissing') });
			settings.countdownEnabled = true;
			assert.throws(() => source.resolveWidgetSource({ ...ref, id: 'widget:deleted' }), { message: t('automation.widgetMissing') });
			assert.equal(JSON.stringify([settings.countdowns, settings.anniversaries]), persisted);
			settings.countdowns.push({ ...settings.countdowns[0]! });
			assert.throws(() => source.resolveWidgetSource(ref), { message: t('automation.widgetMissing') });
			settings.countdowns.pop();
			settings.dashboardFile = 'Other'; settings.workspaceFiles = ['Other'];
			assert.throws(() => source.resolveWidgetSource(ref), { message: t('automation.widgetDashboardMissing') });
			assert.equal(saves, 1);
		}
	}
	setLanguage('zh');
});

test('inbox renders structured reasons in the current language and deduplicates only exact reminder text', () => {
	const { document } = parseHTML('<html><body></body></html>');
	const prior = globalThis.document;
	Object.assign(globalThis, { document });
	try {
		const panel = document.createElement('div');
		const records = [
			{ id: 'structured', title: 'User title 保留', body: 'Old delivery snapshot', presentation: { kind: 'automation-run', status: 'failed', message: 'Original failure', errorCode: 'cliMissing' } },
			{ id: 'legacy', title: 'Legacy', body: 'Keep original free text 原文' },
			{ id: 'same', title: 'Exact reminder', body: 'Exact reminder' },
			{ id: 'different', title: 'Different', body: 'Different ' },
		].map(row => ({ ...row, createdAt: Date.UTC(2026, 8, 28, 12), read: false, channels: ['in-app'], deliveries: { 'in-app': 'sent' } }));
		for (const language of ['zh', 'en', 'zh'] as const) {
			setLanguage(language);
			render(h(InboxPanel, { records: records as NotificationRecord[], unread: 4, markRead: () => {}, clearRead: () => {}, open: () => {} }), panel);
			assert.ok(panel.textContent!.includes(t('automation.cliMissing')), 'Persisted system reason follows the current language');
			assert.ok(panel.textContent!.includes('Keep original free text 原文'));
			assert.equal(panel.textContent!.split('Exact reminder').length - 1, 1);
			assert.ok(panel.textContent!.includes('Different '), 'Whitespace differences are user content');
			assert.ok(panel.textContent!.includes(language === 'zh' ? '应用内：已提交' : 'In-app: Submitted'));
			assert.ok(panel.textContent!.includes(new Date(records[0]!.createdAt).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')));
		}
		render(null, panel);
	} finally {
		if (prior === undefined) Reflect.deleteProperty(globalThis, 'document'); else Object.assign(globalThis, { document: prior });
		setLanguage('zh');
	}
});

test('structured failures survive run and inbox persistence, language changes, cleanup and recovery without redelivery', async () => {
	const m = memory();
	let delivered = 0;
	const adapter = { available: () => true, send: () => { delivered++; }, dispose: () => {} };
	const inbox = () => new NotificationService(m.app.vault.adapter, 'notifications.json', async () => {}, undefined, adapter);
	let notifications = inbox(); await notifications.load();
	let failure: Error = new AutomationError('processExit', { code: 17 });
	const source: AutomationSourcePort = { list: async () => [], save: async () => {}, remove: async () => {}, open: async () => {}, createTask: async () => { throw failure; } };
	const make = () => new AutomationService(m.app.vault.adapter, 'automation.json', 'device', source, () => undefined, async (run, d) => {
		await notifications.send({ id: run.id, title: d.name, body: automationOutcome(run), channels: d.channels, presentation: { kind: 'automation-run', status: run.status, message: run.message, errorCode: run.errorCode, errorParams: run.errorParams } });
	});
	let service = make(); await service.load();
	const d = definition({ action: { kind: 'create-task', path: 'Board.md', cardId: 'one', text: 'User text 原文' } });
	await service.save(d); const run = (await service.run(d))!;
	assert.equal(run.errorCode, 'processExit'); assert.deepEqual(run.errorParams, { code: 17 });
	const id = run.id, snapshot = notifications.records[0]!.body;
	for (const language of ['en', 'zh', 'en'] as const) {
		setLanguage(language); notifications = inbox(); await notifications.load(); service = make(); await service.load();
		const persisted = service.state.runs.find(r => r.id === id)!;
		assert.equal(automationMessage(persisted), t('automation.processExit', { code: 17 }));
		assert.equal(notificationBody(notifications.records[0]!), automationOutcome(persisted));
		assert.equal(notifications.records[0]!.body, snapshot, 'Stored delivery text is not migrated on language changes');
		assert.equal(delivered, 1, 'Reload never submits the notification twice');
	}
	failure = new Error('External failure 原文');
	const generic = (await service.run(d))!;
	assert.equal(generic.errorCode, 'operationFailed'); assert.deepEqual(generic.errorParams, { detail: 'External failure 原文' });
	assert.ok(automationMessage(generic).includes('External failure 原文'));
	const record = notifications.records[0]!;
	assert.equal(notificationBody({ ...record, presentation: { kind: 'automation-run', status: 'failed', message: 'Legacy fallback', errorCode: 'futureUnknown' } }), t('automation.failed') + t('automation.colon') + 'Legacy fallback');
	assert.equal(automationMessage({ message: 'Old English 原文', errorCode: 'futureUnknown' }), 'Old English 原文');
	assert.equal(automationMessage({ message: 'Missing params', errorCode: 'processExit' }), 'Missing params');
	assert.equal(automationMessage({ message: 'Malformed params', errorCode: 'processExit', errorParams: [] as never }), 'Malformed params');
	await notifications.markRead(); await notifications.clearRead();
	const count = delivered; notifications = inbox(); await notifications.load(); service = make(); await service.load();
	assert.equal(notifications.records.length, 0); assert.equal(delivered, count);
	m.files.set('notifications.json', 'broken'); notifications = inbox(); await notifications.load();
	assert.equal(m.files.get('notifications.json.corrupt'), 'broken');
	assert.equal(delivered, count);
	setLanguage('zh');
});

test('automation panel localizes next/run dates and system reasons while preserving prompt, output and unknown text', () => {
	const { document } = parseHTML('<html><body></body></html>');
	const prior = globalThis.document; Object.assign(globalThis, { document });
	try {
		const panel = document.createElement('div'), now = Date.now();
		const d = definition({ schedule: { kind: 'once', at: now + 86400000 }, action: { kind: 'notify', body: 'User prompt 原文' } });
		const f = fixture(), service = f.make();
		service.state.definitions = [d];
		service.state.runs = [{ id: 'run', automationId: d.id, revision: 1, title: d.name, scheduledFor: now, trigger: 'manual', status: 'failed', startedAt: now, message: 'Original detail', errorCode: 'processExit', errorParams: { code: 17 }, output: 'CLI output 原文' }];
		for (const language of ['zh', 'en', 'zh'] as const) {
			setLanguage(language);
			render(h(AutomationsPanel, { host: { service, edit: () => {}, inbox: () => {}, retry: async () => {} }, state: { selected: d.id, search: '', filter: '', agentFilter: '' }, refresh: () => {}, actions: { clearHistory: () => {}, remove: () => {}, run: () => {} } }), panel);
			const text = panel.textContent!;
			assert.ok(text.includes(new Date(now).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')));
			assert.ok(text.includes(t('automation.next') + t('automation.colon') + new Date(now + 86400000).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')));
			assert.ok(text.includes(t('automation.processExit', { code: 17 })));
			assert.ok(text.includes('User prompt 原文')); assert.ok(text.includes('CLI output 原文'));
		}
		render(null, panel);
	} finally {
		if (prior === undefined) Reflect.deleteProperty(globalThis, 'document'); else Object.assign(globalThis, { document: prior });
		setLanguage('zh');
	}
});

test('cleared once history reads only the matching revision cursor and never replays failed, succeeded or skipped work', async () => {
	const f = fixture(); let taskAttempts = 0;
	f.source.createTask = async () => { taskAttempts++; throw new AutomationError('sourceMissing'); };
	let service = f.make(); await service.load();
	for (const d of [
		definition({ id: 'success' }),
		definition({ id: 'failure', action: { kind: 'create-task', path: 'missing', cardId: 'none', text: 'Keep' } }),
		definition({ id: 'skipped', schedule: { kind: 'once', at: -200000 }, graceMinutes: 0 }),
		definition({ id: 'future', schedule: { kind: 'once', at: 1000000 } }),
		definition({ id: 'manual', schedule: { kind: 'manual' } }),
		definition({ id: 'recurring', schedule: { kind: 'recurring', expression: '* * * * *', start: 1000000 } }),
		definition({ id: 'revised' }),
	]) await service.save(d);
	await service.tick(2000);
	assert.deepEqual(service.state.runs.map(r => r.status), ['succeeded', 'failed', 'skipped', 'succeeded']);
	const revised = service.definitions.find(d => d.id === 'revised')!;
	await service.save({ ...revised, schedule: { kind: 'once', at: 1000000 } });
	service.state.cursors['future:0'] = 1000000;
	service.state.cursors['future:1'] = 999999;
	service.state.cursors['manual:1'] = 1000000;
	service.state.cursors['recurring:1'] = 1000000;
	const { document } = parseHTML('<html><body></body></html>'), prior = globalThis.document;
	Object.assign(globalThis, { document });
	const panel = document.createElement('div');
	const labels = () => {
		render(h(AutomationsPanel, { host: { service, edit: () => {}, inbox: () => {}, retry: async () => {} }, state: { selected: '', search: '', filter: '', agentFilter: '' }, refresh: () => {}, actions: { clearHistory: () => {}, remove: () => {}, run: () => {} } }), panel);
		return Array.from(panel.querySelectorAll('.nand-automation-list > button')).map(button => button.querySelector('small:last-child')?.textContent);
	};
	try {
		setLanguage('zh');
		assert.deepEqual(labels(), ['已完成', '失败', '已跳过', '待执行', '待执行', '待执行', '待执行']);
		const cursors = structuredClone(service.state.cursors), notified = f.notified.length;
		await service.clearHistory(); assert.deepEqual(service.state.cursors, cursors);
		for (const language of ['zh', 'en', 'zh'] as const) {
			setLanguage(language);
			assert.deepEqual(labels(), [t('automation.processed'), t('automation.processed'), t('automation.processed'), ...Array(4).fill(t('automation.pending'))]);
			await service.tick(2000); service = f.make(); await service.load(); await service.tick(3000);
			assert.equal(service.state.runs.length, 0); assert.equal(f.notified.length, notified); assert.equal(taskAttempts, 1);
			assert.deepEqual(service.state.cursors, cursors);
		}
	} finally {
		render(null, panel);
		if (prior === undefined) Reflect.deleteProperty(globalThis, 'document'); else Object.assign(globalThis, { document: prior });
		setLanguage('zh');
	}
});


test('Home toggle saves before applying execution, restores failed saves, and leaves runtime failures retryable', async () => {
 const rows = Setting as unknown as { created: { name: string; toggles: StubControl[] }[] };
 const settings = structuredClone(DEFAULT_SETTINGS);
 let persisted = true, failing = true, failRuntime = false, effects = 0;
 const tab = {
  plugin: { settings, saveSettings: async () => { if (failing) throw Error('disk full'); persisted = settings.modules.automation; },
   applyModuleFlags: async () => { effects++; assert.equal(persisted, settings.modules.automation); if (failRuntime) throw Error('stop failed'); } },
  activeProduct: 'home', activePage: 'home', refresh: () => {},
 } as unknown as DashboardSettingTab;
 for (const language of ['zh', 'en', 'zh'] as const) {
  setLanguage(language); rows.created.length = 0;
  renderHomeSettings.call(tab, new Setting({} as HTMLElement).settingEl);
  const toggle = rows.created.find(row => row.name === t('automation.title'))!.toggles[0]!;
  assert.equal(toggle.value, true);
  const count = effects; failing = true;
  await toggle.fire!(false);
  assert.equal(effects, count); assert.equal(settings.modules.automation, true); assert.equal(toggle.value, true);
  assert.equal(toggle.disabled, false);
  failing = false; failRuntime = true; await toggle.fire!(false);
  assert.equal(settings.modules.automation, false); assert.equal(persisted, false); assert.equal(toggle.value, false);
  failRuntime = false; await toggle.fire!(true);
  assert.equal(settings.modules.automation, true); assert.equal(persisted, true);
 }
});

test('disabled panel retains history and notifications but disables definition and execution mutations', async () => {
 const f = fixture(), service = f.make(); await service.load(); await service.save(definition()); await service.tick(1000);
 await service.setExecutionEnabled(false);
 const { document } = parseHTML('<html><body></body></html>'), prior = globalThis.document;
 Object.assign(globalThis, { document }); const panel = document.createElement('div');
 try {
  for (const language of ['zh', 'en', 'zh'] as const) {
   setLanguage(language);
   render(h(AutomationsPanel, { host: { service, edit: () => {}, inbox: () => {}, retry: async () => {} }, state: { selected: 'a', search: '', filter: '', agentFilter: '' }, refresh: () => {}, actions: { clearHistory: () => {}, remove: () => {}, run: () => {} } }), panel);
   assert.ok(panel.textContent!.includes(t('automation.moduleOff')));
   for (const key of ['new', 'clearHistory', 'run', 'edit', 'pause', 'delete']) {
    const button = Array.from(panel.querySelectorAll('button')).find(button => button.textContent === t(`automation.${key}`))!;
    assert.ok(button.hasAttribute('disabled'), key);
   }
   assert.equal(Array.from(panel.querySelectorAll('button')).find(button => button.textContent === t('automation.inbox'))!.hasAttribute('disabled'), false);
   assert.equal(panel.querySelectorAll('.nand-automation-run').length, 1);
  }
 } finally { render(null, panel); if (prior === undefined) Reflect.deleteProperty(globalThis, 'document'); else Object.assign(globalThis, { document: prior }); setLanguage('zh'); }
});


test('shutdown drains an already-started file effect without undoing it or sending new notifications', async () => {
 const f = fixture(); let release!: () => void, entered!: () => void;
 const gate = new Promise<void>(resolve => { release = resolve; });
 const starting = new Promise<void>(resolve => { entered = resolve; });
 f.source.createTask = async (_, id) => { entered(); await gate; f.effects.push(id); };
 const service = f.make(); await service.load();
 const d = definition({ action: { kind: 'create-task', path: 'Board.md', cardId: 'c', text: 'Preserve effect' } });
 await service.save(d); const running = service.run(d); await starting;
 let closed = false; const closing = service.setExecutionEnabled(false).then(() => { closed = true; });
 await Promise.resolve(); assert.equal(closed, false); release();
 const [run] = await Promise.all([running, closing]);
 assert.deepEqual(f.effects, [run!.id]); assert.equal(service.state.runs[0]?.status, 'cancelled');
 assert.equal(f.notified.length, 0);
});

test('an agent handle arriving during failed cancellation persistence remains owned for retry', async () => {
 let launch!: (handle: AgentRunHandle) => void, entered!: () => void;
 const starting = new Promise<void>(resolve => { entered = resolve; }), stopped: string[] = [];
 const agent: AgentRuntimePort = { listAgents: () => [], listSessions: async () => [], open: async () => {},
  stop: async id => { stopped.push(id); }, start: () => new Promise(resolve => { launch = resolve; entered(); }) };
 const f = fixture(agent), service = f.make(); await service.load();
 const d = definition({ action: { kind: 'agent', agentId: 'codex', cwd: '/vault', prompt: 'test', sessionMode: 'fresh' } });
 await service.save(d); const run = service.run(d); await starting; f.fail();
 const closing = assert.rejects(service.setExecutionEnabled(false), /disk full/);
 launch({ terminalId: 'late-owned', completion: new Promise(() => {}) }); await Promise.all([run, closing]);
 assert.equal(service.executionEnabled, false); assert.deepEqual(stopped, []);
 f.fail(false); await service.setExecutionEnabled(true);
 assert.deepEqual(stopped, ['late-owned']); assert.equal(service.state.runs[0]?.terminalId, 'late-owned');
 assert.equal(service.state.runs[0]?.status, 'cancelled'); assert.equal(service.executionEnabled, true);
});

test('switching an automation action keeps the shared text and drops kind-specific fields', () => {
	const defaults = { agentId: 'codex', cwd: '/vault' };
	const agent = switchAutomationAction(
		{
			kind: 'agent',
			agentId: 'claude-code',
			cwd: '/old',
			prompt: 'Keep this text',
			sessionMode: 'specific',
			session: {
				agentId: 'claude-code',
				sessionId: 's1',
				cwd: '/old',
				title: 'Old',
				modifiedAtMs: 1,
				accountKey: 'a',
			},
		},
		'notify',
		defaults,
	);
	assert.deepEqual(agent, { kind: 'notify', body: 'Keep this text' });
	const task = switchAutomationAction(agent, 'create-task', defaults);
	assert.deepEqual(task, { kind: 'create-task', path: '', cardId: '', text: 'Keep this text' });
	const withTarget = { ...task, path: 'Board.md', cardId: 'card' };
	const again = switchAutomationAction(withTarget, 'agent', { agentId: 'grok', cwd: '/now' });
	assert.deepEqual(again, {
		kind: 'agent',
		agentId: 'grok',
		cwd: '/now',
		prompt: 'Keep this text',
		sessionMode: 'fresh',
	});
	assert.equal('path' in again, false);
	assert.equal('session' in again, false);
	assert.deepEqual(switchAutomationAction(withTarget, 'create-task', defaults), withTarget);
});

test('anniversary reminders use the singular English year only for a difference of one', async () => {
	const year = new Date().getFullYear();
	const cases = [
		{ startDate: `${year - 1}-06-15`, years: 1 },
		{ startDate: `${year - 2}-06-15`, years: 2 },
		{ startDate: `${year}-01-01`, years: 0 },
	];
	try {
		for (const language of ['en', 'zh'] as const) {
			setLanguage(language);
			for (const item of cases) {
				const settings = structuredClone(DEFAULT_SETTINGS);
				settings.dashboardFile = 'dashboard.md';
				settings.anniversaryEnabled = true;
				settings.countdownEnabled = false;
				settings.anniversaries = [
					{
						...settings.anniversaries[0]!,
						id: 'ann',
						label: 'Day',
						startDate: item.startDate,
						annualReminder: true,
					},
				];
				const app = {
					vault: { getFileByPath: () => null, read: async () => '' },
					workspace: { getLeavesOfType: () => [] },
				} as unknown as App;
				const source = new DashboardAutomationSource(app, () => settings, 'device', async () => {}, () => true);
				const [row] = await source.list();
				const body = row?.action.kind === 'notify' ? row.action.body : '';
				if (language === 'en') {
					assert.equal(
						body,
						item.years === 1 ? 'Day: 1 year since that day' : `Day: ${item.years} years since that day`,
					);
				} else {
					assert.equal(body, `Day：已经 ${item.years} 年了`);
				}
			}
		}
	} finally {
		setLanguage('zh');
	}
});
