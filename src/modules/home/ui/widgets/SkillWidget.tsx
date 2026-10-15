// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/skill-widget.ts, src/skill-widget-config-modal.ts
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { toast } from 'sonner';
import { Textarea } from '../../../../ui/components/textarea';
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';
import { useVisible } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import type { SkillShortcut } from '../../core/board/types/model';
import { buildSkillContext } from '../../core/skills/context';
import { dispatchSkillShortcut, type SkillDraft } from '../../services/skill-shortcuts';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { RecordButton } from '../dialogs/RecordButton';
import { SkillList } from '../quickbar/SkillList';
import { inputWidgetClasses as css } from '../theme/input-widget-classes';

function SkillConfig({ store, close }: { store: BoardStore; close(this: void): void }) {
	const t = useT(),
		[draft, setDraft] = useState(() => structuredClone(store.state.getState().settings.skillWidgetButtons)),
		[busy, setBusy] = useState(false);
	return (
		<DashboardDialog
			title={t('skillsWidget.cfgTitle')}
			onClose={close}
			busy={busy}
			onSave={() => {
				if (busy) return;
				setBusy(true);
				void store
					.settings((settings) => {
						settings.skillWidgetButtons = draft
							.filter((s) => s.label.trim())
							.map((s) => ({ ...s, label: s.label.trim() }));
					})
					.then(close)
					.catch(() => toast(t('storage.unsaved')))
					.finally(() => setBusy(false));
			}}
		>
			<SkillList store={store} skills={draft} onChange={setDraft} />
		</DashboardDialog>
	);
}
function SkillWidgetBody({ store }: { store: BoardStore }) {
	const buttons = useStore(store.state, (state) => state.settings.skillWidgetButtons).filter((s) => s.label.trim()),
		t = useT(),
		visible = useVisible();
	const [config, setConfig] = useState(false),
		[preview, setPreview] = useState<SkillDraft | null>(null),
		[busy, setBusy] = useState(false);
	const resolver = useRef<((value: SkillDraft | null) => void) | null>(null),
		controller = useRef<AbortController | null>(null);
	useEffect(
		() => () => {
			resolver.current?.(null);
			controller.current?.abort();
		},
		[],
	);

	const resolve = (draft: SkillDraft | null) => {
		resolver.current?.(draft);
		resolver.current = null;
		setPreview(null);
	};
	const run = (skill: SkillShortcut) => {
		if (controller.current && !controller.current.signal.aborted) return;
		const abort = new AbortController();
		controller.current = abort;
		setBusy(true);
		const path = store.state.getState().path + '.md';
		void dispatchSkillShortcut(
			skill,
			buildSkillContext({ source: { kind: 'widget', path, id: 'skills' }, title: skill.label, input: '' }),
			{
				dispatch: store.widgets.acquireDispatch ?? (async () => undefined),
				signal: abort.signal,
				notify: (message) => toast(message),
				preview: (_skill, _context, draft) =>
					new Promise((done) => {
						resolver.current = done;
						setPreview(draft);
					}),
			},
		).finally(() => {
			if (controller.current === abort) controller.current = null;
			if (!abort.signal.aborted) setBusy(false);
		});
	};
	const keys = [...buttons, null],
		rows = Array.from({ length: Math.ceil(keys.length / 5) }, (_, i) => keys.slice(i * 5, i * 5 + 5));
	return (
		<>
			{rows.map((row, rowIndex) => (
				<div key={rowIndex} className={css('dashboard-skills-row')}>
					{row.map((skill, index) =>
						skill ? (
							<RecordButton
								key={skill.id}
								disabled={busy}
								className={css('dashboard-skills-orb')}
								style={
									{
										'--orb': `var(--db-skill-key-${((rowIndex * 5 + index) % 6) + 1})`,
									} as CSSProperties
								}
								aria-label={skill.label}
								onClick={() => run(skill)}
							>
								<ObsidianIcon name={skill.icon || 'sparkles'} />
							</RecordButton>
						) : (
							<RecordButton
								key="config"
								className={css('dashboard-skills-orb dashboard-skills-orb--cog')}
								aria-label={t('skillsWidget.configure')}
								onClick={() => setConfig(true)}
							>
								<ObsidianIcon name="settings" />
							</RecordButton>
						),
					)}
				</div>
			))}
			{visible && config && <SkillConfig store={store} close={() => setConfig(false)} />}
			{visible && preview && (
				<DashboardDialog
					title={t('home.dashboard.skills')}
					onClose={() => resolve(null)}
					onSave={() => resolve(preview)}
				>
					<Textarea
						aria-label={t('home.dashboard.prompt')}
						value={preview.finalPrompt}
						onChange={(event) => setPreview({ ...preview, finalPrompt: event.target.value })}
					/>
				</DashboardDialog>
			)}
		</>
	);
}

export function SkillWidget({ store }: { store: BoardStore }) {
	return useVisible() ? <SkillWidgetBody store={store} /> : null;
}
