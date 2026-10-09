import { Menu, Notice, setIcon, setTooltip } from 'obsidian';
import { h, render } from 'preact';
import type { PageCreate } from '../../../../app/contracts/workbench-host';
import type { WorkbenchTarget } from '../../../../app/contracts/workbench';
import { onLanguageChanged, t } from '../../../../shared/i18n/index';
import { NativeSurface, type NativeSurfaceContext } from '../../../../ui/native-surface';
import { EmptyState } from '../../../../ui/primitives/EmptyState';
import { TabStrip } from '../../../../ui/primitives/TabStrip';
import { activeTab, activate, moveTab, sessionsOf, setRatio, type LayoutNode } from '../../core/terminal/layout';
import { openPath } from '../../platform/desktop/files';
import type { AgentController } from '../../services/controller';
import type { TerminalSession } from '../../services/terminal/session';
import { HiddenRendererRetention } from './hidden-renderer-retention';
import { mountHistory } from './history-view';
import { pickMaterial } from './material-picker';
import { promptText } from './confirm';
import { statusLabel } from '../../services/terminal/status';
import { TerminalView } from './terminal-view';
import { mountUsage } from './usage-view';

export type AgentSection = 'running' | 'history' | 'usage';
const SECTIONS: readonly AgentSection[] = ['running', 'history', 'usage'];
const retention = new HiddenRendererRetention(2);

/** A folder as its last two segments (`…/projects/vault`); the full path is the tooltip. */
export function shortPath(path: string): string {
	const parts = path.split(/[\\/]/).filter(Boolean);
	return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : path;
}

/** The agent page: terminal tabs with split panes, the history browser and usage. */
class AgentPage extends NativeSurface {
	private section: AgentSection = 'running';
	private historyKey = '';
	private readonly views = new Map<string, TerminalView>();
	private visible = true;
	private runningEl?: HTMLElement;
	private tabsEl?: HTMLElement;
	private panesEl?: HTMLElement;
	private searchEl?: HTMLElement;
	private otherEl?: HTMLElement;
	private unmountOther?: () => void;
	private drawn = '';
	/** Layout drawn into the pane area; status changes only patch the pane headers. */
	private layoutKey = '';
	private readonly bars = new Map<string, { dot: HTMLElement; title: HTMLElement; status: HTMLElement; cwd: HTMLElement; pane: HTMLElement }>();
	private shownFocus = '';
	/** Last target reported to the workbench (so tab and focus changes update its route). */
	private reported = '';

	constructor(context: NativeSurfaceContext, private readonly controller: AgentController) {
		super(context);
	}
	getViewType(): string {
		return 'nand-agent-page';
	}
	getDisplayText(): string {
		return t('workbench.agent');
	}
	getIcon(): string {
		return 'terminal';
	}

	onOpen(): Promise<void> {
		this.contentEl.addClass('nand-agent-page');
		this.register(onLanguageChanged(() => this.draw(true)));
		this.register(this.controller.subscribe(() => this.draw()));
		this.register(this.controller.settings.subscribe(() => {
			for (const view of this.views.values()) view.applySettings();
		}));
		this.draw(true);
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		for (const view of this.views.values()) view.dispose();
		this.views.clear();
		this.unmountOther?.();
		return Promise.resolve();
	}

	setVisible(visible: boolean): void {
		this.visible = visible;
		this.syncViews();
	}

	onResize(): void {
		this.syncViews();
	}

	show(target: WorkbenchTarget): void {
		const section = SECTIONS.includes(target.section as AgentSection) ? (target.section as AgentSection) : 'running';
		const changed = section !== this.section;
		this.section = section;
		if (section === 'running' && target.resourceId) {
			// A session id that no longer exists (after a restart) just opens the section.
			if (this.controller.sessions.get(target.resourceId)) this.controller.show(target.resourceId);
		}
		if (section === 'history') {
			const key = target.resourceId ?? '';
			if (key !== this.historyKey) {
				this.historyKey = key;
				this.drawn = '';
			}
		}
		this.draw(changed);
	}

	getTarget(): WorkbenchTarget {
		if (this.section === 'history') return { feature: 'terminal', section: 'history', ...(this.historyKey ? { resourceId: this.historyKey } : {}) };
		if (this.section === 'usage') return { feature: 'terminal', section: 'usage' };
		const tab = activeTab(this.controller.sessions.tabs);
		return { feature: 'terminal', section: 'running', ...(tab ? { resourceId: tab.focused } : {}) };
	}

	/** Tell the workbench when the page's own route changed (another tab or pane took focus). */
	private report(): void {
		const key = JSON.stringify(this.getTarget());
		if (key === this.reported) return;
		this.reported = key;
		this.context.changed?.();
	}

	private draw(full = false): void {
		this.drawSection(full);
		this.report();
	}

	private drawSection(full: boolean): void {
		if (full) {
			this.contentEl.empty();
			this.runningEl = this.tabsEl = this.panesEl = this.searchEl = this.otherEl = undefined;
			this.unmountOther?.();
			this.unmountOther = undefined;
			this.drawn = '';
			this.layoutKey = '';
			for (const view of this.views.values()) view.dispose();
			this.views.clear();
		}
		if (this.section === 'running') {
			this.unmountOther?.();
			this.unmountOther = undefined;
			this.otherEl?.remove();
			this.otherEl = undefined;
			this.drawRunning();
		} else {
			this.runningEl?.addClass('is-hidden');
			this.syncViews();
			const key = `${this.section}:${this.historyKey}`;
			if (this.drawn === key && this.otherEl) return;
			this.drawn = key;
			this.unmountOther?.();
			this.otherEl?.remove();
			this.otherEl = this.contentEl.createDiv({ cls: 'nand-agent-section' });
			this.unmountOther =
				this.section === 'history'
					? mountHistory(this.otherEl, this.controller, this.historyKey, (key) => void this.controller.open({ feature: 'terminal', section: 'history', ...(key ? { resourceId: key } : {}) }))
					: mountUsage(this.otherEl, this.controller);
		}
	}

	private drawRunning(): void {
		if (!this.runningEl) {
			this.runningEl = this.contentEl.createDiv({ cls: 'nand-agent-running' });
			this.tabsEl = this.runningEl.createDiv({ cls: 'nand-agent-tabs' });
			this.searchEl = this.runningEl.createDiv({ cls: 'nand-agent-search is-hidden' });
			this.panesEl = this.runningEl.createDiv({ cls: 'nand-agent-panes' });
			this.buildSearch(this.searchEl);
		}
		this.runningEl.removeClass('is-hidden');
		const state = this.controller.sessions.tabs;
		const live = new Set(state.tabs.flatMap((tab) => sessionsOf(tab.root)));
		for (const [id, view] of this.views) {
			if (!live.has(id) || !this.controller.sessions.get(id)) {
				view.dispose();
				this.views.delete(id);
			}
		}
		this.drawTabs();
		this.drawPanes();
		this.syncViews();
	}

	private drawTabs(): void {
		const tabsEl = this.tabsEl!;
		const state = this.controller.sessions.tabs;
		const tab = activeTab(state);
		render(
			state.tabs.length
				? h(TabStrip, {
						label: t('agent.sessions'),
						tabs: state.tabs.map((item) => {
							const ids = sessionsOf(item.root);
							const focused = this.controller.sessions.get(item.focused);
							const extra = ids.length > 1 ? ` +${ids.length - 1}` : '';
							return { id: item.id, title: `${focused?.title ?? t('agent.shell')}${extra}`, icon: focused?.agentId ? 'bot' : 'terminal' };
						}),
						active: tab?.id,
						onSelect: (id: string) => {
							const target = state.tabs.find((item) => item.id === id);
							if (target) this.controller.show(target.focused);
						},
						onClose: (id: string) => void this.controller.closeTab(id),
						onNew: () => this.newSessionMenu(tabsEl),
						newLabel: t('agent.newSession'),
						onMove: (from: number, to: number) => this.controller.sessions.setTabs(moveTab(this.controller.sessions.tabs, from, to)),
					})
				: null,
			tabsEl,
		);
		tabsEl.toggleClass('is-hidden', !state.tabs.length);
	}

	private newSessionMenu(anchor: HTMLElement): void {
		const rect = anchor.getBoundingClientRect();
		this.controller.newSessionMenu().showAtPosition({ x: rect.right - 8, y: rect.bottom }, anchor.doc);
	}

	private drawPanes(): void {
		const panesEl = this.panesEl!;
		const tab = activeTab(this.controller.sessions.tabs);
		const key = tab ? `${tab.id}:${JSON.stringify(tab.root)}` : `empty:${this.controller.enabledAgents().map((agent) => agent.id).join(',')}`;
		if (key === this.layoutKey) {
			for (const [id, bar] of this.bars) this.updateBar(id, bar);
			return;
		}
		this.layoutKey = key;
		this.bars.clear();
		// Detach view elements before rebuilding the split frames, so xterm keeps its DOM.
		for (const view of this.views.values()) view.el.detach();
		panesEl.empty();
		if (!tab) {
			this.drawEmpty(panesEl);
			return;
		}
		this.drawNode(panesEl, tab.id, tab.root, []);
	}

	private updateBar(id: string, bar: { dot: HTMLElement; title: HTMLElement; status: HTMLElement; cwd: HTMLElement; pane: HTMLElement }): void {
		const session = this.controller.sessions.get(id);
		if (!session) return;
		const tab = activeTab(this.controller.sessions.tabs);
		bar.pane.toggleClass('is-focused', tab?.focused === id && !!tab && sessionsOf(tab.root).length > 1);
		bar.dot.className = `nand-agent-dot is-${session.connection === 'connected' ? (session.agentId ? session.activity : 'connected') : session.connection}`;
		bar.title.setText(session.title);
		bar.status.setText(statusLabel(session));
		bar.cwd.setText(shortPath(session.cwd));
		bar.cwd.setAttr('title', session.cwd);
	}

	private drawEmpty(host: HTMLElement): void {
		const box = host.createDiv({ cls: 'nand-agent-empty' });
		render(h(EmptyState, { icon: 'terminal', title: t('agent.emptyTitle'), description: t('agent.emptyDescription'), layout: 'content' }), box.createDiv());
		const actions = box.createDiv({ cls: 'nand-agent-empty-actions' });
		const button = (label: string, icon: string, run: () => void) => {
			const el = actions.createEl('button', { cls: 'nand-agent-empty-button' });
			setIcon(el.createSpan(), icon);
			el.createSpan({ text: label });
			el.addEventListener('click', run);
		};
		button(t('agent.shell'), 'terminal', () => void this.controller.newShell().catch(report));
		for (const agent of this.controller.enabledAgents()) button(agent.title, 'bot', () => void this.controller.newAgent(agent.id).catch(report));
	}

	private drawNode(host: HTMLElement, tabId: string, node: LayoutNode, path: Array<'first' | 'second'>): void {
		if (node.kind === 'pane') {
			this.drawPane(host, node.session);
			return;
		}
		const frame = host.createDiv({ cls: `nand-agent-split nand-agent-split--${node.direction}` });
		const first = frame.createDiv({ cls: 'nand-agent-split-cell' });
		const handle = frame.createDiv({ cls: 'nand-agent-split-handle', attr: { role: 'separator', 'aria-orientation': node.direction === 'row' ? 'vertical' : 'horizontal', tabindex: '0' } });
		const second = frame.createDiv({ cls: 'nand-agent-split-cell' });
		first.style.flexBasis = `${node.ratio * 100}%`;
		second.style.flexBasis = `${(1 - node.ratio) * 100}%`;
		this.drawNode(first, tabId, node.first, [...path, 'first']);
		this.drawNode(second, tabId, node.second, [...path, 'second']);
		handle.addEventListener('pointerdown', (event) => {
			event.preventDefault();
			handle.setPointerCapture(event.pointerId);
			const rect = frame.getBoundingClientRect();
			let ratio = node.ratio;
			const move = (moveEvent: PointerEvent) => {
				ratio = node.direction === 'row' ? (moveEvent.clientX - rect.left) / rect.width : (moveEvent.clientY - rect.top) / rect.height;
				ratio = Math.min(0.85, Math.max(0.15, ratio));
				first.style.flexBasis = `${ratio * 100}%`;
				second.style.flexBasis = `${(1 - ratio) * 100}%`;
			};
			const up = () => {
				handle.removeEventListener('pointermove', move);
				handle.removeEventListener('pointerup', up);
				this.controller.sessions.setTabs(setRatio(this.controller.sessions.tabs, tabId, path, ratio));
			};
			handle.addEventListener('pointermove', move);
			handle.addEventListener('pointerup', up);
		});
	}

	private drawPane(host: HTMLElement, id: string): void {
		const session = this.controller.sessions.get(id);
		if (!session) return;
		const pane = host.createDiv({ cls: 'nand-agent-pane' });
		const bar = pane.createDiv({ cls: 'nand-agent-pane-bar' });
		const parts = {
			pane,
			dot: bar.createSpan({ cls: 'nand-agent-dot' }),
			title: bar.createSpan({ cls: 'nand-agent-pane-title' }),
			status: bar.createSpan({ cls: 'nand-agent-pane-status' }),
			cwd: bar.createSpan({ cls: 'nand-agent-pane-cwd' }),
		};
		this.bars.set(id, parts);
		this.updateBar(id, parts);
		const actions = bar.createDiv({ cls: 'nand-agent-pane-actions' });
		const action = (icon: string, label: string, run: (event: MouseEvent) => void) => {
			const button = actions.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': label } });
			setIcon(button, icon);
			setTooltip(button, label);
			button.addEventListener('click', run);
		};
		action('search', t('agent.search'), () => this.toggleSearch(true));
		action('columns-2', t('agent.splitRight'), () => void this.controller.splitSession(id, 'row').catch(report));
		action('rows-2', t('agent.splitDown'), () => void this.controller.splitSession(id, 'column').catch(report));
		action('more-horizontal', t('agent.more'), (event) => this.sessionMenu(session, this.views.get(id)).showAtMouseEvent(event));
		const body = pane.createDiv({ cls: 'nand-agent-pane-body' });
		let view = this.views.get(id);
		if (!view) {
			view = new TerminalView(body, session, {
				app: this.app,
				settings: () => this.controller.settings.get(),
				retention,
				vaultPath: () => this.controller.vaultPath(),
				focused: (focusedView) => {
					this.controller.sessions.focus(focusedView.session.id);
					const state = this.controller.sessions.tabs;
					if (activeTab(state)?.focused !== focusedView.session.id) this.controller.sessions.setTabs(activate(state, focusedView.session.id));
				},
				menu: (menuView, event) => this.sessionMenu(menuView.session, menuView).showAtMouseEvent(event),
			});
			this.views.set(id, view);
		} else {
			body.appendChild(view.el);
		}
	}

	/** Show the views of the active tab (when the page is visible), hide the rest. */
	private syncViews(): void {
		const tab = activeTab(this.controller.sessions.tabs);
		const shown = new Set(this.visible && this.section === 'running' && tab ? sessionsOf(tab.root) : []);
		for (const [id, view] of this.views) view.setVisible(shown.has(id));
		// Move keyboard focus only when the shown session changed, never on status updates.
		const focus = tab && shown.size ? tab.focused : '';
		if (focus && focus !== this.shownFocus) this.views.get(focus)?.focus();
		this.shownFocus = focus;
	}

	private focusedView(): TerminalView | undefined {
		const tab = activeTab(this.controller.sessions.tabs);
		return tab ? this.views.get(tab.focused) : undefined;
	}

	private buildSearch(host: HTMLElement): void {
		const input = host.createEl('input', { cls: 'nand-agent-search-input', attr: { type: 'search', placeholder: t('agent.searchPlaceholder'), 'aria-label': t('agent.search') } });
		const options = { caseSensitive: false, regex: false };
		const toggle = (label: string, icon: string, key: 'caseSensitive' | 'regex') => {
			const button = host.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': label, 'aria-pressed': 'false' } });
			setIcon(button, icon);
			setTooltip(button, label);
			button.addEventListener('click', () => {
				options[key] = !options[key];
				button.setAttr('aria-pressed', String(options[key]));
				button.toggleClass('is-active', options[key]);
			});
		};
		toggle(t('agent.matchCase'), 'case-sensitive', 'caseSensitive');
		toggle(t('agent.regex'), 'regex', 'regex');
		const find = (direction: 'next' | 'previous') => {
			const found = this.focusedView()?.find(input.value, direction, options) ?? false;
			input.toggleClass('is-missing', !!input.value && !found);
		};
		const button = (icon: string, label: string, run: () => void) => {
			const el = host.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': label } });
			setIcon(el, icon);
			setTooltip(el, label);
			el.addEventListener('click', run);
		};
		button('arrow-up', t('agent.searchPrevious'), () => find('previous'));
		button('arrow-down', t('agent.searchNext'), () => find('next'));
		button('x', t('agent.close'), () => this.toggleSearch(false));
		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				find(event.shiftKey ? 'previous' : 'next');
			} else if (event.key === 'Escape') {
				event.preventDefault();
				this.toggleSearch(false);
			}
		});
	}

	toggleSearch(open: boolean): void {
		if (!this.searchEl) return;
		this.searchEl.toggleClass('is-hidden', !open);
		if (open) this.searchEl.querySelector('input')?.focus();
		else {
			this.focusedView()?.clearSearch();
			this.focusedView()?.focus();
		}
	}

	private sessionMenu(session: TerminalSession, view: TerminalView | undefined): Menu {
		const menu = new Menu();
		if (view) {
			menu.addItem((item) => item.setTitle(t('agent.copy')).setIcon('copy').setDisabled(!view.hasSelection).onClick(() => void view.copy()));
			menu.addItem((item) => item.setTitle(t('agent.copyPlain')).setIcon('clipboard-type').setDisabled(!view.hasSelection).onClick(() => void view.copy(true)));
			menu.addItem((item) => item.setTitle(t('agent.paste')).setIcon('clipboard-paste').onClick(() => void view.paste()));
			menu.addItem((item) => item.setTitle(t('agent.selectAll')).setIcon('text-select').onClick(() => view.selectAll()));
			menu.addItem((item) => item.setTitle(t('agent.selectLine')).setIcon('text-cursor').onClick(() => view.selectLine()));
			menu.addSeparator();
			menu.addItem((item) => item.setTitle(t('agent.search')).setIcon('search').onClick(() => this.toggleSearch(true)));
			menu.addItem((item) => item.setTitle(t('agent.promptPrevious')).setIcon('chevron-up').onClick(() => view.jump('previous')));
			menu.addItem((item) => item.setTitle(t('agent.promptNext')).setIcon('chevron-down').onClick(() => view.jump('next')));
			menu.addItem((item) => item.setTitle(t('agent.promptFailed')).setIcon('circle-x').onClick(() => view.jump('failed')));
			menu.addItem((item) => item.setTitle(t('agent.clear')).setIcon('eraser').onClick(() => view.clear()));
			menu.addItem((item) => item.setTitle(t('agent.clearScrollback')).setIcon('trash').onClick(() => view.clearScrollback()));
			menu.addSeparator();
			menu.addItem((item) => item.setTitle(t('agent.fontLarger')).setIcon('zoom-in').onClick(() => view.zoom(1)));
			menu.addItem((item) => item.setTitle(t('agent.fontSmaller')).setIcon('zoom-out').onClick(() => view.zoom(-1)));
			menu.addItem((item) => item.setTitle(t('agent.fontReset')).setIcon('rotate-ccw').onClick(() => view.zoom(0)));
			menu.addSeparator();
		}
		if (session.agentId && session.running) {
			menu.addItem((item) => item.setTitle(t('agent.attach')).setIcon('paperclip').onClick(() => pickMaterial(this.controller, session.id)));
			menu.addSeparator();
		}
		menu.addItem((item) => item.setTitle(t('agent.copyPath')).setIcon('folder').onClick(() => void navigator.clipboard.writeText(session.cwd)));
		menu.addItem((item) => item.setTitle(t('agent.reveal')).setIcon('folder-open').onClick(() => void openPath(session.cwd)));
		menu.addItem((item) => item.setTitle(t('agent.splitRight')).setIcon('columns-2').onClick(() => void this.controller.splitSession(session.id, 'row').catch(report)));
		menu.addItem((item) => item.setTitle(t('agent.splitDown')).setIcon('rows-2').onClick(() => void this.controller.splitSession(session.id, 'column').catch(report)));
		menu.addSeparator();
		menu.addItem((item) =>
			item.setTitle(t('agent.rename')).setIcon('pencil').onClick(() => {
				void promptText(this.app, t('agent.rename'), session.title).then((title) => {
					if (title !== null) session.rename(title);
				});
			}),
		);
		menu.addItem((item) =>
			item.setTitle(t('agent.copyId')).setIcon('fingerprint').onClick(() => {
				void navigator.clipboard.writeText(session.id).then(() => new Notice(t('agent.copiedId')));
			}),
		);
		menu.addItem((item) => item.setTitle(session.running ? t('agent.end') : t('agent.closePane')).setIcon('square-x').setWarning(true).onClick(() => void this.controller.closeSession(session.id)));
		return menu;
	}
}

function report(error: unknown): void {
	new Notice(error instanceof Error ? error.message : String(error));
}

export const createAgentPage = (controller: () => AgentController | undefined): PageCreate => async (context, target) => {
	const current = controller();
	if (!current) throw new Error(t('workbench.notReady'));
	const page = new AgentPage(context, current);
	page.show(target);
	return {
		surface: page,
		getTarget: () => page.getTarget(),
		navigate: async (next) => page.show(next),
	};
};
