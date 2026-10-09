import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { render } from 'preact';
import type { App, TFile } from 'obsidian';
import { test } from 'vitest';
import { registerMessages, t } from '../../../../shared/i18n';
import { flush, installDom } from '../../../../../test/dom';
import type { LibraryConfig } from '../../core/board/types/index';
import { messages } from '../../i18n';
import type { DashboardRenderContext } from '../renderer/render-context';
import { LibraryKanban } from './LibraryKanban';
import { FileCards, FileList } from './LibraryViews';
import type { LibraryFileResult } from './library-file-result';

registerMessages(messages);
const { document } = installDom();

const file = { path: 'Notes/A.md', basename: 'A', name: 'A.md' } as TFile;
const result: LibraryFileResult = {
	file,
	basename: 'A',
	mtime: 1,
	ctime: 1,
	frontmatter: { tags: ['alpha'] },
	preview: '',
	tags: ['alpha'],
};
const config = {
	filters: [],
	viewMode: 'grid',
	sortBy: 'modified',
	sortDesc: true,
	showProperties: false,
	kanbanGroupBy: 'tags',
	groupMode: 'property',
} as LibraryConfig;

function scene(): { app: App; context: DashboardRenderContext; opened: string[]; deleted: TFile[] } {
	const opened: string[] = [];
	const deleted: TFile[] = [];
	const app = {
		workspace: {
			trigger() {},
			getLeaf: () => ({ openFile: (item: TFile) => opened.push(item.path) }),
		},
		metadataCache: { getFileCache: () => undefined },
		vault: { cachedRead: async () => '', getAbstractFileByPath: () => null },
	} as unknown as App;
	return { app, context: {} as DashboardRenderContext, opened, deleted };
}

test('grid, gallery, list and kanban delete through the confirm handler without opening or dragging', async () => {
	const css = readFileSync(new URL('../../styles/074-table-view.css', import.meta.url), 'utf8');
	assert.match(css, /\.dashboard-library-card:hover \.dashboard-library-table-delete/);
	assert.match(css, /\.dashboard-library-list-item:hover \.dashboard-library-table-delete/);
	assert.match(css, /\.dashboard-library-kanban-card:hover \.dashboard-library-table-delete/);
	assert.match(css, /\.dashboard-library-table-delete:focus-visible/);
	assert.match(css, /@media \(pointer: coarse\)/);

	const views = ['grid', 'gallery', 'list', 'kanban'] as const;
	for (const view of views) {
		const { app, context, opened, deleted } = scene();
		const root = document.createElement('div');
		document.body.append(root);
		const onDelete = (item: TFile) => deleted.push(item);
		const node =
			view === 'kanban' ? (
				<LibraryKanban results={[result]} app={app} config={config} context={context} onDelete={onDelete} />
			) : view === 'list' ? (
				<FileList results={[result]} app={app} context={context} onDelete={onDelete} />
			) : (
				<FileCards results={[result]} app={app} config={config} context={context} covers={view === 'gallery'} onDelete={onDelete} />
			);
		render(node, root);
		await flush();
		const button = root.querySelector('.dashboard-library-table-delete') as HTMLButtonElement;
		assert.equal(button.getAttribute('aria-label'), t('library.delete'));
		const card = button.closest('.dashboard-library-kanban-card');
		button.dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true }));
		assert.equal(card?.classList.contains('dashboard-library-kanban-card--dragging') ?? false, false);
		button.click();
		await flush();
		assert.deepEqual(
			deleted.map((item) => item.path),
			['Notes/A.md'],
		);
		assert.deepEqual(opened, []);
		render(null, root);
		root.remove();
	}
});
