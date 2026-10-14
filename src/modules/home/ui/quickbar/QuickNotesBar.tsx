// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/quick-note-section.ts
import { SkillButtons } from './SkillButtons';
import { useState } from 'react';
import { useStore } from 'zustand';
import { Settings, Sun } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import { IconButton } from '../board/controls';
import { CaptureBox } from './CaptureBox';
import { QuickNoteConfigDialog } from './QuickNoteConfigDialog';
export function QuickNotesBar({ store }: { store: BoardStore }) {
	const s = useStore(store.state, (state) => state.settings),
		t = useT(),
		[config, setConfig] = useState(false);
	const empty =
		!s.quickDailyEnabled &&
		!s.quickCommands.length &&
		!s.pinnedNotes.length &&
		!s.quickNotePresets.length &&
		!s.quickCaptureEnabled;
	return (
		<>
			<div className="dashboard-quicknote @container flex min-h-[calc(var(--input-height,30px)+12px)] min-w-0 basis-full flex-wrap items-center gap-2 rounded-[var(--db-radius-lg)] border border-[var(--db-border-card)] bg-[var(--db-bg-btn)] px-3 py-1">
				<div className="grid min-w-0 grid-cols-[repeat(5,max-content)] min-h-8 auto-rows-[32px] items-center gap-1.5 overflow-x-auto overflow-y-hidden">
					{s.quickDailyEnabled && (
						<Button
							size="xs"
							variant="secondary"
							className="rounded-full"
							onClick={() => {
								void store.today();
							}}
						>
							<Sun />
							{t('home.dashboard.today')}
						</Button>
					)}
					{s.quickCommands.map((command) => (
						<Button
							key={command.id}
							size="xs"
							variant="secondary"
							className="rounded-full"
							onClick={() => {
								void store.action({
									name: command.label,
									icon: command.icon,
									type: 'command',
									target: command.commandId,
								});
							}}
						>
							<ObsidianIcon name={command.icon} />
							{command.label}
						</Button>
					))}
					{s.pinnedNotes.map((note) => (
						<Button
							key={note.id}
							size="xs"
							variant="secondary"
							className="rounded-full"
							onClick={() => {
								void store.openFile(note.path);
							}}
						>
							<ObsidianIcon name={note.icon} />
							{note.label}
						</Button>
					))}
					{s.quickNotePresets.map((preset) => (
						<Button
							key={preset.id}
							size="xs"
							variant="secondary"
							className="rounded-full"
							onClick={() => {
								void store.newNote(preset.folder, preset.filename || preset.label, preset.templatePath);
							}}
						>
							<ObsidianIcon name={preset.icon} />
							{preset.label}
						</Button>
					))}
					<SkillButtons store={store} />
				</div>
				{empty && <span className="text-xs text-muted-foreground">{t('quickNote.empty')}</span>}
				{s.quickCaptureEnabled && <CaptureBox store={store} />}
				<IconButton label={t('quickNote.config')} className="ml-auto shrink-0" onClick={() => setConfig(true)}>
					<Settings className="size-3" />
				</IconButton>
			</div>
			{config && <QuickNoteConfigDialog store={store} onClose={() => setConfig(false)} />}
		</>
	);
}
