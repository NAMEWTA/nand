import { observeBoardAction } from '../board/actions';
// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/quick-note-config-modal.ts
import { DraftList } from './DraftList';
import { SkillList } from './SkillList';
import type { SkillShortcut } from '../../core/board/types/model';
import { useState } from 'react';
import { Plus, Trash2, ArrowUp } from 'lucide-react';
import { Input } from '../../../../ui/components/input';
import { Label } from '../../../../ui/components/label';
import { Button } from '../../../../ui/components/button';
import { Switch } from '../../../../ui/components/switch';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import type { DashboardSettings } from '../../core/board/types/model';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { Choice, IconButton } from '../board/controls';
import { DashboardIconPicker } from './DashboardIconPicker';
export function QuickNoteConfigDialog({ store, onClose }: { store: BoardStore; onClose(this: void): void }) {
	const [skills, setSkills] = useState<SkillShortcut[]>(() =>
		structuredClone(store.state.getState().data?.skills ?? []),
	);
	const t = useT(),
		[draft, setDraft] = useState<DashboardSettings>(() => structuredClone(store.state.getState().settings));
	return (
		<DashboardDialog
			wide
			title={t('quickNote.configTitle')}
			onClose={onClose}
			onSave={() => {
				void observeBoardAction(store
					.settings((s) => {
						s.quickNotesEnabled = true;
						s.pinnedNotes = draft.pinnedNotes;
						s.quickCommands = draft.quickCommands;
						s.quickNotePresets = draft.quickNotePresets;
						s.quickDailyEnabled = draft.quickDailyEnabled;
						s.quickCaptureEnabled = draft.quickCaptureEnabled;
						s.quickCaptureMode = draft.quickCaptureMode;
						s.quickCaptureTarget = draft.quickCaptureTarget;
						s.quickCaptureFolder = draft.quickCaptureFolder;
						s.quickCaptureTemplate = draft.quickCaptureTemplate;
						s.quickCapturePosition = draft.quickCapturePosition;
					})
					.then(() =>
						store.edit((data) => {
							data.skills = skills;
						}),
					)
					.then(onClose));
			}}
		>
			{(['quickNotePresets', 'pinnedNotes', 'quickCommands'] as const).map((key) => (
				<section key={key} className="grid gap-2">
					<h3 className="text-sm font-semibold">
						{t(
							key === 'quickNotePresets'
								? 'quickNote.presets'
								: key === 'pinnedNotes'
									? 'quickNote.pinned'
									: 'quickNote.commands',
						)}
					</h3>
					<DraftList
						items={draft[key] as Array<{ id: string; icon: string; label: string }>}
						onChange={(items) => setDraft({ ...draft, [key]: items })}
					>
						{(row, i) => (
							<div key={row.id} className="flex flex-wrap items-center gap-2">
								<DashboardIconPicker
									value={row.icon}
									onChange={(icon) =>
										setDraft({
											...draft,
											[key]: draft[key].map((item, n) => (n === i ? { ...item, icon } : item)),
										})
									}
								/>
								<Input
									className="w-32"
									aria-label={t('home.dashboard.name')}
									value={row.label}
									onChange={(e) =>
										setDraft({
											...draft,
											[key]: draft[key].map((item, n) =>
												n === i ? { ...item, label: e.target.value } : item,
											),
										})
									}
								/>
								{Object.entries(row)
									.filter(([field]) => !['id', 'label', 'icon'].includes(field))
									.map(([field, value]) => (
										<Input
											key={field}
											className="min-w-24 flex-1"
											aria-label={t(`home.dashboard.${field}`)}
											placeholder={t(`home.dashboard.${field}`)}
											value={String(value)}
											onChange={(e) =>
												setDraft({
													...draft,
													[key]: draft[key].map((item, n) =>
														n === i ? { ...item, [field]: e.target.value } : item,
													),
												})
											}
										/>
									))}
								<IconButton
									label={t('workspace.moveUp')}
									disabled={!i}
									onClick={() => {
										const rows = [...draft[key]],
											item = rows.splice(i, 1)[0]!;
										rows.splice(i - 1, 0, item);
										setDraft({ ...draft, [key]: rows });
									}}
								>
									<ArrowUp />
								</IconButton>
								<IconButton
									label={t('common.delete')}
									onClick={() => setDraft({ ...draft, [key]: draft[key].filter((_, n) => n !== i) })}
								>
									<Trash2 />
								</IconButton>
							</div>
						)}
					</DraftList>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							const row = {
								id: crypto.randomUUID(),
								icon: 'file-text',
								label: '',
								...(key === 'pinnedNotes'
									? { path: '' }
									: key === 'quickCommands'
										? { commandId: '' }
										: { templatePath: '', folder: '', filename: '{{date:YYYY-MM-DD}}' }),
							};
							setDraft({ ...draft, [key]: [...draft[key], row] });
						}}
					>
						<Plus />
						{t('common.add')}
					</Button>
				</section>
			))}
			<SkillList store={store} skills={skills} onChange={setSkills} />
			<Label className="flex items-center gap-2">
				<Switch
					checked={draft.quickDailyEnabled}
					onCheckedChange={(checked) => setDraft({ ...draft, quickDailyEnabled: checked })}
				/>
				{t('home.dashboard.today')}
			</Label>
			<Label className="flex items-center gap-2">
				<Switch
					checked={draft.quickCaptureEnabled}
					onCheckedChange={(checked) => setDraft({ ...draft, quickCaptureEnabled: checked })}
				/>
				{t('quickNote.captureEnable')}
			</Label>
			<Choice
				label={t('home.dashboard.mode')}
				value={draft.quickCaptureMode}
				onChange={(value) => setDraft({ ...draft, quickCaptureMode: value as 'capture' | 'search' })}
				options={[
					{ value: 'capture', label: t('home.dashboard.capture') },
					{ value: 'search', label: t('home.dashboard.findNote') },
				]}
			/>
			{(['quickCaptureTarget', 'quickCaptureFolder', 'quickCaptureTemplate'] as const).map((key) => (
				<Label key={key}>
					{t(`home.dashboard.${key}`)}
					<Input value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
				</Label>
			))}
			<Choice
				label={t('quickNote.capturePosition')}
				value={draft.quickCapturePosition}
				onChange={(value) => setDraft({ ...draft, quickCapturePosition: value as 'start' | 'end' })}
				options={['start', 'end'].map((value) => ({ value, label: t(`home.dashboard.${value}`) }))}
			/>
		</DashboardDialog>
	);
}
