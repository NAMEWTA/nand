import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu } from '../../../../scripts/obsidian-stub';
import type { AgentUsage, StatusBarPreferences, StatusSegment, UsageSnapshot } from '../../contracts/workbench';
import { setLanguage, t } from '../../../shared/i18n';
import { registerObsidianStatus, type ObsidianStatusHost } from './obsidian-status';

// The Obsidian DOM helpers the status bar code relies on (happy-dom has no such extensions).
const helpers: Record<string, unknown> = {
	win: { get: () => window },
	createEl: (tag: string, options: { cls?: string; attr?: Record<string, string> } = {}, self?: HTMLElement) => {
		const el = document.createElement(tag);
		if (options.cls) el.className = options.cls;
		for (const [name, value] of Object.entries(options.attr ?? {})) el.setAttribute(name, value);
		self?.appendChild(el);
		return el;
	},
};
const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
beforeAll(() => {
	Object.defineProperty(proto, 'win', { configurable: true, get: () => window });
	Object.defineProperty(proto, 'createEl', { configurable: true, value(this: HTMLElement, tag: string, options?: { cls?: string; attr?: Record<string, string> }) { return (helpers.createEl as Function)(tag, options, this); } });
	Object.defineProperty(proto, 'createSpan', { configurable: true, value(this: HTMLElement, options?: { cls?: string }) { return (helpers.createEl as Function)('span', options, this); } });
	Object.defineProperty(proto, 'addClass', { configurable: true, value(this: HTMLElement, ...names: string[]) { this.classList.add(...names); } });
	Object.defineProperty(proto, 'setText', { configurable: true, value(this: HTMLElement, text: string) { this.textContent = text; } });
	Object.defineProperty(proto, 'toggleClass', { configurable: true, value(this: HTMLElement, name: string, on: boolean) { this.classList.toggle(name, on); } });
});
afterAll(() => {
	for (const name of ['win', 'createEl', 'createSpan', 'addClass', 'setText', 'toggleClass']) delete proto[name];
});

const segment = (id: string, order: number, extra: Partial<StatusSegment> = {}): StatusSegment => ({ id, icon: 'bell', label: `${id} label`, order, ...extra });
const providers: UsageSnapshot['providers'] = [
	{ id: 'claude', name: 'Claude', windows: [{ label: '5h', usedPercent: 42 }] },
	{ id: 'codex', name: 'Codex', windows: [{ label: '7d', usedPercent: 91 }] },
];

function fixture(overrides: { segments?: StatusSegment[]; preferences?: StatusBarPreferences; snapshot?: UsageSnapshot } = {}) {
	const bar = document.body.createDiv({ cls: 'status-bar' });
	const listeners = new Set<() => void>();
	let snapshot: UsageSnapshot = overrides.snapshot ?? { providers, refreshing: false };
	const released = vi.fn();
	const observeWindow = vi.fn(() => released);
	const usage: AgentUsage = {
		snapshot: () => snapshot,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		refresh: vi.fn(async () => {}),
		setDisplay: () => {},
		observeWindow,
	};
	let preferences: StatusBarPreferences = overrides.preferences ?? { segments: {}, usageMode: 'verbose', usageDisplay: 'used' };
	let segments = overrides.segments ?? [];
	let service: AgentUsage | undefined = usage;
	const open = vi.fn(async () => {});
	const disposers: Array<() => void> = [];
	const plugin = {
		// Like Obsidian: every item stays registered with the plugin until the plugin unloads.
		addStatusBarItem: () => {
			const el = bar.createDiv({ cls: 'status-bar-item' });
			disposers.push(() => el.remove());
			return el;
		},
		register: (fn: () => void) => disposers.push(fn),
	};
	const host: ObsidianStatusHost = {
		segments: () => segments,
		preferences: () => preferences,
		setPreferences: async (next) => {
			preferences = next;
			status.refresh();
		},
		usage: () => service,
		open,
		report: (error) => {
			throw error;
		},
	};
	const status = registerObsidianStatus(plugin as never, host);
	active.push(status);
	status.refresh();
	return {
		bar,
		usage,
		open,
		observeWindow,
		released,
		status,
		disposers,
		get preferences() {
			return preferences;
		},
		setSegments(next: StatusSegment[]) {
			segments = next;
			status.refresh();
		},
		setService(next: AgentUsage | undefined) {
			service = next;
			status.refresh();
		},
		setSnapshot(next: UsageSnapshot) {
			snapshot = next;
			for (const listener of [...listeners]) listener();
		},
	};
}

const active: Array<{ dispose: () => void }> = [];
afterEach(() => {
	for (const status of active.splice(0)) status.dispose();
	document.body.replaceChildren();
	setLanguage('en');
});

test('each visible segment is its own status bar item with icon, text, tone and a working click target', async () => {
	const f = fixture({
		segments: [
			segment('agents-waiting', 10, { icon: 'circle-help', count: 2, tone: 'attention', target: { feature: 'terminal', section: 'running' } }),
			segment('sync:repo', 50, { label: '3 changes', icon: 'git-branch' }),
		],
		snapshot: { providers: [], refreshing: false },
	});
	const items = [...f.bar.querySelectorAll<HTMLElement>('[data-status-segment]')];
	expect(items.map((el) => el.dataset.statusSegment)).toEqual(['agents-waiting', 'sync:repo']);
	expect(items[0]!.dataset.tone).toBe('attention');
	expect(items[0]!.querySelector('.nand-status-text')?.textContent).toBe('2');
	expect(items[0]!.querySelector('.nand-status-icon')?.getAttribute('data-icon')).toBe('circle-help');
	expect(items[1]!.querySelector('.nand-status-text')?.textContent).toBe('3 changes');
	fireEvent.click(items[0]!.querySelector('button')!);
	expect(f.open).toHaveBeenCalledWith({ feature: 'terminal', section: 'running' }, window);
	fireEvent.click(items[1]!.querySelector('button')!);
	expect(f.open).toHaveBeenCalledTimes(1);
	expect(items[1]!.querySelector('button')!.getAttribute('aria-disabled')).toBe('true');
});

test('segments follow contribution changes without a workbench and keep their order', () => {
	const f = fixture({ segments: [segment('notifications', 90, { count: 3 })], snapshot: { providers: [], refreshing: false } });
	f.setSegments([segment('automations', 30, { count: 1 }), segment('notifications', 90, { count: 4 })]);
	const ids = () => [...f.bar.querySelectorAll<HTMLElement>('[data-status-segment]')].map((el) => el.dataset.statusSegment);
	expect(ids()).toEqual(['automations', 'notifications']);
	expect(f.bar.querySelector('[data-status-segment="notifications"] .nand-status-text')?.textContent).toBe('4');
	f.setSegments([]);
	expect(ids()).toEqual([]);
	expect(f.bar.querySelectorAll('.status-bar-item:not([hidden])')).toHaveLength(0);
});

test('hidden preferences keep an item out of the bar', () => {
	const f = fixture({
		segments: [segment('sync:repo', 50), segment('notifications', 90)],
		preferences: { segments: { sync: false, usage: false }, usageMode: 'verbose', usageDisplay: 'used' },
	});
	expect([...f.bar.querySelectorAll<HTMLElement>('[data-status-segment]')].map((el) => el.dataset.statusSegment)).toEqual(['notifications']);
	expect(f.bar.querySelector('.nand-status-usage:not([hidden])')).toBeNull();
	expect(f.observeWindow).not.toHaveBeenCalled();
});

test('right-click lists every item as a checkable entry and writes the preference', () => {
	const f = fixture({ segments: [segment('notifications', 90, { count: 1 })] });
	fireEvent.contextMenu(f.bar.querySelector('[data-status-segment="notifications"]')!);
	const menu = Menu.last!;
	const entry = (title: string) => menu.items.find((item) => item.title === title)!;
	expect(entry(t('shell.usage')).checked).toBe(true);
	expect(entry(t('shell.notifications')).checked).toBe(true);
	expect(entry(`${t('shell.usageMode')} · ${t('shell.verbose')}`).checked).toBe(true);
	expect(entry(`${t('shell.usageMode')} · ${t('shell.compact')}`).checked).toBe(false);
	entry(t('shell.notifications')).click();
	return waitFor(() => {
		expect(f.preferences.segments.notifications).toBe(false);
		expect(f.bar.querySelector('[data-status-segment="notifications"]')).toBeNull();
	}).then(() => {
		fireEvent.contextMenu(f.bar.querySelector('.nand-status-usage')!);
		Menu.last!.items.find((item) => item.title === t('shell.usage'))!.click();
		return waitFor(() => {
			expect(f.preferences.segments).toEqual({ notifications: false, usage: false });
			expect(f.bar.querySelector('.nand-status-usage:not([hidden])')).toBeNull();
		});
	});
});

test('right-click can switch the usage display and detail', async () => {
	const f = fixture();
	await screen.findByRole('button', { name: t('shell.usage') });
	fireEvent.contextMenu(f.bar.querySelector('.nand-status-usage')!);
	Menu.last!.items.find((item) => item.title === `${t('shell.usageDisplay')} · ${t('shell.remaining')}`)!.click();
	Menu.last!.items.find((item) => item.title === `${t('shell.usageMode')} · ${t('shell.compact')}`)!.click();
	await waitFor(() => expect(f.preferences).toMatchObject({ usageDisplay: 'remaining', usageMode: 'compact' }));
	await waitFor(() => expect(f.bar.textContent).toContain('58%'));
});

test('usage item shows icon and percentages, observes its window and opens the roster panel', async () => {
	const user = userEvent.setup();
	const f = fixture();
	const trigger = await screen.findByRole('button', { name: t('shell.usage') });
	expect(f.observeWindow).toHaveBeenCalledWith(window);
	expect(f.bar.querySelector('.nand-status-usage')?.firstElementChild?.classList.contains('nand-ui')).toBe(true);
	expect(trigger.textContent).toContain('42% 5h');
	expect(trigger.textContent).toContain('91% 7d');
	await user.click(trigger);
	const menu = await screen.findByRole('menu');
	expect(menu.textContent).toContain('Claude');
	expect(menu.closest('.nand-portal-root')).not.toBeNull();
	await user.click(await screen.findByRole('menuitem', { name: new RegExp(t('shell.usageDetails')) }));
	expect(f.open).toHaveBeenCalledWith({ feature: 'terminal', section: 'usage' }, window);
	await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
});

test('the panel refresh button calls the usage service', async () => {
	const user = userEvent.setup();
	const f = fixture();
	await user.click(await screen.findByRole('button', { name: t('shell.usage') }));
	await user.click(await screen.findByRole('menuitem', { name: t('shell.refreshUsage') }));
	expect(f.usage.refresh).toHaveBeenCalled();
});

test('usage leaves with the service, returns with a new one and is released on dispose', async () => {
	const f = fixture();
	await screen.findByRole('button', { name: t('shell.usage') });
	f.setService(undefined);
	expect(f.bar.querySelector('.nand-status-usage:not([hidden])')).toBeNull();
	expect(f.released).toHaveBeenCalledTimes(1);
	f.setService(f.usage);
	await screen.findByRole('button', { name: t('shell.usage') });
	expect(f.observeWindow).toHaveBeenCalledTimes(2);
	// An empty provider list hides the entry instead of showing a permanent placeholder.
	f.setSnapshot({ providers: [], refreshing: false });
	await waitFor(() => expect(f.bar.querySelector('.nand-status-usage:not([hidden])')).toBeNull());
	f.setSnapshot({ providers, refreshing: false });
	await screen.findByRole('button', { name: t('shell.usage') });
	f.setSegments([segment('notifications', 90, { count: 1 })]);
	f.status.dispose();
	expect(f.bar.querySelectorAll('.status-bar-item')).toHaveLength(0);
	expect(document.querySelector('.nand-ui button[aria-label]')).toBeNull();
	expect(f.released.mock.calls.length).toBe(3);
});

test('more providers than fit fold into a +N chip while the busiest stay visible', async () => {
	fixture({
		snapshot: {
			refreshing: false,
			providers: [
				{ id: 'claude', name: 'Claude', windows: [{ label: '5h', usedPercent: 5 }] },
				{ id: 'codex', name: 'Codex', windows: [{ label: '5h', usedPercent: 90 }] },
				{ id: 'gemini', name: 'Gemini', windows: [{ label: '5h', usedPercent: 70 }] },
			],
		},
	});
	const trigger = await screen.findByRole('button', { name: t('shell.usage') });
	expect(trigger.querySelector('[data-usage-more]')?.textContent).toBe('+1');
	expect(trigger.textContent).toContain('90%');
	expect(trigger.textContent).not.toContain('5% 5h');
});

test('labels follow the language', async () => {
	const f = fixture({ segments: [segment('notifications', 90, { count: 1 })] });
	await screen.findByRole('button', { name: t('shell.usage') });
	setLanguage('zh');
	await screen.findByRole('button', { name: '用量' });
	f.status.dispose();
});

test('items that appear and disappear repeatedly are reused, so host registrations stay bounded', async () => {
	const f = fixture({ snapshot: { providers: [], refreshing: false } });
	const waiting = segment('agents-waiting', 10, { count: 1 });
	const running = segment('agents-running', 20, { count: 2 });
	const registered = () => f.disposers.length;
	const visible = () => [...f.bar.querySelectorAll<HTMLElement>('[data-status-segment]')].map((el) => el.dataset.statusSegment);
	f.setSegments([waiting, running]);
	const peak = registered();
	for (let i = 0; i < 25; i++) {
		f.setSegments([]);
		expect(visible()).toEqual([]);
		f.setSegments(i % 2 ? [waiting, running] : [running, waiting].sort((a, b) => a.order - b.order));
		expect(visible()).toEqual(['agents-waiting', 'agents-running']);
	}
	// A different set of ids (one repository row after another) reuses the same two elements.
	for (let i = 0; i < 10; i++) f.setSegments([segment(`sync:repo-${i}`, 50, { label: `r${i}` })]);
	expect(visible()).toEqual(['sync:repo-9']);
	expect(registered()).toBe(peak);
	expect(f.bar.querySelectorAll('.status-bar-item')).toHaveLength(2);
	// Usage appears and disappears through the preference and the service, too.
	const usageShown = () => Boolean(f.bar.querySelector('.nand-status-usage:not([hidden]) button'));
	for (let i = 0; i < 12; i++) {
		f.setSnapshot({ providers: i % 2 ? providers : [], refreshing: false });
		await waitFor(() => expect(usageShown()).toBe(i % 2 === 1));
	}
	for (let i = 0; i < 6; i++) {
		f.setService(undefined);
		expect(usageShown()).toBe(false);
		f.setService(f.usage);
		await waitFor(() => expect(usageShown()).toBe(true));
	}
	f.setService(f.usage);
	f.setSnapshot({ providers, refreshing: false });
	await waitFor(() => expect(f.bar.querySelector('.nand-status-usage:not([hidden]) button')).not.toBeNull());
	expect(f.bar.querySelectorAll('.nand-status-usage')).toHaveLength(1);
	expect(registered()).toBeLessThanOrEqual(peak + 1);
	expect(f.observeWindow.mock.calls.length - f.released.mock.calls.length).toBe(1);
	f.status.dispose();
	expect(f.bar.querySelectorAll('.status-bar-item')).toHaveLength(0);
});
