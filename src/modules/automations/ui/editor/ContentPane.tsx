// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationEditorPromptSection.tsx
import { useEffect, useState } from 'react';
import { Textarea } from '../../../../ui/components/textarea';
import { Input } from '../../../../ui/components/input';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import { actionText, setActionText } from '../../core/switch-action';
import type { AutomationViewHost, TaskTarget } from '../panel-contract';
import { Field, SearchChoice } from '../parts';
import type { DraftProps } from './SchedulePicker';
export function ContentPane({ draft, onChange, host }: DraftProps & { host: AutomationViewHost }) {
	const t = useT(),
		action = draft.action;
	const [targets, setTargets] = useState<TaskTarget[]>([]),
		[error, setError] = useState('');
	useEffect(() => {
		if (action.kind !== 'create-task') return;
		let cancelled = false;
		void (host.taskTargets?.() ?? Promise.resolve([])).then(
			(rows) => {
				if (!cancelled) setTargets(rows);
			},
			(e) => {
				if (!cancelled) setError(String(e));
			},
		);
		return () => {
			cancelled = true;
		};
	}, [host, action.kind]);
	const setText = (text: string) => onChange((d) => setActionText(d.action, text));
	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-5 max-[760px]:min-h-64 max-[760px]:shrink-0">
			{action.kind === 'create-task' && (
				<div className="mb-4 space-y-4">
					<Field label={t('automation.board')}>
						{(id) => (
							<SearchChoice
								id={id}
								label={t('automation.board')}
								clearable
								value={action.path}
								options={[...new Set(targets.map((target) => target.path))].map((value) => ({
									value,
									label: value,
								}))}
								onChange={(value) =>
									onChange((d) => {
										if (d.action.kind === 'create-task') {
											d.action.path = value;
											d.action.cardId = '';
										}
									})
								}
							/>
						)}
					</Field>
					<Field label={t('automation.card')}>
						{(id) => (
							<SearchChoice
								id={id}
								label={t('automation.card')}
								clearable
								value={action.cardId}
								options={targets
									.filter((target) => target.path === action.path)
									.map((target) => ({ value: target.cardId, label: target.title }))}
								onChange={(value) =>
									onChange((d) => {
										if (d.action.kind === 'create-task') d.action.cardId = value;
									})
								}
							/>
						)}
					</Field>
					{!targets.length && (
						<p className="text-xs text-muted-foreground">{t('automation.noTaskTargets')}</p>
					)}
					{error && <p role="alert">{error}</p>}
				</div>
			)}
			{action.kind === 'obsidian-command' ? (
				<Field label={t('automation.obsidian-command')}>
					{(id) => (
						<SearchChoice
							id={id}
							label={t('automation.obsidian-command')}
							value={action.command}
							options={host.commands().map((command) => ({ value: command.id, label: command.name }))}
							onChange={setText}
						/>
					)}
				</Field>
			) : action.kind === 'open-file' ? (
				<Field label={t('automation.open-file')}>
					{(id) => (
						<SearchChoice
							id={id}
							label={t('automation.open-file')}
							value={action.path}
							options={host
								.paths()
								.filter((item) => item.kind === 'file')
								.map((item) => ({ value: item.path, label: item.path }))}
							onChange={setText}
						/>
					)}
				</Field>
			) : action.kind === 'open-url' ? (
				<Field label={t('automation.open-url')}>
					{(id) => <Input id={id} type="url" value={action.url} onChange={(e) => setText(e.target.value)} />}
				</Field>
			) : (
				<>
					<div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
						{t(action.kind === 'script' ? 'automation.script' : 'automation.prompt')}
					</div>
					<Textarea
						data-content-editor
						aria-label={t('automation.prompt')}
						disabled={draft.source?.kind === 'widget'}
						value={actionText(action)}
						onChange={(e) => setText(e.target.value)}
						className="min-h-48 flex-1 resize-none bg-background font-mono text-sm"
						onKeyDown={(event) => {
							if (event.key === 'Tab' && action.kind === 'script' && !event.shiftKey) {
								event.preventDefault();
								const input = event.currentTarget,
									start = input.selectionStart;
								setText(input.value.slice(0, start) + '  ' + input.value.slice(input.selectionEnd));
								input.ownerDocument.defaultView?.requestAnimationFrame(() =>
									input.setSelectionRange(start + 2, start + 2),
								);
							}
						}}
					/>
				</>
			)}
			{!actionText(action).trim() && (
				<p className="mt-2 text-xs text-destructive">{t('automation.contentRequired')}</p>
			)}
			{action.kind === 'agent' && (
				<div className="mt-3 space-y-3">
					<p className="text-xs text-muted-foreground">{t('automation.variables')}</p>
					<div className="flex flex-wrap gap-2">
						{['date', 'time', 'vault', 'folder'].map((variable) => (
							<Button
								key={variable}
								variant="outline"
								size="xs"
								className="font-mono"
								onClick={() => setText(action.prompt + `{{${variable}}}`)}
							>{`{{${variable}}}`}</Button>
						))}
					</div>
					<SearchChoice
						label={t('automation.insertNote')}
						value=""
						options={host
							.paths()
							.filter((item) => item.kind === 'file')
							.map((item) => ({ value: item.path, label: item.path }))}
						onChange={(path) =>
							setText(
								`${action.prompt}\n[[${path.replace(/\.md$/, '')}]] ${host.cwd ? `${host.cwd}/` : ''}${path}`,
							)
						}
					/>
				</div>
			)}
		</div>
	);
}
