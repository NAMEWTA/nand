import { normalizeWorkspace } from '../core/workspace/ops';
import { createStore } from 'zustand/vanilla';
import { expect, test, vi } from 'vitest';
import { emptyWorkspace } from '../core/workspace/model';
import { TerminalSession } from './terminal/session';
import type { TerminalSessions } from './terminal/sessions';
import { WorkspaceService, type WorkspaceLaunchPort } from './workspace-service';
import { sessionState } from './terminal/status';
function fixture() {
	const map = new Map<string, TerminalSession>(),
		listeners = new Set<() => void>();
	let next = 0;
	const make = (agentId?: 'codex') => {
		const session = new TerminalSession({
			id: `s${next++}`,
			sid: next,
			kind: agentId ? 'agent' : 'shell',
			title: agentId ?? 'Shell',
			cwd: '/vault',
			agentId,
			cols: 80,
			rows: 24,
			scrollback: 100,
			platform: 'linux',
			colors: () => ({ foreground: '#fff', background: '#000', cursor: '#fff' }),
		});
		session.attach({ input: () => {}, resize: () => {}, acknowledge: () => {}, end: () => {} }, 1);
		map.set(session.id, session);
		session.onChange(() => listeners.forEach((fn) => fn()));
		return session;
	};
	const sessions = {
		get: (id: string) => map.get(id),
		focus: vi.fn(),
		end: vi.fn((id: string) => map.get(id)?.exit(0, null)),
		subscribe: (fn: () => void) => {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		remove: vi.fn((id: string) => {
			map.get(id)?.dispose();
			map.delete(id);
		}),
	} as unknown as TerminalSessions;
	const persistence = {
		store: createStore(emptyWorkspace),
		ready: Promise.resolve(),
		flush: async () => {},
		dispose: vi.fn(async () => {}),
	};
	const launch: WorkspaceLaunchPort = {
		shell: vi.fn(async () => make()),
		agent: vi.fn(async () => make('codex')),
		resume: vi.fn(async () => make('codex')),
		account: () => 'work',
		report: vi.fn(),
	};
	const service = new WorkspaceService(persistence, sessions, launch);
	return { service, sessions, persistence, launch, map, make, listeners };
}
test('close cancellation keeps all processes; acceptance removes all panes exactly once', async () => {
	const f = fixture();
	await f.service.newTerminal();
	const tab = f.service.active!;
	const id = [...f.map.keys()][0]!;
	await f.service.splitPane(id, 'row');
	expect(f.map.size).toBe(2);
	await f.service.close(tab.id, async () => false);
	expect(f.map.size).toBe(2);
	expect(f.service.active?.id).toBe(tab.id);
	await f.service.close(tab.id, async () => true);
	expect(f.map.size).toBe(0);
	expect(f.sessions.remove).toHaveBeenCalledTimes(2);
	expect(f.service.store.getState().groups).toEqual([]);
	await f.service.dispose();
});
test('native state transitions, hidden completion unread, visible clearing and idle aging share one slice', async () => {
	const f = fixture();
	await f.service.newAgent('codex');
	const tab = f.service.active!,
		session = [...f.map.values()][0]!;
	session.setActivity('running');
	expect(f.service.active).toMatchObject({ state: 'working', unread: false });
	session.setActivity('permission');
	expect(f.service.active).toMatchObject({ state: 'permission' });
	session.setActivity('done', { session_id: 'native', transcript_path: '/vault/.nand/log' });
	expect(f.service.active).toMatchObject({
		state: 'done',
		unread: true,
		panes: { [session.id]: { nativeSessionId: 'native', accountId: 'work' } },
	});
	const owner = {};
	f.service.setVisible(owner, [tab.id]);
	expect(f.service.active).toMatchObject({ unread: false });
	session.setActivity('running');
	session.setActivity('done');
	expect(f.service.active).toMatchObject({ unread: false });
	expect(sessionState(session, session.activityAt + 31 * 60_000)).toBe('idle');
	session.setActivity('unknown');
	session.receive(new TextEncoder().encode('output'));
	expect(sessionState(session, Date.now() + 60 * 60_000)).toBe('unknown');
	await f.service.dispose();
	expect(f.listeners.size).toBe(0);
	session.dispose();
});
test('restore keeps the tab/group/pane layout and uses original account and native id', async () => {
	const f = fixture();
	await f.service.newAgent('codex');
	const tabId = f.service.active!.id,
		session = [...f.map.values()][0]!;
	session.setActivity('done', { session_id: 'native', transcript_path: '/vault/.nand/log' });
	const groupId = f.service.group(tabId)!.id;
	f.sessions.remove(session.id);
	f.launch.account = () => 'changed-account';
	await f.service.restore(tabId);
	expect(f.launch.resume).toHaveBeenCalledWith(
		expect.objectContaining({ accountId: 'work', nativeSessionId: 'native', cwd: '/vault' }),
		'codex',
	);
	expect(f.service.active?.id).toBe(tabId);
	expect(f.service.active).toMatchObject({
		panes: {
			[f.service.active?.kind === 'terminal' ? f.service.active.focusedSessionId : '']: { accountId: 'work' },
		},
	});
	expect(f.service.group(tabId)?.id).toBe(groupId);
	await f.service.dispose();
	f.map.forEach((s) => s.dispose());
});
test('restoring a closed tab cancels the late attachment and kills its new process', async () => {
	const f = fixture();
	await f.service.newTerminal();
	const tab = f.service.active!;
	let resolve!: (s: TerminalSession) => void;
	f.launch.shell = vi.fn(
		() =>
			new Promise<TerminalSession>((r) => {
				resolve = r;
			}),
	);
	const restoring = f.service.restore(tab.id);
	await f.service.close(tab.id, async () => true);
	const late = f.make();
	resolve(late);
	await restoring;
	expect(f.service.active).toBeUndefined();
	expect(f.map.size).toBe(0);
	await f.service.dispose();
});
test('browser absent is explicit; module stop releases pending launches and persistence', async () => {
	const f = fixture();
	expect(() => f.service.newBrowser('https://example.com/')).toThrow(/browser|浏览器/i);
	await f.service.dispose();
	expect(f.persistence.dispose).toHaveBeenCalledOnce();
});

test('a Hook update while a close confirmation is open does not ask twice', async () => {
	const f = fixture();
	await f.service.newAgent('codex');
	const tab = f.service.active!,
		session = [...f.map.values()][0]!;
	const confirm = vi.fn(async () => {
		session.setActivity('permission');
		return true;
	});
	await f.service.close(tab.id, confirm);
	expect(confirm).toHaveBeenCalledOnce();
	expect(f.map.size).toBe(0);
	await f.service.dispose();
});
test('module shutdown ends a process that arrives after its pending launch', async () => {
	const f = fixture();
	let resolve!: (s: TerminalSession) => void;
	f.launch.shell = vi.fn(
		() =>
			new Promise<TerminalSession>((r) => {
				resolve = r;
			}),
	);
	const creating = f.service.newTerminal();
	await Promise.resolve();
	await f.service.dispose();
	const late = f.make();
	resolve(late);
	expect(await creating).toBeUndefined();
	expect(f.map.size).toBe(0);
	await f.service.newTerminal();
	expect(f.launch.shell).toHaveBeenCalledOnce();
});

test('end confirms, preserves the tab and stopped session, and allows restart', async () => {
	const f = fixture();
	await f.service.newTerminal();
	const tab = f.service.active!;
	await f.service.end(tab.id, async () => false);
	expect(f.sessions.end).not.toHaveBeenCalled();
	await f.service.end(tab.id, async () => true);
	expect(f.sessions.end).toHaveBeenCalledOnce();
	expect(f.service.active?.id).toBe(tab.id);
	expect([...f.map.values()][0]?.running).toBe(false);
	await f.service.restore(tab.id, undefined, true);
	expect(f.service.active?.id).toBe(tab.id);
	expect([...f.map.values()][0]?.running).toBe(true);
	await f.service.dispose();
	f.map.forEach((s) => s.dispose());
});
test('pane title and equalized geometry survive normalized persistence and explicit restart', async () => {
	const f = fixture();
	await f.service.newTerminal();
	const tabId = f.service.active!.id,
		id = [...f.map.keys()][0]!;
	await f.service.splitPane(id, 'row');
	f.service.resizePane(tabId, [], 0.7);
	f.service.renamePane(tabId, id, 'Pane A');
	f.service.equalizePanes(tabId);
	expect(f.service.active).toMatchObject({ paneLayout: { ratio: 0.5 }, panes: { [id]: { customTitle: 'Pane A' } } });
	const disk = normalizeWorkspace(JSON.parse(JSON.stringify(f.service.store.getState())));
	expect(disk.tabs[tabId]).toMatchObject({ paneLayout: { ratio: 0.5 }, panes: { [id]: { customTitle: 'Pane A' } } });
	await f.service.restore(tabId, id, true);
	const tab = f.service.active!;
	expect(tab.kind === 'terminal' && tab.panes[tab.focusedSessionId]?.customTitle).toBe('Pane A');
	await f.service.dispose();
	f.map.forEach((s) => s.dispose());
});
