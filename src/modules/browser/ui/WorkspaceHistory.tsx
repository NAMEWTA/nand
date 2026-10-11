import { useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import { TextField } from '../../../ui/primitives/TextField';
import { promptText } from '../../../ui/primitives/prompt';
import { searchTasks, type TaskDocuments } from '../core/workspace/history';
import type { BrowserModule } from '../services';
import type { Workspace } from '../services/workspace';

export function WorkspaceHistory({ workspace, module, disabled, run }: {
	workspace: Workspace; module: BrowserModule; disabled: boolean; run: (action: () => Promise<unknown>) => void;
}) {
	const [query, setQuery] = useState(''), [removing, setRemoving] = useState<TaskDocuments>();
	const tasks = searchTasks(workspace.data(), query);
	return <section class="nand-browser-workspace-history nand-browser-workspace-task-list">
		<h3>{t('browser.workspace.history')}</h3>
		<TextField label={t('browser.workspace.historySearch')} value={query} onInput={setQuery} />
		{tasks.map(task => <section key={task.id} class="nand-browser-workspace-target">
			<div class="nand-browser-workspace-actions">
				<Button variant="ghost" onClick={event => { const win = event.currentTarget.win; run(() => module.openWorkspace(task.id, win)); }}>{task.title}</Button>
				<Button disabled={disabled || workspace.busy(task.id)} onClick={() => run(async () => {
					const title = await promptText(module.app, { title: t('browser.workspace.historyRename'), label: t('browser.workspace.taskTitle'), value: task.title });
					if (title) await workspace.updateTask(task.id, { title });
				})}>{t('browser.workspace.historyRename')}</Button>
				<Button disabled={disabled || workspace.busy(task.id)} onClick={() => run(() => workspace.updateTask(task.id, { pinned: !task.pinned }))}>
					{t(task.pinned ? 'browser.workspace.unpin' : 'browser.workspace.pin')}</Button>
				<Button variant="danger" disabled={disabled || workspace.busy(task.id)} onClick={() => run(async () => setRemoving(await workspace.reviewDeleteTask(task.id)))}>{t('browser.workspace.historyDelete')}</Button>
			</div>
		</section>)}
		{!tasks.length && <p>{t('browser.workspace.historyEmpty')}</p>}
		{removing && <section class="nand-browser-workspace-preview">
			<h4>{removing.task.title}</h4>
			<p>{t('browser.workspace.historyDeleteScope', { rounds: removing.turns.length, answers: removing.exchanges.length })}</p>
			<ul><li>{t('browser.workspace.historyTaskDocument', { title: removing.task.title })}</li>
				{removing.turns.map(turn => <li key={turn.id}>{t('browser.workspace.turn', { sequence: turn.sequence })}
					<ul>{turn.targets.filter(target => removing.exchanges.some(exchange => exchange.turnId === turn.id && exchange.targetId === target.id)).map(target =>
						<li key={target.id}>{t('browser.workspace.target', { provider: t('browser.workspace.provider.' + target.provider), account: target.accountLabel })}</li>)}</ul>
				</li>)}
			</ul>
			<div class="nand-browser-workspace-actions">
				<Button variant="danger" disabled={disabled} onClick={() => run(async () => { await workspace.deleteTask(removing); setRemoving(undefined); })}>{t('browser.workspace.historyDeleteConfirm')}</Button>
				<Button disabled={disabled} onClick={() => setRemoving(undefined)}>{t('browser.workspace.promptCancel')}</Button>
			</div>
		</section>}
	</section>;
}
