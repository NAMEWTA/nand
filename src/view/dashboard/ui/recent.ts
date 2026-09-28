import { App } from 'obsidian';
import { h } from 'preact';
import { t } from '../../../shared/i18n/index';
import { RecentDocsPanel } from '../notes/RecentDocsPanel';
import { mountDashboardPanel } from '../renderer/render-context';

export interface RecentDoc {
	name: string;
	path: string;
	relativeTime: string;
}

export function getRecentDocs(app: App, count: number): RecentDoc[] {
	const files = app.vault.getMarkdownFiles();
	const sorted = files
		.filter((f) => !f.path.startsWith('.'))
		.sort((a, b) => b.stat.mtime - a.stat.mtime)
		.slice(0, count);

	return sorted.map((f) => ({
		name: f.basename,
		path: f.path,
		relativeTime: formatRelativeTime(f.stat.mtime),
	}));
}

export function renderRecentDocs(container: HTMLElement, docs: RecentDoc[], onClick: (path: string) => void): void {
	const root = container.createDiv({ cls: 'dashboard-section dashboard-recent' });
	mountDashboardPanel(root, h(RecentDocsPanel, { docs, open: onClick }));
}

function formatRelativeTime(timestamp: number): string {
	const diff = Date.now() - timestamp;
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return t('recent.daysAgo', { count: days });
	if (hours > 0) return t('recent.hoursAgo', { count: hours });
	if (minutes > 0) return t('recent.minutesAgo', { count: minutes });
	return t('recent.justNow');
}
