import { Component, Menu, Platform } from 'obsidian';
import { render } from 'preact';
import { onLanguageChanged, t } from '../../shared/i18n';
import type { PanelModel, WorkbenchFeature, WorkbenchTarget } from '../../app/contracts/workbench';
import { Shell } from '../Shell';
import type { RailItem } from '../Rail';
import { railAction, rememberTarget } from '../layout';
import { normalizeWorkbenchState, panelWidth, targetKey, type WorkbenchState } from '../navigation-state';
import { NavigationTransition } from '../navigation-transition';
import { headerStatuses } from '../status-policy';
import { refreshLeafTitle } from '../../host/obsidian/workspace-title';
import type { WorkbenchContribution, WorkbenchHost, WorkbenchLeafView, WorkbenchSurface } from '../../app/contracts/workbench-host';
import type { NativeSurface } from '../../ui/native-surface';
import { WorkbenchPages, type SavedPage } from './workbench-pages';

/** The workbench UI of a leaf: rail, side panel and page, or one page in focus mode. */
export function createWorkbenchSurface(view: WorkbenchLeafView, host: WorkbenchHost, saved: Record<string, unknown>): WorkbenchSurface {
	return new WorkbenchShellSurface(view, host, saved);
}

class WorkbenchShellSurface implements WorkbenchSurface {
	private state: WorkbenchState;
	private readonly transition = new NavigationTransition();
	private pages?: WorkbenchPages;
	private opened = false;
	private pending: WorkbenchTarget = { feature: 'dashboard' };
	private busy = false;
	private error?: string;
	private unavailable?: { feature: WorkbenchFeature; message: string };
	private savedPages: unknown;
	private revision = 0;
	/** Page-owned panel content (e.g. agent sessions) lives here and moves into the panel when it is shown. */
	private readonly navigationHost = createDiv({ cls: 'nand-workbench-context' });
	/** Listeners of this surface; the leaf outlives it when the plugin unloads. */
	private readonly lifetime: Component;

	constructor(private readonly view: WorkbenchLeafView, private readonly host: WorkbenchHost, saved: Record<string, unknown>) {
		this.state = normalizeWorkbenchState(saved);
		this.savedPages = saved.pages;
		this.lifetime = view.addChild(new Component());
		this.opened = true;
		view.contentEl.addClass('nand-workbench-view');
		this.draw();
		this.pages?.restore(this.savedPages);
		this.lifetime.register(onLanguageChanged(() => this.draw()));
		this.lifetime.register(host.subscribe(() => {
			void this.refreshAvailability().catch(host.report);
		}));
		this.lifetime.register(view.contentEl.onWindowMigrated(() => this.draw()));
	}
	displayText(): string {
		if (!this.state.focus) return t('workbench.title');
		return this.pageTitle() ?? t('workbench.title');
	}
	icon(): string {
		return this.state.focus ? (this.contribution(this.state.target.feature)?.navigation.icon ?? 'panels-top-left') : 'panels-top-left';
	}

	get focusMode(): boolean {
		return this.state.focus;
	}
	ensureActivePage(): Promise<void> {
		return this.navigate(this.state.target);
	}
	getSavedPages(feature?: WorkbenchFeature): SavedPage[] {
		return this.pages?.list(feature) ?? [];
	}
	async activateResource(feature: WorkbenchFeature, id: string): Promise<boolean> {
		const saved = this.getSavedPages(feature).find((page) => page.target.resourceId === id);
		if (!saved) return false;
		await this.view.app.workspace.revealLeaf(this.view.leaf);
		await this.navigate(saved.target);
		return true;
	}
	getNativeSurfaces(): readonly NativeSurface[] {
		return this.pages?.getSurfaces() ?? [];
	}
	async closeResource(feature: WorkbenchFeature, id: string): Promise<void> {
		await this.pages?.closeResource(feature, id);
	}
	getState(): Record<string, unknown> {
		return { ...this.state, pages: this.pages?.getState() ?? this.savedPages };
	}
	async setState(raw: Record<string, unknown>): Promise<void> {
		this.state = normalizeWorkbenchState(raw);
		this.savedPages = raw.pages;
		this.pages?.restore(raw.pages);
		if (this.opened) {
			this.transition.invalidate();
			await this.navigate(this.state.target);
		}
	}

	async navigate(raw: WorkbenchTarget, initial?: Record<string, unknown>, keyboard = false): Promise<void> {
		if (!this.opened || !this.pages) return;
		const target = this.pages.resolve(raw), revision = ++this.revision;
		this.pending = target;
		this.busy = true;
		this.error = undefined;
		this.draw();
		if (initial) this.transition.invalidate();
		let page: Awaited<ReturnType<WorkbenchPages['prepare']>>;
		let unavailable: string | undefined;
		try {
			await this.transition.navigate(target, async (signal) => {
				const availability = this.contribution(target.feature)?.availability();
				if (!availability) unavailable = t('workbench.missing');
				else if (!availability.enabled) unavailable = t('workbench.disabled');
				else if (!availability.supported) unavailable = t('workbench.unsupported');
				else if (!availability.ready) unavailable = availability.reason ?? t('workbench.notReady');
				else page = await this.pages?.prepare(target, signal, initial);
			}, () => {
				this.pages?.show(page);
				this.unavailable = unavailable ? { feature: target.feature, message: unavailable } : undefined;
				this.view.lastActivatedAt = Date.now();
				this.state = rememberTarget(this.state, page?.target ?? target);
				if (this.state.focus) refreshLeafTitle(this.view.app, this.view.leaf);
				this.view.app.workspace.requestSaveLayout();
			}, () => {
				const actual = this.pages?.getCurrent()?.getTarget?.();
				return actual ? targetKey(actual) : undefined;
			});
		} catch (error) {
			if (revision === this.revision) this.error = error instanceof Error ? error.message : String(error);
			throw error;
		} finally {
			if (revision === this.revision) {
				this.busy = false;
				this.draw();
				if (keyboard && !this.error) this.view.contentEl.win.requestAnimationFrame(() => {
					if (this.opened && revision === this.revision) this.view.contentEl.querySelector<HTMLElement>('[data-workbench-focus="title"]')?.focus({ preventScroll: true });
				});
			}
		}
	}
	async prepareModuleChanges(disabled: ReadonlySet<WorkbenchFeature>): Promise<void> {
		if (!this.opened) return;
		this.transition.invalidate();
		this.revision++;
		this.busy = false;
		const closed = await this.pages?.refreshAvailability(disabled);
		if (closed) this.unavailable = { feature: this.state.target.feature, message: t('workbench.disabled') };
		this.draw();
	}
	async refreshAvailability(): Promise<void> {
		if (!this.opened) return;
		const changed = await this.pages?.refreshAvailability();
		// Service notifications during page creation must not replace the requested route with the old unavailable page.
		// Explicit module changes cancel navigation through prepareModuleChanges instead.
		if (this.busy) return this.draw();
		if (changed || this.unavailable) {
			this.transition.invalidate();
			await this.navigate(this.state.target);
		} else this.draw();
	}
	async dispose(): Promise<void> {
		if (!this.opened) return;
		this.savedPages = this.pages?.getState() ?? this.savedPages;
		this.opened = false;
		this.revision++;
		this.transition.dispose();
		await this.pages?.dispose();
		this.pages = undefined;
		render(null, this.view.contentEl);
		this.view.removeChild(this.lifetime);
	}
	onResize(): void {
		this.pages?.getCurrent()?.surface.onResize();
	}
	onPaneMenu(menu: Menu, source: string): void {
		const binding = this.pages?.getCurrent();
		const target = binding?.getTarget?.() ?? this.state.target;
		const state = () => binding?.getState?.() ?? binding?.surface.getState() ?? {};
		menu.addItem((item) => item.setTitle(t('workbench.openStandalone')).setIcon('external-link').onClick(() => {
			void this.host.openFocus(target, state(), 'tab', this.view.contentEl.win).catch(this.host.report);
		}));
		menu.addItem((item) => item.setTitle(t('workbench.openSplit')).setIcon('columns-2').onClick(() => {
			void this.host.openFocus(target, state(), 'split', this.view.contentEl.win).catch(this.host.report);
		}));
		if (binding && this.contribution(target.feature)?.resourcePages) {
			menu.addItem((item) => item.setTitle(t('workbench.closePage')).setIcon('x').onClick(() => {
				void Promise.resolve(binding.surface.context.close()).catch(this.host.report);
			}));
		}
		binding?.surface.onPaneMenu(menu, source);
	}

	private contribution(feature: WorkbenchFeature): WorkbenchContribution | undefined {
		return this.host.contributions.find((item) => item.id === feature);
	}
	private available(contribution: WorkbenchContribution): boolean {
		const availability = contribution.availability();
		return availability.enabled && availability.supported;
	}
	private pageTitle(): string | undefined {
		const target = this.state.target;
		const contribution = this.contribution(target.feature);
		if (!contribution) return undefined;
		const custom = contribution.title?.(target);
		if (custom) return custom;
		const label = t(contribution.navigation.labelKey);
		const child = contribution.navigation.children?.find((item) => item.target?.section && item.target.section === target.section);
		return child ? `${label} · ${t(child.labelKey)}` : label;
	}
	private railItems(): RailItem[] {
		return this.host.contributions
			.filter((contribution) => contribution.rail && (contribution.id === 'dashboard' || contribution.id === 'settings' || this.available(contribution)))
			.map((contribution) => ({
				id: contribution.id,
				label: t(contribution.navigation.labelKey),
				icon: contribution.navigation.icon,
				slot: contribution.rail!.slot,
				badge: contribution.rail!.badge?.(),
				failed: this.host.failed(contribution.id),
			}));
	}
	private panelModel(): PanelModel | undefined {
		const contribution = this.contribution(this.state.target.feature);
		if (!contribution) return undefined;
		if (contribution.panel) {
			return contribution.panel({ target: this.state.target, pages: (feature) => this.getSavedPages(feature), navigate: (target) => this.requestNavigation(target) });
		}
		const children = contribution.navigation.children ?? [];
		if (!children.length) return undefined;
		return { sections: [{ id: 'sections', items: children.map((child) => ({ id: child.id, label: t(child.labelKey), icon: child.icon, target: child.target, badge: child.badge })) }] };
	}
	private browserTabs() {
		const contribution = this.contribution(this.state.target.feature);
		if (!contribution?.resourcePages || contribution.resourceTabs?.(this.state.target) === false) return undefined;
		const feature = contribution.id;
		const section = this.state.target.section;
		const pages = this.getSavedPages(feature).filter(page => page.target.section === section);
		return {
			tabs: pages.map((page) => ({
				id: page.target.resourceId ?? '',
				title: (typeof page.state.title === 'string' && page.state.title) || (typeof page.state.url === 'string' && page.state.url) || t(contribution.navigation.labelKey),
				icon: contribution.navigation.icon,
			})),
			active: this.state.target.resourceId,
			onSelect: (id: string) => this.requestNavigation({ feature, section, resourceId: id }),
			onClose: (id: string) => {
				void this.pages?.closeResource(feature, id).catch(this.host.report);
			},
			onNew: () => this.requestNavigation({ feature, section, resourceId: crypto.randomUUID() }),
			newLabel: t('workbench.newPage'),
		};
	}
	private onRail = (feature: WorkbenchFeature): 'toggled' | 'navigated' => {
		const action = railAction(this.state, feature);
		if (action.kind === 'toggle-panel') return 'toggled';
		this.requestNavigation(action.target);
		return 'navigated';
	};
	private change = (patch: Partial<WorkbenchState>): void => {
		this.state = normalizeWorkbenchState({ ...this.state, ...patch });
		this.draw();
		this.view.app.workspace.requestSaveLayout();
	};
	private more = (event: MouseEvent): void => {
		const menu = new Menu();
		this.onPaneMenu(menu, 'workbench');
		menu.showAtMouseEvent(event);
	};
	private requestNavigation = (target: WorkbenchTarget, keyboard = false): void => {
		void this.navigate(target, undefined, keyboard).catch(this.host.report);
	};
	private retry = (): void => {
		this.transition.invalidate();
		this.requestNavigation(this.pending);
	};
	private content = (element: HTMLDivElement | null): void => {
		if (element && !this.pages) {
			this.pages = new WorkbenchPages(this.view, element, this.host.contributions, (target) => this.navigate(target), this.host.report, () => {
				this.state = rememberTarget(this.state, this.pages?.getCurrent()?.getTarget?.() ?? this.state.target);
				this.draw();
				this.view.app.workspace.requestSaveLayout();
			}, this.navigationHost, () => this.change({ panelOpen: true }));
		}
	};
	private customPanel = (element: HTMLDivElement | null): void => {
		if (element && this.navigationHost.parentElement !== element) element.appendChild(this.navigationHost);
	};
	private draw(): void {
		if (!this.opened) return;
		const hasNativeStatusBar = Platform.isDesktopApp && !!this.view.contentEl.doc.querySelector('.status-bar');
		const statuses = headerStatuses(hasNativeStatusBar, this.host.statuses?.() ?? []);
		const contribution = this.contribution(this.state.target.feature);
		const unavailable = this.unavailable
			? {
					message: this.unavailable.message,
					action: this.unavailable.message === t('workbench.disabled') ? { label: t('workbench.enableModule'), run: () => this.host.openSettings('settings') } : undefined,
				}
			: undefined;
		render(
			<Shell
				state={this.state}
				rail={this.railItems()}
				railCurrent={contribution?.railParent ?? this.state.target.feature}
				title={this.pageTitle() ?? t('workbench.title')}
				panelTitle={contribution ? t(contribution.navigation.labelKey) : t('workbench.title')}
				panel={this.panelModel()}
				tabs={this.browserTabs()}
				statuses={statuses}
				busy={this.busy}
				error={this.error}
				unavailable={unavailable}
				ownerWindow={this.view.contentEl.win}
				phone={Platform.isPhone}
				onRail={this.onRail}
				onNavigate={(target) => this.requestNavigation(target)}
				onPanelOpen={(open) => this.change({ panelOpen: open })}
				onPanelWidth={(width) => this.change({ panelWidth: panelWidth(width) })}
				openInWorkbench={this.state.focus ? () => {
					const binding = this.pages?.getCurrent();
					void this.host.openInWorkbench(binding?.getTarget?.() ?? this.state.target, binding?.getState?.() ?? binding?.surface.getState() ?? {}, this.view.contentEl.win).then(() => this.view.leaf.detach()).catch(this.host.report);
				} : undefined}
				more={this.more}
				retry={this.retry}
				report={this.host.report}
				contentRef={this.content}
				panelCustomRef={this.customPanel}
			/>,
			this.view.contentEl,
		);
	}
}
