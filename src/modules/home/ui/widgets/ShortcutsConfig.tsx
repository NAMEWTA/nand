import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Textarea } from '../../../../ui/components/textarea';
import { useT } from '../../../../ui/react/hooks';
import { SHORTCUT_TYPES, type ShortcutButton, type ShortcutType } from '../../core/board/shortcut-buttons';
import type { BoardStore } from '../../services/board-store';
import { Choice, IconButton } from '../board/controls';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { DashboardIconPicker } from '../quickbar/DashboardIconPicker';
import { DraftList } from '../quickbar/DraftList';

const ICONS: Record<ShortcutType, string> = {
	file: 'file-text',
	command: 'terminal',
	automation: 'zap',
	quick: 'square-terminal',
	agent: 'bot',
};
const MAX_MATCHES = 8;

/** Targets of a button's type that match the typed text. */
function matches(store: BoardStore, type: ShortcutType, query: string): { id: string; name: string }[] {
	const needle = query.trim().toLowerCase();
	if (type === 'file')
		return store
			.searchFiles(query)
			.slice(0, MAX_MATCHES)
			.map((file) => ({ id: file.path, name: file.path }));
	const all =
		type === 'command'
			? store.commands()
			: type === 'automation'
				? (store.host.automationHost?.actions?.() ?? [])
				: type === 'quick'
					? [...(store.widgets.quickCommands?.()?.list() ?? [])]
					: [];
	return all
		.filter((item) => !needle || item.name.toLowerCase().includes(needle))
		.slice(0, MAX_MATCHES)
		.map((item) => ({ id: item.id, name: item.name }));
}

function TargetField({
	store,
	button,
	onPick,
}: {
	store: BoardStore;
	button: ShortcutButton;
	onPick(this: void, target: { id: string; name: string }): void;
}) {
	const t = useT(),
		[query, setQuery] = useState(''),
		found = query.trim() || button.type !== 'file' ? matches(store, button.type, query) : [];
	return (
		<div className="grid gap-1">
			<Input
				aria-label={t('shortcuts.target')}
				placeholder={button.target || t('shortcuts.target')}
				value={query}
				onChange={(event) => setQuery(event.target.value)}
			/>
			{button.target && <span className="truncate text-xs text-muted-foreground">{button.target}</span>}
			{query.trim() && found.length === 0 && (
				<span className="text-xs text-muted-foreground">{t('shortcuts.noMatch')}</span>
			)}
			{found.length > 0 && (
				<ul className="m-0 grid max-h-40 list-none gap-0.5 overflow-y-auto p-0">
					{found.map((item) => (
						<li key={item.id}>
							<Button
								variant={button.target === item.id ? 'secondary' : 'ghost'}
								className="h-7 w-full justify-start truncate text-xs"
								onClick={() => {
									onPick(item);
									setQuery('');
								}}
							>
								{item.name}
							</Button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

/** Editor of the Shortcuts widget's buttons; nothing is written until Save. */
export function ShortcutsConfig({ store, close }: { store: BoardStore; close(this: void): void }) {
	const t = useT(),
		agents = store.widgets.agents?.() ?? [],
		[draft, setDraft] = useState<ShortcutButton[]>(() =>
			structuredClone(store.state.getState().settings.shortcutButtons),
		),
		[busy, setBusy] = useState(false);
	const update = (id: string, value: Partial<ShortcutButton>) =>
		setDraft(draft.map((button) => (button.id === id ? { ...button, ...value } : button)));
	return (
		<DashboardDialog
			wide
			title={t('shortcuts.title')}
			busy={busy}
			onClose={close}
			onSave={() => {
				if (busy) return;
				setBusy(true);
				const kept = draft
					.map((button) => ({ ...button, label: button.label.trim() }))
					.filter((button) => button.label || button.target);
				void store
					.settings((settings) => {
						settings.shortcutButtons = kept;
					})
					.then(close)
					.catch(() => toast(t('shortcuts.saveFailed')))
					.finally(() => setBusy(false));
			}}
		>
			<DraftList items={draft} onChange={setDraft}>
				{(button) => (
					<div className="grid gap-2 rounded-md border p-2" data-shortcut-row={button.id}>
						<div className="flex gap-2">
							<DashboardIconPicker value={button.icon} onChange={(icon) => update(button.id, { icon })} />
							<Input
								aria-label={t('shortcuts.label')}
								placeholder={t('shortcuts.label')}
								value={button.label}
								onChange={(event) => update(button.id, { label: event.target.value })}
							/>
							<IconButton
								label={t('common.delete')}
								onClick={() => setDraft(draft.filter((item) => item.id !== button.id))}
							>
								<Trash2 />
							</IconButton>
						</div>
						<Choice
							label={t('shortcuts.type')}
							value={button.type}
							onChange={(type) =>
								update(button.id, {
									type: type as ShortcutType,
									target: '',
									icon: ICONS[button.type] === button.icon ? ICONS[type as ShortcutType] : button.icon,
									...(type === 'agent' ? { agentId: button.agentId ?? '', prompt: button.prompt ?? '' } : {}),
								})
							}
							options={SHORTCUT_TYPES.map((type) => ({ value: type, label: t(`shortcuts.type.${type}`) }))}
						/>
						{button.type === 'agent' ? (
							<>
								<Choice
									label={t('shortcuts.agent')}
									value={button.agentId || '_none'}
									onChange={(value) => update(button.id, { agentId: value === '_none' ? '' : value })}
									options={[
										{ value: '_none', label: t('shortcuts.agent') },
										...agents.map((agent) => ({ value: agent.id, label: agent.title })),
									]}
								/>
								<Textarea
									aria-label={t('shortcuts.prompt')}
									placeholder={t('shortcuts.prompt')}
									value={button.prompt ?? ''}
									onChange={(event) => update(button.id, { prompt: event.target.value })}
								/>
							</>
						) : (
							<TargetField
								store={store}
								button={button}
								onPick={(item) =>
									update(button.id, { target: item.id, label: button.label || item.name.replace(/\.md$/, '').split('/').pop()! })
								}
							/>
						)}
					</div>
				)}
			</DraftList>
			<Button
				variant="outline"
				size="sm"
				onClick={() =>
					setDraft([
						...draft,
						{ id: crypto.randomUUID(), label: '', icon: ICONS.command, type: 'command', target: '' },
					])
				}
			>
				{t('shortcuts.add')}
			</Button>
		</DashboardDialog>
	);
}
