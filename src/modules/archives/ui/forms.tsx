// Layout adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/SettingsFormControls.tsx
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { FuzzySuggestModal, Notice, type App } from 'obsidian';
import { toast } from 'sonner';
import { relationKind, type ContactsQuery } from '../core/index-store';
import {
	ContactsError,
	cloneRecord,
	emptyRef,
	newRecord,
	validateRecord,
	type ArchiveRecord,
	type EntityRef,
	type ProseSection,
	type RecordKind,
} from '../core/model';
import type { ContactsController } from '../platform/controller';
import { ct, relationLabel } from './labels';
import { useT, useOwnerWindow } from '../../../ui/react/hooks';
import { openReactDialog, dialogOwner } from '../../../ui/react/dialog';
import { Button } from '../../../ui/components/button';
import { Input } from '../../../ui/components/input';
import { Textarea } from '../../../ui/components/textarea';
import { SettingsRow, SettingsSwitchRow } from '../../../ui/components/nand/SettingsFormControls';
import { SettingsSection } from '../../../ui/components/nand/SettingsSection';
import { Choice } from '../../../ui/components/nand/Choice';
import { MultiValueField } from './form-fields';
export { ct, relationDescription } from './labels';

export function errorText(error: unknown): string {
	return error instanceof ContactsError
		? ct(error.code)
		: ct('failed', { detail: error instanceof Error ? error.message : '' });
}
export function confirm(app: App, message: string, accept = ct('delete')): Promise<boolean> {
	return new Promise((resolve) => {
		let accepted = false;
		openReactDialog(dialogOwner(app), {
			title: accept,
			description: message,
			content: (close) => (
				<div className="flex justify-end gap-2">
					<Button type="button" variant="outline" onClick={close}>
						{ct('cancel')}
					</Button>
					<Button
						type="button"
						onClick={() => {
							accepted = true;
							close();
						}}
					>
						{accept}
					</Button>
				</div>
			),
			onClose: () => resolve(accepted),
		});
	});
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
		this.setPlaceholder(ct(kind === 'person' ? 'searchPeople' : 'searchCompanies'));
		this.emptyStateText = ct(kind === 'person' ? 'noMatchingPeople' : 'noMatchingCompanies');
	}
	getItems() {
		return this.values;
	}
	getItemText(r: ArchiveRecord) {
		return this.values.some((other) => other.id !== r.id && other.fields.name === r.fields.name)
			? `${r.fields.name} · ${r.fields.region || r.path}`
			: r.fields.name;
	}
	onChooseItem(record: ArchiveRecord) {
		this.chosen = true;
		this.done(record);
	}
	onClose() {
		super.onClose();
		queueMicrotask(() => {
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
export interface ArchiveEditorHandle {
	close(): void;
}
export interface ArchiveEditorProps {
	controller: ContactsController;
	base: ArchiveRecord;
	scope: EditScope;
	rowId?: string;
	done: (record: ArchiveRecord) => void;
	exit: () => void;
	ref?: Ref<ArchiveEditorHandle>;
}
function editing(base: ArchiveRecord, scope: EditScope, rowId?: string) {
	const draft = cloneRecord(base);
	if (scope === 'employment' && !draft.employments.some((row) => row.id === rowId)) {
		rowId = crypto.randomUUID();
		draft.employments.push({
			id: rowId,
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
	if (scope === 'relation' && !draft.relations.some((row) => row.id === rowId)) {
		rowId = crypto.randomUUID();
		draft.relations.push({ id: rowId, person: emptyRef(), kind: 'colleague', company: emptyRef(), notes: '' });
	}
	return { base: cloneRecord(base), draft, rowId, initial: JSON.stringify(draft) };
}
export function ArchiveEditor({ controller, base, scope, rowId, done, exit, ref }: ArchiveEditorProps) {
	useT();
	const owner = useOwnerWindow();
	const [model, setModel] = useState(() => editing(base, scope, rowId));
	const [revision, setRevision] = useState(0),
		[, repaint] = useState(0),
		[error, setError] = useState<unknown>(),
		[external, setExternal] = useState(false),
		[saving, setSaving] = useState(false);
	const busy = useRef(false),
		confirming = useRef(false),
		root = useRef<HTMLFormElement>(null),
		originalRoot = useRef(controller.root);
	const { draft } = model;
	const change = (run: () => void) => {
		run();
		setError(undefined);
		repaint((v) => v + 1);
	};
	const close = () => {
		if (busy.current || confirming.current) return;
		if (JSON.stringify(draft) === model.initial) return exit();
		confirming.current = true;
		void confirm(controller.app, ct('discard'), ct('discardAction')).then((yes) => {
			confirming.current = false;
			if (yes) exit();
		});
	};
	useImperativeHandle(ref, () => ({ close }));
	useEffect(
		() =>
			controller.subscribe(() => {
				if (model.base.path) setExternal(controller.index.get(model.base.id)?.raw !== model.base.raw);
			}),
		[controller, model.base],
	);
	const fieldKey =
		error instanceof ContactsError
			? error.detail ||
				(
					{
						nameRequired: 'name',
						currentEnd: 'end',
						invalidDate: 'start',
						companyRequired: 'companySelect',
						relationRequired: 'personSelect',
					} as Record<string, string>
				)[error.code]
			: '';
	useEffect(() => {
		if (fieldKey) root.current?.querySelector<HTMLElement>(`[data-field="${CSS.escape(fieldKey)}"]`)?.focus();
	}, [fieldKey, error]);
	const recoverable =
		external ||
		(!!error &&
			(!(error instanceof ContactsError) ||
				['conflict', 'editorConflict', 'folderChanged', 'missing', 'invalidRecord'].includes(error.code)));
	const field = (
		key: string,
		label: string,
		value: string,
		update: (value: string) => void,
		multiline = false,
		description = '',
	) => (
		<SettingsRow
			key={key}
			label={ct(label)}
			description={description}
			className="flex-wrap [&>div:last-child]:w-full sm:[&>div:last-child]:w-2/3"
			control={
				multiline ? (
					<Textarea
						data-field={key}
						aria-label={ct(label)}
						value={value}
						rows={5}
						onChange={(e) => change(() => update(e.target.value))}
					/>
				) : (
					<Input
						data-field={key}
						aria-label={ct(label)}
						aria-invalid={fieldKey === key}
						type={key === 'birthday' ? 'date' : 'text'}
						value={value}
						onChange={(e) => change(() => update(e.target.value))}
						autoFocus={key === 'name'}
					/>
				)
			}
		/>
	);
	const reference = (
		key: string,
		value: EntityRef,
		kind: RecordKind,
		update: (value: EntityRef) => void,
		optional = false,
	) => {
		const selected = (record?: ArchiveRecord) => {
			if (record) change(() => update(controller.ref(record)));
		};
		return (
			<SettingsRow
				label={ct(key)}
				description={value.label || ct('none')}
				control={
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							data-field={key}
							aria-invalid={fieldKey === key}
							onClick={() => {
								void chooseRecord(controller, kind, draft.id).then(selected);
							}}
						>
							{ct('choose')}
						</Button>
						{kind === 'company' && (
							<Button
								type="button"
								variant="outline"
								onClick={() => openCompanyEditor(controller, selected)}
							>
								{ct('addCompany')}
							</Button>
						)}
						{optional && (
							<Button type="button" variant="ghost" onClick={() => change(() => update(emptyRef()))}>
								{ct('clearReference')}
							</Button>
						)}
					</div>
				}
			/>
		);
	};
	const choice = (
		key: string,
		value: string,
		options: readonly string[],
		update: (value: string) => void,
		prefix = '',
	) => (
		<SettingsRow
			label={ct(key)}
			control={
				<Choice
					label={ct(key)}
					value={value}
					options={options.map((v) => [v, ct(v ? prefix + v : 'none')])}
					onChange={(v) => change(() => update(v))}
				/>
			}
		/>
	);
	const title =
		scope === 'relation'
			? rowId
				? 'editRelation'
				: 'addRelation'
			: scope === 'employment'
				? rowId
					? 'editEmployment'
					: 'addEmployment'
				: base.kind === 'person'
					? base.path
						? 'editPerson'
						: 'addPerson'
					: base.path
						? 'editCompany'
						: 'addCompany';
	const save = async () => {
		if (busy.current) return;
		busy.current = true;
		setSaving(true);
		setError(undefined);
		try {
			if (root.current?.querySelector<HTMLInputElement>('[data-field="birthday"]')?.validity.badInput)
				throw new ContactsError('invalidDate', 'birthday');
			validateRecord(draft);
			if (controller.root !== originalRoot.current) throw new ContactsError('folderChanged');
			const record = model.base.path ? await controller.save(model.base, draft) : await controller.create(draft);
			toast.success(ct('saved'));
			done(record);
			exit();
		} catch (reason) {
			setError(reason);
		} finally {
			busy.current = false;
			setSaving(false);
		}
	};
	const groups =
		draft.kind === 'person'
			? [
					{ title: 'identityInfo', fields: ['name', 'aliases', 'birthday', 'birthplace', 'region'] as const },
					{ title: 'contactInfo', fields: ['mobiles', 'phones', 'wechat', 'emails'] as const },
					{ title: 'otherInfo', fields: ['tags'] as const },
				]
			: [
					{ title: 'companyInfo', fields: ['name', 'aliases', 'region', 'website', 'tags'] as const },
					{ title: 'contactInfo', fields: ['phones', 'emails'] as const },
				];
	const job = draft.employments.find((row) => row.id === model.rowId),
		relation = draft.relations.find((row) => row.id === model.rowId),
		builtins = ['leader', 'report', 'colleague', 'friend'];
	return (
		<form
			ref={root}
			className="mx-auto w-full max-w-3xl space-y-5 p-4"
			onSubmit={(e) => {
				e.preventDefault();
				void save();
			}}
			onKeyDown={(e) => {
				if (e.key === 'Escape' && !e.defaultPrevented) {
					e.preventDefault();
					close();
				}
			}}
		>
			<h2 className="text-lg font-semibold">{ct(title)}</h2>
			{!!error && (
				<p role="alert" className="text-sm text-destructive">
					{errorText(error)}
				</p>
			)}
			{external && (
				<p role="status" className="text-sm text-muted-foreground">
					{ct('external')}
				</p>
			)}
			<fieldset key={revision} disabled={saving} className="m-0 min-w-0 space-y-5 border-0 p-0">
				{scope === 'basic' &&
					groups.map((group) => (
						<SettingsSection key={group.title} title={ct(group.title)}>
							{group.fields.map((key) => {
								const value = draft.fields[key];
								return Array.isArray(value) ? (
									<MultiValueField
										key={key}
										label={ct(key)}
										value={value}
										chips={key === 'tags' || key === 'aliases'}
										onChange={(next) =>
											change(() => {
												Object.assign(draft.fields, { [key]: next });
											})
										}
									/>
								) : (
									field(
										key,
										key === 'name'
											? draft.kind === 'person'
												? 'personName'
												: 'companyName'
											: key === 'region' && draft.kind === 'company'
												? 'companyRegion'
												: key,
										value,
										(next) => {
											Object.assign(draft.fields, { [key]: next });
										},
									)
								);
							})}
						</SettingsSection>
					))}
				{scope === 'employment' && job && (
					<>
						{reference('companySelect', job.company, 'company', (value) => {
							job.company = value;
						})}
						{(
							[
								['department', 'department'],
								['title', 'jobTitle'],
								['start', 'start'],
								['end', 'end'],
								['notes', 'notes'],
							] as const
						).map(([key, label]) =>
							field(
								key,
								label,
								job[key],
								(value) => {
									job[key] = value;
								},
								key === 'notes',
								key === 'start' || key === 'end' ? ct('jobDateHint') : '',
							),
						)}
						{choice('status', job.status, ['current', 'past'], (value) => {
							job.status = value === 'past' ? 'past' : 'current';
						})}
						{choice('keyRole', job.keyRole, ['', 'leader', 'contact'], (value) => {
							job.keyRole = value === 'leader' || value === 'contact' ? value : '';
						})}
					</>
				)}
				{scope === 'relation' && relation && (
					<>
						{reference('personSelect', relation.person, 'person', (value) => {
							relation.person = value;
						})}
						<SettingsRow
							label={ct('kind')}
							control={
								<Choice
									label={ct('kind')}
									value={builtins.includes(relation.kind) ? relation.kind : 'custom'}
									options={[
										...builtins.map((v) => [v, ct('relation.' + v)] as const),
										['custom', ct('custom')],
									]}
									onChange={(value) =>
										change(() => {
											relation.kind = value === 'custom' ? '' : value;
										})
									}
								/>
							}
						/>
						{!builtins.includes(relation.kind) &&
							field('customKind', 'customKind', relation.kind, (value) => {
								relation.kind = value;
							})}
						{reference(
							'relatedCompany',
							relation.company,
							'company',
							(value) => {
								relation.company = value;
							},
							true,
						)}
						{field(
							'notes',
							'notes',
							relation.notes,
							(value) => {
								relation.notes = value;
							},
							true,
						)}
					</>
				)}
				{scope !== 'basic' &&
					scope !== 'employment' &&
					scope !== 'relation' &&
					field(
						scope,
						scope === 'notes' && draft.kind === 'company' ? 'companyNotes' : scope,
						draft.prose[scope],
						(value) => {
							draft.prose[scope] = value;
						},
						true,
					)}
			</fieldset>
			{recoverable && (
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							void owner.navigator.clipboard
								.writeText(JSON.stringify(draft, null, 2))
								.then(() => toast.success(ct('copied')))
								.catch(setError);
						}}
					>
						{ct('copyDraft')}
					</Button>
					{model.base.path && (
						<Button
							type="button"
							variant="outline"
							disabled={saving}
							onClick={() => {
								void (async () => {
									if (!(await confirm(controller.app, ct('discard'), ct('reloadDraft')))) return;
									const next = await controller.snapshot(
										controller.index.get(model.base.id)?.path ?? model.base.path,
									);
									setModel(editing(next, scope, model.rowId));
									setRevision((v) => v + 1);
									setExternal(false);
									setError(undefined);
								})().catch(setError);
							}}
						>
							{ct('reloadDraft')}
						</Button>
					)}
				</div>
			)}
			<div className="flex justify-end gap-2">
				<Button type="button" variant="outline" disabled={saving} onClick={close}>
					{ct('cancel')}
				</Button>
				<Button type="submit" disabled={saving}>
					{ct('save')}
				</Button>
			</div>
		</form>
	);
}
function openCompanyEditor(controller: ContactsController, done: (record?: ArchiveRecord) => void) {
	const editor: { current: ArchiveEditorHandle | null } = { current: null };
	openReactDialog(dialogOwner(controller.app), {
		title: ct('addCompany'),
		className: 'max-w-3xl max-h-[90vh] overflow-y-auto',
		canClose: () => {
			editor.current?.close();
			return false;
		},
		content: (close) => (
			<ArchiveEditor
				ref={editor}
				controller={controller}
				base={newRecord('company')}
				scope="basic"
				done={done}
				exit={close}
			/>
		),
	});
}
export function ArchiveFilters({
	controller,
	query,
	done,
	close,
}: {
	controller: ContactsController;
	query: ContactsQuery;
	done: (query: ContactsQuery) => void;
	close: () => void;
}) {
	useT();
	const [draft, setDraft] = useState(() => structuredClone(query));
	const records = [...controller.index.byPath.values()].filter((r) => r.kind === draft.kind);
	const groups: Array<{
		key: 'current' | 'past' | 'regions' | 'tags' | 'relations';
		title: string;
		values: Array<[string, string]>;
	}> = [
		{
			key: 'regions',
			title: draft.kind === 'person' ? 'region' : 'companyRegion',
			values: [...new Set(records.map((r) => r.fields.region).filter(Boolean))].sort().map((v) => [v, v]),
		},
		{
			key: 'tags',
			title: 'tags',
			values: [...new Set(records.flatMap((r) => r.fields.tags))].sort().map((v) => [v, v]),
		},
	];
	if (draft.kind === 'person') {
		const companies = controller.choices('company');
		const options = (status: 'current' | 'past'): Array<[string, string]> =>
			companies
				.filter((company) => controller.index.members(company.id, status).length > 0)
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
						controller.index.relationsFor(r.id).map((e) => relationKind(e.relation.kind, e.inverse)),
					),
				),
			]
				.sort()
				.map((v) => [v, relationLabel(v)]),
		});
	}
	return (
		<div className="space-y-5">
			{groups.every((group) => !group.values.length) && (
				<p className="text-sm text-muted-foreground">{ct('filterEmpty')}</p>
			)}
			{groups.map((group) => (
				<SettingsSection key={group.key} title={ct(group.title)}>
					{!group.values.length && <p className="text-xs text-muted-foreground">{ct('noFilterOptions')}</p>}
					{group.values.map(([value, name]) => (
						<SettingsSwitchRow
							key={value}
							label={name}
							checked={draft[group.key].includes(value)}
							onChange={() =>
								setDraft((current) => ({
									...current,
									[group.key]: current[group.key].includes(value)
										? current[group.key].filter((v) => v !== value)
										: [...current[group.key], value],
								}))
							}
						/>
					))}
				</SettingsSection>
			))}
			<div className="flex justify-end gap-2">
				<Button type="button" variant="outline" onClick={close}>
					{ct('cancel')}
				</Button>
				<Button
					type="button"
					onClick={() => {
						done(draft);
						close();
					}}
				>
					{ct('apply')}
				</Button>
			</div>
		</div>
	);
}
export class FilterModal {
	private dialog?: { close(): void };
	constructor(
		private controller: ContactsController,
		private query: ContactsQuery,
		private done: (query: ContactsQuery) => void,
	) {}
	open() {
		this.dialog = openReactDialog(dialogOwner(this.controller.app), {
			title: ct('filter'),
			className: 'max-h-[85vh] overflow-y-auto',
			content: (close) => (
				<ArchiveFilters controller={this.controller} query={this.query} done={this.done} close={close} />
			),
		});
	}
	close() {
		this.dialog?.close();
	}
}

/** The current base of a record for editing (re-read from disk); rejects when the row no longer exists. */
export async function editBase(
	controller: ContactsController,
	record: ArchiveRecord,
	scope: EditScope,
	rowId: string | undefined,
): Promise<ArchiveRecord> {
	const base = await controller.snapshot(record.path);
	if (
		rowId &&
		((scope === 'employment' && !base.employments.some((r) => r.id === rowId)) ||
			(scope === 'relation' && !base.relations.some((r) => r.id === rowId)))
	)
		throw new ContactsError('conflict');
	return base;
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
