// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import type { App } from 'obsidian';
import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../../ui/components/button';
import { Checkbox } from '../../../ui/components/checkbox';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '../../../ui/components/command';
import { Label } from '../../../ui/components/label';
import { useT } from '../../../ui/react/hooks';
import type { DialogRegistry } from './dialog-registry';
import { openTracked } from './dialogs';

export interface ConfirmOptions {
	title: string;
	description?: string;
	/** Names or lines listed under the description. */
	lines?: readonly string[];
	confirmLabel: string;
	danger?: boolean;
	/** A tick box under the text, e.g. "delete the originals". */
	checkbox?: { label: string; checked: boolean };
}

export interface ConfirmResult { confirmed: boolean; checked: boolean }

/** Ask for confirmation; a dialog closed any other way (or by stopping the navigator) answers "not confirmed". */
export function confirmAction(app: App, registry: DialogRegistry, options: ConfirmOptions): Promise<ConfirmResult> {
	return new Promise((resolve) => {
		let result: ConfirmResult = { confirmed: false, checked: options.checkbox?.checked ?? false };
		openTracked(registry, app, {
			title: options.title,
			description: options.description,
			content: (close) => (
				<ConfirmBody
					options={options}
					onConfirm={(checked) => { result = { confirmed: true, checked }; close(); }}
					onCancel={close}
				/>
			),
			onClose: () => resolve(result),
		});
	});
}

function ConfirmBody({ options, onConfirm, onCancel }: { options: ConfirmOptions; onConfirm: (checked: boolean) => void; onCancel: () => void }) {
	const t = useT();
	const id = useId();
	const [checked, setChecked] = useState(options.checkbox?.checked ?? false);
	return (
		<div className="space-y-4">
			{options.lines?.length ? (
				<ul className="max-h-40 list-none space-y-1 overflow-y-auto rounded-md border border-border p-2 text-sm">
					{options.lines.map((line, index) => <li key={`${line}-${index}`} className="truncate">{line}</li>)}
				</ul>
			) : null}
			{options.checkbox ? (
				<div className="flex items-center gap-2">
					<Checkbox id={id} checked={checked} onCheckedChange={(next) => setChecked(next === true)} />
					<Label htmlFor={id}>{options.checkbox.label}</Label>
				</div>
			) : null}
			<div className="flex justify-end gap-2">
				<Button type="button" variant="outline" onClick={onCancel}>{t('navigator.cancel')}</Button>
				<Button type="button" variant={options.danger ? 'destructive' : 'default'} autoFocus onClick={() => onConfirm(checked)}>{options.confirmLabel}</Button>
			</div>
		</div>
	);
}

export interface ChoiceItem { value: string; label: string; hint?: string }

export interface ChooseOptions {
	title: string;
	placeholder: string;
	empty: string;
	items: readonly ChoiceItem[];
	/** Let the user type a value that is not in the list; `label` formats the "create" row. */
	create?: { label: (query: string) => string; valid: (query: string) => boolean };
}

/** Pick one item from a searchable list (or create a new value); undefined when dismissed. */
export function chooseItem(app: App, registry: DialogRegistry, options: ChooseOptions): Promise<string | undefined> {
	return new Promise((resolve) => {
		let result: string | undefined;
		openTracked(registry, app, {
			title: options.title,
			content: (close) => <ChoiceList options={options} onPick={(value) => { result = value; close(); }} />,
			onClose: () => resolve(result),
		});
	});
}

function ChoiceList({ options, onPick }: { options: ChooseOptions; onPick: (value: string) => void }) {
	const [query, setQuery] = useState('');
	const typed = query.trim();
	const canCreate = !!options.create && !!typed && options.create.valid(typed) && !options.items.some((item) => item.value.toLowerCase() === typed.toLowerCase());
	return (
		<Command className="h-72 rounded-md border border-border">
			<CommandInput autoFocus placeholder={options.placeholder} aria-label={options.placeholder} value={query} onValueChange={setQuery} />
			<CommandList>
				{/* Not inside a group: cmdk hides a group whose items are all forced rows. */}
				{canCreate && options.create ? (
					<CommandItem value={`__create__${typed}`} forceMount onSelect={() => onPick(typed)}>
						<Plus aria-hidden className="size-4 text-muted-foreground" />
						<span className="truncate">{options.create.label(typed)}</span>
					</CommandItem>
				) : <CommandEmpty>{options.empty}</CommandEmpty>}
				{options.items.map((item) => (
					<CommandItem key={item.value} value={`${item.label} ${item.value}`} onSelect={() => onPick(item.value)}>
						<span className="min-w-0 flex-1 truncate">{item.label}</span>
						{item.hint ? <span className="shrink-0 text-xs text-muted-foreground">{item.hint}</span> : null}
					</CommandItem>
				))}
			</CommandList>
		</Command>
	);
}
