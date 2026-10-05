import { CONTACTS_VIEW_TYPE } from './contacts-presentation';
import { t } from '../../shared/i18n';
import { ItemView, type WorkspaceLeaf, type ViewStateResult } from 'obsidian';
import { ContactsPresentation } from './contacts-presentation';
import type { ContactsHost } from './host';
export { CONTACTS_VIEW_TYPE } from './contacts-presentation';

/** Original native identity; business presentation is shared with the workbench. */
export class ContactsView extends ItemView {
	readonly surface: ContactsPresentation;
	constructor(leaf: WorkspaceLeaf, host: ContactsHost) {
		super(leaf);
		this.surface = this.addChild(new ContactsPresentation({
			app: this.app, leaf, contentEl: this.contentEl, containerEl: this.contentEl,
			addAction: (icon, title, callback) => this.addAction(icon, title, callback),
			close: () => this.leaf.detach(),
		}, host));
	}
	getNativeSurfaces(): readonly ContactsPresentation[] { return this.surface ? [this.surface] : []; }
	onOpen(): Promise<void> { return this.surface.onOpen(); }
	onClose(): Promise<void> { return this.surface.onClose(); }
	getState(): Record<string, unknown> { return this.surface?.getState() ?? {}; }
	async setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {
		await this.surface.setState(state, result);
		await super.setState(state, result);
	}
	get state(): ContactsPresentation['state'] { return this.surface.state; }
	set state(value: ContactsPresentation['state']) { this.surface.state = value; }
	get controller(): ContactsPresentation['controller'] { return this.surface.controller; }
	set controller(value: ContactsPresentation['controller']) { this.surface.controller = value; }
	get enabled(): ContactsPresentation['enabled'] { return this.surface.enabled; }
	get columns(): ContactsPresentation['columns'] { return this.surface.columns; }
	mountMarkdown(...args: Parameters<ContactsPresentation['mountMarkdown']>): ReturnType<ContactsPresentation['mountMarkdown']> { return this.surface.mountMarkdown(...args); }

	getViewType(): string { return CONTACTS_VIEW_TYPE; }

	getDisplayText(): string { return this.surface?.getDisplayText() ?? t('contacts.title'); }

	getIcon(): string { return 'contact-round'; }
	bindController(...args: Parameters<ContactsPresentation['bindController']>): ReturnType<ContactsPresentation['bindController']> { return this.surface.bindController(...args); }
	render(...args: Parameters<ContactsPresentation['render']>): ReturnType<ContactsPresentation['render']> { return this.surface.render(...args); }
	disposeSurface(...args: Parameters<ContactsPresentation['disposeSurface']>): ReturnType<ContactsPresentation['disposeSurface']> { return this.surface.disposeSurface(...args); }
	select(...args: Parameters<ContactsPresentation['select']>): ReturnType<ContactsPresentation['select']> { return this.surface.select(...args); }
	back(...args: Parameters<ContactsPresentation['back']>): ReturnType<ContactsPresentation['back']> { return this.surface.back(...args); }
	changeKind(...args: Parameters<ContactsPresentation['changeKind']>): ReturnType<ContactsPresentation['changeKind']> { return this.surface.changeKind(...args); }
	search(...args: Parameters<ContactsPresentation['search']>): ReturnType<ContactsPresentation['search']> { return this.surface.search(...args); }
	sort(...args: Parameters<ContactsPresentation['sort']>): ReturnType<ContactsPresentation['sort']> { return this.surface.sort(...args); }
	page(...args: Parameters<ContactsPresentation['page']>): ReturnType<ContactsPresentation['page']> { return this.surface.page(...args); }
	clearFilters(...args: Parameters<ContactsPresentation['clearFilters']>): ReturnType<ContactsPresentation['clearFilters']> { return this.surface.clearFilters(...args); }
	filters(...args: Parameters<ContactsPresentation['filters']>): ReturnType<ContactsPresentation['filters']> { return this.surface.filters(...args); }
	add(...args: Parameters<ContactsPresentation['add']>): ReturnType<ContactsPresentation['add']> { return this.surface.add(...args); }
	edit(...args: Parameters<ContactsPresentation['edit']>): ReturnType<ContactsPresentation['edit']> { return this.surface.edit(...args); }
	deleteRow(...args: Parameters<ContactsPresentation['deleteRow']>): ReturnType<ContactsPresentation['deleteRow']> { return this.surface.deleteRow(...args); }
	resources(...args: Parameters<ContactsPresentation['resources']>): ReturnType<ContactsPresentation['resources']> { return this.surface.resources(...args); }
	newNote(...args: Parameters<ContactsPresentation['newNote']>): ReturnType<ContactsPresentation['newNote']> { return this.surface.newNote(...args); }
	openResource(...args: Parameters<ContactsPresentation['openResource']>): ReturnType<ContactsPresentation['openResource']> { return this.surface.openResource(...args); }
	revealFolder(...args: Parameters<ContactsPresentation['revealFolder']>): ReturnType<ContactsPresentation['revealFolder']> { return this.surface.revealFolder(...args); }
	addResources(...args: Parameters<ContactsPresentation['addResources']>): ReturnType<ContactsPresentation['addResources']> { return this.surface.addResources(...args); }
	more(...args: Parameters<ContactsPresentation['more']>): ReturnType<ContactsPresentation['more']> { return this.surface.more(...args); }
	onPaneMenu(...args: Parameters<ContactsPresentation['onPaneMenu']>): ReturnType<ContactsPresentation['onPaneMenu']> { return this.surface.onPaneMenu(...args); }
}
