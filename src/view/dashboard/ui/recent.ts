import { App } from 'obsidian';
import { h } from 'preact';
import { formatRelativeTime } from './recent-time';
import { RecentDocsPanel } from '../notes/RecentDocsPanel';
import { mountDashboardPanel } from '../renderer/render-context';

export interface RecentDoc {
	name: string;
	path: string;
	relativeTime: string;
	timestamp?: number;
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
		timestamp: f.stat.mtime,
		relativeTime: formatRelativeTime(f.stat.mtime),
	}));
}

export function renderRecentDocs(container: HTMLElement, docs: RecentDoc[], onClick: (path: string) => void): void {
	const root = container.createDiv({ cls: 'dashboard-section dashboard-recent' });
	mountDashboardPanel(root, h(RecentDocsPanel, { docs, open: onClick }));
}
