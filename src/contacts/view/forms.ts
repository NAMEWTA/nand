import { FuzzySuggestModal, Modal, Notice, Setting, type App } from 'obsidian';
import { t } from '../../shared/i18n';
import {
	ContactsError,
	cloneRecord,
	emptyRef,
	listFields,
	newRecord,
	type ArchiveRecord,
	type EmploymentRecord,
	type EntityRef,
	type FieldKey,
	type PersonRelation,
	type ProseSection,
	type RecordKind,
} from '../model';
import { type ContactsController } from '../controller';
import { type ContactsQuery, relationKind } from '../index-store';

export const ct = (key: string, params?: Record<string, string | number>): string => t('contacts.' + key, params);
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
			.addButton((b) => b.setButtonText(ct('cancel')).onClick(() => this.close()))
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
		private done: (record?: ArchiveRecord) => void,
	) {
		super(app);
		this.setPlaceholder(ct('search'));
	}
	getItems(): ArchiveRecord[] {
		return this.values;
	}
	getItemText(r: ArchiveRecord): string {
		return `${r.fields.name} · ${r.fields.region || r.path}`;
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
			resolve,
		).open(),
	);
}
export type EditScope = 'basic' | ProseSection | 'employment' | 'relation';
export class RecordEditorModal extends Modal {
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
		this.setTitle(ct(this.base.path ? 'edit' : this.base.kind === 'person' ? 'addPerson' : 'addCompany'));
		this.renderForm();
		this.unsubscribe = this.controller.subscribe(() => {
			if (!this.base.path) return;
			const record = this.controller.index.get(this.base.id);
			this.statusEl.setText(record?.raw !== this.base.raw ? ct('external') : '');
		});
	}
	private text(key: string, value: string, update: (value: string) => void, multiline = false, hint = ''): void {
		const setting = new Setting(this.contentEl).setName(ct(key));
		if (hint) setting.setDesc(hint);
		if (multiline)
			setting.addTextArea((input) => {
				input.setValue(value).onChange(update);
				input.inputEl.rows = 5;
			});
		else
			setting.addText((input) => {
				input.setValue(value).onChange(update);
			});
	}
	private reference(
		key: string,
		value: EntityRef,
		kind: RecordKind,
		update: (ref: EntityRef) => void,
		optional = false,
	): void {
		const setting = new Setting(this.contentEl).setName(ct(key));
		const render = () => setting.setDesc(value.label || ct('none'));
		render();
		const selected = (r?: ArchiveRecord) => {
			if (r) {
				value = this.controller.ref(r);
				update(value);
				render();
			}
		};
		setting.addButton((b) =>
			b.setButtonText(ct('choose')).onClick(() => {
				void chooseRecord(this.controller, kind, this.draft.id).then(selected);
			}),
		);
		if (kind === 'company')
			setting.addButton((b) =>
				b.setButtonText(ct('addCompany')).onClick(() => {
					new RecordEditorModal(this.controller, newRecord('company'), 'basic', undefined, selected).open();
				}),
			);
		if (optional)
			setting.addButton((b) =>
				b.setButtonText(ct('clear')).onClick(() => {
					value = emptyRef();
					update(value);
					render();
				}),
			);
	}
	private renderForm(): void {
		this.contentEl.empty();
		this.errorEl = this.contentEl.createDiv({ cls: 'nand-contacts-error', attr: { role: 'alert' } });
		this.statusEl = this.contentEl.createDiv({ cls: 'nand-contacts-muted', attr: { 'aria-live': 'polite' } });
		if (this.editScope === 'basic') {
			const fields: FieldKey[] =
				this.draft.kind === 'person'
					? [
							'name',
							'aliases',
							'birthday',
							'birthplace',
							'region',
							'mobiles',
							'phones',
							'wechat',
							'emails',
							'tags',
						]
					: ['name', 'aliases', 'region', 'website', 'tags'];
			for (const key of fields) {
				const isList = (listFields as readonly string[]).includes(key),
					value = this.draft.fields[key];
				this.text(
					key === 'region' && this.draft.kind === 'company' ? 'companyRegion' : key,
					Array.isArray(value) ? value.join('\n') : value,
					(input) => {
						Object.assign(this.draft.fields, {
							[key]: isList
								? [
										...new Set(
											input
												.split('\n')
												.map((v) => v.trim())
												.filter(Boolean),
										),
									]
								: input,
						});
					},
					isList,
					isList ? ct('listHint') : key === 'birthday' ? ct('dateHint') : '',
				);
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
			new Setting(this.contentEl).setName(ct('status')).addDropdown((d) =>
				d
					.addOption('current', ct('current'))
					.addOption('past', ct('past'))
					.setValue(row.status)
					.onChange((v) => {
						row.status = v as EmploymentRecord['status'];
					}),
			);
			new Setting(this.contentEl).setName(ct('keyRole')).addDropdown((d) =>
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
			const custom = new Setting(this.contentEl).setName(ct('customKind')).addText((input) =>
				input.setValue(builtins.includes(row.kind) ? '' : row.kind).onChange((v) => {
					row.kind = v;
				}),
			);
			custom.settingEl.hidden = builtins.includes(row.kind);
			new Setting(this.contentEl).setName(ct('kind')).addDropdown((d) => {
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
		new Setting(this.contentEl)
			.addButton((b) =>
				b.setButtonText(ct('copyDraft')).onClick(() => {
					void this.copyDraft();
				}),
			)
			.addButton((b) => b.setButtonText(ct('cancel')).onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText(ct('save'))
					.setCta()
					.onClick(() => {
						b.setDisabled(true);
						void this.save().finally(() => b.setDisabled(false));
					}),
			);
		if (this.base.path)
			new Setting(this.contentEl).addButton((b) =>
				b.setButtonText(ct('reloadDraft')).onClick(() => {
					void this.reload();
				}),
			);
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
			this.errorEl.setText(errorText(error));
		}
	}
	private async copyDraft(): Promise<void> {
		try {
			await this.contentEl.win.navigator.clipboard.writeText(JSON.stringify(this.draft, null, 2));
			new Notice(ct('copied'));
		} catch (error) {
			this.errorEl.setText(errorText(error));
		}
	}
	private async save(): Promise<void> {
		if (this.saving) return;
		this.saving = true;
		try {
			if (this.controller.root !== this.originalRoot) throw new ContactsError('folderChanged');
			const record = this.base.path
				? await this.controller.save(this.base, this.draft)
				: await this.controller.create(this.draft);
			new Notice(ct('saved'));
			this.allowClose = true;
			this.done(record);
			this.close();
		} catch (error) {
			this.errorEl.setText(errorText(error));
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
		this.contentEl.empty();
	}
}
export class FilterModal extends Modal {
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
		this.setTitle(ct('filter'));
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
			const companies = this.controller
				.choices('company')
				.map((r): [string, string] => [r.id, r.fields.name + ' · ' + r.path]);
			groups.unshift(
				{ key: 'current', title: 'currentCompany', values: companies },
				{ key: 'past', title: 'pastCompany', values: companies },
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
		for (const group of groups) {
			new Setting(this.contentEl).setName(ct(group.title)).setHeading();
			for (const [value, name] of group.values)
				new Setting(this.contentEl).setName(name).addToggle((toggle) =>
					toggle.setValue(this.draft[group.key].includes(value)).onChange((enabled) => {
						this.draft[group.key] = enabled
							? [...this.draft[group.key], value]
							: this.draft[group.key].filter((v) => v !== value);
					}),
				);
		}
		new Setting(this.contentEl)
			.addButton((b) => b.setButtonText(ct('cancel')).onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText(ct('apply'))
					.setCta()
					.onClick(() => {
						this.done(this.draft);
						this.close();
					}),
			);
	}
	onClose(): void {
		this.contentEl.empty();
	}
}
export function relationLabel(kind: string): string {
	return ['leader', 'report', 'colleague', 'friend'].includes(kind) ? ct('relation.' + kind) : kind;
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
export function relationDescription(relation: PersonRelation, inverse: boolean, owner: ArchiveRecord): string {
	if (!inverse || ['leader', 'report', 'colleague', 'friend'].includes(relation.kind))
		return relationLabel(relationKind(relation.kind, inverse));
	return ct('inverse', { name: owner.fields.name, kind: relation.kind });
}
