import { useState } from 'react';
import { expect, test, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '../ui/react/test-providers';
import { ShellRoot, type ShellProps } from './ShellRoot';
import { t } from '../shared/i18n';
const preferences = {
	visible: true,
	segments: {},
	usageMode: 'verbose',
	usageDisplay: 'used',
	mirrorToObsidian: false,
} as const;
const base: ShellProps = {
	state: { target: { feature: 'contacts' }, panelOpen: true, panelWidth: 280, focus: false, lastTargets: {} },
	rail: [
		{ id: 'contacts', label: 'Contacts', icon: 'user', slot: 'top' },
		{ id: 'settings', label: 'Settings', icon: 'settings', slot: 'bottom' },
	],
	title: 'Contacts',
	panelTitle: 'Contacts',
	panel: {
		searchable: true,
		sections: [{ id: 'rows', items: [{ id: 'one', label: 'One', target: { feature: 'contacts' } }] }],
	},
	statuses: [],
	statusBar: preferences,
	setStatusBar: vi.fn(),
	busy: false,
	ownerWindow: window,
	phone: false,
	onRail: () => 'toggled',
	onOpen: vi.fn(),
	onNavigate: vi.fn(),
	onPanelOpen: vi.fn(),
	onPanelWidth: vi.fn(),
	more: vi.fn(),
	retry: vi.fn(),
	report: vi.fn(),
	contentRef: null,
	panelCustomRef: null,
};
afterEach(() => vi.restoreAllMocks());
function size(width: number) {
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
		width,
		height: 800,
		left: 0,
		top: 0,
		bottom: 800,
		right: width,
		x: 0,
		y: 0,
		toJSON() {},
	});
}
test('F6 cycles rail, panel, page and status; reverse traversal and hidden panel are respected', async () => {
	size(1200);
	const user = userEvent.setup();
	const { container, rerender } = render(
		<TestProviders>
			<ShellRoot {...base} />
		</TestProviders>,
	);
	screen.getByRole('button', { name: 'Contacts' }).focus();
	for (const region of ['panel', 'page', 'status', 'rail']) {
		await user.keyboard('{F6}');
		expect(document.activeElement?.closest('[data-shell-region]')?.getAttribute('data-shell-region')).toBe(region);
	}
	await user.keyboard('{Shift>}{F6}{/Shift}');
	expect(document.activeElement?.closest('[data-shell-region]')?.getAttribute('data-shell-region')).toBe('status');
	rerender(
		<TestProviders>
			<ShellRoot {...base} panel={undefined} />
		</TestProviders>,
	);
	expect(container.querySelector('[data-shell-region="panel"]')).toBeNull();
	screen.getByRole('button', { name: 'Contacts' }).focus();
	await user.keyboard('{F6}');
	expect(document.activeElement?.closest('[data-shell-region]')?.getAttribute('data-shell-region')).toBe('page');
});
test.each([800, 500])('overlay at %i owns focus and Escape restores trigger', async (width) => {
	size(width);
	const user = userEvent.setup();
	render(
		<TestProviders>
			<ShellRoot {...base} />
		</TestProviders>,
	);
	const trigger = screen.getByRole('button', { name: t('workbench.toggleNavigation') });
	await user.click(trigger);
	await waitFor(() => expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true));
	await user.keyboard('{Escape}');
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	expect(document.activeElement).toBe(trigger);
});
test('open medium drawer cycles F6 and Tab through rail and panel only, in both directions', async () => {
	size(800);
	const user = userEvent.setup();
	render(
		<TestProviders>
			<ShellRoot {...base} />
		</TestProviders>,
	);
	await user.click(screen.getByRole('button', { name: t('workbench.toggleNavigation') }));
	const region = () => document.activeElement?.closest('[data-shell-region]')?.getAttribute('data-shell-region');
	expect(region()).toBe('panel');
	for (const key of ['{Shift>}{F6}{/Shift}', '{F6}']) {
		await user.keyboard(key);
		expect(region()).toBe('rail');
		await user.keyboard(key);
		expect(region()).toBe('panel');
	}
	for (const shift of [false, true]) {
		const visited = new Set();
		for (let i = 0; i < 12; i++) {
			await user.tab({ shift });
			expect(['rail', 'panel']).toContain(region());
			visited.add(region());
		}
		expect(visited).toEqual(new Set(['rail', 'panel']));
	}
});
test('closing a drawer opened from the medium rail restores its remounted trigger', async () => {
	size(800);
	const user = userEvent.setup();
	render(
		<TestProviders>
			<ShellRoot {...base} />
		</TestProviders>,
	);
	await user.click(screen.getByRole('button', { name: 'Contacts' }));
	expect(screen.getByRole('dialog')).toBeTruthy();
	await user.keyboard('{Escape}');
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Contacts' }));
});
test.each([500, 800])('open drawer survives narrow/medium transitions starting at %i', async (initialWidth) => {
	size(initialWidth);
	let resize = () => {};
	vi.spyOn(window, 'ResizeObserver').mockImplementation(
		class implements ResizeObserver {
			constructor(private callback: ResizeObserverCallback) {}
			observe(target: Element) {
				if (target.classList.contains('nand-shell')) resize = () => this.callback([], this);
			}
			unobserve() {}
			disconnect() {}
		},
	);
	const user = userEvent.setup();
	const { container } = render(
		<TestProviders>
			<ShellRoot {...base} />
		</TestProviders>,
	);
	const trigger = screen.getByRole('button', { name: t('workbench.toggleNavigation') });
	await user.click(trigger);
	const dialog = screen.getByRole('dialog');
	const search = dialog.querySelector('input')!;
	await user.type(search, 'One');
	const resizeTo = async (width: number) => {
		size(width);
		await act(async () => resize());
	};
	for (const width of [800, 500, 800, 500, 800]) {
		await resizeTo(width);
		expect(container.querySelector('.nand-shell')?.getAttribute('data-layout')).toBe(
			width === 800 ? 'medium' : 'narrow',
		);
		expect(screen.getByRole('dialog')).toBe(dialog);
		expect(document.activeElement).toBe(search);
		expect(search.value).toBe('One');
		expect(document.querySelectorAll('[data-shell-region="rail"]')).toHaveLength(1);
	}
	await user.keyboard('{Escape}');
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	expect(document.activeElement).toBe(trigger);
	await user.click(trigger);
	await resizeTo(1200);
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	await resizeTo(800);
	expect(screen.queryByRole('dialog')).toBeNull();
});
test.each([800, 500])('rail navigates once at %i and preserves the layout overlay policy', async (width) => {
	size(width);
	const selected = vi.fn();
	function Fixture() {
		const [state, setState] = useState(base.state);
		return (
			<ShellRoot
				{...base}
				state={state}
				panelTitle={state.target.feature}
				onRail={(feature) => {
					selected(feature);
					if (state.target.feature === feature) return 'toggled';
					setState({ ...state, target: { feature } });
					return 'navigated';
				}}
			/>
		);
	}
	const user = userEvent.setup();
	render(
		<TestProviders>
			<Fixture />
		</TestProviders>,
	);
	await user.click(screen.getByRole('button', { name: t('workbench.toggleNavigation') }));
	await user.click(screen.getByRole('button', { name: 'Settings' }));
	expect(selected).toHaveBeenCalledExactlyOnceWith('settings');
	if (width === 800) await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	else {
		expect(screen.getByRole('dialog', { name: 'settings' })).toBeTruthy();
		await user.click(screen.getByRole('button', { name: 'Settings' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	}
});
test('separator supports arrows, bounds, reset and pointer commit', async () => {
	size(1200);
	const changed = vi.fn();
	render(
		<TestProviders>
			<ShellRoot {...base} onPanelWidth={changed} />
		</TestProviders>,
	);
	const separator = screen.getByRole('separator');
	fireEvent.keyDown(separator, { key: 'ArrowRight' });
	expect(changed).toHaveBeenLastCalledWith(288);
	fireEvent.keyDown(separator, { key: 'End' });
	expect(changed).toHaveBeenLastCalledWith(500);
	fireEvent.keyDown(separator, { key: 'Home' });
	expect(changed).toHaveBeenLastCalledWith(220);
	fireEvent.doubleClick(separator);
	expect(changed).toHaveBeenLastCalledWith(280);
	fireEvent.pointerDown(separator, { button: 0, clientX: 332, pointerId: 1 });
	fireEvent.pointerMove(separator, { clientX: 372, pointerId: 1 });
	fireEvent.pointerUp(separator, { pointerId: 1 });
	expect(changed).toHaveBeenLastCalledWith(320);
});
test('status visibility menu changes preferences, hide and restore preserve them', async () => {
	size(1200);
	const user = userEvent.setup();
	let saved = preferences as ShellProps['statusBar'];
	function Fixture() {
		const [value, setValue] = useState(saved);
		return (
			<ShellRoot
				{...base}
				statusBar={value}
				setStatusBar={(v) => {
					saved = v;
					setValue(v);
				}}
				statuses={[{ id: 'notifications', icon: 'bell', label: 'Three unread', count: 3, order: 90 }]}
			/>
		);
	}
	const { unmount } = render(
		<TestProviders>
			<Fixture />
		</TestProviders>,
	);
	fireEvent.contextMenu(screen.getByLabelText(t('shell.statusBar')));
	await user.click(await screen.findByRole('menuitemcheckbox', { name: t('shell.notifications') }));
	expect(saved.segments.notifications).toBe(false);
	expect(screen.queryByRole('button', { name: 'Three unread' })).toBeNull();
	unmount();
	render(
		<TestProviders>
			<Fixture />
		</TestProviders>,
	);
	expect(screen.queryByRole('button', { name: 'Three unread' })).toBeNull();
});
test('chrome none preserves the independent page slot without a shell header', () => {
	size(1200);
	const { container } = render(
		<TestProviders>
			<ShellRoot {...base} chrome="none" />
		</TestProviders>,
	);
	expect(container.querySelector('.nand-page-header')).toBeNull();
	expect(container.querySelector('.nand-shell-pages')).not.toBeNull();
});

test.each(['tab', 'split'] as const)(
	'rail context %s releases the drawer before opening and never steals destination focus',
	async (placement) => {
		size(800);
		const user = userEvent.setup();
		const destination = document.createElement('input');
		document.body.appendChild(destination);
		const onOpen = vi.fn(() => {
			expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull();
			expect(document.querySelector('[role="menu"]')).toBeNull();
			expect(document.body.style.pointerEvents).toBe('');
			expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
			destination.focus();
		});
		const { container } = render(
			<TestProviders>
				<ShellRoot {...base} onOpen={onOpen} />
			</TestProviders>,
		);
		const slot = container.querySelector('.nand-shell-pages');
		await user.click(screen.getByRole('button', { name: 'Contacts' }));
		fireEvent.contextMenu(screen.getByRole('button', { name: 'Settings' }));
		await user.click(
			await screen.findByRole('menuitem', {
				name: t(placement === 'tab' ? 'workbench.openStandalone' : 'workbench.openSplit'),
			}),
		);
		expect(onOpen).toHaveBeenCalledExactlyOnceWith('settings', placement);
		await user.keyboard('destination');
		expect(document.activeElement).toBe(destination);
		expect(destination.value).toBe('destination');
		expect(container.querySelector('.nand-shell-pages')).toBe(slot);
		destination.remove();
	},
);

test.each(['sheet', 'sheet-menu', 'rail-menu', 'panel-menu', 'panel-dropdown', 'status-menu', 'usage-menu'] as const)(
	'hiding a leaf clears %s without unmounting its page or restoring focus, and showing does not reopen it',
	async (kind) => {
		size(kind.startsWith('sheet') ? 800 : 1200);
		const user = userEvent.setup();
		const snapshot = {
			refreshing: false,
			providers: [{ id: 'codex', name: 'Codex', windows: [{ label: '5h', usedPercent: 20 }] }],
		};
		const usage = {
			snapshot: () => snapshot,
			subscribe: () => () => {},
			refresh: async () => {},
			setDisplay: () => {},
		};
		const panel = {
			...base.panel,
			sections: [
				{
					id: 'rows',
					items: [{ id: 'one', label: 'One', menu: () => [{ title: 'Row action', run: () => {} }] }],
				},
			],
		};
		const renderLeaf = (visible: boolean) => (
			<>
				<TestProviders>
					<ShellRoot {...base} visible={visible} usage={usage} panel={panel} />
				</TestProviders>
				<input aria-label="Destination" />
			</>
		);
		const { container, rerender } = render(renderLeaf(true));
		const slot = container.querySelector('.nand-shell-pages')!;
		const draft = document.createElement('input');
		draft.value = 'preserved draft';
		slot.appendChild(draft);
		if (kind.startsWith('sheet')) await user.click(screen.getByRole('button', { name: 'Contacts' }));
		if (kind === 'sheet-menu' || kind === 'rail-menu')
			fireEvent.contextMenu(screen.getByRole('button', { name: 'Contacts' }));
		if (kind === 'panel-menu') fireEvent.contextMenu(screen.getByRole('button', { name: 'One' }));
		if (kind === 'panel-dropdown')
			await user.click(container.querySelector<HTMLButtonElement>('aside button[aria-label]')!);
		if (kind === 'status-menu') fireEvent.contextMenu(screen.getByLabelText(t('shell.statusBar')));
		if (kind === 'usage-menu') await user.click(screen.getByRole('button', { name: t('shell.usage') }));
		await waitFor(() => expect(document.querySelector('[role="dialog"], [role="menu"]')).not.toBeNull());
		rerender(renderLeaf(false));
		expect(document.querySelector('[role="dialog"], [role="menu"], [data-slot="tooltip-content"]')).toBeNull();
		expect(document.body.style.pointerEvents).toBe('');
		expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
		const destination = screen.getByRole('textbox', { name: 'Destination' });
		await user.click(destination);
		await user.keyboard('first click');
		expect(document.activeElement).toBe(destination);
		expect((destination as HTMLInputElement).value).toBe('first click');
		rerender(renderLeaf(true));
		expect(document.querySelector('[role="dialog"], [role="menu"]')).toBeNull();
		expect(container.querySelector('.nand-shell-pages')).toBe(slot);
		expect(draft.isConnected).toBe(true);
		expect(draft.value).toBe('preserved draft');
		expect(document.activeElement).toBe(destination);
	},
);
