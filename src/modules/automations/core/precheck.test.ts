import { expect, test, vi } from 'vitest';
import { AutomationService } from './service';
import { PRECHECK_TIMEOUT_MS, type PrecheckRunner } from './precheck';
import type {
	AutomationDefinition,
	AutomationRun,
	AutomationSourcePort,
	AgentRuntimePort,
} from '../../../shared/automation/types';
import type { TextStorage } from '../../../shared/storage/ports';
import { AutomationError, automationMessage } from '../../../shared/automation/errors';
import { getLanguage, setLanguage } from '../../../shared/i18n/index';

function definition(): AutomationDefinition {
	return {
		id: 'precheck',
		name: 'Review',
		deviceId: 'device',
		enabled: true,
		revision: 1,
		createdAt: 0,
		updatedAt: 0,
		graceMinutes: 720,
		schedule: { kind: 'once', at: 1000 },
		action: { kind: 'notify', body: 'Ready' },
		channels: ['in-app'],
		notifyOn: 'always',
		precheck: { command: 'exit 0', shell: 'bash' },
	};
}
async function fixture(precheck: PrecheckRunner) {
	const files = new Map<string, string>();
	const storage: TextStorage = {
		exists: async (path) => files.has(path),
		read: async (path) => files.get(path)!,
		mkdir: async () => {},
		write: async (path, text) => {
			files.set(path, text);
		},
	};
	const sources: AutomationSourcePort = {
		list: async () => [],
		save: async () => {},
		remove: async () => {},
		open: async () => {},
		createTask: vi.fn(async () => {}),
	};
	const notify = vi.fn(async () => {}),
		start = vi.fn<AgentRuntimePort['start']>(async () => ({ terminalId: 't', completion: new Promise(() => {}) }));
	const agent: AgentRuntimePort = {
		start,
		listAgents: () => [],
		listSessions: async () => [],
		stop: async () => {},
		open: async () => {},
	};
	const make = () =>
		new AutomationService(storage, 'runtime.json', 'device', sources, () => agent, notify, true, { precheck });
	const service = make();
	await service.load();
	return { service, make, files, notify, start, sources };
}
test.each(['manual', 'scheduled'] as const)(
	'precheck runs after durable admission for %s and records nonzero as skipped',
	async (trigger) => {
		const check = vi.fn<PrecheckRunner>(async (request) => {
			const state = JSON.parse(f.files.get('runtime.json')!) as { runs: AutomationRun[] };
			expect(state.runs[0]?.status).toBe('pending');
			expect(state.runs[0]?.timeline?.at(-1)?.phase).toBe('precheck');
			expect(request.timeoutMs).toBe(60_000);
			return { exitCode: 4, timedOut: false, output: 'Not ready' };
		});
		const f = await fixture(check),
			d = definition();
		await f.service.save(d);
		const run = await f.service.run(d, trigger, 1000, 1000);
		expect(run).toMatchObject({
			status: 'skipped',
			errorCode: 'precheckFailed',
			precheckResult: { exitCode: 4, output: 'Not ready' },
		});
		expect(f.notify).not.toHaveBeenCalled();
		expect(f.start).not.toHaveBeenCalled();
		if (trigger === 'scheduled') {
			await f.service.tick(1000);
			expect(check).toHaveBeenCalledTimes(1);
		}
		await f.service.shutdown();
		const restarted = f.make();
		await restarted.load();
		expect(restarted.state.runs[0]?.status).toBe('skipped');
		await restarted.shutdown();
	},
);
test('successful precheck admits the action; timeout skips it; empty precheck never launches a process', async () => {
	const check = vi
		.fn<PrecheckRunner>()
		.mockResolvedValueOnce({ exitCode: 0, timedOut: false, output: 'Ready' })
		.mockResolvedValueOnce({ exitCode: null, timedOut: true, output: '' });
	const f = await fixture(check),
		d = definition();
	expect((await f.service.run(d))?.status).toBe('succeeded');
	expect(f.notify).toHaveBeenCalledTimes(1);
	expect((await f.service.run(d))?.status).toBe('skipped');
	expect(f.notify).toHaveBeenCalledTimes(1);
	const empty = { ...d, precheck: { command: '   ', shell: 'bash' as const } };
	expect((await f.service.run(empty))?.status).toBe('succeeded');
	expect(check).toHaveBeenCalledTimes(2);
	expect(PRECHECK_TIMEOUT_MS).toBe(60_000);
	await f.service.shutdown();
});
test('unsafe precheck directories persist a localized failure without admitting the action, including after restart', async () => {
	const f = await fixture(async () => {
		throw new AutomationError('precheckDirectoryUnsafe');
	});
	const d = definition();
	d.action = { kind: 'agent', agentId: 'codex', cwd: '/vault', prompt: 'Go', sessionMode: 'fresh' };
	d.notifyOn = 'never';
	const language = getLanguage();
	try {
		await f.service.save(d);
		const run = await f.service.run(d);
		expect(run).toMatchObject({ status: 'failed', errorCode: 'precheckDirectoryUnsafe' });
		expect(f.start).not.toHaveBeenCalled();
		expect((JSON.parse(f.files.get('runtime.json')!) as { runs: AutomationRun[] }).runs[0]).toMatchObject({
			status: 'failed',
			errorCode: 'precheckDirectoryUnsafe',
		});
		await f.service.shutdown();
		const restarted = f.make();
		await restarted.load();
		const stored = restarted.state.runs[0]!;
		expect(stored).toMatchObject({ status: 'failed', errorCode: 'precheckDirectoryUnsafe' });
		setLanguage('zh');
		expect(automationMessage(stored)).toContain('预检失败：数据目录含符号链接');
		setLanguage('en');
		expect(automationMessage(stored)).toContain('Precheck failed: its data directory contains a symbolic link');
		await restarted.shutdown();
	} finally {
		setLanguage(language);
		await f.service.shutdown();
	}
});
test.each(['stop', 'disable', 'shutdown'])(
	'%s aborts the owned precheck and never launches the action',
	async (mode) => {
		let entered!: () => void;
		const ready = new Promise<void>((resolve) => {
			entered = resolve;
		});
		let signal!: AbortSignal;
		const f = await fixture(
			(request) =>
				new Promise((resolve) => {
					signal = request.signal;
					signal.addEventListener('abort', () => resolve({ exitCode: null, timedOut: false, output: '' }), {
						once: true,
					});
					entered();
				}),
		);
		const d = definition();
		d.action = { kind: 'agent', agentId: 'codex', cwd: '/vault', prompt: 'Go', sessionMode: 'fresh' };
		const pending = f.service.run(d);
		await ready;
		if (mode === 'stop') await f.service.stop(f.service.state.runs[0]!);
		else if (mode === 'disable') await f.service.setExecutionEnabled(false);
		else await f.service.shutdown();
		await pending;
		expect(signal.aborted).toBe(true);
		expect(f.start).not.toHaveBeenCalled();
		expect(f.service.state.runs[0]?.status).toBe(mode === 'shutdown' ? 'interrupted' : 'cancelled');
		await f.service.shutdown();
	},
);
test('save and execution both reject forbidden extras and reuse extras; allowed args reach the runtime unchanged', async () => {
	const f = await fixture(async () => ({ exitCode: 0, timedOut: false, output: '' }));
	const d = definition();
	d.action = {
		kind: 'agent',
		agentId: 'codex',
		cwd: '/vault',
		prompt: 'Go',
		sessionMode: 'fresh',
		extraArgs: '--dangerously-skip-permissions',
	};
	await expect(f.service.save(d)).rejects.toMatchObject({ code: 'extraArgsRejected' });
	await expect(f.service.run(d)).rejects.toMatchObject({ code: 'extraArgsRejected' });
	d.action.extraArgs = '--model test';
	d.action.sessionMode = 'reuse';
	await expect(f.service.save(d)).rejects.toMatchObject({ code: 'extraArgsReuse' });
	d.action.sessionMode = 'fresh';
	await f.service.save(d);
	await f.service.run(d);
	expect(f.start.mock.calls[0]?.[0].extraArgs).toBe('--model test');
	await f.service.shutdown();
});
