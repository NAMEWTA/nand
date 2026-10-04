import { App } from 'obsidian';
import { isRecentUserDocument, type RecentDocScope } from '../../../core/dashboard/recent-doc-policy';
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

export function getRecentDocs(app: App, count: number, scope: RecentDocScope = {}): RecentDoc[] {
	const files = app.vault.getMarkdownFiles();
	const sorted = files
		.filter((f) => isRecentUserDocument(f.path, scope))
		.sort((a, b) => b.stat.mtime - a.stat.mtime || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
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
