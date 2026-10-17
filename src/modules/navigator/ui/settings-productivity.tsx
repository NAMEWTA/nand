// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { useId, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import type { SettingsHandle } from '../../../shared/settings/store';
import { Button } from '../../../ui/components/button';
import { Input } from '../../../ui/components/input';
import { Choice } from '../../../ui/components/nand/Choice';
import { SettingsRow, SettingsSwitchRow } from '../../../ui/components/nand/SettingsFormControls';
import { SettingsSection } from '../../../ui/components/nand/SettingsSection';
import { SettingsSubsectionHeader } from '../../../ui/components/nand/SettingsSubsectionHeader';
import { useT } from '../../../ui/react/hooks';
import { MAX_CREATE_COMMANDS, newCreateCommand, type CreateNoteCommand } from '../core/create-commands';
import { setFolderTemplate, type FolderTemplate } from '../core/folder-templates';
import { PERIODS, type Period, type PeriodRule } from '../core/periodic';
import { addProfile, editProfile, MAX_PROFILES, removeProfile, summarizeProfiles } from '../core/profiles';
import type { NavigatorSettings } from '../settings';
import type { NavigatorRuntime } from './runtime';


/** A text field that saves when it loses focus, so a half-typed path or pattern never takes effect. */
function TextRow({ label, description, value, placeholder, listId, onCommit }: { label: string; description?: string; value: string; placeholder?: string; listId?: string; onCommit: (value: string) => void }) {
	const [draft, setDraft] = useState<string | null>(null);
	return (
		<SettingsRow
			label={label}
			description={description}
			control={
				<Input
					aria-label={label}
					className="w-56"
					list={listId}
					placeholder={placeholder}
					spellCheck={false}
					value={draft ?? value}
					onChange={(event) => setDraft(event.target.value)}
					onBlur={() => { if (draft !== null) { onCommit(draft); setDraft(null); } }}
				/>
			}
		/>
	);
}

export function ProductivitySettings({ settings, runtime }: { settings: SettingsHandle<NavigatorSettings>; runtime: () => NavigatorRuntime | undefined }) {
	const t = useT();
	const value = useSyncExternalStore((listener) => settings.subscribe(listener), () => settings.get());
	const listId = useId();
	const fail = () => toast.error(t('settings.writeFailed'));
	const update = (change: (draft: NavigatorSettings) => void) => { void settings.update(change).catch(fail); };
	const templates = runtime()?.templateFiles() ?? [];
	const templaterInstalled = runtime()?.templaterInstalled() ?? false;
	const profiles = summarizeProfiles(value.profiles, value.activeProfile, t('navigator.profileDefault'));
	const setRule = (period: Period, patch: Partial<PeriodRule>) => update((draft) => { draft.periodRules = { ...draft.periodRules, [period]: { ...draft.periodRules[period], ...patch } }; });
	const setCommand = (id: string, patch: Partial<CreateNoteCommand>) => update((draft) => { draft.createCommands = draft.createCommands.map((command) => (command.id === id ? { ...command, ...patch } : command)); });

	return (
		<>
			<SettingsSection title={t('navigator.setting.calendarTitle')}>
				<SettingsRow
					label={t('navigator.setting.calendarSource')}
					description={t('navigator.setting.calendarSourceDesc')}
					control={<Choice label={t('navigator.setting.calendarSource')} value={value.calendarSource} options={[['nand', t('navigator.setting.sourceNand')], ['core', t('navigator.setting.sourceCore')]]} onChange={(next) => update((draft) => { draft.calendarSource = next === 'core' ? 'core' : 'nand'; })} />}
				/>
				<SettingsRow
					label={t('navigator.setting.calendarWeekStart')}
					description={t('navigator.setting.calendarWeekStartDesc')}
					control={<Choice label={t('navigator.setting.calendarWeekStart')} value={value.calendarWeekStart} options={[['auto', t('navigator.setting.weekAuto')], ['monday', t('navigator.setting.weekMonday')], ['sunday', t('navigator.setting.weekSunday')], ['saturday', t('navigator.setting.weekSaturday')]]} onChange={(next) => update((draft) => { draft.calendarWeekStart = next === 'monday' || next === 'sunday' || next === 'saturday' ? next : 'auto'; })} />}
				/>
				<SettingsSwitchRow label={t('navigator.setting.calendarWeekNumbers')} description={t('navigator.setting.calendarWeekNumbersDesc')} checked={value.calendarWeekNumbers} onChange={() => update((draft) => { draft.calendarWeekNumbers = !draft.calendarWeekNumbers; })} />
				<SettingsSwitchRow label={t('navigator.setting.calendarImages')} description={t('navigator.setting.calendarImagesDesc')} checked={value.calendarImages} onChange={() => update((draft) => { draft.calendarImages = !draft.calendarImages; })} />
				{PERIODS.map((period) => {
					const rule = value.periodRules[period];
					const name = t(`navigator.period.${period}`);
					return (
						<div key={period} className="space-y-1" data-period-rule={period}>
							<SettingsSubsectionHeader title={name} description={period === 'week' ? t('navigator.setting.weekPatternHint') : undefined} />
							<SettingsSwitchRow label={t('navigator.setting.periodEnabled', { period: name })} checked={rule.enabled} onChange={() => setRule(period, { enabled: !rule.enabled })} />
							<TextRow label={t('navigator.setting.periodFolder', { period: name })} value={rule.folder} placeholder={t('navigator.rootFolder')} onCommit={(next) => setRule(period, { folder: next })} />
							<TextRow label={t('navigator.setting.periodFormat', { period: name })} description={t('navigator.setting.periodFormatDesc')} value={rule.format} onCommit={(next) => setRule(period, { format: next })} />
							<TextRow label={t('navigator.setting.periodTemplate', { period: name })} value={rule.template} listId={listId} onCommit={(next) => setRule(period, { template: next })} />
						</div>
					);
				})}
			</SettingsSection>

			<SettingsSection title={t('navigator.setting.templatesTitle')}>
				<datalist id={listId}>{templates.map((path) => <option key={path} value={path} />)}</datalist>
				<TextRow label={t('navigator.setting.templateFolder')} description={t('navigator.setting.templateFolderDesc')} value={value.templateFolder} onCommit={(next) => update((draft) => { draft.templateFolder = next.trim().replace(/^\/+|\/+$/g, ''); })} />
				<SettingsRow
					label={t('navigator.setting.templateEngine')}
					description={t(templaterInstalled ? 'navigator.setting.templateEngineDesc' : 'navigator.setting.templateEngineNoTemplater')}
					control={<Choice label={t('navigator.setting.templateEngine')} value={value.templateEngine} options={[['auto', t('navigator.setting.engineAuto')], ['builtin', t('navigator.setting.engineBuiltin')], ['templater', t('navigator.setting.engineTemplater')]]} onChange={(next) => update((draft) => { draft.templateEngine = next === 'builtin' || next === 'templater' ? next : 'auto'; })} />}
				/>
				<TextRow label={t('navigator.setting.templateDateFormat')} description={t('navigator.setting.templateDateFormatDesc')} value={value.templateDateFormat} placeholder="YYYY-MM-DD" onCommit={(next) => update((draft) => { draft.templateDateFormat = next.trim() || 'YYYY-MM-DD'; })} />
				<TextRow label={t('navigator.setting.templateTimeFormat')} value={value.templateTimeFormat} placeholder="HH:mm" onCommit={(next) => update((draft) => { draft.templateTimeFormat = next.trim() || 'HH:mm'; })} />
				<SettingsSubsectionHeader title={t('navigator.setting.folderTemplates')} description={t('navigator.setting.folderTemplatesDesc')} />
				{value.folderTemplates.map((entry) => (
					<FolderTemplateRow
						key={entry.folder}
						entry={entry}
						listId={listId}
						onChange={(next) => update((draft) => { draft.folderTemplates = setFolderTemplate(draft.folderTemplates, next); })}
						onRemove={() => update((draft) => { draft.folderTemplates = setFolderTemplate(draft.folderTemplates, { ...entry, template: '' }); })}
					/>
				))}
				<AddFolderTemplate listId={listId} onAdd={(entry) => update((draft) => { draft.folderTemplates = setFolderTemplate(draft.folderTemplates, entry); })} />
			</SettingsSection>

			<SettingsSection title={t('navigator.setting.createCommandsTitle')}>
				<SettingsSubsectionHeader title={t('navigator.setting.createCommandsHint')} description={t('navigator.setting.createCommandsDesc')} />
				{value.createCommands.map((command) => (
					<div key={command.id} className="space-y-1 rounded-md border border-border p-2" data-create-command={command.id}>
						<TextRow label={t('navigator.setting.commandName')} value={command.name} onCommit={(next) => { if (next.trim()) setCommand(command.id, { name: next.trim() }); }} />
						<TextRow label={t('navigator.setting.commandTemplate')} value={command.template} listId={listId} onCommit={(next) => setCommand(command.id, { template: next })} />
						<TextRow label={t('navigator.setting.commandFileName')} description={t('navigator.setting.commandFileNameDesc')} placeholder={t('navigator.untitled')} value={command.fileName} onCommit={(next) => setCommand(command.id, { fileName: next.trim() })} />
						<SettingsRow
							label={t('navigator.setting.commandLocation')}
							control={<Choice label={t('navigator.setting.commandLocation')} value={command.location} options={[['selected', t('navigator.setting.locationSelected')], ['folder', t('navigator.setting.locationFolder')]]} onChange={(next) => setCommand(command.id, { location: next === 'folder' ? 'folder' : 'selected' })} />}
						/>
						{command.location === 'folder' && <TextRow label={t('navigator.setting.commandFolder')} value={command.folder} onCommit={(next) => setCommand(command.id, { folder: next.trim().replace(/^\/+|\/+$/g, '') })} />}
						<div className="flex justify-end">
							<Button type="button" variant="ghost" size="sm" onClick={() => update((draft) => { draft.createCommands = draft.createCommands.filter((entry) => entry.id !== command.id); })}>{t('navigator.setting.remove')}</Button>
						</div>
					</div>
				))}
				<div className="flex justify-end">
					<Button type="button" variant="outline" size="sm" disabled={value.createCommands.length >= MAX_CREATE_COMMANDS} onClick={() => update((draft) => { draft.createCommands = [...draft.createCommands, newCreateCommand(draft.createCommands, t('navigator.setting.newCommandName'))]; })}>{t('navigator.setting.addCommand')}</Button>
				</div>
			</SettingsSection>

			<SettingsSection title={t('navigator.setting.profilesTitle')}>
				<SettingsSubsectionHeader title={t('navigator.setting.profilesHint')} description={t('navigator.setting.profilesDesc')} />
				{profiles.map((profile) => (
					<div key={profile.id} className="space-y-1 rounded-md border border-border p-2" data-profile={profile.id}>
						<TextRow label={t('navigator.setting.profileName')} value={profile.name} onCommit={(next) => update((draft) => { draft.profiles = editProfile(draft.profiles, profile.id, { name: next }, t('navigator.profileDefault')); })} />
						<TextRow label={t('navigator.setting.profileBanner')} description={t('navigator.setting.profileBannerDesc')} value={profile.banner} placeholder="Attachments/banner.png" onCommit={(next) => update((draft) => { draft.profiles = editProfile(draft.profiles, profile.id, { banner: next.trim() }, t('navigator.profileDefault')); })} />
						<div className="flex items-center justify-end gap-2">
							{profile.active ? <span className="text-xs text-muted-foreground">{t('navigator.profileActive')}</span> : (
								<>
									<Button type="button" variant="outline" size="sm" onClick={() => runtime()?.service.switchProfile(profile.id)}>{t('navigator.setting.profileUse')}</Button>
									<Button type="button" variant="ghost" size="sm" onClick={() => update((draft) => { draft.profiles = removeProfile(draft.profiles, profile.id, draft.activeProfile, t('navigator.profileDefault')); })}>{t('navigator.setting.remove')}</Button>
								</>
							)}
						</div>
					</div>
				))}
				<div className="flex justify-end">
					<Button type="button" variant="outline" size="sm" disabled={profiles.length >= MAX_PROFILES} onClick={() => update((draft) => { draft.profiles = addProfile(draft.profiles, t('navigator.setting.newProfileName'), t('navigator.profileDefault')).profiles; })}>{t('navigator.setting.addProfile')}</Button>
				</div>
			</SettingsSection>
		</>
	);
}

function FolderTemplateRow({ entry, listId, onChange, onRemove }: { entry: FolderTemplate; listId: string; onChange: (entry: FolderTemplate) => void; onRemove: () => void }) {
	const t = useT();
	return (
		<div className="space-y-1 rounded-md border border-border p-2" data-folder-template={entry.folder}>
			<SettingsRow label={t('navigator.setting.folderTemplateFolder')} control={<span className="max-w-56 truncate text-sm">{entry.folder === '/' ? t('navigator.rootFolder') : entry.folder}</span>} />
			<TextRow label={t('navigator.setting.commandTemplate')} value={entry.template} listId={listId} onCommit={(next) => onChange({ ...entry, template: next.trim() })} />
			<SettingsSwitchRow label={t('navigator.folderTemplateOnly')} checked={entry.exact} onChange={() => onChange({ ...entry, exact: !entry.exact })} />
			<div className="flex justify-end"><Button type="button" variant="ghost" size="sm" onClick={onRemove}>{t('navigator.setting.remove')}</Button></div>
		</div>
	);
}

function AddFolderTemplate({ listId, onAdd }: { listId: string; onAdd: (entry: FolderTemplate) => void }) {
	const t = useT();
	const [folder, setFolder] = useState('');
	const [template, setTemplate] = useState('');
	const ready = template.trim() !== '';
	return (
		<SettingsRow
			label={t('navigator.setting.addFolderTemplate')}
			description={t('navigator.setting.addFolderTemplateDesc')}
			alignTop
			control={
				<div className="flex flex-col gap-2">
					<Input aria-label={t('navigator.setting.folderTemplateFolder')} className="w-56" placeholder={t('navigator.setting.folderPlaceholder')} value={folder} onChange={(event) => setFolder(event.target.value)} />
					<Input aria-label={t('navigator.setting.commandTemplate')} className="w-56" list={listId} value={template} onChange={(event) => setTemplate(event.target.value)} />
					<Button type="button" variant="outline" size="sm" disabled={!ready} onClick={() => { onAdd({ folder: folder.trim().replace(/^\/+|\/+$/g, '') || '/', template: template.trim(), exact: false }); setFolder(''); setTemplate(''); }}>{t('navigator.setting.add')}</Button>
				</div>
			}
		/>
	);
}

