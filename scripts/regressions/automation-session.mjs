import { pathToFileURL } from 'node:url';
const repo = process.env.NAND_REPO || process.cwd();
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const { AutomationService } = await import(
	new URL('./src/core/automations/service.ts', pathToFileURL(repo + '/')).href
);
const { TerminalAutomationRuntime } = await import(
	new URL('./src/plugin/workflows/agent-runtime.ts', pathToFileURL(repo + '/')).href
);
const { normalizeAgentSettings } = await import(
	new URL('./src/core/agent-launch/defaults.ts', pathToFileURL(repo + '/')).href
);
const root = fs.mkdtempSync(path.join(tmpdir(), 'nand-native-session-race-'));
let runtime;
try {
	const vault = path.join(root, 'vault');
	fs.mkdirSync(vault);
	const cli = path.join(root, 'never-executed-cli');
	fs.writeFileSync(cli, 'test fixture; no execution');
	globalThis.window = { require: createRequire(path.join(process.cwd(), 'package.json')) };
	const settings = normalizeAgentSettings({});
	settings.agents.grok.enabled = true;
	settings.agents.grok.cliPath = cli;
	settings.globalPermissionMode = 'default';
	let launches = 0;
	const host = {
		settings: { agentSettings: settings },
		manifest: { dir: '.obsidian/plugins/nand' },
		app: {
			loadLocalStorage: () => 'fixture',
			workspace: { containerEl: { win: {} } },
			vault: { adapter: { exists: async () => false, getBasePath: () => vault } },
		},
		getTerminalService: async () => ({
			createTerminal: async (opts, onCreated) => {
				const terminal = {
					id: 'mock-terminal-' + ++launches,
					write: () => {},
					observeAutomation: () => () => {},
					isAlive: () => true,
				};
				onCreated(terminal);
				return terminal;
			},
		}),
	};
	runtime = new TerminalAutomationRuntime(host);
	let entered;
	const firstPrepared = new Promise((r) => {
		entered = r;
	});
	let unblock;
	const block = new Promise((r) => {
		unblock = r;
	});
	let preparations = 0;
	runtime.hooks = {
		prepare: async () => {
			if (++preparations === 1) {
				entered();
				await block;
			}
			return { env: {}, close() {} };
		},
		dispose() {},
	};
	runtime.sessionUsage = async () => undefined;
	const session = {
		agentId: 'grok',
		cwd: vault,
		sessionId: 'shared-native-session',
		title: 'Synthetic',
		accountKey: '{}',
		modifiedAtMs: 0,
	};
	runtime.listSessions = async () => [session];
	const action = {
		kind: 'agent',
		agentId: 'grok',
		cwd: vault,
		prompt: 'Synthetic prompt; never sent',
		sessionMode: 'specific',
		session,
	};
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
			throw Error('No file actions allowed');
		},
	};
	const service = new AutomationService(
		storage,
		'fixture/state.json',
		'fixture',
		sources,
		() => runtime,
		async () => {},
	);
	await service.load();
	for (const id of ['automation-a', 'automation-b'])
		await service.save({
			id,
			name: id,
			enabled: true,
			deviceId: 'fixture',
			revision: 1,
			schedule: { kind: 'once', at: 1000 },
			action,
			channels: [],
			notifyOn: 'never',
			graceMinutes: 720,
			createdAt: 0,
			updatedAt: 0,
		});
	const tick = service.tick(1000);
	await firstPrepared;
	await new Promise((r) => setTimeout(r, 0));
	assert.equal(launches, 0, 'first launch remains reserved during prepare');
	unblock();
	await tick;
	assert.equal(launches, 1, 'one scheduler tick must launch the native session once');
	assert.equal(service.state.runs.length, 2);
	assert.equal(service.state.runs.filter((r) => r.status === 'unknown').length, 1);
	assert.equal(service.state.runs.filter((r) => r.status === 'failed').length, 1);
	await assert.rejects(
		runtime.start(action, { id: 'automation-c', title: 'C', trigger: 'scheduled' }),
		(e) => e.code === 'busy',
	);
	// A failed preparation releases the reservation; another session can run independently.
	const other = { ...session, sessionId: 'other-native-session' };
	runtime.listSessions = async () => [session, other];
	let failPrepare = true;
	runtime.hooks.prepare = async () => {
		if (failPrepare) throw Error('fixture preparation failed');
		return { env: {}, close() {} };
	};
	await assert.rejects(
		runtime.start({ ...action, session: other }, { id: 'retry', trigger: 'scheduled' }),
		/preparation failed/,
	);
	assert.equal(runtime.reservations.size, 0);
	failPrepare = false;
	await runtime.start({ ...action, session: other }, { id: 'retry', trigger: 'scheduled' });
	assert.equal(launches, 2);
	assert.equal(runtime.reservations.size, 0);
	console.log('Automation session: concurrent duplicate rejected busy; one terminal launched');
} finally {
	runtime?.dispose();
	fs.rmSync(root, { recursive: true, force: true });
}
