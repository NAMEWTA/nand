import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useStore } from 'zustand';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { contentFiles } from '../../../host/obsidian/storage/content-files';
import { TestProviders } from '../../../ui/react/test-providers';
import { setLanguage, t } from '../../../shared/i18n';
import { DEFAULT_DASHBOARD_SETTINGS } from '../core/board/types/model';
import { memoCardText } from '../platform/board/card-move';
import { BoardStore } from './board-store';
import type { HomeHost } from './home-host';
import { Card } from '../ui/cards/Card';
import { MemoBody } from '../ui/cards/MemoBody';
import { TaskList } from '../ui/cards/TaskList';
import { CaptureBox } from '../ui/quickbar/CaptureBox';
vi.mock('obsidian', async (original) => ({
	...(await original<typeof import('obsidian')>()),
	Component: class {
		load() {}
		unload() {}
	},
	MarkdownRenderer: {
		render: async (_app: unknown, text: string, el: HTMLElement) => {
			el.textContent = text;
		},
	},
}));
vi.mock('./instances', () => ({ homeServices: {} }));
import { convertToCanvas } from '../core/board/canvas';
import { parse, serialize } from '../core/board/parser/parse';
import { withStableSectionIds } from '../core/board/section-identity';
const board = '.nand/content/board.md';
/** A board that already is a widget canvas, so opening it writes nothing. */
const source = serialize(
	withStableSectionIds(
		convertToCanvas(
			parse(
				'# Board\n\n## Todo\n\n### Tasks\n- [ ] Parent\n  - [ ] Child\n- [x] Finished\n\n### Memo\nOriginal memo\n',
			),
			undefined,
		),
		() => `section-${crypto.randomUUID()}`,
	),
);
const stores: BoardStore[] = [];
afterEach(async () => {
	cleanup();
	for (const store of stores.splice(0)) await store.dispose();
});
async function fixture() {
	setLanguage('en');
	const vault = memoryVault({ [board]: source, '.nand/content/Archive.md': '# Existing archive' }, window);
	const files = contentFiles(vault.app);
	await files.refresh();
	const settings = { ...structuredClone(DEFAULT_DASHBOARD_SETTINGS), taskArchivePath: '.nand/content/Archive.md' };
	const host = {
		app: vault.app,
		settings,
		subscribeSettings: () => () => {},
		workbenchRefresh: () => {},
	} as unknown as HomeHost;
	const store = new BoardStore(host, '.nand/content/board', window);
	stores.push(store);
	await store.init();
	return { vault, files, store };
}
test('archive appends before the single board write; failed archive leaves all board bytes intact', async () => {
	const { vault, store } = await fixture();
	const process = vi.spyOn(vault.adapter, 'process');
	await store.archiveTasks('Todo');
	expect(vault.contents.get('.nand/content/Archive.md')).toContain('# Existing archive\n- ');
	expect(vault.contents.get('.nand/content/Archive.md')).toContain('Finished');
	expect(vault.contents.get(board)).not.toContain('Finished');
	expect(process.mock.calls.filter(([path]) => path === board)).toHaveLength(1);
	const first = process.mock.calls.findIndex(([path]) => path === '.nand/content/Archive.md');
	expect(first).toBeLessThan(process.mock.calls.findIndex(([path]) => path === board));
	const second = await fixture(),
		before = second.vault.contents.get(board);
	vi.spyOn(second.vault.adapter, 'process').mockRejectedValue(new Error('disk full'));
	await expect(second.store.archiveTasks('Todo')).rejects.toThrow('disk full');
	expect(second.vault.contents.get(board)).toBe(before);
	expect(second.store.completedTasks('Todo')).toHaveLength(1);
});
test('daily archive uses the core daily template and aborts if daily notes are unavailable', async () => {
	const { vault, store } = await fixture();
	store.host.settings.taskArchiveTarget = 'daily';
	await expect(store.archiveTasks('Todo')).rejects.toThrow(t('notice.archiveDailyUnavailable'));
	expect(vault.contents.get(board)).toBe(source);
	await vault.adapter.write('Templates/Daily.md', '# Daily {{date}}\n');
	Object.assign(vault.app, {
		internalPlugins: {
			plugins: {
				'daily-notes': {
					enabled: true,
					instance: { options: { folder: 'Daily', template: 'Templates/Daily.md' } },
				},
			},
		},
	});
	await store.archiveTasks('Todo');
	const daily = [...vault.contents.entries()].find(([path]) => path.startsWith('Daily/'));
	expect(daily?.[1]).toContain('# Daily ');
	expect(daily?.[1]).toContain('Finished');
	expect(vault.contents.get(board)).not.toContain('Finished');
});
function Memo({ store }: { store: BoardStore }) {
	const data = useStore(store.state, (s) => s.data)!;
	const card = data.columns[0]!.cards.find((c) => c.title === 'Memo')!;
	return (
		<MemoBody
			store={store}
			cardId={card.id}
			text={memoCardText(card)}
			onSave={(text, original) => store.saveMemo(card.id, text, original)}
		/>
	);
}
test.each(['blur', 'shortcut', 'storage-retry-remount'])(
	'failed memo write can retry the latest draft via %s, then edit and save again',
	async (retry) => {
		const { vault, store } = await fixture();
		const view = render(
			<TestProviders>
				<Memo store={store} />
			</TestProviders>,
		);
		fireEvent.click(screen.getByRole('button', { name: t('common.edit') }));
		fireEvent.change(screen.getByRole('textbox'), { target: { value: '  FIRST FAILED SAVE  \n\n' } });
		const process = vi.spyOn(vault.adapter, 'process').mockRejectedValue(new Error('temporary I/O failure'));
		fireEvent.blur(screen.getByRole('textbox'));
		await screen.findByRole('alert');
		expect(store.state.getState().save.status).toBe('save-error');
		expect(vault.contents.get(board)).toBe(source);
		expect(store.state.getState().data!.columns[0]!.cards[1]!.body).toBe('FIRST FAILED SAVE');
		fireEvent.change(screen.getByRole('textbox'), { target: { value: 'SECOND DRAFT AFTER FAILURE' } });
		process.mockRestore();
		if (retry === 'storage-retry-remount') {
			await act(() => store.sync.retrySave());
			expect(vault.contents.get(board)).toContain('FIRST FAILED SAVE');
			view.rerender(
				<TestProviders>
					<Memo key="remounted" store={store} />
				</TestProviders>,
			);
			expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('SECOND DRAFT AFTER FAILURE');
		}
		if (retry === 'shortcut') fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', ctrlKey: true });
		else fireEvent.blur(screen.getByRole('textbox'));
		await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
		expect(screen.queryByRole('alert')).toBeNull();
		expect(vault.contents.get(board)).toContain('SECOND DRAFT AFTER FAILURE');
		expect(store.state.getState().save.status).toBe('saved');
		expect(store.memoDrafts.size).toBe(0);
		fireEvent.click(screen.getByRole('button', { name: t('common.edit') }));
		fireEvent.change(screen.getByRole('textbox'), { target: { value: 'THIRD EDIT SAVED' } });
		fireEvent.blur(screen.getByRole('textbox'));
		await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
		expect(vault.contents.get(board)).toContain('THIRD EDIT SAVED');
		expect(vault.contents.get(board)).not.toContain('SECOND DRAFT AFTER FAILURE');
		expect(store.state.getState().save.status).toBe('saved');
	},
);
test('a retried local revision does not permit overwriting a later external edit during the same memo session', async () => {
	const { vault, files, store } = await fixture();
	render(
		<TestProviders>
			<Memo store={store} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByRole('button', { name: t('common.edit') }));
	fireEvent.change(screen.getByRole('textbox'), { target: { value: 'FAILED LOCAL REVISION' } });
	const process = vi.spyOn(vault.adapter, 'process').mockRejectedValue(new Error('temporary I/O failure'));
	fireEvent.blur(screen.getByRole('textbox'));
	await screen.findByRole('alert');
	process.mockRestore();
	await act(() => store.sync.retrySave());
	fireEvent.change(screen.getByRole('textbox'), { target: { value: 'LATEST UNSAVED DRAFT' } });
	await act(async () => {
		await vault.adapter.write(board, vault.contents.get(board)!.replace('FAILED LOCAL REVISION', 'REMOTE BODY'));
		await files.refresh();
	});
	await waitFor(() => expect(store.state.getState().data!.columns[0]!.cards[1]!.body).toBe('REMOTE BODY'));
	fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', ctrlKey: true });
	await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(t('home.dashboard.memoChanged')));
	expect(vault.contents.get(board)).toContain('REMOTE BODY');
	expect(vault.contents.get(board)).not.toContain('LATEST UNSAVED DRAFT');
	expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('LATEST UNSAVED DRAFT');
});
test('normal watcher update during inline editing cannot overwrite remote body; the draft survives remount', async () => {
	const { vault, files, store } = await fixture();
	const view = render(
		<TestProviders>
			<Memo store={store} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByRole('button', { name: t('common.edit') }));
	fireEvent.change(screen.getByRole('textbox'), { target: { value: 'LOCAL UNSAVED MEMO' } });
	await act(async () => {
		await vault.adapter.write(board, source.replace('Original memo', 'REMOTE MEMO UPDATE'));
		await files.refresh();
	});
	await waitFor(() =>
		expect(store.state.getState().data!.columns[0]!.cards[1]!.body).toContain('REMOTE MEMO UPDATE'),
	);
	fireEvent.blur(screen.getByRole('textbox'));
	await screen.findByRole('alert');
	expect(vault.contents.get(board)).toContain('REMOTE MEMO UPDATE');
	expect(vault.contents.get(board)).not.toContain('LOCAL UNSAVED MEMO');
	expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('LOCAL UNSAVED MEMO');
	view.unmount();
	render(
		<TestProviders>
			<Memo store={store} />
		</TestProviders>,
	);
	expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('LOCAL UNSAVED MEMO');
});
test('external edits to unrelated fields merge with the inline memo draft', async () => {
	const { vault, files, store } = await fixture();
	render(
		<TestProviders>
			<Memo store={store} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByRole('button', { name: t('common.edit') }));
	fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Local body' } });
	await act(async () => {
		await vault.adapter.write(board, source.replace('Parent', 'Remote parent'));
		await files.refresh();
	});
	await waitFor(() =>
		expect(store.state.getState().data!.columns[0]!.cards[0]!.tasks[0]!.text).toBe('Remote parent'),
	);
	fireEvent.blur(screen.getByRole('textbox'));
	await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
	expect(vault.contents.get(board)).toContain('Remote parent');
	expect(vault.contents.get(board)).toContain('Local body');
});
function Tasks({ store }: { store: BoardStore }) {
	const card = useStore(store.state, (s) => s.data!.columns[0]!.cards[0]!);
	return <TaskList store={store} card={card} />;
}
test('collapse and expand update DOM and disk exactly once per gesture', async () => {
	const { vault, store } = await fixture();
	const process = vi.spyOn(vault.adapter, 'process');
	render(
		<TestProviders>
			<Tasks store={store} />
		</TestProviders>,
	);
	const toggle = screen.getByRole('button', { name: t('home.dashboard.collapse') });
	fireEvent.click(toggle);
	await waitFor(() => expect(toggle.getAttribute('aria-expanded')).toBe('false'));
	expect(screen.queryByRole('checkbox', { name: 'Child' })).toBeNull();
	await waitFor(() => expect(vault.contents.get(board)).toContain('<!--collapsed-->'));
	expect(process.mock.calls.filter(([path]) => path === board)).toHaveLength(1);
	fireEvent.click(toggle);
	await waitFor(() => expect(toggle.getAttribute('aria-expanded')).toBe('true'));
	expect(screen.getByRole('checkbox', { name: 'Child' })).toBeTruthy();
	await waitFor(() => expect(vault.contents.get(board)).not.toContain('<!--collapsed-->'));
	expect(process.mock.calls.filter(([path]) => path === board)).toHaveLength(2);
});
test('layout remounts restore the controlled capture draft and skills read the same value', async () => {
	const { store } = await fixture();
	const view = render(
		<TestProviders>
			<CaptureBox key="side" store={store} />
		</TestProviders>,
	);
	fireEvent.change(screen.getByRole('textbox', { hidden: true }), { target: { value: 'Unsubmitted thought' } });
	for (const layout of ['mobile', 'side', 'stacked', 'side']) {
		view.rerender(
			<TestProviders>
				<CaptureBox key={layout} store={store} />
			</TestProviders>,
		);
		expect((screen.getByRole('textbox', { hidden: true }) as HTMLTextAreaElement).value).toBe(
			'Unsubmitted thought',
		);
		expect(store.captureDraft).toBe('Unsubmitted thought');
	}
});

test('card save action routes exactly once, and real note creation keeps templates, properties and collisions', async () => {
	const { vault, store, files } = await fixture();
	const card = store.state.getState().data!.columns[0]!.cards.find((c) => c.title === 'Memo')!;
	const save = vi.spyOn(store, 'saveCard').mockResolvedValue();
	render(
		<TestProviders>
			<Card store={store} card={card} index={0} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByRole('button', { name: t('home.dashboard.saveNote') }));
	expect(save).toHaveBeenCalledExactlyOnceWith(card);
	vi.spyOn(store, 'openFile').mockResolvedValue();
	await vault.adapter.write('.nand/content/Template.md', '---\ncustom: keep\nstatus: old\n---\n# {{title}}\nBody');
	await files.refresh();
	const first = await store.newNote('Notes', 'Test', 'Template.md', { status: 'draft' });
	const second = await store.newNote('Notes', 'Test', 'Template.md', { status: 'draft' });
	expect(first).toBe('.nand/content/Notes/Test.md');
	expect(second).toBe('.nand/content/Notes/Test-2.md');
	expect(vault.contents.get(first)).toContain('custom: keep');
	expect(vault.contents.get(first)).toContain('status: draft');
	expect(vault.contents.get(first)).toContain('# Test');
	expect(vault.contents.get(first)).toContain('Body');
});
