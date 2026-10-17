import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createStore } from 'zustand/vanilla';
import { TestProviders } from '../../../../ui/react/test-providers';
import type { NativeSurfaceContext } from '../../../../ui/native-surface';
import { setLanguage, t } from '../../../../shared/i18n';
import type { HomeWidgetKind } from '../../api';
import { DEFAULT_DASHBOARD_SETTINGS } from '../../core/board/types/model';
import type { BoardStore } from '../../services/board-store';
import { homeServices } from '../../services/instances';
import { indexWidgetProviders } from '../../core/board/widget-registry';
import { BoardCanvas } from './BoardCanvas';

const probe: HomeWidgetKind = {
	key: 'probe',
	titleKey: 'probe.title',
	icon: 'box',
	category: 'tools',
	sizes: { S: { w: 3, h: 10 }, M: { w: 4, h: 20 }, L: { w: 6, h: 30 }, XL: { w: 12, h: 40 } },
	defaultTier: 'M',
	minSize: { w: 2, h: 6 },
	instances: () => [{ id: 'default' }],
	render: (host) => {
		host.textContent = 'probe content';
	},
};

function fixture(
	widgets = [{ memberId: 'probe:probe:default', provider: 'probe', kind: 'probe', instanceId: 'default' }],
	kinds: HomeWidgetKind[] = [probe],
) {
	setLanguage('en');
	homeServices.widgets = indexWidgetProviders([{ module: 'probe', bundle: { kinds } }]);
	const sync = {
		setBoardTiles: vi.fn(async (_tiles: unknown[]) => {}),
		setBoardMembers: vi.fn(async () => {}),
		addToCanvas: vi.fn(async () => {}),
		deleteColumn: vi.fn(async () => {}),
		deleteCard: vi.fn(async () => {}),
	};
	const data = {
		banner: { quote: '', author: '', image: '' },
		quickActions: [],
		columns: [],
		layout: 'immersive',
		widgets,
		immersive: [{ id: 'widget:probe:probe:default', w: 4, cap: 20, x: 0, y: 0, fixed: true }],
	};
	const state = createStore(() => ({
		path: 'dashboard',
		settings: structuredClone(DEFAULT_DASHBOARD_SETTINGS),
		data,
		widgetRevision: 0,
		generation: 0,
		files: [],
		dialog: null as 'section' | null,
	}));
	const store = {
		view: () => store,
		state,
		sync,
		host: { openSettings: vi.fn() },
		image: async () => '',
		setDialog: vi.fn(),
	} as unknown as BoardStore;
	render(
		<TestProviders>
			<BoardCanvas store={store} context={{} as NativeSurfaceContext} mobile={false} />
		</TestProviders>,
	);
	return { store, sync, state };
}

/** happy-dom has no layout: the grid is desktop wide (not projected) and the tile toolbar width is chosen per test. */
let toolbarWidth = 1200;
beforeEach(() => {
	toolbarWidth = 1200;
	Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
		configurable: true,
		get(this: HTMLElement) {
			return this.classList.contains('nand-immersive-toolbar') ? toolbarWidth : 1200;
		},
	});
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
});

test('outside edit mode a board shows no editing controls and starts no drag', () => {
	const { sync } = fixture();
	expect(screen.getByRole('button', { name: t('canvas.edit') })).toBeTruthy();
	expect(screen.queryByRole('button', { name: t('canvas.done') })).toBeNull();
	expect(document.querySelector('[data-grid-action]')).toBeNull();
	const tile = document.querySelector<HTMLElement>('[data-tile]')!;
	fireEvent.pointerDown(tile, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
	fireEvent.pointerMove(tile, { clientX: 200, clientY: 200, pointerId: 1 });
	fireEvent.pointerUp(tile, { clientX: 200, clientY: 200, pointerId: 1 });
	expect(sync.setBoardTiles).not.toHaveBeenCalled();
});

test('edit mode shows move, size, fit and remove controls and Done leaves it', () => {
	fixture();
	fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
	expect(document.querySelector('[data-tile] [data-grid-action="move"]')).not.toBeNull();
	expect(document.querySelector('[data-tile] [data-grid-action="resize"]')).not.toBeNull();
	expect(document.querySelector('.nand-immersive-grid')?.getAttribute('data-editing')).toBe('true');
	for (const tier of ['S', 'M', 'L', 'XL'])
		expect(
			screen.getByRole('button', {
				name: t('canvas.setSize', { name: t('probe.title'), size: t(`canvas.size.${tier}`) }),
			}),
		).toBeTruthy();
	// the tile is exactly its medium tier
	expect(
		screen
			.getByRole('button', { name: t('canvas.setSize', { name: t('probe.title'), size: t('canvas.size.M') }) })
			.getAttribute('aria-pressed'),
	).toBe('true');
	fireEvent.click(screen.getByRole('button', { name: t('canvas.done') }));
	expect(document.querySelector('[data-grid-action]')).toBeNull();
});

test('switching a size tier saves the tile once at the tier cells', () => {
	const { sync } = fixture();
	fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
	fireEvent.click(
		screen.getByRole('button', { name: t('canvas.setSize', { name: t('probe.title'), size: t('canvas.size.L') }) }),
	);
	expect(sync.setBoardTiles).toHaveBeenCalledTimes(1);
	expect(sync.setBoardTiles.mock.calls[0]?.[0]).toEqual([
		expect.objectContaining({ id: 'widget:probe:probe:default', w: 6, cap: 30, fixed: true }),
	]);
});

test('the add panel searches, previews a size and adds the widget in one write at that size', async () => {
	const { sync } = fixture([]);
	fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
	fireEvent.click(screen.getByRole('button', { name: t('canvas.addWidget') }));
	fireEvent.change(screen.getByLabelText(t('canvas.search')), { target: { value: 'zzz' } });
	expect(screen.getByText(t('canvas.empty'))).toBeTruthy();
	fireEvent.change(screen.getByLabelText(t('canvas.search')), { target: { value: 'probe' } });
	const entry = document.querySelector<HTMLElement>('[data-widget-entry="probe"]')!;
	expect(entry).not.toBeNull();
	fireEvent.click(entry.querySelector<HTMLButtonElement>('button[title="' + t('canvas.size.XL') + '"]')!);
	expect(entry.querySelector<HTMLElement>('[data-testid="footprint"]')?.style.width).toBe('100%');
	fireEvent.click(screen.getByRole('button', { name: t('home.widget.addNamed', { name: t('probe.title') }) }));
	await waitFor(() => expect(sync.addToCanvas).toHaveBeenCalledTimes(1));
	expect(sync.addToCanvas).toHaveBeenCalledWith(
		{ member: { memberId: 'probe:probe:default', provider: 'probe', kind: 'probe', instanceId: 'default' } },
		{ w: 12, h: 40 },
	);
	expect(document.querySelector('[data-widget-entry]')).toBeNull();
});

test('removing a widget writes the member list once', () => {
	const { sync } = fixture();
	fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
	fireEvent.click(screen.getByRole('button', { name: t('home.widget.removeNamed', { name: t('probe.title') }) }));
	expect(sync.setBoardMembers).toHaveBeenCalledExactlyOnceWith([]);
});

test('a contributed widget mounts through its render and is released when its member goes', async () => {
	const { state } = fixture();
	await waitFor(() => expect(document.querySelector('[data-tile]')?.textContent).toContain('probe content'));
	// Removing the provider's member keeps the saved tile as a placeholder; the provider's view is released.
	act(() => state.setState({ data: { ...state.getState().data!, widgets: [] } }));
	expect(document.querySelector('[data-tile]')?.textContent).not.toContain('probe content');
});

test('the add-section command opens the add-widget panel', () => {
	const { state } = fixture();
	expect(document.querySelector('[data-widget-entry]')).toBeNull();
	act(() => state.setState({ dialog: 'section' }));
	expect(document.querySelector('[data-widget-entry="probe"]')).not.toBeNull();
});

test('REVIEW: a timer revision does not cancel a keyboard layout gesture', () => {
	const { state, sync } = fixture();
	fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
	const handle = document.querySelector('[data-grid-action="move"]')!;
	fireEvent.keyDown(handle, { key: 'Enter' });
	fireEvent.keyDown(handle, { key: 'ArrowDown' });
	expect(document.querySelector('[data-lifted="true"]')).not.toBeNull();
	for (let tick = 1; tick <= 3; tick++) act(() => state.setState({ widgetRevision: tick }));
	expect(document.querySelector('[data-lifted="true"]')).not.toBeNull();
	fireEvent.keyDown(handle, { key: 'Enter' });
	expect(sync.setBoardTiles).toHaveBeenCalledTimes(1);
});

test('the add panel follows provider registration and instance changes without a board edit', () => {
	const listeners = new Set<() => void>();
	homeServices.watchWidgets = (listener) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	};
	try {
		fixture();
		fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
		fireEvent.click(screen.getByRole('button', { name: t('canvas.addWidget') }));
		expect(document.querySelector('[data-widget-entry="newprovider"]')).toBeNull();
		const added = { ...probe, key: 'newprovider', titleKey: 'newprovider.title' };
		homeServices.widgets = indexWidgetProviders([{ module: 'probe', bundle: { kinds: [probe, added] } }]);
		act(() => listeners.forEach((listener) => listener()));
		expect(document.querySelector('[data-widget-entry="newprovider"]')).not.toBeNull();
		homeServices.widgets = indexWidgetProviders([{ module: 'probe', bundle: { kinds: [probe] } }]);
		act(() => listeners.forEach((listener) => listener()));
		expect(document.querySelector('[data-widget-entry="newprovider"]')).toBeNull();
	} finally {
		delete homeServices.watchWidgets;
	}
});

test('settings changes (instance lists) refresh the add panel too', () => {
	const { state } = fixture();
	fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
	fireEvent.click(screen.getByRole('button', { name: t('canvas.addWidget') }));
	const added = { ...probe, key: 'newprovider', titleKey: 'newprovider.title' };
	homeServices.widgets = indexWidgetProviders([{ module: 'probe', bundle: { kinds: [probe, added] } }]);
	act(() => state.setState({ settings: { ...state.getState().settings }, files: [] }));
	expect(document.querySelector('[data-widget-entry="newprovider"]')).not.toBeNull();
});

test('a contributed widget receives the new board path after the board is switched', async () => {
	const original = probe.render;
	const mounts: string[] = [];
	const released: string[] = [];
	probe.render = (_host, ctx) => {
		mounts.push(ctx.boardPath);
		return () => released.push(ctx.boardPath);
	};
	try {
		const { state } = fixture();
		await waitFor(() => expect(mounts).toEqual(['dashboard']));
		act(() => state.setState({ path: 'other-board', data: { ...state.getState().data! } }));
		await waitFor(() => expect(mounts).toEqual(['dashboard', 'other-board']));
		expect(released).toEqual(['dashboard']);
	} finally {
		probe.render = original;
	}
});

test('configure and create lifetimes end when the canvas goes away or the board changes', async () => {
	let signal: AbortSignal | undefined;
	let finish: () => void = () => {};
	probe.configure = async (ctx) => {
		signal = ctx.signal;
		await new Promise<void>((resolve) => (finish = resolve));
	};
	try {
		fixture();
		fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
		fireEvent.click(screen.getByRole('button', { name: t('canvas.settings', { name: t('probe.title') }) }));
		await waitFor(() => expect(signal).toBeDefined());
		expect(signal?.aborted).toBe(false);
		cleanup();
		expect(signal?.aborted).toBe(true);
	} finally {
		finish();
		delete probe.configure;
	}
});

test('a late create result is dropped when the board changed meanwhile and a revoked provider aborts its lifetime', async () => {
	let signal: AbortSignal | undefined;
	let finish: (value: { id: string } | null) => void = () => {};
	const creating: HomeWidgetKind = {
		...probe,
		key: 'maker',
		titleKey: 'maker.title',
		multiple: true,
		create: (ctx) => {
			signal = ctx.signal;
			return new Promise((resolve) => (finish = resolve));
		},
	};
	homeServices.watchWidgets = () => () => {};
	try {
		const { state, sync } = fixture([], [probe, creating]);
		fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
		fireEvent.click(screen.getByRole('button', { name: t('canvas.addWidget') }));
		fireEvent.click(screen.getByRole('button', { name: t('home.widget.createNamed', { name: t('maker.title') }) }));
		await waitFor(() => expect(signal).toBeDefined());
		act(() => state.setState({ path: 'other-board' }));
		expect(signal?.aborted).toBe(true);
		await act(async () => finish({ id: 'late' }));
		expect(sync.addToCanvas).not.toHaveBeenCalled();
	} finally {
		delete homeServices.watchWidgets;
	}
});

test('a narrow tile keeps every action reachable: the bar sheds size buttons into a menu, then delete', async () => {
	let { sync } = fixture();
	fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
	const name = t('probe.title');
	const bar = () => document.querySelector<HTMLElement>('.nand-immersive-toolbar')!;
	expect(bar().dataset.toolbarMode).toBe('full');
	cleanup();
	toolbarWidth = 200;
	({ sync } = fixture());
	fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
	expect(bar().dataset.toolbarMode).toBe('compact');
	expect(screen.queryByRole('button', { name: t('canvas.setSize', { name, size: t('canvas.size.L') }) })).toBeNull();
	const remove = screen.getByRole('button', { name: t('home.widget.removeNamed', { name }) });
	expect(bar().contains(remove)).toBe(true);
	fireEvent.pointerDown(screen.getByRole('button', { name: t('canvas.moreActions', { name }) }), {
		button: 0,
		ctrlKey: false,
		pointerType: 'mouse',
	});
	const large = await screen.findByRole('menuitemcheckbox', {
		name: t('canvas.setSize', { name, size: t('canvas.size.L') }),
	});
	fireEvent.click(large);
	await waitFor(() => expect(sync.setBoardTiles).toHaveBeenCalledTimes(1));
	cleanup();
	toolbarWidth = 100;
	({ sync } = fixture());
	fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
	expect(bar().dataset.toolbarMode).toBe('tiny');
	expect(screen.queryByRole('button', { name: t('home.widget.removeNamed', { name }) })).toBeNull();
	fireEvent.pointerDown(screen.getByRole('button', { name: t('canvas.moreActions', { name }) }), {
		button: 0,
		ctrlKey: false,
		pointerType: 'mouse',
	});
	fireEvent.click(await screen.findByRole('menuitem', { name: t('home.widget.removeNamed', { name }) }));
	await waitFor(() => expect(sync.setBoardMembers).toHaveBeenCalledExactlyOnceWith([]));
});

test('banners are multi-instance: an extra banner is created, placed and edited on its own data', async () => {
	const banner: HomeWidgetKind = {
		...probe,
		key: 'banner',
		titleKey: 'home.widget.banner',
		multiple: true,
		instances: () => [{ id: 'default' }],
		create: async () => ({ id: 'banner-extra' }),
	};
	const { sync } = fixture([], [banner]);
	fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
	fireEvent.click(screen.getByRole('button', { name: t('canvas.addWidget') }));
	// the original banner (default instance) and a brand-new one are both offered
	expect(
		screen.getByRole('button', { name: t('home.widget.addNamed', { name: t('home.widget.banner') }) }),
	).toBeTruthy();
	fireEvent.click(
		screen.getByRole('button', { name: t('home.widget.createNamed', { name: t('home.widget.banner') }) }),
	);
	await waitFor(() => expect(sync.addToCanvas).toHaveBeenCalledTimes(1));
	expect(sync.addToCanvas).toHaveBeenCalledWith(
		{
			member: {
				memberId: 'probe:banner:banner-extra',
				provider: 'probe',
				kind: 'banner',
				instanceId: 'banner-extra',
			},
		},
		expect.any(Object),
	);
});

test('touch input needs 44px targets: the bar grows with them and sheds controls earlier', () => {
	const original = window.matchMedia;
	window.matchMedia = ((query: string) => ({
		matches: query.includes('coarse'),
		media: query,
		addEventListener() {},
		removeEventListener() {},
	})) as unknown as typeof window.matchMedia;
	try {
		toolbarWidth = 357;
		fixture();
		fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
		const bar = document.querySelector<HTMLElement>('.nand-immersive-toolbar')!;
		// 357px fits the desktop full row but not eight 44px targets
		expect(bar.dataset.toolbarMode).toBe('compact');
		expect(bar.className).not.toMatch(/(^|\s)h-9(\s|$)/);
		expect(bar.className).toContain('min-h-9');
		cleanup();
		toolbarWidth = 460;
		fixture();
		fireEvent.click(screen.getByRole('button', { name: t('canvas.edit') }));
		expect(document.querySelector<HTMLElement>('.nand-immersive-toolbar')!.dataset.toolbarMode).toBe('full');
	} finally {
		window.matchMedia = original;
	}
});
