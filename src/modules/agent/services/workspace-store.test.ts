import { afterEach, expect, test, vi } from 'vitest';
import { createWorkspaceStore } from './workspace-store';
import { openTab, renameTab } from '../core/workspace/ops';
import type { TerminalTabData } from '../core/workspace/model';
const terminalTab = (id: string): TerminalTabData => ({
	kind: 'terminal',
	id,
	title: id,
	sessionIds: [id],
	paneLayout: { kind: 'pane', session: id },
	focusedSessionId: id,
	panes: { [id]: { cwd: '/vault' } },
	state: 'unknown',
	unread: false,
	createdAt: 1,
	updatedAt: 1,
});
import type { TextStorage } from '../../../shared/storage/ports';
afterEach(() => vi.useRealTimers());
export function memoryStorage() {
	const files = new Map<string, string>(),
		writes: string[] = [];
	const adapter: TextStorage = {
		exists: async (p) => files.has(p),
		read: async (p) => {
			if (!files.has(p)) throw new Error('missing');
			return files.get(p)!;
		},
		write: async (p, value) => {
			writes.push(p);
			files.set(p, value);
		},
		mkdir: async () => {},
	};
	return { files, writes, adapter };
}
const clock = {
	setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number,
	clearTimeout: (id: number) => clearTimeout(id),
} as Pick<Window, 'setTimeout' | 'clearTimeout'>;
test('500ms debounce writes device-owned JSON, flushes on disposal and restores inert tabs', async () => {
	vi.useFakeTimers();
	const disk = memoryStorage(),
		report = vi.fn(),
		persistence = createWorkspaceStore(disk.adapter, 'device', clock, report);
	await persistence.ready;
	persistence.store.setState((s) => openTab(s, 'g', terminalTab('a')), true);
	await vi.advanceTimersByTimeAsync(499);
	expect(disk.writes).toEqual([]);
	persistence.store.setState((s) => renameTab(s, 'a', 'title'), true);
	await vi.advanceTimersByTimeAsync(499);
	expect(disk.writes).toEqual([]);
	await vi.advanceTimersByTimeAsync(1);
	await persistence.flush();
	const path = '.nand/terminal-agent/device/workspace.json';
	expect(JSON.parse(disk.files.get(path)!).tabs.a.customTitle).toBe('title');
	persistence.store.setState((s) => renameTab(s, 'a', 'final'), true);
	await persistence.dispose();
	expect(JSON.parse(disk.files.get(path)!).tabs.a.customTitle).toBe('final');
	const restored = createWorkspaceStore(disk.adapter, 'device', clock, report);
	await restored.ready;
	expect(restored.store.getState().tabs.a).toMatchObject({
		resume: { cwd: '/vault' },
		state: 'idle',
		customTitle: 'final',
	});
	await restored.dispose();
	expect(report).not.toHaveBeenCalled();
});
test('unreadable or unsupported data is retained on disk and not overwritten by fallback edits', async () => {
	const disk = memoryStorage(),
		path = '.nand/terminal-agent/d/workspace.json';
	disk.files.set(path, '{"version":0,"legacy":"keep"}');
	const report = vi.fn(),
		persistence = createWorkspaceStore(disk.adapter, 'd', clock, report);
	await persistence.ready;
	persistence.store.setState((s) => openTab(s, 'g', terminalTab('a')), true);
	await persistence.dispose();
	expect(disk.files.get(path)).toBe('{"version":0,"legacy":"keep"}');
	expect(report).toHaveBeenCalled();
});
test('failed write is reported and memory remains usable', async () => {
	const disk = memoryStorage(),
		report = vi.fn(),
		persistence = createWorkspaceStore(disk.adapter, 'd', clock, report);
	await persistence.ready;
	disk.adapter.write = async () => {
		throw new Error('write failed');
	};
	persistence.store.setState((s) => openTab(s, 'g', terminalTab('a')), true);
	await persistence.flush();
	expect(persistence.store.getState().tabs.a).toBeDefined();
	expect(report).toHaveBeenCalled();
	await persistence.dispose();
});
