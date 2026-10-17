import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createStore } from 'zustand/vanilla';
import { toast } from 'sonner';
import type { AgentDispatchRequest } from '../../../agent/api';
import type { AgentUsage } from '../../../agent/api';
import type { UsageSnapshot } from '../../../../app/contracts/workbench';
import { TestProviders } from '../../../../ui/react/test-providers';
import { setLanguage, t } from '../../../../shared/i18n';
import { DEFAULT_DASHBOARD_SETTINGS } from '../../core/board/types/model';
import { normalizeDashboardSettings } from '../../core/board/settings';
import type { ShortcutButton } from '../../core/board/shortcut-buttons';
import type { BoardStore } from '../../services/board-store';
import { UsageWidget } from './UsageWidget';
import { ShortcutsWidget } from './ShortcutsWidget';

vi.mock('sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

let box = { width: 400, height: 300 };
beforeEach(() => {
	setLanguage('en');
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => box.width);
	vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => box.height);
	const Observer = class {
		constructor(private readonly callback: () => void) {}
		observe() {
			this.callback();
		}
		disconnect() {}
		unobserve() {}
	};
	Object.assign(globalThis, { ResizeObserver: Observer });
	Object.assign(window, { ResizeObserver: Observer });
});
afterEach(() => {
	cleanup();
	vi.mocked(toast).mockClear();
	vi.restoreAllMocks();
	box = { width: 400, height: 300 };
});

const claude = {
	id: 'claude',
	name: 'Claude',
	account: 'work',
	windows: [
		{ key: '5h', label: '5h', usedPercent: 42, resetsAt: Date.now() + 90 * 60_000 },
		{ key: '7d', label: '7d', usedPercent: 63, resetsAt: Date.now() + 3 * 86_400_000 },
	],
};
const codex = { id: 'codex', name: 'Codex', windows: [{ key: '5h', label: '5h', usedPercent: 91 }] };
const quiet = { id: 'gemini', name: 'Gemini', windows: [], status: 'idle', statusLabel: 'Not signed in' };

function usageFixture(providers: UsageSnapshot['providers']) {
	let snapshot: UsageSnapshot = { providers, refreshing: false };
	const listeners = new Set<() => void>();
	const refresh = vi.fn(async () => {});
	const usage: AgentUsage = {
		snapshot: () => snapshot,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		refresh,
		setDisplay: () => {},
	};
	const watchers = new Set<() => void>();
	let current: AgentUsage | undefined = usage;
	const widgets = {
		usage: () => current,
		watchUsage: (listener: () => void) => {
			watchers.add(listener);
			return () => watchers.delete(listener);
		},
	};
	const store = { widgets } as unknown as BoardStore;
	return {
		store,
		refresh,
		set(next: UsageSnapshot) {
			snapshot = next;
			for (const listener of [...listeners]) listener();
		},
		setService(next: AgentUsage | undefined) {
			current = next;
			for (const listener of [...watchers]) listener();
		},
		subscribers: () => listeners.size,
	};
}

test('usage at small size shows only the busiest provider, with no title row', () => {
	box = { width: 200, height: 90 };
	const f = usageFixture([claude, codex, quiet]);
	render(
		<TestProviders>
			<UsageWidget store={f.store} />
		</TestProviders>,
	);
	expect(document.querySelectorAll('[data-usage-provider]')).toHaveLength(1);
	expect(screen.getByText('Codex')).toBeTruthy();
	expect(screen.getByText('91%')).toBeTruthy();
	expect(screen.queryByText(t('home.widget.usage'))).toBeNull();
});

test('usage at small size keeps a refresh control, also while empty, and disables it while refreshing', () => {
	box = { width: 200, height: 90 };
	const f = usageFixture([codex]);
	render(
		<TestProviders>
			<UsageWidget store={f.store} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByLabelText(t('usage.refresh')));
	expect(f.refresh).toHaveBeenCalledTimes(1);
	expect(screen.getByLabelText(t('usage.refresh')).hasAttribute('data-hit-control')).toBe(true);
	act(() => f.set({ providers: [], refreshing: false }));
	expect(screen.getByText(t('usage.empty'))).toBeTruthy();
	expect(screen.getByLabelText(t('usage.refresh'))).toBeTruthy();
	act(() => f.set({ providers: [codex], refreshing: true }));
	expect((screen.getByLabelText(t('usage.refresh')) as HTMLButtonElement).disabled).toBe(true);
});

test('usage in Chinese spells reset times and statuses in Chinese and shows no raw status code', () => {
	setLanguage('zh');
	box = { width: 300, height: 260 };
	const raw = { id: 'gemini', name: 'Gemini', windows: [], status: 'idle', failed: false };
	const f = usageFixture([claude, raw]);
	render(
		<TestProviders>
			<UsageWidget store={f.store} />
		</TestProviders>,
	);
	const text = document.body.textContent ?? '';
	expect(text).toContain('尚未加载');
	expect(text).toContain('小时');
	expect(text).not.toMatch(/\bidle\b|\d+h \d+m|\d+d \d+h/);
	setLanguage('en');
});

test('usage at medium size lists every provider busiest first with its earliest reset', () => {
	box = { width: 300, height: 160 };
	const f = usageFixture([claude, codex, quiet]);
	render(
		<TestProviders>
			<UsageWidget store={f.store} />
		</TestProviders>,
	);
	const order = [...document.querySelectorAll('[data-usage-provider]')].map((el) => el.getAttribute('data-usage-provider'));
	expect(order).toEqual(['codex', 'claude', 'gemini']);
	expect(screen.getByText('Not signed in')).toBeTruthy();
	expect(screen.getByText(t('usage.resetsIn', { time: '1h 30m' }))).toBeTruthy();
	expect(screen.getByText(t('home.widget.usage'))).toBeTruthy();
});

test('usage at large size lists every window and refreshes on request', async () => {
	box = { width: 360, height: 280 };
	const f = usageFixture([claude, codex]);
	render(
		<TestProviders>
			<UsageWidget store={f.store} />
		</TestProviders>,
	);
	const row = document.querySelector('[data-usage-provider="claude"]') as HTMLElement;
	expect(within(row).getByText('5h')).toBeTruthy();
	expect(within(row).getByText('7d')).toBeTruthy();
	expect(within(row).getByText('42%')).toBeTruthy();
	fireEvent.click(screen.getByLabelText(t('usage.refresh')));
	expect(f.refresh).toHaveBeenCalledTimes(1);
});

test('usage follows snapshots, the service coming and going, and releases its subscription', async () => {
	box = { width: 300, height: 160 };
	const f = usageFixture([codex]);
	const view = render(
		<TestProviders>
			<UsageWidget store={f.store} />
		</TestProviders>,
	);
	expect(f.subscribers()).toBe(1);
	act(() => f.set({ providers: [codex, claude], refreshing: false }));
	expect(document.querySelectorAll('[data-usage-provider]')).toHaveLength(2);
	act(() => f.setService(undefined));
	await screen.findByText(t('usage.unavailable'));
	expect(f.subscribers()).toBe(0);
	const blank: UsageSnapshot = { providers: [], refreshing: false };
	act(() => f.setService({ snapshot: () => blank, subscribe: () => () => {}, refresh: async () => {}, setDisplay: () => {} }));
	await screen.findByText(t('usage.empty'));
	view.unmount();
});

test('usage tones the percentage by how close the limit is', () => {
	box = { width: 300, height: 160 };
	const f = usageFixture([{ ...codex, windows: [{ label: '5h', usedPercent: 97 }] }, { ...claude, windows: [{ label: '5h', usedPercent: 85 }] }]);
	render(
		<TestProviders>
			<UsageWidget store={f.store} />
		</TestProviders>,
	);
	expect(screen.getByText('97%').className).toContain('text-destructive');
	expect(screen.getByText('85%').className).toContain('text-status-warning');
});

function shortcutsFixture(
	buttons: ShortcutButton[],
	options: { files?: string[]; commands?: string[]; runCommand?: boolean; automations?: boolean; quick?: boolean } = {},
) {
	const board = { current: true };
	const state = createStore(() => ({
		settings: { ...structuredClone(DEFAULT_DASHBOARD_SETTINGS), shortcutButtons: buttons },
		path: 'Board',
		data: { skills: [] },
		files: [],
	}));
	const openFile = vi.fn(async (_path: string) => {}),
		runCommand = vi.fn((_id: string) => options.runCommand ?? true),
		runAction = vi.fn(async (_id: string) => {}),
		runQuick = vi.fn(async (_id: string) => {}),
		dispatch = vi.fn(async (_request: AgentDispatchRequest) => ({ invocationId: 'x', delivery: 'started' as const })),
		save = vi.fn(async () => {});
	const commands = options.commands ?? ['editor:toggle-pin', 'app:reload'],
		files = options.files ?? ['Notes/Inbox.md'];
	const store = {
		state,
		openFile,
		isCurrent: () => board.current,
		settings: save,
		hasFile: (path: string) => files.includes(path),
		hasCommand: (id: string) => commands.includes(id),
		runCommand,
		hotkeysOf: (id: string) => (id === 'editor:toggle-pin' ? ['Mod', 'Shift', 'P'] : []),
		commands: () => commands.map((id) => ({ id, name: id === 'editor:toggle-pin' ? 'Toggle pin' : id })),
		searchFiles: () => [],
		host: {
			automationHost:
				options.automations === false
					? undefined
					: { actions: () => [{ id: 'daily', name: 'Daily digest', running: false }], runAction },
		},
		widgets: {
			acquireDispatch: async () => ({ dispatch }),
			agents: () => [{ id: 'codex', title: 'Codex', enabled: true, installed: true }],
			quickCommands:
				options.quick === false
					? () => undefined
					: () => ({
							list: () => [{ id: 'q1', name: 'Build', type: 'terminal' as const, scope: 'vault' as const }],
							subscribe: () => () => {},
							run: runQuick,
						}),
		},
	} as unknown as BoardStore;
	return { store, board, openFile, runCommand, runAction, runQuick, dispatch, save };
}
const buttons: ShortcutButton[] = [
	{ id: 'a', label: 'Inbox', icon: 'inbox', type: 'file', target: 'Notes/Inbox.md' },
	{ id: 'b', label: 'Pin', icon: 'pin', type: 'command', target: 'editor:toggle-pin' },
	{ id: 'c', label: 'Digest', icon: 'zap', type: 'automation', target: 'daily' },
	{ id: 'd', label: 'Review', icon: 'bot', type: 'agent', target: '', agentId: 'codex', prompt: 'Review today' },
	{ id: 'e', label: 'Build it', icon: 'square-terminal', type: 'quick', target: 'q1' },
];
const messages = () => vi.mocked(toast).mock.calls.map((call) => String(call[0]));

test('shortcut buttons act at once, say what they start, and report the agent delivery', async () => {
	const f = shortcutsFixture(buttons);
	render(
		<TestProviders>
			<ShortcutsWidget store={f.store} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByLabelText('Inbox'));
	fireEvent.click(screen.getByLabelText('Pin'));
	fireEvent.click(screen.getByLabelText('Digest'));
	fireEvent.click(screen.getByLabelText('Build it'));
	await waitFor(() => expect(f.runQuick).toHaveBeenCalledTimes(1));
	expect(f.openFile).toHaveBeenCalledExactlyOnceWith('Notes/Inbox.md');
	expect(f.runCommand).toHaveBeenCalledExactlyOnceWith('editor:toggle-pin');
	expect(f.runAction).toHaveBeenCalledExactlyOnceWith('daily');
	expect(f.runQuick).toHaveBeenCalledExactlyOnceWith('q1');
	fireEvent.click(screen.getByLabelText('Review'));
	await waitFor(() => expect(f.dispatch).toHaveBeenCalledTimes(1));
	expect(f.dispatch.mock.calls[0]?.[0]).toMatchObject({
		agentId: 'codex',
		finalPrompt: 'Review today',
		destination: { kind: 'fresh', cwd: '' },
		source: { kind: 'widget', path: 'Board.md', id: 'shortcuts' },
	});
	await waitFor(() => expect(messages()).toContain(t('home.skills.started')));
	expect(messages()).toEqual(
		expect.arrayContaining([
			t('shortcuts.running', { name: 'Pin' }),
			t('shortcuts.running', { name: 'Digest' }),
			t('shortcuts.starting', { name: 'Build it' }),
			t('shortcuts.starting', { name: 'Review' }),
		]),
	);
});

test('a saved target that is gone is named, and the user is told to edit the shortcut', async () => {
	const f = shortcutsFixture(buttons, { files: [], commands: [], automations: false, quick: false });
	render(
		<TestProviders>
			<ShortcutsWidget store={f.store} />
		</TestProviders>,
	);
	for (const label of ['Inbox', 'Pin', 'Digest', 'Build it']) fireEvent.click(screen.getByLabelText(label));
	await waitFor(() => expect(messages()).toHaveLength(4));
	expect(messages()).toEqual([
		t('shortcuts.missing.file', { name: 'Inbox' }),
		t('shortcuts.missing.command', { name: 'Pin' }),
		t('shortcuts.unavailable.automation', { name: 'Digest' }),
		t('shortcuts.unavailable.quick', { name: 'Build it' }),
	]);
	expect(messages()[0]).toContain(t('shortcuts.missing.file', { name: 'Inbox' }));
	expect(f.openFile).not.toHaveBeenCalled();
	expect(f.runCommand).not.toHaveBeenCalled();
	expect(f.runAction).not.toHaveBeenCalled();
	expect(f.runQuick).not.toHaveBeenCalled();
});

test('a command Obsidian refuses to run is reported instead of looking done', async () => {
	const f = shortcutsFixture([buttons[1]!], { runCommand: false });
	render(
		<TestProviders>
			<ShortcutsWidget store={f.store} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByLabelText('Pin'));
	await waitFor(() => expect(messages()).toContain(t('shortcuts.failed.command', { name: 'Pin' })));
});

test('an agent that is not installed and a deleted automation or quick command do not run', async () => {
	const f = shortcutsFixture(
		[
			{ id: 'd', label: 'Review', icon: 'bot', type: 'agent', target: '', agentId: 'gemini-cli', prompt: 'go' },
			{ id: 'c', label: 'Digest', icon: 'zap', type: 'automation', target: 'deleted' },
			{ id: 'e', label: 'Build it', icon: 'x', type: 'quick', target: 'gone' },
		],
	);
	render(
		<TestProviders>
			<ShortcutsWidget store={f.store} />
		</TestProviders>,
	);
	for (const label of ['Review', 'Digest', 'Build it']) fireEvent.click(screen.getByLabelText(label));
	await waitFor(() => expect(messages()).toHaveLength(3));
	expect(messages()).toEqual([
		t('shortcuts.missing.agent', { name: 'Review' }),
		t('shortcuts.missing.automation', { name: 'Digest' }),
		t('shortcuts.missing.quick', { name: 'Build it' }),
	]);
	expect(f.dispatch).not.toHaveBeenCalled();
});

test('a run that throws names the shortcut and the reason', async () => {
	const f = shortcutsFixture([buttons[2]!]);
	f.runAction.mockRejectedValueOnce(new Error('disk full'));
	render(
		<TestProviders>
			<ShortcutsWidget store={f.store} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByLabelText('Digest'));
	await waitFor(() => expect(messages()).toContain(t('shortcuts.failed', { name: 'Digest', detail: 'disk full' })));
});

test('every control of the new widgets keeps a 32px (44px touch) hit area', () => {
	const f = shortcutsFixture(buttons);
	box = { width: 360, height: 200 };
	render(
		<TestProviders>
			<ShortcutsWidget store={f.store} />
		</TestProviders>,
	);
	const small = [...document.querySelectorAll<HTMLElement>('button')].filter((button) => button.className.match(/\bh-(?:5|6|7)\b|\bsize-5\b/));
	// A control drawn smaller than 32px must carry the pseudo-element hit area (`data-hit-control`).
	for (const button of small) expect(button.hasAttribute('data-hit-control'), button.outerHTML.slice(0, 120)).toBe(true);
	expect(screen.getByLabelText(t('shortcuts.configure')).hasAttribute('data-hit-control')).toBe(true);
	for (const label of ['Inbox', 'Pin']) expect(screen.getByLabelText(label).className).toContain('h-8');
});

test('shortcut layout follows the tile: icons only when narrow, hotkeys when there is room', () => {
	const f = shortcutsFixture(buttons);
	box = { width: 140, height: 80 };
	const view = render(
		<TestProviders>
			<ShortcutsWidget store={f.store} />
		</TestProviders>,
	);
	expect(document.querySelector('[data-shortcuts-layout="icons"]')).toBeTruthy();
	expect(screen.queryByText('Inbox')).toBeNull();
	view.unmount();
	box = { width: 360, height: 200 };
	render(
		<TestProviders>
			<ShortcutsWidget store={f.store} />
		</TestProviders>,
	);
	expect(document.querySelector('[data-shortcuts-layout="rows"]')).toBeTruthy();
	expect(screen.getByText('Inbox')).toBeTruthy();
	expect(screen.getByText('Shift')).toBeTruthy();
});

test('an incomplete button does nothing but say so', async () => {
	const f = shortcutsFixture([{ id: 'x', label: 'Empty', icon: 'zap', type: 'command', target: '' }]);
	render(
		<TestProviders>
			<ShortcutsWidget store={f.store} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByLabelText('Empty'));
	await waitFor(() => expect(messages()).toEqual([t('shortcuts.incomplete', { name: 'Empty' })]));
	expect(f.runCommand).not.toHaveBeenCalled();
	expect(f.dispatch).not.toHaveBeenCalled();
});

test('the editor drafts changes, saves them once and writes nothing on cancel', async () => {
	const f = shortcutsFixture([]);
	render(
		<TestProviders>
			<ShortcutsWidget store={f.store} />
		</TestProviders>,
	);
	expect(screen.getByText(t('shortcuts.empty'))).toBeTruthy();
	fireEvent.click(screen.getByLabelText(t('shortcuts.configure')));
	const dialog = await screen.findByRole('dialog');
	fireEvent.click(within(dialog).getByText(t('shortcuts.add')));
	fireEvent.click(within(dialog).getByText(t('common.cancel')));
	expect(f.save).not.toHaveBeenCalled();
	fireEvent.click(screen.getByLabelText(t('shortcuts.configure')));
	const reopened = await screen.findByRole('dialog');
	fireEvent.click(within(reopened).getByText(t('shortcuts.add')));
	fireEvent.change(within(reopened).getByLabelText(t('shortcuts.label')), { target: { value: 'Pin it' } });
	fireEvent.change(within(reopened).getByLabelText(t('shortcuts.target')), { target: { value: 'pin' } });
	fireEvent.click(await within(reopened).findByText('Toggle pin'));
	fireEvent.click(within(reopened).getByText(t('common.save')));
	await waitFor(() => expect(f.save).toHaveBeenCalledTimes(1));
	const apply = (f.save.mock.calls[0] as unknown as [(settings: { shortcutButtons: ShortcutButton[] }) => void])[0];
	const settings = { shortcutButtons: [] as ShortcutButton[] };
	apply(settings);
	expect(settings.shortcutButtons).toMatchObject([{ label: 'Pin it', type: 'command', target: 'editor:toggle-pin' }]);
});

test('stored shortcut buttons are validated: unknown types, missing ids and repeats are dropped', () => {
	const normalized = normalizeDashboardSettings({
		shortcutButtons: [
			{ id: 'a', label: 'A', type: 'file', target: 'a.md', icon: 'x' },
			{ id: 'a', label: 'Again', type: 'file', target: 'b.md' },
			{ id: 'b', label: 'B', type: 'teleport', target: 'c' },
			{ label: 'No id', type: 'file', target: 'd.md' },
			{ id: 'e', label: 'E', type: 'agent', agentId: 'codex', prompt: 'go', target: 'ignored' },
			'nonsense',
		],
	});
	expect(normalized.shortcutButtons).toEqual([
		{ id: 'a', label: 'A', icon: 'x', type: 'file', target: 'a.md' },
		{ id: 'e', label: 'E', icon: 'zap', type: 'agent', target: 'ignored', agentId: 'codex', prompt: 'go' },
	]);
});

test('the editor offers the agent module\'s saved terminal quick commands and keeps the chosen id', async () => {
	const f = shortcutsFixture([]);
	render(
		<TestProviders>
			<ShortcutsWidget store={f.store} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByLabelText(t('shortcuts.configure')));
	const dialog = await screen.findByRole('dialog');
	fireEvent.click(within(dialog).getByText(t('shortcuts.add')));
	fireEvent.click(within(dialog).getByLabelText(t('shortcuts.type')));
	fireEvent.click(await screen.findByRole('option', { name: t('shortcuts.type.quick') }));
	fireEvent.click(await within(dialog).findByText('Build'));
	fireEvent.click(within(dialog).getByText(t('common.save')));
	await waitFor(() => expect(f.save).toHaveBeenCalledTimes(1));
	const apply = (f.save.mock.calls[0] as unknown as [(settings: { shortcutButtons: ShortcutButton[] }) => void])[0];
	const settings = { shortcutButtons: [] as ShortcutButton[] };
	apply(settings);
	expect(settings.shortcutButtons).toMatchObject([{ type: 'quick', target: 'q1', label: 'Build' }]);
});

test('a button pressed after its board was left does nothing and says nothing', async () => {
	const f = shortcutsFixture(buttons);
	render(
		<TestProviders>
			<ShortcutsWidget store={f.store} />
		</TestProviders>,
	);
	f.board.current = false;
	for (const label of ['Pin', 'Digest', 'Build it', 'Review']) fireEvent.click(screen.getByLabelText(label));
	await new Promise((resolve) => setTimeout(resolve, 20));
	expect(f.runCommand).not.toHaveBeenCalled();
	expect(f.runAction).not.toHaveBeenCalled();
	expect(f.runQuick).not.toHaveBeenCalled();
	expect(f.dispatch).not.toHaveBeenCalled();
	expect(messages()).toEqual([]);
});
