import { observeDashboardPromise } from '../save-feedback';
import { localizedAttributes, localizedText } from '../../../../ui/primitives/localized-dom';
import { Platform, setIcon } from 'obsidian';
import { t } from '../../../../shared/i18n/index';
import { renderQuickActions } from '../notes/quick-actions';
import { unmountDashboardPanelsIn } from '../renderer/render-context';
import { createDashboardSettingsAccess } from '../settings-access';
import { showConfirmDialog } from '../ui/confirm-dialog';
import { getRecentDocs, renderRecentDocs } from '../ui/recent';
import { legacyBoardMembers } from '../../core/board/widget-members';
import { widgetProviderKey } from '../../core/board/widget-registry';
import { homeServices } from '../../services/instances';
import { bindBuiltinWidgetEnvironment } from '../widgets/builtin-context';
import { mountWidgetHost } from '../widgets/WidgetHost';
import { widgetMemberLabel } from '../widgets/widget-label';
import { renderBoardQuickActions } from './quick-actions-widget';
import { renderBoardSkills } from './skills-widget';
import type { DashboardSurface } from './dashboard-surface';

export function renderMobileActions(this: DashboardSurface, bannerEl: HTMLElement): void {
	const actions = bannerEl.createDiv({ cls: 'dashboard-mobile-actions' });

	const linksBtn = actions.createEl('button', {
		cls: 'dashboard-mobile-action-btn',
		attr: { ...localizedAttributes('mobile.quickActions', undefined, 'aria-label') },
	});
	setIcon(linksBtn, 'zap');
	linksBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		this.openMobileDrawer('quickActions');
	});

	const recentBtn = actions.createEl('button', {
		cls: 'dashboard-mobile-action-btn',
		attr: { ...localizedAttributes('mobile.recent', undefined, 'aria-label') },
	});
	setIcon(recentBtn, 'clock');
	recentBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		this.openMobileDrawer('recent');
	});

	// On mobile, tapping right half of banner reveals the edit button
	const overlay = bannerEl.querySelector('.dashboard-banner-overlay') as HTMLElement;
	if (overlay) {
		overlay.addEventListener('click', (e) => {
			const rect = overlay.getBoundingClientRect();
			const tapX = e.clientX - rect.left;
			if (tapX > rect.width * 0.5) {
				const editBtn = overlay.querySelector('.dashboard-banner-edit-btn') as HTMLElement;
				if (editBtn) {
					editBtn.addClass('dashboard-banner-edit-btn--mobile-visible');
				}
			}
		});
	}
}

export function renderMobileWidgetBar(this: DashboardSurface, container: HTMLElement): void {
	this.mobileWidgetTabsOpen = false;
	this.mobileWidgetExpanded = null;

	const bar = container.createDiv({ cls: 'dashboard-mobile-widget-bar' });

	// Thin strip: collapsed state, tap to expand tabs
	const strip = bar.createEl('button', { cls: 'dashboard-mobile-widget-strip', attr: { type: 'button', ...localizedAttributes('home.widget.manage', undefined, 'aria-label') } });
	strip.createDiv({ cls: 'dashboard-mobile-widget-strip-hint' });
	strip.addEventListener('click', (e) => {
		e.stopPropagation();
		this.mobileWidgetTabsOpen = !this.mobileWidgetTabsOpen;
		if (!this.mobileWidgetTabsOpen) {
			this.mobileWidgetExpanded = null;
		}
		this.refreshMobileWidgetPanel(bar);
	});

	// Tab row: hidden by default, revealed by tapping strip
	const tabs = bar.createDiv({ cls: 'dashboard-mobile-widget-tabs' });

	const members = this.data?.widgets ?? legacyBoardMembers(this.plugin.settings, true, Platform.isPhone);

	bar.createDiv({ cls: 'dashboard-mobile-widget-panel' });

	for (const member of members) {
		const kind = homeServices.widgets?.byKey.get(widgetProviderKey(member.provider, member.kind))?.kind;
		const label = widgetMemberLabel(member, kind);
		const btn = tabs.createEl('button', {
			cls: 'dashboard-mobile-widget-btn',
			attr: { type: 'button', 'aria-label': label, title: label },
		});
		setIcon(btn, kind?.icon ?? 'puzzle');

		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			if (this.mobileWidgetExpanded === member.memberId) {
				this.mobileWidgetExpanded = null;
			} else {
				this.mobileWidgetExpanded = member.memberId;
			}
			this.refreshMobileWidgetPanel(bar);
		});

		btn.dataset.widgetMember = member.memberId;
	}

	this.refreshMobileWidgetPanel(bar);
}

export function refreshMobileWidgetPanel(this: DashboardSurface, bar: HTMLElement): void {
	const strip = bar.querySelector('.dashboard-mobile-widget-strip');
	const tabs = bar.querySelector('.dashboard-mobile-widget-tabs');
	const panel = bar.querySelector<HTMLElement>('.dashboard-mobile-widget-panel');
	if (!strip || !tabs || !panel) return;

	// Toggle strip active state
	strip.classList.toggle('dashboard-mobile-widget-strip--active', this.mobileWidgetTabsOpen);
	strip.setAttribute('aria-expanded', String(this.mobileWidgetTabsOpen));

	// Toggle tabs visibility
	tabs.classList.toggle('dashboard-mobile-widget-tabs--open', this.mobileWidgetTabsOpen);
	(tabs as HTMLElement).inert = !this.mobileWidgetTabsOpen;

	// Update button active states
	tabs.querySelectorAll('.dashboard-mobile-widget-btn').forEach((btn) => {
		const el = btn as HTMLElement;
		const active = el.dataset.widgetMember === this.mobileWidgetExpanded;
		el.classList.toggle('active', active);
		el.setAttribute('aria-pressed', String(active));
	});

	// Render panel content
	unmountDashboardPanelsIn(panel);
	panel.empty();

	if (!this.mobileWidgetExpanded) {
		panel.removeClass('dashboard-mobile-widget-panel--open');
		return;
	}

	panel.addClass('dashboard-mobile-widget-panel--open');

	const members = this.data?.widgets ?? legacyBoardMembers(this.plugin.settings, true, Platform.isPhone);
	const member = members.find(item => item.memberId === this.mobileWidgetExpanded);
	if (!member) return;
	const root = panel.createDiv({ cls: 'dashboard-sidebar-widget-mount' });
	root.dataset.widgetMember = member.memberId;
	const kind = homeServices.widgets?.byKey.get(widgetProviderKey(member.provider, member.kind))?.kind;
	mountWidgetHost(root, member, kind, this.plugin.settings.dashboardFile, () => this.plugin.openSettings(), context => {
		bindBuiltinWidgetEnvironment(context, {
			app: this.app, settings: this.plugin.settings, settingsAccess: createDashboardSettingsAccess(this.plugin),
			pomodoro: this.pomodoroService ?? undefined, reading: this.readingService ?? undefined, holidayData: this.holidayData,
			openNote: (file, line) => this.openNote(file, undefined, line), calendarAutoLoad: true,
			renderQuickActions: host => renderBoardQuickActions(this, host), renderSkills: (host, ctx) => renderBoardSkills(this, host, ctx),
		});
	});
}

export function openMobileDrawer(this: DashboardSurface, type: 'quickActions' | 'recent'): void {
	this.closeMobileDrawer();

	const root = this.contentEl;
	if (!root) return;

	const firstSection = root.querySelector('.dashboard-section-row') as HTMLElement;
	const drawerTop = firstSection ? firstSection.getBoundingClientRect().top : 0;

	const drawer = root.createDiv({ cls: 'dashboard-mobile-drawer' });
	drawer.style.top = `${drawerTop}px`;

	const content = drawer.createDiv({ cls: 'dashboard-mobile-drawer-content' });

	if (type === 'quickActions') {
		content.createEl('h4', { ...localizedText('mobile.quickActions'), cls: 'dashboard-mobile-drawer-title' });
		if (this.data) {
			renderQuickActions(
				content,
				this.data.quickActions,
				(action) => {
					void this.executeAction(action);
					this.closeMobileDrawer();
				},
				(index) => {
					void (async () => {
						const confirmed = await showConfirmDialog(this.app, {
							title: t('common.confirmDelete'),
							message: t('common.confirmDeleteMessage'),
						});
						if (!confirmed) return;
						void observeDashboardPromise(this.sync.removeQuickAction(index));
					})();
				},
				() => this.openAddActionModal(),
				this.data.quickActionOrder,
				(order) => {
					void observeDashboardPromise(this.sync.reorderQuickActions(order));
				},
				(key) => {
					void (async () => {
						const confirmed = await showConfirmDialog(this.app, {
							title: t('common.confirmDelete'),
							message: t('common.confirmDeleteMessage'),
						});
						if (!confirmed) return;
						void observeDashboardPromise(this.sync.removeQuickActionByKey(key));
					})();
				},
				this.data.hiddenPresets,
				undefined,
				undefined,
				this.plugin.automationHost,
			);
		}
	} else {
		content.createEl('h4', { ...localizedText('mobile.recent'), cls: 'dashboard-mobile-drawer-title' });
		const docs = getRecentDocs(this.app, this.plugin.settings.recentDocCount, this.plugin.settings);
		renderRecentDocs(content, docs, (path) => {
			void this.navigateToPath(path);
		});
	}

	const backdrop = drawer.createDiv({ cls: 'dashboard-mobile-drawer-backdrop' });
	backdrop.addEventListener('click', () => this.closeMobileDrawer());

	root.win.requestAnimationFrame(() => {
		content.addClass('dashboard-mobile-drawer-content--open');
	});
}

export function closeMobileDrawer(this: DashboardSurface): void {
	const root = this.contentEl;
	if (!root) return;
	const existing = root.querySelector('.dashboard-mobile-drawer');
	if (existing) { unmountDashboardPanelsIn(existing as HTMLElement); existing.remove(); }
}
