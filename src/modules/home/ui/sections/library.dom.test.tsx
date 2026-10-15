import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
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
		newNote: vi.fn(async () => '.nand/content/new.md'),
		sync: { updateLibraryConfig: vi.fn(async () => {}) },
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

for (const view of ['grid', 'gallery', 'list', 'kanban'] as const)
	test(`${view} delete confirms once without opening the file`, async () => {
		const { store, column } = fixture(1);
		column.libraryConfig!.viewMode = view;
		render(
			<TestProviders>
				<LibrarySection store={store} column={column} />
			</TestProviders>,
		);
		fireEvent.click(screen.getByRole('button', { name: t('common.delete') }));
		expect(store.openFile).not.toHaveBeenCalled();
		expect(store.trash).not.toHaveBeenCalled();
		const dialog = screen.getByRole('dialog');
		fireEvent.click(within(dialog).getByRole('button', { name: t('common.delete') }));
		await waitFor(() => expect(store.trash).toHaveBeenCalledTimes(1));
	});

test.each(['library', 'folder'] as const)(
	'%s toolbar new-note passes folder, template and prefilled properties',
	async (sectionType) => {
		const { store, column } = fixture(1);
		column.sectionType = sectionType;
		Object.assign(column.libraryConfig!, {
			folders: ['Notes', 'Projects'],
			templatePath: 'T.md',
			filters: [
				{ property: 'status', values: ['draft', 'done'] },
				{ property: 'title', operator: 'contains', values: ['book'] },
				{ property: 'tags', values: ['work'] },
				{ property: 'path', values: ['private'] },
				{ property: 'rating', operator: 'notEquals', values: ['0'] },
			],
		});
		render(
			<TestProviders>
				<LibrarySection store={store} column={column} />
			</TestProviders>,
		);
		fireEvent.click(screen.getByRole('button', { name: t('home.dashboard.newNote') }));
		fireEvent.change(screen.getByLabelText(t('home.dashboard.name')), { target: { value: 'A note' } });
		fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('common.save') }));
		await waitFor(() =>
			expect(store.newNote).toHaveBeenCalledWith(sectionType === 'folder' ? 'Notes' : '', 'A note', 'T.md', {
				status: 'draft',
				title: 'book',
				tags: ['work'],
			}),
		);
	},
);
test('pinned badges honor order and cap fallback; config preserves unrelated fields and clears picks', async () => {
	const { store, column } = fixture(1);
	column.libraryConfig!.visibleProperties = ['status'];
	column.libraryConfig!.propertyLimit = 0;
	const view = render(
		<TestProviders>
			<LibrarySection store={store} column={column} />
		</TestProviders>,
	);
	expect(screen.getByText('status:')).toBeTruthy();
	fireEvent.click(screen.getByRole('button', { name: t('home.dashboard.settings') }));
	const dialog = screen.getByRole('dialog');
	fireEvent.click(within(dialog).getByRole('button', { name: 'status' }));
	fireEvent.change(within(dialog).getByLabelText(t('library.visibleProperties')), { target: { value: 'custom' } });
	fireEvent.click(within(dialog).getByRole('button', { name: t('library.addProperty') }));
	fireEvent.click(within(dialog).getByRole('button', { name: t('common.save') }));
	await waitFor(() => expect(store.sync.updateLibraryConfig).toHaveBeenCalled());
	expect(vi.mocked(store.sync.updateLibraryConfig).mock.calls.at(-1)?.[1]).toMatchObject({
		visibleProperties: ['custom'],
		pageSize: 20,
		propertyLimit: 0,
		viewGroupMode: 'property',
	});
	column.libraryConfig!.showProperties = false;
	view.rerender(
		<TestProviders>
			<LibrarySection store={store} column={column} />
		</TestProviders>,
	);
	expect(screen.queryByText('status:')).toBeNull();
});
test('library config operator, tags, folders and template edits survive one save', async () => {
	const { store, column } = fixture(1);
	column.libraryConfig!.filters = [{ property: 'tags', operator: 'contains', values: ['work'] }];
	render(
		<TestProviders>
			<LibrarySection store={store} column={column} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByRole('button', { name: t('home.dashboard.settings') }));
	const d = screen.getByRole('dialog');
	fireEvent.change(within(d).getByLabelText(t('home.dashboard.value')), { target: { value: 'work, personal' } });
	fireEvent.change(within(d).getByLabelText(t('home.dashboard.folders')), { target: { value: 'Notes, Projects' } });
	fireEvent.change(within(d).getByLabelText(t('home.dashboard.template')), { target: { value: 'Template.md' } });
	fireEvent.click(within(d).getByRole('button', { name: t('common.save') }));
	await waitFor(() =>
		expect(store.sync.updateLibraryConfig).toHaveBeenCalledWith(
			'Library',
			expect.objectContaining({
				filters: [{ property: 'tags', operator: 'contains', values: ['work', 'personal'] }],
				folders: ['Notes', 'Projects'],
				templatePath: 'Template.md',
				templatePaths: ['Template.md'],
			}),
		),
	);
});
test.each([
	['small', '150px'],
	['medium', '200px'],
	['large', '280px'],
] as const)('card size %s applies to real gallery grid with a placeholder', (size, width) => {
	const { store, column } = fixture(1);
	column.libraryConfig!.cardSize = size;
	column.libraryConfig!.viewMode = 'gallery';
	const { container } = render(
		<TestProviders>
			<LibrarySection store={store} column={column} />
		</TestProviders>,
	);
	expect([...container.querySelectorAll('div')].some((el) => el.className.includes(`minmax(${width},1fr)`))).toBe(
		true,
	);
	expect(container.querySelector('svg.size-8')).toBeTruthy();
	expect(container.querySelector('img')).toBeNull();
});
test('refresh keeps section DOM, search and collapsed groups; another board has independent state', () => {
	const one = fixture(2),
		two = fixture(2);
	const view = render(
		<TestProviders>
			<div data-testid="one">
				<LibrarySection {...one} />
			</div>
			<div data-testid="two">
				<LibrarySection {...two} />
			</div>
		</TestProviders>,
	);
	const first = screen.getByTestId('one'),
		second = screen.getByTestId('two');
	const search = within(first).getByLabelText(t('home.dashboard.findNote'));
	fireEvent.change(search, { target: { value: 'Item 1' } });
	fireEvent.click(within(first).getByRole('button', { name: /^Draft/ }));
	act(() => one.store.state.setState({ files: [] }));
	expect(within(first).getByLabelText(t('home.dashboard.findNote'))).toBe(search);
	expect(within(first).queryByRole('button', { name: /Item 1/ })).toBeNull();
	expect(within(second).getAllByRole('button', { name: /Item [01]/ })).toHaveLength(2);
	view.unmount();
});
