import { NativeSurface, type NativeSurfaceContext } from '../hosts/obsidian/native-surface';
import {
	Component,
	MarkdownRenderer,
	Menu,
	Notice,
	Platform,
	type ViewStateResult,
	} from 'obsidian';
import { render } from 'preact/compat';
import { emptyQuery } from '../../core/contacts/index-store';
import type { ContactsLayoutMode } from './panel-contract';
import { applyLayout, contactsTarget, emptyPanelState, restoreContactsState, showContactKind } from './panel-state';
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
export class ContactsPresentation extends NativeSurface {
	state: ContactsPanelState = emptyPanelState();
	controller?: ContactsController;
	private unsubscribe?: () => void;
	private history: Array<{ path: string; id: string }> = [];
	private root?: HTMLElement;
	private pendingInput?: HTMLInputElement;
	constructor(
		context: NativeSurfaceContext,
		private plugin: ContactsHost,
	) {
		super(context);
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
			if (this.state.selectedPath) return;
			this.state.scroll = this.contentEl.scrollTop;
			const path = this.firstVisible();
			if (!path) return;
			const kind = this.state.query.kind;
			this.state.anchors[kind][this.state.layout[kind]] = path;
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
	getTarget() {
		return contactsTarget(this.state);
	}
	async setState(raw: Record<string, unknown>, result: ViewStateResult): Promise<void> {
		this.state = restoreContactsState(raw);
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
		if (!this.state.selectedPath) this.restoreScroll();
	}
	private firstVisible(): string {
		const top = this.contentEl.getBoundingClientRect().top;
		const nodes = this.contentEl.querySelectorAll<HTMLElement>('[data-path]');
		for (let index = 0; index < nodes.length; index++) {
			const node = nodes[index]!;
			if (node.getBoundingClientRect().bottom > top + 1) return node.dataset.path ?? '';
		}
		return '';
	}
	private scrollToPath(path: string): void {
		if (!path) return;
		const node = this.contentEl.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`);
		node?.scrollIntoView({ block: 'start' });
	}
	private restoreScroll(): void {
		const kind = this.state.query.kind;
		const anchor = this.state.anchors[kind][this.state.layout[kind]];
		this.contentEl.win.requestAnimationFrame(() => {
			if (anchor) this.scrollToPath(anchor);
			else this.contentEl.scrollTop = this.state.scroll;
		});
	}
	private persist(): void {
		this.app.workspace.requestSaveLayout();
	}
	select(path: string, focus = ''): void {
		if (this.state.selectedPath) this.history.push({ path: this.state.selectedPath, id: this.state.selectedId });
		this.state.selectedPath = path;
		this.state.selectedId = this.controller?.index.byPath.get(path)?.id ?? '';
		this.state.focus = focus;
		this.contentEl.scrollTop = 0;
		this.render();
		this.persist();
		this.context.changed?.();
	}
	back(): void {
		const previous = this.history.pop();
		this.state.selectedPath = previous?.path ?? '';
		this.state.selectedId = previous?.id ?? '';
		this.state.focus = '';
		this.render();
		if (this.state.selectedPath) this.contentEl.scrollTop = 0;
		else this.restoreScroll();
		this.persist();
		this.context.changed?.();
	}
	layout(mode: ContactsLayoutMode): void {
		const next = applyLayout(this.state, mode, this.firstVisible());
		if (next === this.state) return;
		this.state = next;
		this.render();
		this.scrollToPath(this.state.anchors[this.state.query.kind][mode]);
		this.persist();
	}
	setScope(value: 'record' | 'fields'): void {
		if (this.state.query.scope === value) return;
		this.state.query = { ...this.state.query, scope: value };
		this.state.page = 0;
		this.render();
		this.persist();
	}
	changeKind(kind: RecordKind): void {
		this.history = [];
		this.state = showContactKind(this.state, kind);
		this.render();
		this.persist();
		this.context.changed?.();
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
			scope: this.state.query.scope,
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
