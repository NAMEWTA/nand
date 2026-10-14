import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createStore } from 'zustand/vanilla';
import { TestProviders } from '../../../../ui/react/test-providers';
import { setLanguage, t } from '../../../../shared/i18n';
import { LibrarySection } from './types/LibrarySection';
import type { BoardStore } from '../../services/board-store';
import type { DashboardColumn } from '../../core/board/types/model';
import type { LibraryFileResult } from '../../services/library-query';
afterEach(cleanup);
function fixture(count: number) {
	const rows = Array.from({ length: count }, (_, i) => ({
		file: {
			kind: 'managed' as const,
			path: `Notes/Item ${i}.md`,
			name: `Item ${i}.md`,
			basename: `Item ${i}`,
			extension: 'md',
			stat: { mtime: Date.now(), ctime: Date.now(), size: 0 },
		},
		basename: `Item ${i}`,
		mtime: Date.now(),
		ctime: Date.now(),
		frontmatter: { status: 'Draft' },
		preview: '',
		tags: [],
	})) as LibraryFileResult[];
	const store = {
		state: createStore(() => ({ files: [] })),
		library: () => rows,
		image: () => Promise.resolve(''),
		openFile: vi.fn(),
		trash: vi.fn(async () => {}),
		sync: { updateLibraryConfig: vi.fn() },
	} as unknown as BoardStore;
	const column = {
		name: 'Library',
		color: '',
		cards: [],
		sectionType: 'library',
		libraryConfig: {
			filters: [],
			viewMode: 'grid',
			sortBy: 'name',
			sortDesc: false,
			pageSize: 20,
			viewGroupMode: 'property',
			viewGroupBy: 'status',
		},
	} as DashboardColumn;
	return { store, column };
}
test('grouped library reveals fifty at a time, caps display at five hundred, and retains total count', () => {
	setLanguage('en');
	const { store, column } = fixture(610);
	render(
		<TestProviders>
			<LibrarySection store={store} column={column} />
		</TestProviders>,
	);
	expect(screen.getAllByRole('button', { name: /^Item \d+/ })).toHaveLength(50);
	for (let i = 0; i < 9; i++) fireEvent.click(screen.getByText(t('home.dashboard.more50')));
	expect(screen.getAllByRole('button', { name: /^Item \d+/ })).toHaveLength(500);
	expect(screen.queryByRole('button', { name: t('home.dashboard.more50') })).toBeNull();
	expect(screen.getByText(t('home.dashboard.files', { count: 610 }))).toBeTruthy();
}, 15000);
test('library delete opens confirmation without opening the file, and cancel does not trash it', () => {
	const { store, column } = fixture(1);
	render(
		<TestProviders>
			<LibrarySection store={store} column={column} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByRole('button', { name: t('common.delete') }));
	expect(screen.getByRole('dialog')).toBeTruthy();
	expect(store.openFile).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole('button', { name: t('common.cancel') }));
	expect(store.trash).not.toHaveBeenCalled();
});
