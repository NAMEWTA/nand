import type { App } from 'obsidian';
import { expect, test, vi } from 'vitest';
import type { AgentSessionRef } from '../../../shared/automation/types';
import { TerminalAutomationRuntime, type AutomationRuntimeHost } from './agent-runtime';

const file = '.nand/terminal-agent/00000000-0000-0000-0000-000000000000/automation-sessions.json';
const row = (id: string, at: number): AgentSessionRef => ({ agentId: 'codex', sessionId: id, cwd: '/vault', title: 'Prompt', accountKey: '{}', modifiedAtMs: at });
function fixture() {
	const files = new Map<string, string>();
	const adapter = {
		exists: async (path: string) => files.has(path),
		read: async (path: string) => { const text = files.get(path); if (text === undefined) throw new Error('missing'); return text; },
		write: async (path: string, text: string) => { files.set(path, text); },
		mkdir: async () => {},
	};
	const app = { vault: { adapter }, workspace: { containerEl: { win: {} } }, loadLocalStorage: () => '00000000-0000-0000-0000-000000000000' } as unknown as App;
	const create = () => new TerminalAutomationRuntime({ app } as AutomationRuntimeHost);
	return { files, adapter, create };
}
const loaded = (runtime: TerminalAutomationRuntime): Promise<void> => Reflect.get(runtime, 'loaded') as Promise<void>;
const persist = (runtime: TerminalAutomationRuntime): Promise<void> => Reflect.apply(Reflect.get(runtime, 'persistRegistry') as () => Promise<void>, runtime, []);
function receive(runtime: TerminalAutomationRuntime, id: string, at: number) {
	const slot = { since: 0, action: { agentId: 'codex', cwd: '/vault', prompt: 'Prompt' }, accountKey: '{}' };
	Reflect.apply(Reflect.get(runtime, 'receive') as (...args: unknown[]) => void, runtime, [slot, { event: 'SessionStart', at, data: { session_id: id } }]);
}

test('independent external and local sessions merge across successive hook events', async () => {
	const f = fixture(), runtime = f.create();
	const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
	try {
		await loaded(runtime);
		f.files.set(file, JSON.stringify([row('external', 1)]));
		receive(runtime, 'local', 2); await persist(runtime);
		receive(runtime, 'local', 3); await persist(runtime);
		expect(JSON.parse(f.files.get(file)!).sort((a: AgentSessionRef, b: AgentSessionRef) => a.sessionId.localeCompare(b.sessionId))).toEqual([row('external', 1), row('local', 3)]);
	} finally { runtime.dispose(); errors.mockRestore(); }
});

test('immediate reopening observes every write admitted before disposal', async () => {
	const f = fixture(), runtime = f.create();
	await loaded(runtime);
	let release!: () => void, entered!: () => void;
	const gate = new Promise<void>(resolve => { release = resolve; }), blocked = new Promise<void>(resolve => { entered = resolve; });
	const write = f.adapter.write;
	let block = true;
	f.adapter.write = async (path, text) => { if (block && path === file) { block = false; entered(); await gate; } await write(path, text); };
	const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
	try {
		receive(runtime, 'first', 1); await blocked;
		receive(runtime, 'first', 2); runtime.dispose();
		const reopened = f.create();
		release(); await loaded(reopened);
		expect(Reflect.get(reopened, 'registry')).toEqual([row('first', 2)]);
		receive(reopened, 'second', 3); await persist(reopened);
		expect(JSON.parse(f.files.get(file)!)).toEqual([row('first', 2), row('second', 3)]);
		reopened.dispose();
	} finally { release(); await persist(runtime); errors.mockRestore(); }
});
