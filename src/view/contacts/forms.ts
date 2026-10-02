import { bindLocalizedControl, bindLocalizedElement } from '../primitives/localized-dom';
import { FuzzySuggestModal, Modal, Notice, Setting, type App } from 'obsidian';
import { relationKind, type ContactsQuery } from '../../core/contacts/index-store';
import {
	ContactsError,
	cloneRecord,
	emptyRef,
	newRecord,
	validateRecord,
	type ArchiveRecord,
	type EmploymentRecord,
	type EntityRef,

	type ProseSection,
	type RecordKind,
} from '../../core/contacts/model';
import { type ContactsController } from '../../platform/obsidian/contacts/controller';
import { onLanguageChanged } from '../../shared/i18n';
import { repaintLocalizedForm } from '../primitives/localized-form';
import { ct, relationLabel } from './labels';
export { ct, relationDescription } from './labels';
import { fieldSetting, fieldError, labelInput, multiValueField, type FormField } from './form-fields';

export function errorText(error: unknown): string {
	return error instanceof ContactsError
		? ct(error.code)
		: ct('failed', { detail: error instanceof Error ? error.message : '' });
}
export class ConfirmModal extends Modal {
	private decided = false;
	constructor(
		app: App,
		private message: string,
		private accept: string,
		private done: (ok: boolean) => void,
	) {
		super(app);
	}
	onOpen(): void {
		this.contentEl.createEl('p', { text: this.message });
		new Setting(this.contentEl)
			.addButton((b) => bindLocalizedControl(b.setButtonText(ct('cancel')), "buttonText", "contacts." + ('cancel')).onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText(this.accept)
					.setCta()
					.onClick(() => {
						this.decided = true;
						this.done(true);
						this.close();
					}),
			);
	}
	onClose(): void {
		this.contentEl.empty();
		if (!this.decided) this.done(false);
	}
}
export function confirm(app: App, message: string, accept = ct('delete')): Promise<boolean> {
	return new Promise((resolve) => new ConfirmModal(app, message, accept, resolve).open());
}
class RecordPicker extends FuzzySuggestModal<ArchiveRecord> {
	private chosen = false;
	constructor(
		app: App,
		private values: ArchiveRecord[],
		kind: RecordKind,
		private done: (record?: ArchiveRecord) => void,
	) {
		super(app);
		bindLocalizedControl(this.setPlaceholder(ct(kind === 'person' ? 'searchPeople' : 'searchCompanies')), "placeholder", "contacts." + (kind === 'person' ? 'searchPeople' : 'searchCompanies'));
	}
	getItems(): ArchiveRecord[] {
		return this.values;
	}
	getItemText(r: ArchiveRecord): string {
		const duplicate = this.values.some((other) => other.id !== r.id && other.fields.name === r.fields.name);
		return duplicate ? `${r.fields.name} · ${r.fields.region || r.path}` : r.fields.name;
	}
	onChooseItem(record: ArchiveRecord): void {
		this.chosen = true;
		this.done(record);
	}
	onClose(): void {
		super.onClose();
		void Promise.resolve().then(() => {
			if (!this.chosen) this.done();
		});
	}
}
export function chooseRecord(
	controller: ContactsController,
	kind: RecordKind,
	exclude = '',
): Promise<ArchiveRecord | undefined> {
	return new Promise((resolve) =>
		new RecordPicker(
			controller.app,
			controller.choices(kind).filter((r) => r.id !== exclude),
			kind,
			resolve,
		).open(),
	);
}
export type EditScope = 'basic' | ProseSection | 'employment' | 'relation';
export class RecordEditorModal extends Modal {
	private languageCleanup?: () => void;
	private base: ArchiveRecord;
	private originalRoot: string;
	private draft: ArchiveRecord;
	private initial = '';
	private saving = false;
	private allowClose = false;
	private confirming = false;
	private errorEl!: HTMLElement;
	private unsubscribe?: () => void;
	private statusEl!: HTMLElement;
	private readonly addingRow: boolean;
	private bodyEl!: HTMLElement;
	private fieldsEl!: HTMLElement;
	private conflictEl!: HTMLElement;
	private fields = new Map<string, FormField>();
	constructor(
		private controller: ContactsController,
		base: ArchiveRecord,
		private editScope: EditScope,
		private rowId: string | undefined,
		private done: (record: ArchiveRecord) => void,
	) {
		super(controller.app);
		this.originalRoot = controller.root;
		this.base = cloneRecord(base);
		this.draft = cloneRecord(base);
		this.addingRow = !rowId;
		this.initializeRow();
	}
	private initializeRow(): void {
		if (this.editScope === 'employment' && !this.rowId) {
			this.rowId = crypto.randomUUID();
			this.draft.employments.push({
				id: this.rowId,
				company: emptyRef(),
				department: '',
				title: '',
				start: '',
				end: '',
				status: 'current',
				keyRole: '',
				notes: '',
			});
		}
		if (this.editScope === 'relation' && !this.rowId) {
			this.rowId = crypto.randomUUID();
			this.draft.relations.push({
				id: this.rowId,
				person: emptyRef(),
				kind: 'colleague',
				company: emptyRef(),
				notes: '',
			});
		}
		this.initial = JSON.stringify(this.draft);
	}
	onOpen(): void {
		this.modalEl.addClass('nand-contacts-form');
		const title =
			this.editScope === 'relation'
				? this.addingRow
					? 'addRelation'
					: 'editRelation'
				: this.editScope === 'employment'
					? this.addingRow
						? 'addEmployment'
						: 'editEmployment'
					: this.base.kind === 'person'
						? this.base.path
							? 'editPerson'
							: 'addPerson'
						: this.base.path
							? 'editCompany'
							: 'addCompany';
		bindLocalizedControl(this.setTitle(ct(title)), "title", "contacts." + (title));
		this.renderForm();
		this.languageCleanup = onLanguageChanged(() => {
			bindLocalizedControl(this.setTitle(ct(title)), "title", "contacts." + (title));
			repaintLocalizedForm(this.contentEl, () => this.renderForm());
		});
		this.unsubscribe = this.controller.subscribe(() => {
			if (!this.base.path) return;
			const record = this.controller.index.get(this.base.id);
			const external = record?.raw !== this.base.raw;
			this.statusEl.setText(external ? ct('external') : '');
			this.conflictEl.hidden = !external;
		});
	}
	private text(key: string, value: string, update: (value: string) => void, multiline = false, hint = ''): void {
		const setting = fieldSetting(this.fieldsEl, key);
		if (hint) setting.setDesc(hint);
		if (multiline)
			setting.addTextArea((input) => {
				input.inputEl.rows = 3;
				const resize = () => {
					input.inputEl.style.removeProperty('height');
					input.inputEl.style.height = Math.min(240, Math.max(72, input.inputEl.scrollHeight)) + 'px';
				};
				input.setValue(value).onChange((next) => {
					update(next);
					resize();
				});
				labelInput(setting, input.inputEl);
				this.fields.set(key, fieldError(setting, input.inputEl));
				resize();
			});
		else
			setting.addText((input) => {
				if (key === 'birthday') input.inputEl.type = 'date';
				input.setValue(value).onChange((next) => {
					update(next);
					this.clearFieldError(key);
				});
				labelInput(setting, input.inputEl);
				this.fields.set(key, fieldError(setting, input.inputEl));
				if (key === 'personName' || key === 'companyName') input.inputEl.required = true;
			});
	}
	private reference(
		key: string,
		value: EntityRef,
		kind: RecordKind,
		update: (ref: EntityRef) => void,
		optional = false,
	): void {
		const setting = bindLocalizedControl(new Setting(this.fieldsEl).setName(ct(key)), "name", "contacts." + (key));
		const render = () => setting.setDesc(value.label || ct('none'));
		render();
		const selected = (r?: ArchiveRecord) => {
			if (r) {
				value = this.controller.ref(r);
				update(value);
				render();
			}
		};
		setting.addButton((b) => {
			this.fields.set(key, fieldError(setting, b.buttonEl));
			bindLocalizedControl(b.setButtonText(ct('choose')), "buttonText", "contacts." + ('choose')).onClick(() => {
				void chooseRecord(this.controller, kind, this.draft.id).then(selected);
			});
		});
		if (kind === 'company')
			setting.addButton((b) =>
				bindLocalizedControl(b.setButtonText(ct('addCompany')), "buttonText", "contacts." + ('addCompany')).onClick(() => {
					new RecordEditorModal(this.controller, newRecord('company'), 'basic', undefined, selected).open();
				}),
			);
		if (optional)
			setting.addButton((b) =>
				bindLocalizedControl(b.setButtonText(ct('clearReference')), "buttonText", "contacts." + ('clearReference')).onClick(() => {
					value = emptyRef();
					update(value);
					render();
				}),
			);
	}
	private renderForm(): void {
		this.contentEl.empty();
		this.fields.clear();
		this.bodyEl = this.contentEl.createDiv({ cls: 'nand-contacts-form-body' });
		this.fieldsEl = this.bodyEl;
		this.errorEl = this.bodyEl.createDiv({ cls: 'nand-contacts-error', attr: { role: 'alert' } });
		this.statusEl = this.bodyEl.createDiv({ cls: 'nand-contacts-muted', attr: { 'aria-live': 'polite' } });
		if (this.editScope === 'basic') {
			const groups =
				this.draft.kind === 'person'
					? [
							{
								title: 'identityInfo',
								fields: ['name', 'aliases', 'birthday', 'birthplace', 'region'] as const,
							},
							{ title: 'contactInfo', fields: ['mobiles', 'phones', 'wechat', 'emails'] as const },
							{ title: 'otherInfo', fields: ['tags'] as const },
						]
					: [
							{ title: 'companyInfo', fields: ['name', 'aliases', 'region', 'website', 'tags'] as const },
							{ title: 'contactInfo', fields: ['phones', 'emails'] as const },
						];
			for (const group of groups) {
				this.fieldsEl = this.bodyEl.createDiv({ cls: 'nand-contacts-form-group' });
				bindLocalizedControl(new Setting(this.fieldsEl).setName(ct(group.title)), "name", "contacts." + (group.title)).setHeading();
				for (const key of group.fields) {
					const value = this.draft.fields[key];
					if (Array.isArray(value))
						this.fields.set(
							key,
							multiValueField(
								this.fieldsEl,
								key,
								value,
								(next) => {
									Object.assign(this.draft.fields, { [key]: next });
								},
								key === 'aliases' || key === 'tags',
							),
						);
					else
						this.text(
							key === 'name'
								? this.draft.kind === 'person'
									? 'personName'
									: 'companyName'
								: key === 'region' && this.draft.kind === 'company'
									? 'companyRegion'
									: key,
							value,
							(next) => {
								Object.assign(this.draft.fields, { [key]: next });
							},
						);
				}
			}
		} else if (this.editScope === 'employment') {
			const row = this.draft.employments.find((r) => r.id === this.rowId)!;
			this.reference('companySelect', row.company, 'company', (r) => {
				row.company = r;
			});
			for (const [key, label] of [
				['department', 'department'],
				['title', 'jobTitle'],
				['start', 'start'],
				['end', 'end'],
				['notes', 'notes'],
			] as const)
				this.text(
					label,
					row[key],
					(v) => {
						row[key] = v;
					},
					key === 'notes',
					key === 'start' || key === 'end' ? ct('jobDateHint') : '',
				);
			bindLocalizedControl(new Setting(this.fieldsEl).setName(ct('status')), "name", "contacts." + ('status')).addDropdown((d) =>
				d
					.addOption('current', ct('current'))
					.addOption('past', ct('past'))
					.setValue(row.status)
					.onChange((v) => {
						row.status = v as EmploymentRecord['status'];
					}),
			);
			bindLocalizedControl(new Setting(this.fieldsEl).setName(ct('keyRole')), "name", "contacts." + ('keyRole')).addDropdown((d) =>
				d
					.addOption('', ct('none'))
					.addOption('leader', ct('leader'))
					.addOption('contact', ct('contact'))
					.setValue(row.keyRole)
					.onChange((v) => {
						row.keyRole = v as EmploymentRecord['keyRole'];
					}),
			);
		} else if (this.editScope === 'relation') {
			const row = this.draft.relations.find((r) => r.id === this.rowId)!;
			this.reference('personSelect', row.person, 'person', (r) => {
				row.person = r;
			});
			const builtins = ['leader', 'report', 'colleague', 'friend'];
			const custom = bindLocalizedControl(new Setting(this.fieldsEl).setName(ct('customKind')), "name", "contacts." + ('customKind')).addText((input) =>
				input.setValue(builtins.includes(row.kind) ? '' : row.kind).onChange((v) => {
					row.kind = v;
				}),
			);
			custom.settingEl.hidden = builtins.includes(row.kind);
			bindLocalizedControl(new Setting(this.fieldsEl).setName(ct('kind')), "name", "contacts." + ('kind')).addDropdown((d) => {
				for (const key of builtins) d.addOption(key, ct('relation.' + key));
				d.addOption('custom', ct('custom'))
					.setValue(builtins.includes(row.kind) ? row.kind : 'custom')
					.onChange((v) => {
						row.kind = v === 'custom' ? '' : v;
						custom.settingEl.hidden = v !== 'custom';
					});
			});
			this.reference(
				'relatedCompany',
				row.company,
				'company',
				(r) => {
					row.company = r;
				},
				true,
			);
			this.text(
				'notes',
				row.notes,
				(v) => {
					row.notes = v;
				},
				true,
			);
		} else
			this.text(
				this.editScope === 'notes' && this.draft.kind === 'company' ? 'companyNotes' : this.editScope,
				this.draft.prose[this.editScope],
				(v) => {
					if (this.editScope !== 'basic' && this.editScope !== 'employment' && this.editScope !== 'relation')
						this.draft.prose[this.editScope] = v;
				},
				true,
			);
		this.conflictEl = this.bodyEl.createDiv({ cls: 'nand-contacts-conflict-actions' });
		this.conflictEl.hidden = true;
		const recovery = new Setting(this.conflictEl).addButton((b) =>
			bindLocalizedControl(b.setButtonText(ct('copyDraft')), "buttonText", "contacts." + ('copyDraft')).onClick(() => {
				void this.copyDraft();
			}),
		);
		if (this.base.path)
			recovery.addButton((b) =>
				bindLocalizedControl(b.setButtonText(ct('reloadDraft')), "buttonText", "contacts." + ('reloadDraft')).onClick(() => {
					void this.reload();
				}),
			);
		const footer = this.contentEl.createDiv({ cls: 'nand-contacts-form-footer' });
		new Setting(footer)
			.addButton((b) => bindLocalizedControl(b.setButtonText(ct('cancel')), "buttonText", "contacts." + ('cancel')).onClick(() => this.close()))
			.addButton((b) =>
				bindLocalizedControl(b
					.setButtonText(ct('save')), "buttonText", "contacts." + ('save'))
					.setCta()
					.onClick(() => {
						b.setDisabled(true);
						void this.save().finally(() => {
							b.setDisabled(false);
						});
					}),
			);
		(this.fields.get('personName') ?? this.fields.get('companyName'))?.input.focus();
	}

	private showError(error: unknown): void {
		this.errorEl.setText(errorText(error));
		this.conflictEl.hidden =
			error instanceof ContactsError &&
			!['conflict', 'editorConflict', 'folderChanged', 'missing', 'invalidRecord'].includes(error.code);
		let key =
			error instanceof ContactsError
				? error.detail ||
					(error.code === 'nameRequired'
						? this.draft.kind === 'person'
							? 'personName'
							: 'companyName'
						: error.code === 'currentEnd'
							? 'end'
							: error.code === 'invalidDate'
								? 'start'
								: error.code === 'companyRequired'
									? 'companySelect'
									: error.code === 'relationRequired'
										? 'personSelect'
										: '')
				: '';
		if (key === 'name') key = this.draft.kind === 'person' ? 'personName' : 'companyName';
		if (key === 'region' && this.draft.kind === 'company') key = 'companyRegion';
		const field = this.fields.get(key);
		if (field) {
			field.error.setText(errorText(error));
			field.input.setAttribute('aria-invalid', 'true');
			field.input.focus();
		}
	}
	private clearFieldError(key: string): void {
		const field = this.fields.get(key);
		if (!field) return;
		if (this.errorEl.textContent === field.error.textContent) this.errorEl.setText('');
		field.error.setText('');
		field.input.removeAttribute('aria-invalid');
	}
	private async reload(): Promise<void> {
		if (this.saving || !(await confirm(this.app, ct('discard'), ct('reloadDraft')))) return;
		try {
			this.base = await this.controller.snapshot(this.controller.index.get(this.base.id)?.path ?? this.base.path);
			this.draft = cloneRecord(this.base);
			if (
				(this.editScope === 'employment' && !this.draft.employments.some((r) => r.id === this.rowId)) ||
				(this.editScope === 'relation' && !this.draft.relations.some((r) => r.id === this.rowId))
			)
				this.rowId = undefined;
			this.initializeRow();
			this.renderForm();
		} catch (error) {
			this.showError(error);
		}
	}
	private async copyDraft(): Promise<void> {
		try {
			await this.contentEl.win.navigator.clipboard.writeText(JSON.stringify(this.draft, null, 2));
			new Notice(ct('copied'));
		} catch (error) {
			this.showError(error);
		}
	}
	private async save(): Promise<void> {
		if (this.saving) return;
		this.saving = true;
		try {
			this.errorEl.setText('');
			for (const field of this.fields.values()) {
				field.error.setText('');
				field.input.removeAttribute('aria-invalid');
			}
			const birthday = this.fields.get('birthday')?.input as HTMLInputElement | undefined;
			if (birthday?.validity.badInput) throw new ContactsError('invalidDate', 'birthday');
			validateRecord(this.draft);
			if (this.controller.root !== this.originalRoot) throw new ContactsError('folderChanged');
			const record = this.base.path
				? await this.controller.save(this.base, this.draft)
				: await this.controller.create(this.draft);
			new Notice(ct('saved'));
			this.allowClose = true;
			this.done(record);
			this.close();
		} catch (error) {
			this.showError(error);
		} finally {
			this.saving = false;
		}
	}
	close(): void {
		if (this.allowClose) {
			super.close();
			return;
		}
		if (this.saving || this.confirming) return;
		if (JSON.stringify(this.draft) === this.initial) {
			super.close();
			return;
		}
		this.confirming = true;
		void confirm(this.app, ct('discard'), ct('discardAction')).then((yes) => {
			this.confirming = false;
			if (yes) {
				this.allowClose = true;
				super.close();
			}
		});
	}
	onClose(): void {
		this.unsubscribe?.();
		this.languageCleanup?.();
		this.contentEl.empty();
	}
}
export class FilterModal extends Modal {
	private languageCleanup?: () => void;
	private draft: ContactsQuery;
	constructor(
		private controller: ContactsController,
		query: ContactsQuery,
		private done: (query: ContactsQuery) => void,
	) {
		super(controller.app);
		this.draft = structuredClone(query);
	}
	onOpen(): void {
		this.draw();
		this.languageCleanup = onLanguageChanged(() => repaintLocalizedForm(this.contentEl, () => this.draw()));
	}
	private draw(): void {
		this.contentEl.empty();
		this.modalEl.addClass('nand-contacts-filter');
		bindLocalizedControl(this.setTitle(ct('filter')), "title", "contacts." + ('filter'));
		const records = [...this.controller.index.byPath.values()].filter((r) => r.kind === this.draft.kind);
		const groups: Array<{
			key: 'current' | 'past' | 'regions' | 'tags' | 'relations';
			title: string;
			values: Array<[string, string]>;
		}> = [
			{
				key: 'regions',
				title: this.draft.kind === 'person' ? 'region' : 'companyRegion',
				values: [...new Set(records.map((r) => r.fields.region).filter(Boolean))].sort().map((v) => [v, v]),
			},
			{
				key: 'tags',
				title: 'tags',
				values: [...new Set(records.flatMap((r) => r.fields.tags))].sort().map((v) => [v, v]),
			},
		];
		if (this.draft.kind === 'person') {
			const companies = this.controller.choices('company');
			const options = (status: 'current' | 'past'): Array<[string, string]> =>
				companies
					.filter((company) => this.controller.index.members(company.id, status).length > 0)
					.map((r) => [
						r.id,
						companies.some((other) => other.id !== r.id && other.fields.name === r.fields.name)
							? `${r.fields.name} · ${r.fields.region || r.path}`
							: r.fields.name,
					]);
			groups.unshift(
				{ key: 'current', title: 'currentCompany', values: options('current') },
				{ key: 'past', title: 'pastCompany', values: options('past') },
			);
			groups.push({
				key: 'relations',
				title: 'relations',
				values: [
					...new Set(
						records.flatMap((r) =>
							this.controller.index
								.relationsFor(r.id)
								.map((e) => relationKind(e.relation.kind, e.inverse)),
						),
					),
				]
					.sort()
					.map((v) => [v, relationLabel(v)]),
			});
		}
		if (groups.every((group) => group.values.length === 0)) {
			bindLocalizedElement(this.contentEl.createEl('p', { cls: 'nand-contacts-muted', text: ct('filterEmpty') }), "contacts." + ('filterEmpty'));
		}
		for (const group of groups) {
			const section = bindLocalizedElement(this.contentEl.createEl('section', {
				cls: 'nand-contacts-filter-group',
				attr: { 'aria-label': ct(group.title) },
			}), "contacts." + (group.title), undefined, "aria-label");
			bindLocalizedControl(new Setting(section).setName(ct(group.title)), "name", "contacts." + (group.title)).setHeading();
			if (group.values.length === 0) {
				bindLocalizedElement(section.createEl('p', {
					cls: 'nand-contacts-muted nand-contacts-placeholder',
					text: ct('noFilterOptions'),
				}), "contacts." + ('noFilterOptions'));
			}
			for (const [value, name] of group.values)
				new Setting(section).setName(name).addToggle((toggle) =>
					toggle.setValue(this.draft[group.key].includes(value)).onChange((enabled) => {
						this.draft[group.key] = enabled
							? [...this.draft[group.key], value]
							: this.draft[group.key].filter((v) => v !== value);
					}),
				);
		}
		new Setting(this.contentEl)
			.addButton((b) => bindLocalizedControl(b.setButtonText(ct('cancel')), "buttonText", "contacts." + ('cancel')).onClick(() => this.close()))
			.addButton((b) =>
				bindLocalizedControl(b
					.setButtonText(ct('apply')), "buttonText", "contacts." + ('apply'))
					.setCta()
					.onClick(() => {
						this.done(this.draft);
						this.close();
					}),
			);
	}
	onClose(): void {
		this.languageCleanup?.();
		this.contentEl.empty();
	}
}

export async function editRecord(
	controller: ContactsController,
	record: ArchiveRecord,
	scope: EditScope,
	rowId: string | undefined,
	done: (record: ArchiveRecord) => void,
): Promise<void> {
	try {
		const base = await controller.snapshot(record.path);
		if (
			rowId &&
			((scope === 'employment' && !base.employments.some((r) => r.id === rowId)) ||
				(scope === 'relation' && !base.relations.some((r) => r.id === rowId)))
		)
			throw new ContactsError('conflict');
		new RecordEditorModal(controller, base, scope, rowId, done).open();
	} catch (error) {
		new Notice(errorText(error));
	}
}
export async function deleteRow(
	controller: ContactsController,
	record: ArchiveRecord,
	scope: 'employment' | 'relation',
	id: string,
): Promise<void> {
	try {
		const base = await controller.snapshot(record.path);
		if (!(await confirm(controller.app, ct('deleteEntry'), ct('delete')))) return;
		const next = cloneRecord(base);
		if (scope === 'employment') next.employments = next.employments.filter((r) => r.id !== id);
		else next.relations = next.relations.filter((r) => r.id !== id);
		await controller.save(base, next);
	} catch (error) {
		new Notice(errorText(error));
	}
}
