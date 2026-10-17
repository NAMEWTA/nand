// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import type { App } from 'obsidian';
import { useId, useState, type ReactNode } from 'react';
import { Folder } from 'lucide-react';
import { Button } from '../../../ui/components/button';
import { Input } from '../../../ui/components/input';
import { Label } from '../../../ui/components/label';
import { Choice } from '../../../ui/components/nand/Choice';
import { Switch } from '../../../ui/components/switch';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '../../../ui/components/command';
import { dialogOwner, openReactDialog } from '../../../ui/react/dialog';
import { useT } from '../../../ui/react/hooks';
import { t } from '../../../shared/i18n';
import type { AppearanceOverride, ListAppearance } from '../core/appearance';
import { contextKey, ROOT_FOLDER, type NavContext } from '../core/types';
import type { DialogRegistry } from './dialog-registry';
import type { NavigatorService } from '../services/navigator';
import { contextLabel } from './labels';

export type DialogOptions = Parameters<typeof openReactDialog>[1];

/** Open a dialog and register it so stopping the navigator closes it. */
export function openTracked(registry: DialogRegistry, app: App, options: DialogOptions): void {
	let untrack: () => void = () => undefined;
	const handle = openReactDialog(dialogOwner(app), { ...options, onClose: () => { untrack(); options.onClose?.(); } });
	untrack = registry.track(handle);
}

/** Ask the user to confirm trashing; resolves true only on the explicit confirm button (and false if the navigator stops first). */
export function confirmDelete(app: App, registry: DialogRegistry, names: readonly string[]): Promise<boolean> {
	return new Promise((resolve) => {
		let result = false;
		openTracked(registry, app, {
			title: t(names.length === 1 ? 'navigator.deleteOne' : 'navigator.deleteMany', { count: names.length }),
			description: names.length === 1 ? names[0] : names.slice(0, 5).join(', ') + (names.length > 5 ? '…' : ''),
			content: (close) => <ConfirmBody onConfirm={() => { result = true; close(); }} onCancel={close} />,
			onClose: () => resolve(result),
		});
	});
}

function ConfirmBody({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
	const label = useT();
	return (
		<div className="flex justify-end gap-2">
			<Button type="button" variant="outline" onClick={onCancel}>{label('navigator.cancel')}</Button>
			<Button type="button" variant="destructive" autoFocus onClick={onConfirm}>{label('navigator.delete')}</Button>
		</div>
	);
}

/**
 * Ask for one line of text. Unlike the shared prompt this dialog is registered with the navigator, so stopping the
 * navigator closes it and the answer is "cancelled" (undefined); nothing can be confirmed afterwards.
 */
export function askName(app: App, registry: DialogRegistry, options: { title: string; label: string; value: string; confirm: string }): Promise<string | undefined> {
	return new Promise((resolve) => {
		let result: string | undefined;
		openTracked(registry, app, {
			title: options.title,
			content: (close) => <NameBody label={options.label} value={options.value} confirm={options.confirm} onSubmit={(name) => { result = name; close(); }} onCancel={close} />,
			onClose: () => resolve(result),
		});
	});
}

function NameBody({ label, value, confirm, onSubmit, onCancel }: { label: string; value: string; confirm: string; onSubmit: (name: string) => void; onCancel: () => void }) {
	const t = useT();
	const id = useId();
	const [text, setText] = useState(value);
	return (
		<form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const name = text.trim(); if (name) onSubmit(name); }}>
			<div className="space-y-2">
				<Label htmlFor={id}>{label}</Label>
				<Input id={id} aria-label={label} value={text} autoFocus onChange={(event) => setText(event.target.value)} />
			</div>
			<div className="flex justify-end gap-2">
				<Button type="button" variant="outline" onClick={onCancel}>{t('navigator.cancel')}</Button>
				<Button type="submit">{confirm}</Button>
			</div>
		</form>
	);
}

/** Pick a vault folder from a searchable list; resolves to its path, or undefined if dismissed. */
export function chooseFolder(app: App, registry: DialogRegistry, folders: readonly string[], title: string): Promise<string | undefined> {
	return new Promise((resolve) => {
		let result: string | undefined;
		openTracked(registry, app, {
			title,
			content: (close) => <FolderList folders={folders} onPick={(folder) => { result = folder; close(); }} />,
			onClose: () => resolve(result),
		});
	});
}

function FolderList({ folders, onPick }: { folders: readonly string[]; onPick: (folder: string) => void }) {
	const label = useT();
	return (
		<Command className="h-72 rounded-md border border-border">
			<CommandInput autoFocus placeholder={label('navigator.searchFolders')} aria-label={label('navigator.searchFolders')} />
			<CommandList>
				<CommandEmpty>{label('navigator.noFolders')}</CommandEmpty>
				{[...folders].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((folder) => (
					<CommandItem key={folder} value={folder} onSelect={() => onPick(folder)}>
						<Folder aria-hidden className="size-4 text-muted-foreground" />
						<span className="truncate">{folder === ROOT_FOLDER ? label('navigator.rootFolder') : folder}</span>
					</CommandItem>
				))}
			</CommandList>
		</Command>
	);
}

/** Edit the list settings that one folder, tag or property overrides; unticked options follow the global settings. */
export function openAppearanceDialog(app: App, registry: DialogRegistry, service: NavigatorService, context: NavContext): void {
	openTracked(registry, app, {
		title: t('navigator.appearanceTitle', { name: contextLabel(context) }),
		description: t('navigator.appearanceHint'),
		content: (close) => <AppearanceBody service={service} context={context} close={close} />,
	});
}

type OverrideField = keyof AppearanceOverride;

function AppearanceBody({ service, context, close }: { service: NavigatorService; context: NavContext; close: () => void }) {
	const label = useT();
	const current: AppearanceOverride = service.settings.get().appearances[contextKey(context)] ?? {};
	const effective: ListAppearance = service.appearanceFor(context);
	const [draft, setDraft] = useState<AppearanceOverride>(current);
	const properties = service.settings.get().groupProperties;
	const on = (field: OverrideField) => draft[field] !== undefined;
	const toggle = (field: OverrideField, enabled: boolean) => setDraft((prev) => {
		const next = { ...prev } as Record<string, unknown>;
		if (!enabled) {
			delete next[field];
			if (field === 'groupBy') delete next['groupProperty'];
		} else {
			next[field] = effective[field];
			if (field === 'groupBy') next['groupProperty'] = effective.groupProperty;
		}
		return next;
	});
	const set = (patch: AppearanceOverride) => setDraft((prev) => ({ ...prev, ...patch }));
	const value = <K extends OverrideField>(field: K): ListAppearance[K] => (draft[field] ?? effective[field]);
	const group = value('groupBy') === 'property' ? `property:${value('groupProperty')}` : value('groupBy');
	const numbers = (max: number) => Array.from({ length: max }, (_, index): readonly [string, string] => [String(index + 1), String(index + 1)]);

	// A plain function, not a component: a component defined here would remount its controls on every change.
	const row = (field: OverrideField, name: string, children: ReactNode) => (
		<div key={field} className="flex items-center gap-3" data-appearance-field={field}>
			<Switch checked={on(field)} aria-label={name} onCheckedChange={(enabled) => toggle(field, enabled)} />
			<span className="min-w-0 flex-1 truncate text-sm">{name}</span>
			<div className="w-44 shrink-0">{children}</div>
		</div>
	);

	return (
		<div className="space-y-3">
			{row('sortBy', label('navigator.sortBy'), (
				<Choice label={label('navigator.sortBy')} value={value('sortBy')} disabled={!on('sortBy')} className="w-full" options={[['modified', label('navigator.sortModified')], ['created', label('navigator.sortCreated')], ['name', label('navigator.sortName')]]} onChange={(next) => set({ sortBy: next === 'created' || next === 'name' ? next : 'modified' })} />
			))}
			{row('sortDirection', label('navigator.setting.sortDirection'), (
				<Choice label={label('navigator.setting.sortDirection')} value={value('sortDirection')} disabled={!on('sortDirection')} className="w-full" options={[['desc', label('navigator.descending')], ['asc', label('navigator.ascending')]]} onChange={(next) => set({ sortDirection: next === 'asc' ? 'asc' : 'desc' })} />
			))}
			{row('groupBy', label('navigator.groupBy'), (
				<Choice
					label={label('navigator.groupBy')}
					value={group}
					disabled={!on('groupBy')}
					className="w-full"
					options={[['none', label('navigator.groupNone')], ['date', label('navigator.groupDate')], ['folder', label('navigator.groupFolder')], ...properties.map((property): readonly [string, string] => [`property:${property}`, label('navigator.groupProperty', { property })])]}
					onChange={(next) => {
						if (next.startsWith('property:')) set({ groupBy: 'property', groupProperty: next.slice(9) });
						else set({ groupBy: next === 'none' || next === 'folder' ? next : 'date' });
					}}
				/>
			))}
			{row('titleRows', label('navigator.setting.titleRows'), (
				<Choice label={label('navigator.setting.titleRows')} value={String(value('titleRows'))} disabled={!on('titleRows')} className="w-full" options={numbers(3)} onChange={(next) => set({ titleRows: Number(next) })} />
			))}
			{row('previewRows', label('navigator.setting.previewRows'), (
				<Choice label={label('navigator.setting.previewRows')} value={String(value('previewRows'))} disabled={!on('previewRows')} className="w-full" options={numbers(5)} onChange={(next) => set({ previewRows: Number(next) })} />
			))}
			{row('compact', label('navigator.compact'), (
				<Switch checked={value('compact')} disabled={!on('compact')} aria-label={label('navigator.compact')} onCheckedChange={(next) => set({ compact: next })} />
			))}
			{row('includeDescendants', label('navigator.includeDescendants'), (
				<Switch checked={value('includeDescendants')} disabled={!on('includeDescendants')} aria-label={label('navigator.includeDescendants')} onCheckedChange={(next) => set({ includeDescendants: next })} />
			))}
			<div className="flex justify-end gap-2 pt-2">
				<Button type="button" variant="ghost" onClick={() => { service.setAppearance(context, undefined); close(); }}>{label('navigator.reset')}</Button>
				<Button type="button" variant="outline" onClick={close}>{label('navigator.cancel')}</Button>
				<Button type="button" onClick={() => { service.setAppearance(context, draft); close(); }}>{label('navigator.save')}</Button>
			</div>
		</div>
	);
}
