// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/renderer.ts, src/countdown-modal.ts
import { useState } from 'react';
import { useStore } from 'zustand';
import { Plus, Settings } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Label } from '../../../../ui/components/label';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import type { CountdownConfig } from '../../core/board/types/model';
import { useClock, useImage } from '../board/hooks';
import { IconButton, Choice } from '../board/controls';
import { DashboardDialog } from '../dialogs/DashboardDialog';
function CountdownBackground({
	store,
	entry,
	children,
}: {
	store: BoardStore;
	entry: CountdownConfig;
	children: import('react').ReactNode;
}) {
	const image = useImage(store, entry.background?.image ?? '');
	return (
		<div className="relative isolate overflow-hidden rounded-[var(--db-radius-md)] p-2">
			<div
				aria-hidden
				className="absolute inset-0 -z-[var(--layer-content)] bg-cover bg-center"
				style={{
					backgroundImage: image ? `url(${JSON.stringify(image)})` : undefined,
					opacity: (entry.background?.opacity ?? 100) / 100,
					filter: `blur(${entry.background?.blur ?? 0}px)`,
				}}
			/>
			{children}
		</div>
	);
}
export function CountdownWidget({ store }: { store: BoardStore }) {
	const entries = useStore(store.state, (s) => s.settings.countdowns),
		now = useClock(),
		t = useT(),
		[draft, setDraft] = useState<CountdownConfig | null>(null);
	return (
		<>
			<div className="grid gap-2">
				{entries.map((entry) => {
					const unit =
							entry.displayMode === 'days' ? 86400000 : entry.displayMode === 'hours' ? 3600000 : 60000,
						remaining = Math.max(0, Math.ceil((new Date(entry.targetDate).getTime() - now) / unit));
					return (
						<CountdownBackground key={entry.id} store={store} entry={entry}>
							<div className="flex items-center justify-between gap-1">
								<div>
									<div className="text-xs">{entry.label}</div>
									<span className="text-2xl font-light tabular-nums">{remaining}</span>
									<span className="ml-1 text-[.65em] text-muted-foreground">
										{t(`home.dashboard.${entry.displayMode}`)}
									</span>
								</div>
								<IconButton label={t('home.dashboard.settings')} onClick={() => setDraft({ ...entry })}>
									<Settings className="size-3" />
								</IconButton>
							</div>
						</CountdownBackground>
					);
				})}
				<Button
					variant="ghost"
					size="xs"
					onClick={() =>
						setDraft({
							id: crypto.randomUUID(),
							label: '',
							targetDate: '',
							displayMode: 'days',
							reminderDays: 0,
						})
					}
				>
					<Plus />
					{t('common.add')}
				</Button>
			</div>
			{draft && (
				<DashboardDialog
					title={t('home.dashboard.widget.countdown')}
					onClose={() => setDraft(null)}
					onSave={() => {
						if (!draft.targetDate || !draft.label.trim()) return;
						void store
							.settings((s) => {
								s.countdowns = [...s.countdowns.filter((c) => c.id !== draft.id), draft];
							})
							.then(() => setDraft(null));
					}}
				>
					<Input
						value={draft.label}
						aria-label={t('home.dashboard.name')}
						onChange={(e) => setDraft({ ...draft, label: e.target.value })}
					/>
					<Input
						type="datetime-local"
						value={draft.targetDate}
						aria-label={t('home.dashboard.date')}
						onChange={(e) => setDraft({ ...draft, targetDate: e.target.value })}
					/>
					<Label>
						{t('home.dashboard.image')}
						<Input
							value={draft.background?.image ?? ''}
							onChange={(e) =>
								setDraft({
									...draft,
									background: {
										opacity: 100,
										dim: 30,
										blur: 0,
										...draft.background,
										image: e.target.value,
									},
								})
							}
						/>
					</Label>
					<Choice
						label={t('home.dashboard.mode')}
						value={draft.displayMode}
						onChange={(value) =>
							setDraft({ ...draft, displayMode: value as CountdownConfig['displayMode'] })
						}
						options={['days', 'hours', 'minutes'].map((value) => ({
							value,
							label: t(`home.dashboard.${value}`),
						}))}
					/>
					<Label>
						{t('home.dashboard.reminderDays')}
						<Input
							type="number"
							min={0}
							value={draft.reminderDays}
							onChange={(e) => setDraft({ ...draft, reminderDays: +e.target.value })}
						/>
					</Label>
					<Button
						variant="destructive"
						onClick={() => {
							void store
								.settings((s) => {
									s.countdowns = s.countdowns.filter((c) => c.id !== draft.id);
								})
								.then(() => setDraft(null));
						}}
					>
						{t('common.delete')}
					</Button>
				</DashboardDialog>
			)}
		</>
	);
}
