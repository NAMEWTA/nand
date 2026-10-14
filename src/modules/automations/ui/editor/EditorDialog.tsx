// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationEditorDialog.tsx, AutomationEditorDialogHeader.tsx, AutomationEditorDialogFooter.tsx
import { useTransient } from '../use-transient';
import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../../ui/components/dialog';
import { Input } from '../../../../ui/components/input';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import type { AutomationEditRequest } from '../../core/api';
import type { AutomationTemplate } from '../../core/templates';
import type { AutomationViewHost } from '../panel-contract';
import type { AutomationDefinition } from '../../../../shared/automation/types';
import { newDraft, draftError } from './draft';
import { ContentPane } from './ContentPane';
import { SettingsSidebar } from './SettingsSidebar';

export function EditorDialog({
	request,
	template,
	host,
	onClose,
}: {
	request: AutomationEditRequest;
	template?: AutomationTemplate;
	host: AutomationViewHost;
	onClose: (saved?: AutomationDefinition) => void;
}) {
	const t = useT(),
		layer = useTransient();
	const [draft, setDraft] = useState(() =>
		newDraft(request, host.service.deviceId, host.cwd ?? '', host.service.agent()?.listAgents() ?? [], template),
	);
	const [saving, setSaving] = useState(false),
		[error, setError] = useState('');
	const lock = useRef(false),
		content = useRef<HTMLDivElement>(null),
		name = useRef<HTMLInputElement>(null);
	const validation = draftError(draft, host.service.agent()?.listAgents() ?? [], host.cwd ?? '', request.existing);
	const onChange = (change: (draft: AutomationDefinition) => void) => {
		setDraft((current) => {
			const next = structuredClone(current);
			change(next);
			return next;
		});
		setError('');
	};
	const save = async (run = false) => {
		if (lock.current) return;
		lock.current = true;
		setSaving(true);
		setError('');
		try {
			const invalid = draftError(
				draft,
				host.service.agent()?.listAgents() ?? [],
				host.cwd ?? '',
				request.existing,
			);
			if (invalid) throw new Error(invalid);
			if (draft.action.kind === 'create-task') {
				const action = draft.action;
				if (
					!(await host.taskTargets?.())?.some(
						(row) => row.path === action.path && row.cardId === action.cardId,
					)
				)
					throw new Error(t('automation.targetRequired'));
			}
			await host.service.save(draft);
			const saved = host.service.definitions.find((row) => row.id === draft.id) ?? draft;
			if (run) await host.service.run(saved);
			onClose(saved);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			lock.current = false;
			setSaving(false);
		}
	};
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !saving) onClose();
			}}
		>
			<DialogContent
				ref={content}
				onCloseAutoFocus={layer.onCloseAutoFocus}
				className="flex h-[min(880px,90vh)] w-[min(1080px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1080px]"
				aria-describedby={undefined}
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					(request.existing
						? (content.current?.querySelector<HTMLElement>('[data-content-editor]') ?? name.current)
						: name.current
					)?.focus();
				}}
				onKeyDown={(event) => {
					if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) {
						event.preventDefault();
						if (!validation) void save();
					}
				}}
			>
				<DialogHeader className="flex-row items-center justify-between gap-3 border-b border-border/50 px-5 py-2.5 pr-12 text-left">
					<DialogTitle className="sr-only">
						{t(request.existing ? 'automation.editTitle' : 'automation.new')}
					</DialogTitle>
					<div className="min-w-0 flex-1">
						<Input
							ref={name}
							aria-label={t('automation.name')}
							placeholder={t('automation.name')}
							value={draft.name}
							aria-invalid={!draft.name.trim()}
							onChange={(e) =>
								onChange((d) => {
									d.name = e.target.value;
								})
							}
							className="min-w-0 border-0 bg-transparent px-0 text-lg font-semibold shadow-none"
						/>
						{!draft.name.trim() && (
							<p className="mt-1 text-xs text-destructive">{t('automation.nameRequired')}</p>
						)}
					</div>
				</DialogHeader>
				<div className="flex min-h-0 flex-1 flex-row max-[760px]:flex-col max-[760px]:overflow-y-auto">
					<ContentPane draft={draft} onChange={onChange} host={host} />
					<SettingsSidebar draft={draft} onChange={onChange} host={host} />
				</div>
				{(error || validation) && (
					<p role={error ? 'alert' : 'status'} className="mx-5 my-2 text-xs text-destructive">
						{error || validation}
					</p>
				)}
				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 px-5 py-3">
					<p className="min-w-0 text-xs text-muted-foreground">{t('automation.localOnly')}</p>
					<div className="flex shrink-0 justify-end gap-2">
						<Button variant="ghost" disabled={saving} onClick={() => onClose()}>
							{t('automation.cancel')}
						</Button>
						{
							<Button
								variant="outline"
								disabled={saving || !!validation}
								onClick={() => {
									void save(true);
								}}
							>
								{t('automation.saveAndRun')}
							</Button>
						}
						<Button
							disabled={saving || !!validation}
							onClick={() => {
								void save();
							}}
						>
							{t(request.existing ? 'automation.save' : 'automation.create')}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
