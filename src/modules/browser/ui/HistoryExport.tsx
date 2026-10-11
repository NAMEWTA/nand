import { useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import { workspaceMarkdown, type MarkdownScope } from '../core/workspace/markdown-export';
import type { BrowserModule } from '../services';
import type { Workspace } from '../services/workspace';
import type { CopyAnswer } from './WorkspaceAnswers';

export function HistoryExport({ workspace, module, taskId, disabled, run, copy }: {
	workspace: Workspace; module: BrowserModule; taskId?: string; disabled: boolean; run: (action: () => Promise<unknown>) => void; copy: CopyAnswer;
}) {
	const data = workspace.data();
	const targetsFor = (ids: readonly string[]) => [...new Map([
		...data.tasks.filter(task => ids.includes(task.id)).flatMap(task => task.targets),
		...data.turns.filter(turn => ids.includes(turn.taskId)).flatMap(turn => turn.targets),
	].map(target => [target.id, target])).values()];
	const [scope, setScope] = useState<MarkdownScope>(() => ({ taskIds: taskId ? [taskId] : [], targetIds: taskId ? targetsFor([taskId]).map(target => target.id) : [], rounds: 'all' }));
	const [markdown, setMarkdown] = useState<string>(), [saved, setSaved] = useState(''), [copied, setCopied] = useState(false);
	const change = (next: MarkdownScope) => { setScope(next); setMarkdown(undefined); setSaved(''); setCopied(false); };
	return <details class="nand-browser-workspace-export">
		<summary>{t('browser.workspace.export')}</summary>
		<p>{t('browser.workspace.exportScope')}</p>
		<div class="nand-browser-workspace-actions">{data.tasks.map(task => <label key={task.id}>
			<input type="checkbox" checked={scope.taskIds.includes(task.id)} disabled={disabled} onChange={event => {
				const taskIds = event.currentTarget.checked ? [...scope.taskIds, task.id] : scope.taskIds.filter(id => id !== task.id);
				change({ ...scope, taskIds, targetIds: targetsFor(taskIds).map(target => target.id) });
			}} />{task.title}
		</label>)}</div>
		<div class="nand-browser-workspace-actions">{targetsFor(scope.taskIds).map(target => <label key={target.id}>
			<input type="checkbox" checked={scope.targetIds.includes(target.id)} disabled={disabled} onChange={event => change({ ...scope,
				targetIds: event.currentTarget.checked ? [...scope.targetIds, target.id] : scope.targetIds.filter(id => id !== target.id),
			})} />{data.tasks.find(task => scope.taskIds.includes(task.id) && (task.targets.some(row => row.id === target.id)
				|| data.turns.some(turn => turn.taskId === task.id && turn.targets.some(row => row.id === target.id))))?.title} · {t('browser.workspace.target', { provider: t('browser.workspace.provider.' + target.provider), account: target.accountLabel })}
		</label>)}</div>
		<label class="nand-field"><span class="nand-field-label">{t('browser.workspace.exportRounds')}</span>
			<select value={scope.rounds} disabled={disabled} onChange={event => change({ ...scope, rounds: event.currentTarget.value as MarkdownScope['rounds'] })}>
				<option value="all">{t('browser.workspace.exportAllRounds')}</option><option value="latest">{t('browser.workspace.exportLatest')}</option>
			</select>
		</label>
		<Button disabled={disabled || !scope.taskIds.length || !scope.targetIds.length} onClick={() => run(() => {
			setMarkdown(workspaceMarkdown(workspace.data(), scope, {
				question: t('browser.workspace.question'), prompt: t('browser.workspace.finalPrompt'), complete: t('browser.workspace.acquire.complete'), incomplete: t('browser.workspace.acquire.incomplete'),
				noAnswer: t('browser.workspace.recoveryNoAnswer'), noRounds: t('browser.workspace.exportNoRounds'), imported: t('browser.workspace.importedSource'),
				round: sequence => t('browser.workspace.turn', { sequence }), provider: id => t('browser.workspace.provider.' + id), source: id => t('browser.workspace.source.' + id),
			})); setCopied(false); setSaved(''); return Promise.resolve();
		})}>{t('browser.workspace.exportPreview')}</Button>
		{markdown !== undefined && <section class="nand-browser-workspace-preview">
			<p>{t('browser.workspace.exportFrozen')}</p>
			<label class="nand-field"><span class="nand-field-label">{t('browser.workspace.exportPreview')}</span><textarea class="nand-input" readOnly rows={10} value={markdown} /></label>
			<div class="nand-browser-workspace-actions">
				<Button disabled={disabled} onClick={event => { const win = event.currentTarget.win; run(async () => { await copy(markdown, win); setCopied(true); }); }}>{t('browser.workspace.exportCopy')}</Button>
				<Button disabled={disabled} onClick={() => run(async () => setSaved(await module.exportWorkspace(markdown, 'md')))}>{t('browser.workspace.exportSave')}</Button>
			</div>
			{copied && <p role="status">{t('browser.workspace.exportCopied')}</p>}
			{saved && <p role="status">{t('browser.workspace.exportSaved', { path: saved })}</p>}
		</section>}
	</details>;
}
