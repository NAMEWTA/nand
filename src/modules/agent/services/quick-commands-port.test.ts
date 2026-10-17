import { expect, test, vi } from 'vitest';
import type { QuickCommand, TerminalSettings } from '../core/terminal/settings';
import { quickCommandsPort } from './quick-commands-port';

const command = (id: string, extra: Partial<QuickCommand> = {}): QuickCommand => ({
	id,
	name: `Command ${id}`,
	type: 'terminal',
	content: `echo ${id}`,
	agentId: 'claude-code',
	cwd: '',
	scope: 'vault',
	...extra,
});

function fixture(initial: QuickCommand[]) {
	let quickCommands = initial;
	const listeners = new Set<() => void>(),
		run = vi.fn(async (_command: QuickCommand) => {});
	const port = quickCommandsPort(
		{ runQuickCommand: run },
		{
			get: () => ({ quickCommands }) as TerminalSettings,
			subscribe: (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
		},
	);
	return {
		port,
		run,
		set(next: QuickCommand[]) {
			quickCommands = next;
			for (const listener of [...listeners]) listener();
		},
		listeners,
	};
}

test('lists names, types and scopes without the command text', () => {
	const f = fixture([command('a'), command('b', { type: 'agent', agentId: 'codex', scope: 'global' })]);
	expect(f.port.list()).toEqual([
		{ id: 'a', name: 'Command a', type: 'terminal', scope: 'vault' },
		{ id: 'b', name: 'Command b', type: 'agent', scope: 'global', agentId: 'codex' },
	]);
	expect(JSON.stringify(f.port.list())).not.toContain('echo');
});

test('runs a saved command through the controller and rejects one that was deleted', async () => {
	const f = fixture([command('a')]);
	await f.port.run('a');
	expect(f.run).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'a', content: 'echo a' }));
	f.set([]);
	await expect(f.port.run('a')).rejects.toThrow();
	expect(f.run).toHaveBeenCalledTimes(1);
});

test('subscribers hear about changes until they leave', () => {
	const f = fixture([]);
	const listener = vi.fn();
	const off = f.port.subscribe(listener);
	f.set([command('a')]);
	off();
	f.set([]);
	expect(listener).toHaveBeenCalledTimes(1);
	expect(f.listeners.size).toBe(0);
});
