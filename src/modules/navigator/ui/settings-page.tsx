// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { useState, useSyncExternalStore } from 'react';
import { Platform } from 'obsidian';
import { toast } from 'sonner';
import type { SettingsHandle } from '../../../shared/settings/store';
import { Button } from '../../../ui/components/button';
import { Input } from '../../../ui/components/input';
import { Textarea } from '../../../ui/components/textarea';
import { Choice } from '../../../ui/components/nand/Choice';
import { NumberField, SettingsRow, SettingsSwitchRow } from '../../../ui/components/nand/SettingsFormControls';
import { SettingsSection } from '../../../ui/components/nand/SettingsSection';
import { SettingsSubsectionHeader } from '../../../ui/components/nand/SettingsSubsectionHeader';
import { useT } from '../../../ui/react/hooks';
import { defaultKeymap, NAV_ACTIONS, parseKeyList, type NavAction } from '../core/keymap';
import type { NavigatorSettings } from '../settings';
import type { NavigatorRuntime } from './runtime';
import { ProductivitySettings } from './settings-productivity';

type BooleanKey = { [K in keyof NavigatorSettings]: NavigatorSettings[K] extends boolean ? K : never }[keyof NavigatorSettings];

const DISPLAY_SWITCHES: readonly BooleanKey[] = ['showPreview', 'showThumbnail', 'showDate', 'showNoteTags', 'showParentFolder', 'compact'];
const ORGANIZE_SWITCHES: readonly BooleanKey[] = ['showRecent', 'showProperties'];
type RuleKey = 'hiddenFolders' | 'hiddenTags' | 'hiddenFiles' | 'hiddenProperties';
const RULE_KEYS: readonly RuleKey[] = ['hiddenFolders', 'hiddenTags', 'hiddenFiles', 'hiddenProperties'];
const splitList = (text: string): string[] => text.split(',').map((entry) => entry.trim()).filter(Boolean);
const TREE_SWITCHES: readonly BooleanKey[] = ['showRoot', 'showTags', 'showUntagged', 'countDescendants', 'showAllFiles'];
const BEHAVIOUR_SWITCHES: readonly BooleanKey[] = ['includeDescendants', 'autoReveal', 'openOnSelect', 'confirmDelete', 'indexInBackground'];

export function navigatorSettingsPage(settings: SettingsHandle<NavigatorSettings>, runtime: () => NavigatorRuntime | undefined) {
	return function NavigatorSettingsPage() {
		const t = useT();
		const value = useSyncExternalStore((listener) => settings.subscribe(listener), () => settings.get());
		const save = <K extends keyof NavigatorSettings>(key: K, next: NavigatorSettings[K]) => {
			void settings.update((draft) => { draft[key] = next; }).catch(() => toast.error(t('settings.writeFailed')));
		};
		const toggle = (key: BooleanKey) => (
			<SettingsSwitchRow key={key} label={t(`navigator.setting.${key}`)} description={t(`navigator.setting.${key}Desc`)} checked={value[key]} onChange={() => save(key, !value[key])} />
		);
		const defaults = defaultKeymap(Platform.isMacOS);
		return (
			<>
				<SettingsSection title={t('navigator.settingsTitle')}>
					<SettingsRow
						label={t('navigator.setting.layout')}
						control={<Choice label={t('navigator.setting.layout')} value={value.layout} options={[['dual', t('navigator.dualPane')], ['single', t('navigator.singlePane')]]} onChange={(next) => save('layout', next === 'single' ? 'single' : 'dual')} />}
					/>
					<SettingsRow
						label={t('navigator.setting.orientation')}
						control={<Choice label={t('navigator.setting.orientation')} value={value.orientation} disabled={value.layout === 'single'} options={[['vertical', t('navigator.stacked')], ['horizontal', t('navigator.sideBySide')]]} onChange={(next) => save('orientation', next === 'horizontal' ? 'horizontal' : 'vertical')} />}
					/>
					{TREE_SWITCHES.map(toggle)}
				</SettingsSection>
				<SettingsSection title={t('navigator.setting.listTitle')}>
					<SettingsRow
						label={t('navigator.setting.sortBy')}
						control={<Choice label={t('navigator.setting.sortBy')} value={value.sortBy} options={[['modified', t('navigator.sortModified')], ['created', t('navigator.sortCreated')], ['name', t('navigator.sortName')]]} onChange={(next) => save('sortBy', next === 'created' || next === 'name' ? next : 'modified')} />}
					/>
					<SettingsRow
						label={t('navigator.setting.sortDirection')}
						control={<Choice label={t('navigator.setting.sortDirection')} value={value.sortDirection} options={[['desc', t('navigator.descending')], ['asc', t('navigator.ascending')]]} onChange={(next) => save('sortDirection', next === 'asc' ? 'asc' : 'desc')} />}
					/>
					<SettingsRow
						label={t('navigator.setting.groupBy')}
						control={<Choice label={t('navigator.setting.groupBy')} value={value.groupBy} options={[['none', t('navigator.groupNone')], ['date', t('navigator.groupDate')], ['folder', t('navigator.groupFolder')], ...(value.groupBy === 'property' ? [['property', t('navigator.groupProperty', { property: value.groupProperty })] as const] : [])]} onChange={(next) => save('groupBy', next === 'none' || next === 'folder' || next === 'property' ? next : 'date')} />}
					/>
					<SettingsRow
						label={t('navigator.setting.dateWhenNameSort')}
						description={t('navigator.setting.dateWhenNameSortDesc')}
						control={<Choice label={t('navigator.setting.dateWhenNameSort')} value={value.dateWhenNameSort} options={[['modified', t('navigator.sortModified')], ['created', t('navigator.sortCreated')]]} onChange={(next) => save('dateWhenNameSort', next === 'created' ? 'created' : 'modified')} />}
					/>
					<NumberField label={t('navigator.setting.titleRows')} description={t('navigator.setting.titleRowsDesc')} value={value.titleRows} min={1} max={3} integer onChange={(next) => save('titleRows', next)} />
					{DISPLAY_SWITCHES.map(toggle)}
					<NumberField label={t('navigator.setting.previewRows')} description={t('navigator.setting.previewRowsDesc')} value={value.previewRows} min={1} max={5} integer onChange={(next) => save('previewRows', next)} />
					<SettingsRow
						label={t('navigator.setting.dateFormat')}
						description={t('navigator.setting.dateFormatDesc')}
						control={<Input aria-label={t('navigator.setting.dateFormat')} className="w-48" placeholder="YYYY-MM-DD HH:mm" value={value.dateFormat} onChange={(event) => save('dateFormat', event.target.value)} />}
					/>
					<SettingsRow
						label={t('navigator.setting.imageProperties')}
						description={t('navigator.setting.imagePropertiesDesc')}
						control={<Input aria-label={t('navigator.setting.imageProperties')} className="w-48" value={value.imageProperties.join(', ')} onChange={(event) => save('imageProperties', event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean))} />}
					/>
				</SettingsSection>
				<SettingsSection title={t('navigator.setting.orgTitle')}>
					{ORGANIZE_SWITCHES.map(toggle)}
					<NumberField label={t('navigator.setting.recentLimit')} description={t('navigator.setting.recentLimitDesc')} value={value.recentLimit} min={1} max={30} integer onChange={(next) => save('recentLimit', next)} />
					<SettingsRow
						label={t('navigator.setting.propertyKeys')}
						description={t('navigator.setting.propertyKeysDesc')}
						control={<Input aria-label={t('navigator.setting.propertyKeys')} className="w-48" value={value.propertyKeys.join(', ')} onChange={(event) => save('propertyKeys', splitList(event.target.value))} />}
					/>
					<SettingsRow
						label={t('navigator.setting.groupProperties')}
						description={t('navigator.setting.groupPropertiesDesc')}
						control={<Input aria-label={t('navigator.setting.groupProperties')} className="w-48" value={value.groupProperties.join(', ')} onChange={(event) => save('groupProperties', splitList(event.target.value))} />}
					/>
				</SettingsSection>
				<SettingsSection title={t('navigator.setting.hiddenTitle')}>
					{toggle('showHidden')}
					{RULE_KEYS.map((key) => (
						<RuleList key={key} label={t(`navigator.setting.${key}`)} description={t(`navigator.setting.${key}Desc`)} rules={value[key]} onChange={(rules) => save(key, rules)} />
					))}
				</SettingsSection>
				<SettingsSection title={t('navigator.setting.folderNotesTitle')}>
					{toggle('folderNotes')}
					<SettingsRow
						label={t('navigator.setting.folderNoteName')}
						description={t('navigator.setting.folderNoteNameDesc')}
						control={<Input aria-label={t('navigator.setting.folderNoteName')} className="w-48" placeholder="index" value={value.folderNoteName} onChange={(event) => save('folderNoteName', event.target.value)} />}
					/>
					{toggle('folderNoteOpenOnClick')}
				</SettingsSection>
				<ProductivitySettings settings={settings} runtime={runtime} />
				<SettingsSection title={t('navigator.setting.behaviourTitle')}>{BEHAVIOUR_SWITCHES.map(toggle)}</SettingsSection>
				<SettingsSection title={t('navigator.setting.keyboardTitle')}>
					<SettingsSubsectionHeader title={t('navigator.setting.keyboardHint')} description={t('navigator.setting.keyboardFormat')} />
					{NAV_ACTIONS.map((action) => (
						<KeyRow
							key={action}
							action={action}
							custom={value.keymap[action]}
							fallback={defaults[action]}
							onChange={(keys) => save('keymap', withKeys(value.keymap, action, keys))}
						/>
					))}
				</SettingsSection>
				<SettingsSection title={t('navigator.setting.maintenanceTitle')}>
					<SettingsRow
						label={t('navigator.cmd.rebuildCache')}
						description={t('navigator.setting.rebuildDesc')}
						control={<Button variant="outline" disabled={!runtime()} onClick={() => { void runtime()?.rebuildCache().catch(() => toast.error(t('settings.writeFailed'))); }}>{t('navigator.rebuild')}</Button>}
					/>
				</SettingsSection>
			</>
		);
	};
}

function withKeys(keymap: NavigatorSettings['keymap'], action: NavAction, keys: string[] | undefined): NavigatorSettings['keymap'] {
	const next = { ...keymap };
	if (keys) next[action] = keys; else delete next[action];
	return next;
}

function KeyRow({ action, custom, fallback, onChange }: { action: NavAction; custom: string[] | undefined; fallback: string[]; onChange: (keys: string[] | undefined) => void }) {
	const t = useT();
	const shown = (custom ?? fallback).join(', ');
	const [draft, setDraft] = useState<string | null>(null);
	return (
		<SettingsRow
			label={t(`navigator.action.${action}`)}
			control={
				<div className="flex items-center gap-2">
					<Input
						aria-label={t(`navigator.action.${action}`)}
						className="w-48"
						value={draft ?? shown}
						onChange={(event) => setDraft(event.target.value)}
						onBlur={() => {
							if (draft === null) return;
							onChange(parseKeyList(draft));
							setDraft(null);
						}}
					/>
					<Button variant="ghost" size="sm" disabled={custom === undefined} onClick={() => { setDraft(null); onChange(undefined); }}>{t('navigator.reset')}</Button>
				</div>
			}
		/>
	);
}

/** One rule per line; saved when the field loses focus so a half-typed pattern never hides anything. */
function RuleList({ label, description, rules, onChange }: { label: string; description: string; rules: readonly string[]; onChange: (rules: string[]) => void }) {
	const [draft, setDraft] = useState<string | null>(null);
	return (
		<SettingsRow
			label={label}
			description={description}
			alignTop
			control={
				<Textarea
					aria-label={label}
					className="h-24 w-56 text-xs"
					spellCheck={false}
					value={draft ?? rules.join('\n')}
					onChange={(event) => setDraft(event.target.value)}
					onBlur={() => {
						if (draft === null) return;
						onChange(draft.split('\n').map((rule) => rule.trim()).filter(Boolean));
						setDraft(null);
					}}
				/>
			}
		/>
	);
}
