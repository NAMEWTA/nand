import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createStore } from 'zustand/vanilla';
import { memoryVault } from '../../../../../scripts/fixtures/memory-vault';
import { contentFiles } from '../../../../host/obsidian/storage/content-files';
import { TestProviders } from '../../../../ui/react/test-providers';
import type { NativeSurfaceContext } from '../../../../ui/native-surface';
import { setLanguage, t } from '../../../../shared/i18n';
import type { HomeWidgetKind } from '../../api';
import { parse } from '../../core/board/parser/parse';
import { indexWidgetProviders } from '../../core/board/widget-registry';
import { DEFAULT_DASHBOARD_SETTINGS } from '../../core/board/types/model';
import { BoardStore } from '../../services/board-store';
import type { HomeHost } from '../../services/home-host';
import { homeServices } from '../../services/instances';
import { runShortcut, type ShortcutPorts } from '../../services/shortcut-run';
import { BoardCanvas } from './BoardCanvas';
import { CaptureBox } from '../quickbar/CaptureBox';

vi.mock('obsidian', async (original) => ({
	...(await original<typeof import('obsidian')>()),
	Component: class {
		load() {}
		unload() {}
	},
}));

const A = '.nand/content/A';
const B = '.nand/content/B';
const probe: HomeWidgetKind = {
	key: 'probe',
	titleKey: 'probe.title',
	icon: 'box',
	category: 'tools',
	sizes: { M: { w: 4, h: 20 } },
	defaultTier: 'M',
	minSize: { w: 2, h: 6 },
	instances: () => [{ id: 'default' }],
	render: (host) => {
		host.textContent = 'probe content';
	},
};
const member = { memberId: 'probe:probe:default', provider: 'probe', kind: 'probe', instanceId: 'default' };

beforeEach(() => {
	Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1200 });
	Object.assign(globalThis, {
		ResizeObserver: class {
			constructor(private readonly callback: (entries: unknown[]) => void) {}
			observe() {
				this.callback([]);
			}
			disconnect() {}
			unobserve() {}
		},
	});
});
afterEach(() => {
	cleanup();
	delete homeServices.widgets;
	delete homeServices.watchWidgets;
});

/** Two real boards behind a real BoardStore/SyncEngine; writing B is held back so its conversion can be observed mid-way. */
async function twoBoards(kinds: HomeWidgetKind[], bText: string) {
	setLanguage('en');
	const vault = memoryVault(
		{ [A + '.md']: '---\ncanvas: 1\nlayout: immersive\nwidgets: []\n---\n', [B + '.md']: bText },
		window,
	);
	await contentFiles(vault.app).refresh();
	homeServices.widgets = indexWidgetProviders([{ module: 'probe', bundle: { kinds } }]);
	const host = {
		app: vault.app,
		settings: structuredClone(DEFAULT_DASHBOARD_SETTINGS),
		subscribeSettings: () => () => {},
		workbenchRefresh: () => {},
	} as unknown as HomeHost;
	const store = new BoardStore(host, A, window);
	await store.init();
	render(
		<TestProviders>
			<BoardCanvas store={store} context={{} as NativeSurfaceContext} mobile={false} />
		</TestProviders>,
	);
	let release: () => void = () => {};
	const blocked = new Promise<void>((resolve) => (release = resolve));
	let reached = false;
	const write = vault.adapter.write.bind(vault.adapter);
	vault.adapter.write = async (path: string, text: string) => {
		if (path === B + '.md' && !reached) {
			reached = true;
			await blocked;
		}
		return write(path, text);
	};
	return { vault, store, release: () => release(), reached: () => reached };
}

test('a creation started on A cannot land on B while B converts: switching ends it and path+data commit together', async () => {
	let finish: (value: { id: string }) => void = () => {};
	let signal: AbortSignal | undefined;
	const maker: HomeWidgetKind = {
		...probe,
		multiple: true,
		create: (ctx) => {
			signal = ctx.signal;
			return new Promise((resolve) => (finish = resolve));
		},
	};
	const { vault, store, release, reached } = await twoBoards([maker], '---\nlayout: immersive\nwidgets: []\n---\n');
	fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
	fireEvent.click(screen.getByRole('button', { name: t('canvas.addWidget') }));
	fireEvent.click(screen.getByRole('button', { name: t('home.widget.createNamed', { name: t('probe.title') }) }));
	await waitFor(() => expect(signal).toBeDefined());
	const switching = store.switch(B);
	try {
		await waitFor(() => expect(reached()).toBe(true));
		expect(store.state.getState().switching).toBe(true);
		expect(store.state.getState().path).toBe(A);
		await waitFor(() => expect(signal?.aborted).toBe(true));
		await act(async () => finish({ id: 'created-on-A' }));
		release();
		await act(async () => switching);
		await store.sync.flush();
		expect(store.state.getState()).toMatchObject({ path: B, switching: false });
		expect(parse(vault.contents.get(B + '.md')!).widgets?.some((w) => w.instanceId === 'created-on-A')).toBe(false);
	} finally {
		release();
		await switching;
		await store.dispose();
	}
});

test('a widget only the target board has never mounts with the old board path', async () => {
	const paths: string[] = [];
	const spy: HomeWidgetKind = {
		...probe,
		render: (_host, ctx) => {
			paths.push(ctx.boardPath);
		},
	};
	const { store, release, reached } = await twoBoards(
		[spy],
		`---\nlayout: immersive\nwidgets: ${JSON.stringify([member])}\n---\n`,
	);
	const switching = store.switch(B);
	try {
		await waitFor(() => expect(reached()).toBe(true));
		await act(async () => {
			await Promise.resolve();
		});
		expect(paths).toEqual([]);
		release();
		await act(async () => switching);
		await waitFor(() => expect(paths).toEqual([B]));
	} finally {
		release();
		await switching;
		await store.dispose();
	}
});

test('a withdrawn external instance releases its view, keeps its place and ends its pending configure', async () => {
	let notify = () => {};
	homeServices.watchWidgets = (listener) => {
		notify = listener;
		return () => {};
	};
	const dispose = vi.fn();
	let configured: AbortSignal | undefined;
	let finish: () => void = () => {};
	const listing = vi.fn(() => [{ id: 'default' }]);
	const kind: HomeWidgetKind = {
		...probe,
		instances: listing,
		render: (host) => {
			host.textContent = 'instance still mounted';
			return dispose;
		},
		configure: (ctx) => {
			configured = ctx.signal;
			return new Promise<void>((resolve) => (finish = resolve));
		},
	};
	const { store } = await twoBoards([kind], '---\ncanvas: 1\nlayout: immersive\nwidgets: []\n---\n');
	act(() =>
		store.state.setState({
			data: {
				...store.state.getState().data!,
				widgets: [member],
				immersive: [{ id: 'widget:probe:probe:default', w: 4, cap: 20, x: 0, y: 0, fixed: true }],
			},
		}),
	);
	try {
		await waitFor(() => expect(document.body.textContent).toContain('instance still mounted'));
		fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
		fireEvent.click(screen.getByRole('button', { name: t('canvas.settings', { name: t('probe.title') }) }));
		await waitFor(() => expect(configured).toBeDefined());
		act(() => {
			listing.mockReturnValue([]);
			notify();
		});
		expect(document.body.textContent).not.toContain('instance still mounted');
		expect(dispose).toHaveBeenCalledTimes(1);
		expect(configured?.aborted).toBe(true);
		expect(document.body.textContent).toContain(t('home.widget.instanceMissing'));
		expect(store.state.getState().data?.widgets).toEqual([member]);
		// the instance comes back: the view mounts again
		act(() => {
			listing.mockReturnValue([{ id: 'default' }]);
			notify();
		});
		await waitFor(() => expect(document.body.textContent).toContain('instance still mounted'));
	} finally {
		finish();
		await store.dispose();
	}
});

async function boards(kinds: HomeWidgetKind[], aText: string, bText: string) {
	setLanguage('en');
	const vault = memoryVault({ [A + '.md']: aText, [B + '.md']: bText }, window);
	await contentFiles(vault.app).refresh();
	homeServices.widgets = indexWidgetProviders([{ module: 'probe', bundle: { kinds } }]);
	const host = {
		app: vault.app,
		settings: structuredClone(DEFAULT_DASHBOARD_SETTINGS),
		subscribeSettings: () => () => {},
		workbenchRefresh: () => {},
	} as unknown as HomeHost;
	const store = new BoardStore(host, A, window);
	await store.init();
	return { vault, store };
}
const withProbe = `---\ncanvas: 1\nlayout: immersive\nwidgets: ${JSON.stringify([member])}\nimmersive: [{"id":"widget:probe:probe:default","w":4,"cap":20,"x":0,"y":0,"fixed":true}]\nbanner:\n  quote: "A data"\n  author: "A"\n---\n`;
const unconverted = '---\nlayout: immersive\nwidgets: []\nbanner:\n  quote: "B data"\n  author: "B"\n---\n';

test('while switching, the old page cannot write: its controls do nothing and the engine refuses edits', async () => {
	const { vault, store } = await boards([probe], withProbe, unconverted);
	render(
		<TestProviders>
			<BoardCanvas store={store} context={{} as NativeSurfaceContext} mobile={false} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
	let release: () => void = () => {};
	const blocked = new Promise<void>((resolve) => (release = resolve));
	let reached = false;
	const write = vault.adapter.write.bind(vault.adapter);
	vault.adapter.write = async (path: string, text: string) => {
		if (path === B + '.md' && !reached) {
			reached = true;
			await blocked;
		}
		return write(path, text);
	};
	const before = vault.contents.get(A + '.md');
	const oldView = store.view(0);
	const switching = store.switch(B);
	try {
		await waitFor(() => expect(reached).toBe(true));
		expect(screen.getByText(t('canvas.switching'))).toBeTruthy();
		expect(document.querySelector('.dashboard-scroll-region')?.hasAttribute('inert')).toBe(true);
		// the old page was replaced, not just disabled: edit mode and its delete buttons are gone
		expect(
			screen.queryByRole('button', { name: t('home.widget.removeNamed', { name: t('probe.title') }) }),
		).toBeNull();
		await expect(store.sync.setBoardMembers([])).rejects.toMatchObject({ code: 'switching' });
		await expect(store.sync.updateBanner({ quote: 'x' })).rejects.toMatchObject({ code: 'switching' });
		await expect(oldView.sync.setBoardMembers([])).rejects.toMatchObject({ code: 'switching' });
		release();
		await act(async () => switching);
		await store.sync.flush();
		expect(parse(vault.contents.get(B + '.md')!).widgets?.map((m) => m.kind)).toEqual(['banner']);
		expect(vault.contents.get(A + '.md')).toBe(before);
		expect(store.state.getState()).toMatchObject({ path: B, switching: false, switchError: '' });
		// the lock is gone, but anything held from before the switch stays void
		await expect(oldView.sync.updateBanner({ quote: 'late' })).rejects.toMatchObject({ code: 'stale' });
		await expect(oldView.edit(() => {})).rejects.toMatchObject({ code: 'stale' });
		await store.sync.updateBanner({ quote: 'B edited' });
		expect(vault.contents.get(B + '.md')).toContain('B edited');
	} finally {
		release();
		await switching.catch(() => undefined);
		await store.dispose();
	}
});

test('a failed conversion write rolls back to the board being left: A path, A data, A file pointer', async () => {
	const { vault, store } = await boards([probe], withProbe, unconverted);
	const write = vault.adapter.write.bind(vault.adapter);
	let failB = true;
	vault.adapter.write = async (path: string, text: string) => {
		if (path === B + '.md' && failB) throw new Error('disk full');
		return write(path, text);
	};
	const bBefore = vault.contents.get(B + '.md');
	await expect(store.switch(B)).rejects.toThrow('disk full');
	const state = store.state.getState();
	expect(state).toMatchObject({ path: A, switching: false });
	expect(state.switchError).toContain('disk full');
	expect(state.data?.banner.quote).toBe('A data');
	// edits land on A, never on B
	await store.sync.updateBanner({ quote: 'A edited' });
	expect(vault.contents.get(A + '.md')).toContain('A edited');
	expect(vault.contents.get(B + '.md')).toBe(bBefore);
	// retry works once the disk does, and clears the error
	failB = false;
	await store.switch(B);
	expect(store.state.getState()).toMatchObject({ path: B, switching: false, switchError: '' });
	expect(store.state.getState().data?.banner.quote).toBe('B data');
	await store.dispose();
});

test('when the way back fails too the page stays read-only with the reason, and picking a board recovers', async () => {
	const { vault, store } = await boards([probe], withProbe, unconverted);
	render(
		<TestProviders>
			<BoardCanvas store={store} context={{} as NativeSurfaceContext} mobile={false} />
		</TestProviders>,
	);
	const write = vault.adapter.write.bind(vault.adapter);
	const read = vault.adapter.read.bind(vault.adapter);
	let broken = true;
	vault.adapter.write = async (path: string, text: string) => {
		if (path === B + '.md' && broken) throw new Error('disk full');
		return write(path, text);
	};
	vault.adapter.read = async (path: string) => {
		if (path === A + '.md' && broken) throw new Error('cannot read A');
		return read(path);
	};
	await expect(store.switch(B)).rejects.toThrow('disk full');
	expect(store.state.getState()).toMatchObject({ switching: true });
	expect(store.state.getState().switchError).toContain('cannot read A');
	expect(screen.getByRole('alert').textContent).toContain('cannot read A');
	await expect(store.sync.updateBanner({ quote: 'nope' })).rejects.toMatchObject({ code: 'switching' });
	broken = false;
	await store.switch(A);
	expect(store.state.getState()).toMatchObject({ path: A, switching: false, switchError: '' });
	expect(store.state.getState().data?.banner.quote).toBe('A data');
	await store.sync.updateBanner({ quote: 'A again' });
	expect(vault.contents.get(A + '.md')).toContain('A again');
	await store.dispose();
});

const sectionBoard = (body: string, quote = 'x') =>
	`---\ncanvas: 1\nlayout: immersive\nwidgets: []\nbanner:\n  quote: ${quote}\n---\n## Notes\n### Kept\nid: kept\ntype: generic\n${body}\n`;

test('a delete confirmation opened on A is closed, not hidden, when a switch starts and cannot delete on B', async () => {
	const { vault, store } = await boards([probe], sectionBoard('A text'), sectionBoard('B text'));
	const closeOverlays = vi.fn();
	(store.host as unknown as { closeOverlays: () => void }).closeOverlays = closeOverlays;
	render(
		<TestProviders>
			<BoardCanvas store={store} context={{} as NativeSurfaceContext} mobile={false} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
	fireEvent.click(screen.getByRole('button', { name: t('home.widget.removeNamed', { name: 'Notes' }) }));
	expect(screen.getByRole('dialog')).toBeTruthy();
	await act(async () => store.switch(B));
	expect(closeOverlays).toHaveBeenCalledTimes(1);
	// the dialog is gone for good, not parked until the lock is released
	expect(screen.queryByRole('dialog')).toBeNull();
	await store.sync.flush();
	expect(vault.contents.get(B + '.md')).toContain('B text');
	expect(vault.contents.get(A + '.md')).toContain('A text');
	await store.dispose();
});

test('callbacks held from before a switch are void afterwards: representative writers all refuse', async () => {
	const { vault, store } = await boards([probe], sectionBoard('A text'), sectionBoard('B text'));
	const old = store.view(0);
	await store.switch(B);
	const before = vault.contents.get(B + '.md');
	const refused = async (call: () => Promise<unknown>) => expect(call()).rejects.toMatchObject({ code: 'stale' });
	await refused(() => old.sync.deleteColumn('Notes'));
	await refused(() => old.sync.deleteCard('kept'));
	await refused(() => old.sync.setBoardTiles([]));
	await refused(() => old.sync.addToCanvas({ section: { name: 'N', type: 'sticky' } }, { w: 4, h: 20 }));
	await refused(() => old.sync.updateMemoCard('kept', { body: 'late', blockquote: '' }));
	await refused(() => old.sync.addColumn('Late'));
	await refused(() => old.sync.updateBanner({ quote: 'late' }));
	await refused(() => old.edit(() => {}));
	await refused(() => old.saveMemo('kept', 'late', 'B text'));
	await refused(() => old.archiveTasks('Notes'));
	await refused(() => old.capture('late note'));
	await store.sync.flush();
	expect(vault.contents.get(B + '.md')).toBe(before);
	// the current generation writes normally
	await store.view().sync.updateBanner({ quote: 'current' });
	expect(vault.contents.get(B + '.md')).toContain('current');
	await store.dispose();
});

test('a switch refused because the source has an unresolved conflict keeps the source exactly as it was', async () => {
	setLanguage('en');
	const source = sectionBoard('A text', 'Original');
	const { vault, store } = await boards([probe], source, source);
	vault.contents.set(A + '.md', source.replace('Original', 'Remote'));
	await expect(store.sync.updateBanner({ quote: 'Local' })).rejects.toMatchObject({ code: 'conflict' });
	expect(store.sync.getData()?.banner.quote).toBe('Local');
	const statusBefore = store.sync.getSaveState().status;
	expect(statusBefore).not.toBe('saved');
	await expect(store.switch(B)).rejects.toMatchObject({ name: 'SwitchRefusedError' });
	// the refusal names the real recovery location, never a raw placeholder
	expect(store.state.getState().switchError).not.toContain('{path}');
	expect(store.state.getState().switchError).toContain('.nand/recovery');
	// nothing was discarded: the local version, the unresolved state and the file pointer are still the source's
	expect(store.state.getState()).toMatchObject({ path: A, switching: false });
	expect(store.state.getState().switchError).not.toBe('');
	expect(store.sync.getData()?.banner.quote).toBe('Local');
	expect(store.sync.getSaveState().status).toBe(statusBefore);
	await store.dispose();
});

async function captureFixture() {
	const { vault, store } = await boards([probe], sectionBoard('A text'), sectionBoard('B text'));
	await vault.adapter.write('.nand/content/Template.md', 'template body');
	await contentFiles(vault.app).refresh();
	store.host.settings = {
		...store.host.settings,
		quickCaptureTemplate: '.nand/content/Template.md',
		quickCaptureFolder: 'Captured',
	};
	let release: () => void = () => {};
	const blocked = new Promise<void>((resolve) => (release = resolve));
	let held = false;
	const read = vault.adapter.read.bind(vault.adapter);
	vault.adapter.read = async (path: string) => {
		if (path === '.nand/content/Template.md' && !held) {
			held = true;
			await blocked;
		}
		return read(path);
	};
	return { vault, store, release: () => release(), held: () => held };
}
const type = (text: string) => {
	const box = screen.getByRole('textbox');
	fireEvent.change(box, { target: { value: text } });
	return box;
};

test('a capture finishing on A cannot clear the draft typed on B afterwards', async () => {
	const { vault, store, release, held } = await captureFixture();
	render(
		<TestProviders>
			<CaptureBox store={store.view(0)} />
		</TestProviders>,
	);
	fireEvent.keyDown(type('A submitted'), { key: 'Enter' });
	await waitFor(() => expect(held()).toBe(true));
	await act(async () => store.switch(B));
	store.view().setCaptureDraft('B unsaved draft');
	release();
	await waitFor(() => expect([...vault.contents.keys()].some((path) => path.includes('Captured/'))).toBe(true));
	await act(async () => {
		await Promise.resolve();
	});
	expect(store.state.getState().captureDraft).toBe('B unsaved draft');
	const note = [...vault.contents.entries()].find(([path]) => path.includes('Captured/'))!;
	expect(note[1]).toContain('A submitted');
	expect(note[1]).not.toContain('B unsaved draft');
	await store.dispose();
});

test('on the same board only the submitted draft is cleared: text typed during the capture stays', async () => {
	const { store, release, held } = await captureFixture();
	render(
		<TestProviders>
			<CaptureBox store={store.view()} />
		</TestProviders>,
	);
	fireEvent.keyDown(type('first'), { key: 'Enter' });
	await waitFor(() => expect(held()).toBe(true));
	type('first and more');
	release();
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 50));
	});
	expect(store.state.getState().captureDraft).toBe('first and more');
	// an untouched submission does clear
	fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
	await waitFor(() => expect(store.state.getState().captureDraft).toBe(''));
	await store.dispose();
});

test('shared page state is ignored when it comes from an older generation: dialog, preview and open', async () => {
	const { store } = await boards([probe], sectionBoard('A text'), sectionBoard('B text'));
	const old = store.view(0);
	await store.switch(B);
	old.setDialog('section');
	old.setCaptureDraft('late');
	await old.openFile('Anything.md');
	expect(store.state.getState()).toMatchObject({ dialog: null, captureDraft: '', previewPath: null });
	store.view().setDialog('section');
	expect(store.state.getState().dialog).toBe('section');
	await store.dispose();
});

test('a shortcut pressed on A and finishing after a switch to B runs nothing: command, automation, quick command and agent', async () => {
	const { vault, store, release } = await twoBoards([], '---\ncanvas: 1\nlayout: immersive\nwidgets: []\n---\n');
	release();
	const run = vi.fn(() => true);
	Object.assign(vault.app, { commands: { commands: { 'x:y': { name: 'X' } }, executeCommandById: run } });
	const old = store.view();
	await act(async () => store.switch(B));
	expect(store.state.getState().path).toBe(B);
	// The old view knows it is void; the host command is refused at the store, not only in the widget.
	expect(old.isCurrent()).toBe(false);
	expect(old.runCommand('x:y')).toBe(false);
	expect(run).not.toHaveBeenCalled();
	expect(store.view().isCurrent()).toBe(true);
	expect(store.view().runCommand('x:y')).toBe(true);
	expect(run).toHaveBeenCalledTimes(1);
	// A button callback kept from A: nothing starts and nothing is reported on B.
	const automation = vi.fn(async () => {}),
		quick = vi.fn(async () => {}),
		dispatch = vi.fn(async () => ({ invocationId: 'x', delivery: 'started' as const })),
		notify = vi.fn();
	const ports: ShortcutPorts = {
		current: () => old.isCurrent(),
		hasFile: () => true,
		openFile: async () => {},
		hasCommand: (id) => old.hasCommand(id),
		runCommand: (id) => old.runCommand(id),
		automations: () => ({ actions: () => [{ id: 'daily' }], run: automation }),
		quickCommands: () => ({ list: () => [{ id: 'q', name: 'Q', type: 'terminal', scope: 'vault' }], subscribe: () => () => {}, run: quick }),
		agents: () => [{ id: 'codex', enabled: true, installed: true }],
		dispatch: async () => ({ dispatch }),
		notify,
		boardPath: A + '.md',
	};
	const base = { icon: 'x', label: 'Held', target: '' };
	await runShortcut({ ...base, id: '1', type: 'command', target: 'x:y' }, ports);
	await runShortcut({ ...base, id: '2', type: 'automation', target: 'daily' }, ports);
	await runShortcut({ ...base, id: '3', type: 'quick', target: 'q' }, ports);
	await runShortcut({ ...base, id: '4', type: 'agent', agentId: 'codex', prompt: 'go' }, ports);
	expect(run).toHaveBeenCalledTimes(1);
	expect(automation).not.toHaveBeenCalled();
	expect(quick).not.toHaveBeenCalled();
	expect(dispatch).not.toHaveBeenCalled();
	expect(notify).not.toHaveBeenCalled();
	await store.dispose();
});

test('a shortcut that turns stale while it is starting stops before its side effect and says nothing', async () => {
	let current = true;
	const automation = vi.fn(async () => {}),
		notify = vi.fn((_message: string) => {
			current = false;
		});
	const ports: ShortcutPorts = {
		current: () => current,
		hasFile: () => true,
		openFile: async () => {},
		hasCommand: () => true,
		runCommand: () => true,
		automations: () => ({ actions: () => [{ id: 'daily' }], run: automation }),
		quickCommands: () => undefined,
		agents: () => [],
		dispatch: async () => undefined,
		notify,
		boardPath: A + '.md',
	};
	// The "Running…" acknowledgement is the last thing a board still shown may do: the board is left right after it.
	await runShortcut({ id: '1', label: 'Digest', icon: 'x', type: 'automation', target: 'daily' }, ports);
	expect(notify).toHaveBeenCalledTimes(1);
	expect(automation).not.toHaveBeenCalled();
});
