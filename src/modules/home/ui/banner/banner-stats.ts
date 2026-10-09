import type { App } from 'obsidian';
import { h } from 'preact';
import type { BannerStatsConfig } from '../../core/board/types';
import { mountDashboardPanel } from '../renderer/render-context';
import { BannerStatsPanel } from './BannerStatsPanel';
import { computeBannerStats, resolveStatsConfig } from './stats-data';
export function applyBannerStatsStyle(root: HTMLElement, config: BannerStatsConfig): void {
	const darkness = config.darkness ?? 20;
	root.style.setProperty('--banner-blur', `${config.blur ?? 2}px`);
	root.style.setProperty('--banner-bright', String(Math.max(0.3, 1 - (darkness / 100) * 0.7)));
	root.style.setProperty('--banner-scrim', String(0.25 + (darkness / 100) * 0.5));
	root.style.setProperty('--banner-stat-accent', config.accent ?? '#bff038');
}
export function renderBannerStats(parent: HTMLElement, config: BannerStatsConfig | undefined, app: App): HTMLElement {
	const resolved = resolveStatsConfig(config);
	applyBannerStatsStyle(parent, resolved);
	const root = parent.createDiv({ cls: 'dashboard-banner-stats' });
	mountDashboardPanel(
		root,
		h(BannerStatsPanel, {
			app,
			config: resolved,
			result: computeBannerStats(app, config),
			animate: true,
			win: root.ownerDocument.defaultView!,
		}),
	);
	return root;
}
export function refreshBannerStats(container: HTMLElement, config: BannerStatsConfig | undefined, app: App): void {
	if (!container.isConnected) return;
	const resolved = resolveStatsConfig(config);
	if (container.parentElement) applyBannerStatsStyle(container.parentElement, resolved);
	mountDashboardPanel(
		container,
		h(BannerStatsPanel, {
			app,
			config: resolved,
			result: computeBannerStats(app, config),
			animate: false,
			win: container.ownerDocument.defaultView!,
		}),
	);
}
