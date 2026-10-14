// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/quick-note-section.ts
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { toast } from 'sonner';
import { Button } from '../../../../ui/components/button';
import { Textarea } from '../../../../ui/components/textarea';
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';
import { useT } from '../../../../ui/react/hooks';
import { useVisible } from '../../../../ui/react/contexts';
import type { BoardStore } from '../../services/board-store';
import { buildSkillContext } from '../../core/skills/context';
import { dispatchSkillShortcut, type SkillDraft } from '../../services/skill-shortcuts';
import { DashboardDialog } from '../dialogs/DashboardDialog';
export function SkillButtons({ store }: { store: BoardStore }) {
	const skills = useStore(store.state, (s) => s.data?.skills),
		t = useT(),
		visible = useVisible(),
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
	useEffect(() => {
		if (!visible) {
			resolver.current?.(null);
			controller.current?.abort();
		}
	}, [visible]);
	const resolve = (value: SkillDraft | null) => {
		resolver.current?.(value);
		resolver.current = null;
		setPreview(null);
	};
	return (
		<>
			{skills?.map((skill) => (
				<Button
					key={skill.id}
					variant="secondary"
					size="xs"
					className="rounded-full"
					disabled={busy}
					onClick={() => {
						setBusy(true);
						const abort = new AbortController();
						controller.current = abort;
						const path = store.state.getState().path + '.md';
						const context = buildSkillContext({
							source: { kind: 'dashboard', path, id: 'quicknote' },
							title: skill.label,
							path: store.state.getState().settings.quickCaptureTarget,
							input: store.captureDraft,
							files: store.state.getState().settings.quickCaptureTarget
								? [store.state.getState().settings.quickCaptureTarget]
								: [],
						});
						void dispatchSkillShortcut(skill, context, {
							dispatch: store.widgets.acquireDispatch ?? (async () => undefined),
							signal: abort.signal,
							notify: (message) => toast(message),
							preview: (_skill, _context, draft) =>
								new Promise((resolveDraft) => {
									resolver.current = resolveDraft;
									setPreview(draft);
								}),
						}).finally(() => {
							setBusy(false);
						});
					}}
				>
					<ObsidianIcon name={skill.icon || 'sparkles'} />
					{skill.label}
				</Button>
			))}
			{visible && preview && (
				<DashboardDialog
					title={t('home.dashboard.skills')}
					onClose={() => resolve(null)}
					onSave={() => resolve(preview)}
				>
					<Textarea
						aria-label={t('home.dashboard.prompt')}
						value={preview.finalPrompt}
						onChange={(e) => setPreview({ ...preview, finalPrompt: e.target.value })}
					/>
				</DashboardDialog>
			)}
		</>
	);
}
