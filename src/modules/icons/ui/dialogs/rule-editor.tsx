// Layout adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/settings/SettingsFormControls.tsx
import { useMemo, useState } from 'react';
import type { Category } from '../../core/types';
import type IconicController from '../../platform/host/controller';
import type { ConditionItem, RuleItem } from '../../platform/managers/rule-manager';
import { t } from '../../../../shared/i18n';
import { useT } from '../../../../ui/react/hooks';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { SuggestInput } from '../SuggestInput';
import { SettingsRow, SettingsSwitchRow } from '../../../../ui/components/nand/SettingsFormControls';
import { Choice } from '../../../../ui/components/nand/Choice';
import { IconPreview } from '../IconPreview';
import { ReorderList } from '../ReorderList';
import IconPicker from './icon-picker';
import RuleChecker from './rule-checker';
import { openIconicDialog } from './react-dialog';
import {
	FILE_SOURCES,
	FOLDER_SOURCES,
	SOURCE_OPERATORS,
	TEXT_OPERATORS,
	LIST_OPERATORS,
	NUMBER_OPERATORS,
	BOOLEAN_OPERATORS,
	DATE_OPERATORS,
	DATETIME_OPERATORS,
	PROPERTY_OPERATORS,
	OPERATOR_VALUE_TYPES,
	WEEKDAY_VALUES,
	MONTH_VALUES,
	COLOR_VALUES,
} from './rule-options';
export type { OperatorValueType } from './rule-options';
export type RuleEditorCallback = (rule: RuleItem | null) => void;
export function conditionOperators(plugin: IconicController, source: string): string[] {
	if (!source.startsWith('property:')) return SOURCE_OPERATORS[source] ?? [];
	const type = plugin.getPropertyItem(source.slice(9))?.type;
	const operators =
		type === 'number'
			? NUMBER_OPERATORS
			: type === 'checkbox'
				? BOOLEAN_OPERATORS
				: type === 'date'
					? DATE_OPERATORS
					: type === 'datetime'
						? DATETIME_OPERATORS
						: ['multitext', 'aliases', 'tags'].includes(type ?? '')
							? LIST_OPERATORS
							: TEXT_OPERATORS;
	return [...operators, ...PROPERTY_OPERATORS];
}
function normalizeCondition(
	plugin: IconicController,
	condition: ConditionItem,
	previous?: ConditionItem,
): ConditionItem {
	const next = { ...condition };
	const available = conditionOperators(plugin, next.source);
	if (!available.includes(next.operator)) next.operator = available[0] ?? next.operator;
	const type = OPERATOR_VALUE_TYPES[next.operator];
	if (previous && type !== OPERATOR_VALUE_TYPES[previous.operator]) next.value = '';
	const options =
		type === 'weekday'
			? WEEKDAY_VALUES.map(String)
			: type === 'month'
				? MONTH_VALUES.map(String)
				: type === 'color'
					? COLOR_VALUES
					: undefined;
	if (options && !options.includes(next.value)) next.value = options[0]!;
	return next;
}
function suggestions(plugin: IconicController, page: Category, source: string) {
	const files = plugin.app.vault.getFiles(),
		folders = plugin.app.vault.getAllFolders();
	const values =
		source === 'tree'
			? folders.map((f) => (page === 'file' ? f.path : f.name))
			: page === 'folder'
				? folders.map((f) => (source === 'name' ? f.name : source === 'path' ? f.path : ''))
				: files.map((f) =>
						source === 'name'
							? f.basename
							: source === 'filename'
								? f.name
								: source === 'extension'
									? f.extension
									: source === 'path'
										? f.path
										: '',
					);
	return [...new Set(values.filter(Boolean))].sort();
}
function Condition({
	plugin,
	page,
	condition,
	change,
	remove,
}: {
	plugin: IconicController;
	page: Category;
	condition: ConditionItem;
	change: (next: ConditionItem) => void;
	remove: () => void;
}) {
	const t = useT(),
		{ source, operator, value } = condition;
	const sources = [
		...(page === 'file' ? FILE_SOURCES : FOLDER_SOURCES)
			.filter((v) => v !== 'properties')
			.map((v) => [v, t(`iconic.ruleEditor.source.${v}`)] as const),
		...(page === 'file'
			? plugin
					.getPropertyItems()
					.map((prop) => ['property:' + prop.id, prop.id] as const)
					.sort((a, b) => a[1].localeCompare(b[1]))
			: []),
	];
	if (!sources.some(([key]) => key === source)) sources.push([source, source]);
	const operators = conditionOperators(plugin, source),
		type = OPERATOR_VALUE_TYPES[operator];
	const set = (next: ConditionItem) => {
		change(normalizeCondition(plugin, next, condition));
	};
	const dropdown =
		type === 'weekday'
			? WEEKDAY_VALUES.map((v) => [String(v), t(`iconic.ruleEditor.weekday.${v}`)] as const)
			: type === 'month'
				? MONTH_VALUES.map((v) => [String(v), t(`iconic.ruleEditor.month.${v}`)] as const)
				: type === 'color'
					? COLOR_VALUES.map((v) => [v, t(`iconic.iconPicker.colors.${v}`)] as const)
					: undefined;
	const placeholder = t(
		type === 'regex'
			? 'iconic.ruleEditor.enterRegex'
			: type === 'hex'
				? 'iconic.ruleEditor.enterHexCode'
				: type === 'number'
					? 'iconic.ruleEditor.enterNumber'
					: 'iconic.ruleEditor.enterValue',
	);
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Choice
				label={t('iconic.ruleEditor.conditions')}
				value={source}
				options={sources}
				onChange={(v) => set({ ...condition, source: v })}
			/>
			<Choice
				label={t('iconic.ruleEditor.matchConditions.name')}
				value={operator}
				options={operators.map((v) => [v, t(`iconic.ruleEditor.operator.${v}`)])}
				onChange={(v) => set({ ...condition, operator: v })}
			/>
			{dropdown ? (
				<Choice
					label={placeholder}
					value={value}
					options={dropdown}
					onChange={(v) => change({ ...condition, value: v })}
				/>
			) : type === 'text' ? (
				<SuggestInput
					className="min-w-36 flex-1"
					aria-label={placeholder}
					placeholder={placeholder}
					value={value}
					suggestions={suggestions(plugin, page, source)}
					onValueChange={(value) => change({ ...condition, value })}
				/>
			) : type ? (
				<Input
					className="min-w-36 flex-1"
					aria-label={placeholder}
					placeholder={placeholder}
					type={type === 'datetime' ? 'datetime-local' : type === 'date' || type === 'time' ? type : 'text'}
					value={value}
					onChange={(e) => change({ ...condition, value: e.target.value })}
				/>
			) : null}
			<Button variant="ghost" onClick={() => change({ source: 'name', operator: 'contains', value: '' })}>
				{t('iconic.ruleEditor.resetCondition')}
			</Button>
			<Button variant="ghost" onClick={remove}>
				{t('iconic.ruleEditor.removeCondition')}
			</Button>
		</div>
	);
}
export function RuleEditorContent({
	plugin,
	page,
	initial,
	accept,
	close,
}: {
	plugin: IconicController;
	page: Category;
	initial: RuleItem;
	accept: RuleEditorCallback;
	close: () => void;
}) {
	const t = useT(),
		[rule, setRule] = useState(() => structuredClone(initial));
	const [rows, setRows] = useState(() =>
		initial.conditions.map((condition) => ({
			id: crypto.randomUUID(),
			condition: normalizeCondition(plugin, condition),
		})),
	);
	const draft = useMemo(
		() => ({ ...rule, conditions: rows.map((row) => normalizeCondition(plugin, row.condition)) }),
		[plugin, rule, rows],
	);
	const matches = useMemo(
		() =>
			page === 'folder'
				? (plugin.ruleManager?.judgeFolders(draft, new Date(), true) ?? [])
				: (plugin.ruleManager?.judgeFiles(draft, new Date(), true) ?? []),
		[plugin, page, draft],
	);
	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<Button
					variant="outline"
					size="icon"
					aria-label={t('iconic.iconPicker.changeIcon')}
					onClick={() =>
						IconPicker.openSingle(plugin, draft, (icon, color) =>
							setRule((current) => ({ ...current, icon, color })),
						)
					}
				>
					<IconPreview icon={rule.icon ?? plugin.ruleManager?.getPageIcon(page)} color={rule.color} />
				</Button>
				<SuggestInput
					aria-label={t('iconic.ruleEditor.enterName')}
					placeholder={t('iconic.ruleEditor.enterName')}
					value={rule.name}
					onValueChange={(name) => setRule({ ...rule, name })}
					suggestions={plugin.ruleManager?.getRules(page).map((r) => r.name) ?? []}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							accept({ ...draft, name: rule.name || initial.name });
							close();
						}
					}}
				/>
			</div>
			<SettingsSwitchRow
				label={t('iconic.ruleEditor.enabled.name')}
				description={t('iconic.ruleEditor.enabled.desc')}
				checked={rule.enabled}
				onChange={() => setRule({ ...rule, enabled: !rule.enabled })}
			/>
			<SettingsRow
				label={t('iconic.ruleEditor.matchConditions.name')}
				description={t('iconic.ruleEditor.matchConditions.desc')}
				control={
					<Choice
						label={t('iconic.ruleEditor.matchConditions.name')}
						value={rule.match}
						options={['all', 'any', 'none'].map((v) => [v, t(`iconic.ruleEditor.matchConditions.${v}`)])}
						onChange={(v) => setRule({ ...rule, match: v === 'any' || v === 'none' ? v : 'all' })}
					/>
				}
			/>
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-sm font-semibold">{t('iconic.ruleEditor.conditions')}</h3>
				<Button
					variant="outline"
					onClick={() => {
						const last = rows.at(-1)?.condition;
						setRows([
							...rows,
							{
								id: crypto.randomUUID(),
								condition: normalizeCondition(
									plugin,
									last ? { ...last, value: '' } : { source: 'name', operator: 'contains', value: '' },
								),
							},
						]);
					}}
				>
					{t('iconic.ruleEditor.addCondition')}
				</Button>
			</div>
			<ReorderList
				rows={rows.map((row) => ({
					id: row.id,
					content: (
						<Condition
							plugin={plugin}
							page={page}
							condition={row.condition}
							change={(condition) =>
								setRows(rows.map((r) => (r.id === row.id ? { ...r, condition } : r)))
							}
							remove={() => setRows(rows.filter((r) => r.id !== row.id))}
						/>
					),
				}))}
				move={(from, to) => {
					const next = [...rows];
					next.splice(to, 0, next.splice(from, 1)[0]!);
					setRows(next);
				}}
			/>
			<div className="flex flex-wrap items-center gap-2">
				<Button
					variant="outline"
					disabled={!matches.length}
					onClick={() => RuleChecker.open(plugin, page, matches)}
				>
					{t(
						matches.length === 0
							? 'iconic.ruleEditor.buttonNoMatches'
							: matches.length === 1
								? 'iconic.ruleEditor.buttonMatch'
								: 'iconic.ruleEditor.buttonMatches',
						{ '#': matches.length },
					)}
				</Button>
				<Button
					variant="destructive"
					onClick={() => {
						accept(null);
						close();
					}}
				>
					{t('iconic.ruleEditor.removeRule')}
				</Button>
				<span className="flex-1" />
				<Button variant="outline" onClick={close}>
					{t('iconic.iconPicker.cancel')}
				</Button>
				<Button
					onClick={() => {
						accept({ ...draft, name: rule.name || initial.name });
						close();
					}}
				>
					{t('iconic.iconPicker.save')}
				</Button>
			</div>
		</div>
	);
}
export default class RuleEditor {
	static open(plugin: IconicController, page: Category, rule: RuleItem, callback: RuleEditorCallback) {
		if (plugin.ruleManager)
			openIconicDialog(
				plugin,
				t(page === 'folder' ? 'iconic.ruleEditor.folderRule' : 'iconic.ruleEditor.fileRule'),
				(close) => (
					<RuleEditorContent plugin={plugin} page={page} initial={rule} accept={callback} close={close} />
				),
			);
	}
}
