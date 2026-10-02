import {
	Component,
	ItemView,
	MarkdownRenderer,
	Menu,
	Notice,
	Platform,
	type ViewStateResult,
	type WorkspaceLeaf,
} from 'obsidian';
import { render } from 'preact/compat';
import { emptyQuery } from '../../core/contacts/index-store';
import { ContactsError, newRecord, type ArchiveRecord, type RecordKind } from '../../core/contacts/model';
import { type ContactsController } from '../../platform/obsidian/contacts/controller';
import { t } from '../../shared/i18n/index';
import { onLeafLanguageChanged } from '../../platform/obsidian/workspace-title';
import { confirm, ct, deleteRow, editRecord, errorText, FilterModal, RecordEditorModal, type EditScope } from './forms';
import type { ContactsHost } from './host';
import type { ContactsPanelState } from './panel-contract';
import { ContactsSurface } from './surface';
import { ArchiveNoteModal } from './note-modal';
import type { ArchiveResource } from '../../core/contacts/resources';

export const CONTACTS_VIEW_TYPE = 'nand-contacts-view';
export class ContactsView extends ItemView {
	state: ContactsPanelState = { query: emptyQuery(), page: 0, selectedPath: '', selectedId: '', scroll: 0 };
	controller?: ContactsController;
	private unsubscribe?: () => void;
	private history: Array<{ path: string; id: string }> = [];
	private root?: HTMLElement;
	private pendingInput?: HTMLInputElement;
	constructor(
		leaf: WorkspaceLeaf,
		private plugin: ContactsHost,
	) {
		super(leaf);
	}
	mountMarkdown(target: HTMLElement, text: string, path: string): () => void {
		const child = this.addChild(new Component());
		const body = target.createDiv();
		void MarkdownRenderer.render(this.app, text, body, path, child).catch(() => body.setText(text));
		return () => {
			this.removeChild(child);
			body.remove();
		};
	}
	get enabled(): boolean {
		return this.plugin.settings.modules.contacts;
	}
	get columns(): number {
		return this.plugin.settings.contacts.maxColumns;
	}
	getViewType(): string {
		return CONTACTS_VIEW_TYPE;
	}
	getDisplayText(): string {
		return ct('title');
	}
	getIcon(): string {
		return 'contact-round';
	}
	onOpen(): Promise<void> {
		this.contentEl.addClass('nand-contacts-view');
		this.contentEl.toggleClass('nand-contacts-phone', Platform.isPhone);
		this.root = this.contentEl.createDiv();
		if (Platform.isPhone) {
			const navbar = this.contentEl.doc.querySelector('.mobile-navbar');
			if (navbar) {
				const measure = () =>
					this.contentEl.style.setProperty(
						'--nand-contacts-navbar-height',
						`${navbar.getBoundingClientRect().height}px`,
					);
				const observer = new ResizeObserver(measure);
				observer.observe(navbar);
				measure();
				this.register(() => observer.disconnect());
			}
		}
		this.register(onLeafLanguageChanged(this.app, this.leaf, () => this.render()));
		this.register(
			this.contentEl.onWindowMigrated(() => {
				if (this.root) render(null, this.root);
				this.render();
			}),
		);
		this.registerDomEvent(this.contentEl, 'scroll', () => {
			if (!this.state.selectedPath) this.state.scroll = this.contentEl.scrollTop;
		});
		this.bindController();
		return Promise.resolve();
	}
	bindController(): void {
		this.unsubscribe?.();
		this.controller = this.plugin.contactsHost;
		if (this.enabled && this.controller) {
			this.unsubscribe = this.controller.subscribe(() => this.render());
			void this.controller.ensureLoaded().catch((error: unknown) => new Notice(errorText(error)));
		}
		this.render();
	}
	render(): void {
		if (this.state.selectedPath && this.controller) {
			const tracked = this.state.selectedId
				? this.controller.index.get(this.state.selectedId)
				: this.controller.index.byPath.get(this.state.selectedPath);
			if (tracked) {
				this.state.selectedPath = tracked.path;
				this.state.selectedId = tracked.id;
			}
		}
		if (this.root) render(<ContactsSurface view={this} />, this.root);
	}
	onClose(): Promise<void> {
		this.disposeSurface();
		return Promise.resolve();
	}
	disposeSurface(): void {
		this.pendingInput?.remove();
		this.pendingInput = undefined;
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		if (this.root) {
			render(null, this.root);
			this.root.remove();
			this.root = undefined;
		}
	}
	getState(): Record<string, unknown> {
		return { ...this.state };
	}
	async setState(raw: Record<string, unknown>, result: ViewStateResult): Promise<void> {
		const q = raw.query && typeof raw.query === 'object' ? (raw.query as Record<string, unknown>) : {};
		const query = emptyQuery();
		query.kind = q.kind === 'company' ? 'company' : 'person';
		query.sort = q.sort === 'modified' ? 'modified' : 'name';
		query.search = typeof q.search === 'string' ? q.search : '';
		for (const key of ['current', 'past', 'regions', 'tags', 'relations'] as const)
			query[key] = Array.isArray(q[key]) ? q[key].filter((v): v is string => typeof v === 'string') : [];
		this.state = {
			query,
			page: typeof raw.page === 'number' && Number.isFinite(raw.page) ? Math.max(0, Math.floor(raw.page)) : 0,
			selectedPath: typeof raw.selectedPath === 'string' ? raw.selectedPath : '',
			selectedId: typeof raw.selectedId === 'string' ? raw.selectedId : '',
			scroll: typeof raw.scroll === 'number' && Number.isFinite(raw.scroll) ? Math.max(0, raw.scroll) : 0,
		};
		if (this.app.workspace.layoutReady) await this.controller?.ensureLoaded();
		if (
			this.app.workspace.layoutReady &&
			this.controller &&
			this.state.selectedPath &&
			!this.controller.index.byPath.has(this.state.selectedPath) &&
			!this.controller.index.get(this.state.selectedId)
		) {
			this.state.selectedPath = '';
			this.state.selectedId = '';
			this.persist();
		}
		this.render();
		await super.setState(raw, result);
		if (!this.state.selectedPath)
			this.contentEl.win.requestAnimationFrame(() => {
				this.contentEl.scrollTop = this.state.scroll;
			});
	}
	private persist(): void {
		this.app.workspace.requestSaveLayout();
	}
	select(path: string): void {
		if (this.state.selectedPath) this.history.push({ path: this.state.selectedPath, id: this.state.selectedId });
		this.state.selectedPath = path;
		this.state.selectedId = this.controller?.index.byPath.get(path)?.id ?? '';
		this.contentEl.scrollTop = 0;
		this.render();
		this.persist();
	}
	back(): void {
		const previous = this.history.pop();
		this.state.selectedPath = previous?.path ?? '';
		this.state.selectedId = previous?.id ?? '';
		this.render();
		this.contentEl.win.requestAnimationFrame(() => {
			this.contentEl.scrollTop = this.state.selectedPath ? 0 : this.state.scroll;
		});
		this.persist();
	}
	changeKind(kind: RecordKind): void {
		this.state.query = { ...emptyQuery(), kind };
		this.state.page = 0;
		this.render();
		this.persist();
	}
	search(value: string): void {
		this.state.query.search = value;
		this.state.page = 0;
		this.render();
		this.persist();
	}
	sort(): void {
		this.state.query.sort = this.state.query.sort === 'name' ? 'modified' : 'name';
		this.state.page = 0;
		this.render();
		this.persist();
	}
	page(value: number): void {
		this.state.page = value;
		this.render();
		this.contentEl.scrollTop = 0;
		this.persist();
	}
	clearFilters(): void {
		this.state.query = {
			...emptyQuery(),
			kind: this.state.query.kind,
			search: this.state.query.search,
			sort: this.state.query.sort,
		};
		this.state.page = 0;
		this.render();
		this.persist();
	}
	filters(): void {
		if (this.controller)
			new FilterModal(this.controller, this.state.query, (query) => {
				this.state.query = query;
				this.state.page = 0;
				this.render();
				this.persist();
			}).open();
	}
	add(kind: RecordKind): void {
		if (this.controller && this.enabled)
			new RecordEditorModal(this.controller, newRecord(kind), 'basic', undefined, (record) =>
				this.select(record.path),
			).open();
	}
	edit(record: ArchiveRecord, scope: EditScope, id?: string): void {
		if (this.controller && this.enabled) void editRecord(this.controller, record, scope, id, () => this.render());
	}
	deleteRow(record: ArchiveRecord, scope: 'employment' | 'relation', id: string): void {
		if (this.controller) void deleteRow(this.controller, record, scope, id);
	}
	resources(record: ArchiveRecord): ArchiveResource[] {
		try {
			return this.controller?.resources(record.id) ?? [];
		} catch {
			return [];
		}
	}
	newNote(record: ArchiveRecord): void {
		const controller = this.controller;
		if (!controller) return;
		new ArchiveNoteModal(this.app, async (name) => {
			const path = await controller.createNote(record.id, name);
			const file = this.app.vault.getFileByPath(path);
			if (file) {
				const leaf = this.app.workspace.getLeaf('tab');
				await leaf.openFile(file, { active: true });
				await this.app.workspace.revealLeaf(leaf);
			}
		}).open();
	}
	openResource(path: string): void {
		const file = this.app.vault.getFileByPath(path);
		if (file) {
			const leaf = this.app.workspace.getLeaf('tab');
			void leaf
				.openFile(file, { active: true })
				.then(() => this.app.workspace.revealLeaf(leaf))
				.catch((error: unknown) => new Notice(errorText(error)));
		}
	}
	revealFolder(record: ArchiveRecord): void {
		const folder = this.app.vault.getAbstractFileByPath(record.folderPath);
		const leaf = this.app.workspace.getLeavesOfType('file-explorer')[0];
		if (!folder || !leaf) {
			new Notice(ct('folderUnavailable'));
			return;
		}
		const explorer = leaf.view as typeof leaf.view & { revealInFolder?: (file: typeof folder) => void };
		explorer.revealInFolder?.(folder);
		void this.app.workspace.revealLeaf(leaf);
	}
	addResources(record: ArchiveRecord, files?: File[]): void {
		const controller = this.controller;
		if (!controller) return;
		const importFiles = (selected: File[]) => {
			void controller
				.importResources(
					record.id,
					selected.map((file) => ({ name: file.name, read: () => file.arrayBuffer() })),
				)
				.then((results) => {
					new Notice(
						results
							.map((result) => `${result.name}: ${result.error ? ct(result.error) : ct('imported')}`)
							.join('\n'),
						10000,
					);
				})
				.catch((error: unknown) => new Notice(errorText(error)));
		};
		if (files) {
			importFiles(files);
			return;
		}
		this.pendingInput?.remove();
		const input = this.contentEl.createEl('input', { type: 'file' });
		this.pendingInput = input;
		input.hidden = true;
		input.multiple = true;
		input.addEventListener(
			'change',
			() => {
				const selected = Array.from(input.files ?? []);
				input.remove();
				if (selected.length) importFiles(selected);
			},
			{ once: true },
		);
		input.addEventListener('cancel', () => input.remove(), { once: true });
		input.click();
	}
	private async remove(record: ArchiveRecord): Promise<void> {
		if (!this.controller) return;
		try {
			const base = await this.controller.deletion(record.id);
			const index = this.controller.index;
			const count =
				record.kind === 'person'
					? index.relationsFor(record.id).length
					: new Set(
							[...index.members(record.id, 'current'), ...index.members(record.id, 'past')].map(
								(r) => r.id,
							),
						).size;
			if (
				!(await confirm(
					this.app,
					ct('deleteFolderPrompt', {
						name: record.fields.name,
						count,
						folder: base.folderPath,
						resources: base.resources,
					}),
				))
			)
				return;
			await this.controller.remove(base);
			if (this.state.selectedId === record.id) {
				this.state.selectedPath = '';
				this.state.selectedId = '';
				this.persist();
			}
			this.history = this.history.filter((entry) => entry.id !== record.id);
			this.render();
		} catch (error) {
			new Notice(errorText(error));
			if (
				error instanceof ContactsError &&
				error.code === 'deleteChanged' &&
				this.enabled &&
				this.root?.isConnected
			) {
				const current = this.controller?.index.get(record.id);
				if (current) await this.remove(current);
			}
		}
	}
	private recordMenu(menu: Menu, record: ArchiveRecord): void {
		menu.addItem((item) =>
			item
				.setTitle(ct('editBasic'))
				.setIcon('pencil')
				.setDisabled(!!this.controller?.index.issues(record).length)
				.onClick(() => this.edit(record, 'basic')),
		);
		menu.addItem((item) =>
			item
				.setTitle(ct('revealFolder'))
				.setIcon('folder-open')
				.onClick(() => this.revealFolder(record)),
		);
		menu.addItem((item) =>
			item
				.setTitle(t('automation.new'))
				.setIcon('bell-plus')
				.onClick(() => {
					this.plugin.automationHost?.edit(
						{ kind: 'contacts', path: record.path, id: record.id },
						record.fields.name,
					);
				}),
		);
		menu.addItem((item) =>
			item
				.setTitle(ct('source'))
				.setIcon('file-text')
				.onClick(() => {
					void this.app.workspace.openLinkText(record.path, '', true);
				}),
		);
		menu.addItem((item) =>
			item
				.setTitle(ct('delete'))
				.setIcon('trash-2')
				.setDisabled(!!this.controller?.index.issues(record).length)
				.onClick(() => {
					void this.remove(record);
				}),
		);
	}
	more(record: ArchiveRecord): void {
		const menu = new Menu();
		this.recordMenu(menu, record);
		const rect = this.contentEl.getBoundingClientRect();
		menu.showAtPosition({ x: rect.right - 180, y: rect.top + 40 });
	}
	onPaneMenu(menu: Menu, source: string): void {
		if (this.enabled) {
			menu.addItem((i) =>
				i
					.setTitle(ct('addPerson'))
					.setIcon('user-plus')
					.onClick(() => this.add('person')),
			);
			menu.addItem((i) =>
				i
					.setTitle(ct('addCompany'))
					.setIcon('building-2')
					.onClick(() => this.add('company')),
			);
			menu.addItem((i) =>
				i
					.setTitle(ct('filter'))
					.setIcon('list-filter')
					.onClick(() => this.filters()),
			);
			menu.addItem((i) =>
				i
					.setTitle(ct('sort'))
					.setIcon('arrow-down-wide-narrow')
					.onClick(() => this.sort()),
			);
			const record = this.controller?.index.byPath.get(this.state.selectedPath);
			if (record) this.recordMenu(menu, record);
		}
		super.onPaneMenu(menu, source);
	}
}
