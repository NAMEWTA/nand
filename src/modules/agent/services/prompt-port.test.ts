import { afterEach, expect, test, vi } from 'vitest';
import { createAgentDispatch } from './prompt-port';
import type { AgentDispatchRequest, AgentDispatchReceipt } from '../api';
import type { AutomationInvocations } from '../../automations/api';

const input: AgentDispatchRequest = { invocationId: 'one', title: 'Review', agentId: 'codex', source: { kind: 'widget', path: 'A.md', id: 'skill' },
	destination: { kind: 'fresh', cwd: '' }, finalPrompt: '$review\nEdited', files: [] };
function fixture() {
	vi.useFakeTimers();
	const invoke = vi.fn<AutomationInvocations['invoke']>(async request => ({ invocationId: request.invocationId, delivery: 'started', runId: 'run', terminalId: 'terminal' }));
	const agents = [{ id: 'codex' as const, title: 'Codex', enabled: true, installed: true }];
	let available = true;
	const port = createAgentDispatch({ agents: () => agents, invocations: () => available ? { invoke, receipt: () => undefined } : undefined,
		cwd: () => '/vault', clock: { setTimeout: (fn, ms) => Number(setTimeout(fn, ms)), clearTimeout: id => clearTimeout(id) } });
	return { port, invoke, agents, off: () => { available = false; } };
}
afterEach(() => vi.useRealTimers());

test('fresh routes the selected agent and literal final text through the shared journal', async () => {
	const f = fixture(); expect((await f.port.dispatch(input)).delivery).toBe('started');
	expect(f.invoke.mock.calls[0]?.[0]).toEqual({ ...input, destination: { kind: 'fresh', cwd: '/vault' } });
	expect(input.destination).toEqual({ kind: 'fresh', cwd: '' }); expect(vi.getTimerCount()).toBe(0);
});

test('unavailable, disabled, unknown and missing CLI targets never start a journal invocation', async () => {
	const f = fixture();
	expect((await f.port.dispatch({ ...input, agentId: 'chat' })).errorCode).toBe('unsupported');
	f.agents[0]!.enabled = false; expect((await f.port.dispatch(input)).errorCode).toBe('agentDisabled');
	f.agents[0]!.enabled = true; f.agents[0]!.installed = false; expect((await f.port.dispatch(input)).errorCode).toBe('cliMissing');
	f.agents[0]!.installed = true; f.off(); expect((await f.port.dispatch(input)).errorCode).toBe('moduleOff');
	expect(f.invoke).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});

test('ten second delivery timeout does not report cancellation or completion of an accepted task', async () => {
	const f = fixture(); let finish!: (receipt: AgentDispatchReceipt) => void;
	f.invoke.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
	const pending = f.port.dispatch(input); await vi.advanceTimersByTimeAsync(10_000);
	expect(await pending).toMatchObject({ delivery: 'timeout', errorCode: 'timeout' });
	expect(f.invoke.mock.calls[0]?.[1]?.signal?.reason).toBe('timeout');
	finish({ invocationId: 'one', delivery: 'started', runId: 'run' }); await Promise.resolve();
	expect(vi.getTimerCount()).toBe(0); expect(f.invoke).toHaveBeenCalledTimes(1);
});

test('page abort and module disposal release listeners and waits; no request starts after pre-cancel', async () => {
	const f = fixture(); const abort = new AbortController(); abort.abort();
	expect((await f.port.dispatch(input, { signal: abort.signal })).errorCode).toBe('cancelled'); expect(f.invoke).not.toHaveBeenCalled();
	f.invoke.mockImplementation(() => new Promise(() => {}));
	const active = new AbortController(); const pending = f.port.dispatch(input, { signal: active.signal });
	await Promise.resolve(); active.abort(); expect((await pending).errorCode).toBe('cancelled');
	const next = f.port.dispatch(input); await Promise.resolve(); f.port.dispose(); expect((await next).errorCode).toBe('cancelled');
	expect(vi.getTimerCount()).toBe(0); expect((await f.port.dispatch(input)).delivery).toBe('rejected');
});
