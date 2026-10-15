import { useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '../../../ui/react/test-providers';
import { setLanguage, t } from '../../../shared/i18n';
import { newRecord, ContactsError, type ArchiveRecord } from '../core/model';
import { ContactsIndex, emptyQuery } from '../core/index-store';
import { emptyPanelState, applyLayout } from './panel-state';
import type { ContactsPanelHost } from './panel-contract';
import type { ContactsController } from '../platform/controller';
import { ContactsSurface } from './surface';
import { ResourceList } from './ResourceList';
import { ArchiveFilters, ArchiveEditor } from './forms';
import { MultiValueField } from './form-fields';
import { archivesSettingsPage } from './settings-page';
import { SettingsStore } from '../../../shared/settings/store';
import { archivesSettings } from '../settings';
afterEach(() => setLanguage('zh'));
function record(name = '张三', kind: 'person' | 'company' = 'person') {
	const value = newRecord(kind);
	value.fields.name = name;
	value.folderPath = '.nand/content/档案/' + name;
	value.path = value.folderPath + '/基本信息.md';
	return value;
}
function viewFor(records: ArchiveRecord[]) {
	const index = new ContactsIndex();
	records.forEach((r) => index.set(r));
	const view = {
		state: emptyPanelState(),
		enabled: true,
		columns: 6,
		controller: { index, error: '', loading: false, reload: vi.fn(async () => {}) },
		mountMarkdown: vi.fn(() => () => {}),
		resources: () => [],
		select: vi.fn(),
		back: vi.fn(),
		changeKind: vi.fn(),
		layout: vi.fn(),
		setScope: vi.fn(),
		search: vi.fn(),
		sort: vi.fn(),
		page: vi.fn(),
		clearFilters: vi.fn(),
		filters: vi.fn(),
		add: vi.fn(),
		edit: vi.fn(),
		deleteRow: vi.fn(),
		recordActions: () => [],
		newNote: vi.fn(),
		addResources: vi.fn(),
		openResource: vi.fn(),
		revealFolder: vi.fn(),
	} satisfies ContactsPanelHost;
	return view;
}
test('resource pagination keeps the search draft when live resources change', async () => {
	const r = record(),
		view = viewFor([r]);
	let files = Array.from({ length: 65 }, (_, i) => ({
		path: r.folderPath + `/资料${i}.pdf`,
		relativePath: `资料${i}.pdf`,
		name: `资料${i}.pdf`,
		extension: 'pdf',
		size: i,
		modified: i,
	}));
	const host = { ...view, resources: () => files };
	const node = () => (
		<TestProviders>
			<ResourceList view={host} record={r} />
		</TestProviders>
	);
	const mounted = render(node()),
		user = userEvent.setup();
	expect(mounted.container.querySelectorAll('[data-resource-path]')).toHaveLength(60);
	await user.click(screen.getByRole('button', { name: t('contacts.next') }));
	expect(mounted.container.querySelectorAll('[data-resource-path]')).toHaveLength(5);
	await user.type(screen.getByRole('searchbox'), '资料64');
	expect(mounted.container.querySelectorAll('[data-resource-path]')).toHaveLength(1);
	files = [...files, { ...files[64]!, path: r.folderPath + '/项目/资料64.pdf', relativePath: '项目/资料64.pdf' }];
	mounted.rerender(node());
	expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe('资料64');
	expect(mounted.container.querySelectorAll('[data-resource-path]')).toHaveLength(2);
	await user.click(mounted.container.querySelector<HTMLButtonElement>('[data-resource-path]')!);
	expect(view.openResource).toHaveBeenCalledWith(files[64]!.path);
});
test('filters explain absent choices and apply a copy without losing previous choices', async () => {
	const r = record();
	r.fields.region = '上海';
	const index = new ContactsIndex();
	index.set(r);
	const controller = { index, choices: () => [] } as unknown as ContactsController,
		done = vi.fn(),
		close = vi.fn();
	const query = { ...emptyQuery(), regions: ['Previous region'] };
	render(
		<TestProviders>
			<ArchiveFilters controller={controller} query={query} done={done} close={close} />
		</TestProviders>,
	);
	expect(screen.getAllByText(t('contacts.noFilterOptions'))).toHaveLength(4);
	await userEvent.setup().click(screen.getByRole('switch', { name: '上海' }));
	expect(query.regions).toEqual(['Previous region']);
	await userEvent.setup().click(screen.getByRole('button', { name: t('contacts.apply') }));
	expect(done.mock.calls[0]?.[0].regions).toEqual(['Previous region', '上海']);
	expect(close).toHaveBeenCalledOnce();
});
test('list/card paths and kind-specific search survive layout changes and IME', async () => {
	const searchCalls = vi.fn();
	const r = record();
	r.prose.notes = '只在备注';
	r.fields.emails = ['a@example.com'];
	const view = viewFor([r, record('Example', 'company')]);
	function Fixture() {
		const [, draw] = useState(0);
		const paint = () => draw((v) => v + 1);
		view.layout = vi.fn((mode) => {
			view.state = applyLayout(view.state, mode);
			paint();
		});
		view.changeKind = vi.fn((kind) => {
			view.state.query.kind = kind;
			paint();
		});
		view.search = vi.fn((value: string) => {
			searchCalls(value);
			view.state.query.search = value;
			paint();
		});
		return <ContactsSurface view={view} />;
	}
	const mounted = render(
			<TestProviders>
				<Fixture />
			</TestProviders>,
		),
		user = userEvent.setup();
	const paths = () =>
		[...mounted.container.querySelectorAll<HTMLElement>('[data-path]')].map((el) => el.dataset.path);
	const before = paths();
	await user.click(screen.getByRole('button', { name: t('contacts.card') }));
	expect(paths()).toEqual(before);
	expect(view.controller.reload).not.toHaveBeenCalled();
	const input = screen.getByRole('searchbox');
	fireEvent.compositionStart(input);
	fireEvent.change(input, { target: { value: 'zhong' } });
	expect(searchCalls).not.toHaveBeenCalled();
	fireEvent.compositionEnd(input, { data: '中', target: { value: '中' } });
	expect(searchCalls).toHaveBeenCalledWith('中');
	await user.click(screen.getByRole('button', { name: t('contacts.company') }));
	expect(screen.getByRole('searchbox')).toBe(input);
	expect(input.getAttribute('aria-label')).toBe(t('contacts.searchCompanies'));
});
test('empty prose does not mount Markdown but literal placeholder text does and cleans up', async () => {
	const r = record(),
		view = viewFor([r]),
		off = vi.fn();
	view.state.selectedPath = r.path;
	view.mountMarkdown = vi.fn(() => off);
	const node = () => (
		<TestProviders>
			<ContactsSurface view={view} />
		</TestProviders>
	);
	const mounted = render(node());
	await userEvent.setup().click(screen.getByRole('button', { name: t('contacts.traits') }));
	expect(view.mountMarkdown).not.toHaveBeenCalled();
	r.prose.traits = t('contacts.noDetails');
	mounted.rerender(node());
	expect(view.mountMarkdown).toHaveBeenCalledOnce();
	r.prose.traits = '';
	mounted.rerender(node());
	expect(off).toHaveBeenCalledOnce();
});
test('multi-values retain leading zeroes, pasted lines, and uncommitted tag text', async () => {
	const change = vi.fn();
	const mounted = render(
		<TestProviders>
			<MultiValueField label="Phone" value={['00123']} onChange={change} chips={false} />
		</TestProviders>,
	);
	fireEvent.paste(screen.getByRole('textbox'), { clipboardData: { getData: () => '+0123\n00456' } });
	expect(change).toHaveBeenLastCalledWith(['+0123', '00456']);
	mounted.unmount();
	render(
		<TestProviders>
			<MultiValueField label="Tags" value={[]} onChange={change} chips />
		</TestProviders>,
	);
	await userEvent.setup().type(screen.getByRole('textbox'), '草稿');
	expect(change).toHaveBeenLastCalledWith(['草稿']);
});
test('record save conflicts keep the draft and offer copy/reload without reporting success', async () => {
	const base = record(),
		save = vi.fn(async () => {
			throw new ContactsError('conflict');
		}),
		done = vi.fn(),
		exit = vi.fn();
	const controller = {
		app: { workspace: { containerEl: document.body } },
		root: '.nand/content/档案',
		subscribe: () => () => {},
		index: { get: () => base },
		save,
	} as unknown as ContactsController;
	render(
		<TestProviders>
			<ArchiveEditor controller={controller} base={base} scope="basic" done={done} exit={exit} />
		</TestProviders>,
	);
	const name = screen.getByRole<HTMLInputElement>('textbox', { name: t('contacts.personName') }),
		user = userEvent.setup();
	await user.clear(name);
	await user.type(name, '更新');
	await user.click(screen.getByRole('button', { name: t('contacts.save') }));
	await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
	expect(name.value).toBe('更新');
	expect(done).not.toHaveBeenCalled();
	expect(exit).not.toHaveBeenCalled();
	expect(screen.getByRole('button', { name: t('contacts.copyDraft') })).toBeTruthy();
	await user.click(screen.getByRole('button', { name: t('contacts.cancel') }));
	await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
	expect(exit).not.toHaveBeenCalled();
	await user.click(screen.getByRole('button', { name: t('contacts.discardAction') }));
	await waitFor(() => expect(exit).toHaveBeenCalledOnce());
});
test('archive settings reject invalid roots and persist column changes through the namespace', async () => {
	const store = new SettingsStore(
		{ load: async () => null, save: async (_scope, file) => file },
		{
			timers: {
				set: (callback, ms) => setTimeout(callback, ms),
				clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
			},
			debounceMs: 0,
		},
	);
	const settings = store.bind('archives', archivesSettings),
		controller = { countFolder: vi.fn() } as unknown as ContactsController;
	const Page = archivesSettingsPage({ workspace: { containerEl: document.body } } as never, controller, settings);
	render(
		<TestProviders>
			<Page />
		</TestProviders>,
	);
	const user = userEvent.setup();
	const root = screen.getByRole('textbox', { name: t('contacts.folder') });
	await user.clear(root);
	await user.type(root, '../outside');
	await user.click(screen.getByRole('button', { name: t('contacts.preview') }));
	expect(controller.countFolder).not.toHaveBeenCalled();
	expect(settings.get().rootFolder).not.toBe('../outside');
	await user.click(screen.getByRole('combobox', { name: t('contacts.columns') }));
	await user.click(screen.getByRole('option', { name: '5' }));
	expect(settings.get().maxColumns).toBe(5);
	await store.dispose();
});

test.each(['tags', 'aliases'] as const)('saving %s after removing a chip keeps the pending input', async (field) => {
	const base = record();
	base.fields[field] = ['old'];
	const save = vi.fn(async (_base: ArchiveRecord, _draft: ArchiveRecord) => base);
	const controller = {
		app: { workspace: { containerEl: document.body } },
		root: '.nand/content/档案',
		subscribe: () => () => {},
		index: { get: () => base },
		save,
	} as unknown as ContactsController;
	render(
		<TestProviders>
			<ArchiveEditor controller={controller} base={base} scope="basic" done={vi.fn()} exit={vi.fn()} />
		</TestProviders>,
	);
	const input = screen.getByRole<HTMLInputElement>('textbox', { name: t(`contacts.${field}`) });
	fireEvent.change(input, { target: { value: 'pending' } });
	fireEvent.click(screen.getByRole('button', { name: t('contacts.removeItem') + ': old' }));
	expect(input.value).toBe('pending');
	fireEvent.click(screen.getByRole('button', { name: t('contacts.save') }));
	await waitFor(() => expect(save).toHaveBeenCalledOnce());
	expect(save.mock.calls[0]?.[1].fields[field]).toEqual(['pending']);
	expect(base.fields[field]).toEqual(['old']);
});
