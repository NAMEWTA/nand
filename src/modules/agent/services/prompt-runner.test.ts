import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import type { AgentRunContextProvider } from '../api';
import type { AgentRunHandle } from '../../../shared/automation/types';
import type { AgentExecution } from './agent-runtime';
import { PromptRunner } from './prompt-runner';

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => { resolve = done; });
	return { promise, resolve };
};
const clock = { setTimeout: (fn: () => void, ms: number) => Number(setTimeout(fn, ms)), clearTimeout: (id: number) => clearTimeout(id) };
afterEach(() => vi.useRealTimers());

function fixture(providers: readonly AgentRunContextProvider[] = []) {
	const complete = deferred<Awaited<AgentRunHandle['completion']>>();
	const entered = deferred<AgentExecution>();
	const env: Record<string, string>[] = [];
	const stopped: string[] = [];
	const opened: string[] = [];
	let calls = 0;
	const runner = new PromptRunner({
		listAgents: () => [{ id: 'codex', title: 'Codex', enabled: true, installed: true }],
		execute: async (_action, execution) => {
			calls++;
			if (execution.resolveContext) env.push(await execution.resolveContext('C:/vault/canonical'));
			execution.signal?.throwIfAborted();
			execution.onTerminal?.('owned');
			entered.resolve(execution);
			return { terminalId: 'owned', completion: complete.promise };
		},
		stop: async id => { stopped.push(id); },
		open: async id => { opened.push(id); },
	}, () => 'C:/vault', async () => providers, clock);
	return { runner, complete, entered, env, stopped, opened, calls: () => calls };
}

test('complete native answer and usage survive; short-lived context is revoked even with a retained terminal', async () => {
	const disposed = vi.fn();
	const resolve = vi.fn(async (_handle, run) => {
		assert.equal(run.cwd, 'C:/vault/canonical');
		assert.ok(run.runId);
		return { env: { NAND_BROWSER_TOKEN: 'one-run-secret' }, dispose: disposed };
	});
	const f = fixture([{ id: 'browser', resolve }]);
	const answer = JSON.stringify(Array.from({ length: 3000 }, (_, id) => ({ id, text: '完整回答' })));
	const work = f.runner.run({ prompt: 'score', purpose: 'news', runContext: { provider: 'browser', handle: 'opaque' }, keepTerminal: true });
	await f.entered.promise;
	const usage = { input: 10, output: 20, cacheRead: 2, cacheWrite: 0, cost: null, known: true };
	f.complete.resolve({ status: 'succeeded', message: answer, output: '\x1b[31mnot an answer', usage });
	const result = await work;
	assert.equal(result.text, answer);
	assert.deepEqual(result.usage, usage);
	assert.ok(!JSON.stringify(result).includes('one-run-secret'));
	assert.equal(disposed.mock.calls.length, 1);
	assert.deepEqual(f.stopped, []);
	assert.equal((await f.runner.run({ prompt: 'again', purpose: 'news', continueTerminalId: 'owned' })).errorCode, 'runContextInvalid');
	assert.equal(f.calls(), 1, 'a revoked contextual process cannot receive another prompt');
	await f.runner.open('manual');
	await f.runner.open('owned');
	assert.deepEqual(f.opened, ['owned']);
	await f.runner.dispose();
	assert.deepEqual(f.stopped, ['owned']);
	assert.equal(disposed.mock.calls.length, 1);
});

test('permission state opens the owned terminal; cancellation and module disable finish and stop only owned work', async () => {
	const disposed = vi.fn();
	const f = fixture([{ id: 'browser', resolve: async () => ({ env: { NAND_BROWSER_TOKEN: 'secret' }, dispose: disposed }) }]);
	const controller = new AbortController();
	const states: string[] = [];
	const work = f.runner.run({ prompt: 'run', purpose: 'news', signal: controller.signal, runContext: { provider: 'browser', handle: 'h' }, onState: state => states.push(state.status) });
	const execution = await f.entered.promise;
	execution.onState?.('running', 'owned');
	execution.onState?.('needs-attention', 'owned');
	await f.runner.open('owned');
	controller.abort();
	assert.equal((await work).status, 'cancelled');
	assert.deepEqual(states, ['needs-attention', 'running', 'needs-attention']);
	assert.deepEqual(f.stopped, ['owned']);
	assert.equal(disposed.mock.calls.length, 1);
	const g = fixture();
	const disabled = g.runner.run({ prompt: 'run', purpose: 'news' });
	await g.entered.promise;
	await g.runner.dispose();
	assert.equal((await disabled).status, 'interrupted');
	assert.deepEqual(g.stopped, ['owned']);
});

test('timeout also covers pending context resolution; a late grant is revoked and cannot start a terminal', async () => {
	vi.useFakeTimers();
	const lease = deferred<{ env: Record<string, string>; dispose(): void }>();
	const requested = deferred<void>();
	const disposed = vi.fn();
	const f = fixture([{ id: 'browser', resolve: async () => { requested.resolve(); return lease.promise; } }]);
	const work = f.runner.run({ prompt: 'run', purpose: 'news', timeoutMs: 50, runContext: { provider: 'browser', handle: 'h' } });
	await requested.promise;
	await vi.advanceTimersByTimeAsync(51);
	assert.equal((await work).status, 'timeout');
	lease.resolve({ env: { NAND_BROWSER_TOKEN: 'late-secret' }, dispose: disposed });
	await vi.advanceTimersByTimeAsync(1);
	assert.equal(disposed.mock.calls.length, 1);
	assert.deepEqual(f.stopped, []);
	assert.deepEqual(f.env, []);
});

test('absent or invalid context fails before spawning, and a native failure never returns terminal output', async () => {
	const absent = fixture();
	assert.equal((await absent.runner.run({ prompt: 'run', purpose: 'news', continueTerminalId: 'manual' })).errorCode, 'sessionMissing');
	assert.equal((await absent.runner.run({ prompt: 'run', purpose: 'news', runContext: { provider: 'missing', handle: 'h' } })).errorCode, 'runContextUnavailable');
	assert.equal(absent.calls(), 0);
	const invalid = fixture([{ id: 'browser', resolve: async () => undefined }]);
	assert.equal((await invalid.runner.run({ prompt: 'run', purpose: 'news', runContext: { provider: 'browser', handle: 'used' } })).errorCode, 'runContextInvalid');
	assert.deepEqual(invalid.env, []);
	const f = fixture();
	const work = f.runner.run({ prompt: 'run', purpose: 'news' });
	await f.entered.promise;
	f.complete.resolve({ status: 'failed', message: 'partial', output: 'screen tail', errorCode: 'answerTooLarge' });
	assert.deepEqual(await work, { status: 'failed', text: '', terminalId: 'owned', usage: undefined, errorCode: 'answerTooLarge' });
	assert.deepEqual(f.stopped, ['owned']);
});

test('module disposal waits for the active grant to be revoked', async () => {
	const release = deferred<void>();
	const releasing = deferred<void>();
	const f = fixture([{ id: 'browser', resolve: async () => ({ env: {}, dispose: async () => { releasing.resolve(); await release.promise; } }) }]);
	const work = f.runner.run({ prompt: 'run', purpose: 'news', runContext: { provider: 'browser', handle: 'h' } });
	await f.entered.promise;
	let done = false;
	const disposal = f.runner.dispose().then(() => { done = true; });
	await releasing.promise;
	assert.equal(done, false);
	release.resolve();
	await disposal;
	assert.equal((await work).status, 'interrupted');
	assert.equal(done, true);
});
