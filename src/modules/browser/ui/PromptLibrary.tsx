import { useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import { TextField } from '../../../ui/primitives/TextField';
import type { PromptTemplate } from '../core/workspace/model';
import type { Workspace } from '../services/workspace';
import { Answer, type MountMarkdown } from './WorkspaceAnswers';

/** Template edits are local commands; only a separate reviewed send can contact a website. */
export function PromptLibrary({ workspace, taskId, disabled, run, changed, mount }: {
	workspace: Workspace; taskId?: string; disabled: boolean; run: (action: () => Promise<unknown>) => void;
	changed: () => void; mount: MountMarkdown;
}) {
	const [editing, setEditing] = useState<PromptTemplate | 'new'>(), [title, setTitle] = useState(''), [body, setBody] = useState('');
	const [removing, setRemoving] = useState<PromptTemplate>();
	const data = workspace.data(), templates = data.templates.toSorted((a, b) => a.order - b.order);
	const task = data.tasks.find(row => row.id === taskId), selected = task?.promptTemplateIds ?? [];
	const edit = (template?: PromptTemplate) => { setRemoving(undefined); setEditing(template ?? 'new'); setTitle(template?.title ?? ''); setBody(template?.body ?? ''); };
	return <details class="nand-browser-workspace-prompts">
		<summary>{t('browser.workspace.prompts')}</summary>
		<p>{t('browser.workspace.promptsHint')}</p>
		<Button disabled={disabled} onClick={() => edit()}>{t('browser.workspace.promptNew')}</Button>
		<div class="nand-browser-workspace-task-list">{templates.map((template, index) => <section key={template.id} class="nand-browser-workspace-preview">
			<div class="nand-browser-workspace-actions">
				{task ? <label><input type="checkbox" checked={selected.includes(template.id)} disabled={disabled} onChange={event => {
					const next = event.currentTarget.checked ? [...selected, template.id] : selected.filter(id => id !== template.id);
					changed(); run(() => workspace.updateTask(task.id, { promptTemplateIds: next }));
				}} />{template.title}</label> : <strong>{template.title}</strong>}
				<Button disabled={disabled} onClick={() => edit(template)}>{t('browser.workspace.promptEdit')}</Button>
				<Button disabled={disabled || index === 0} onClick={() => { changed(); run(() => workspace.moveTemplate(template.id, -1)); }}>{t('browser.workspace.promptUp')}</Button>
				<Button disabled={disabled || index === templates.length - 1} onClick={() => { changed(); run(() => workspace.moveTemplate(template.id, 1)); }}>{t('browser.workspace.promptDown')}</Button>
				<Button variant="danger" disabled={disabled} onClick={() => setRemoving(template)}>{t('browser.workspace.promptDelete')}</Button>
			</div>
			<details><summary>{t('browser.workspace.promptRead')}</summary><Answer text={template.body} mount={mount} /></details>
		</section>)}</div>
		{!templates.length && <p>{t('browser.workspace.promptsEmpty')}</p>}
		{removing && <section class="nand-browser-workspace-preview">
			<p>{t('browser.workspace.promptDeleteReview', { title: removing.title })}</p>
			<div class="nand-browser-workspace-actions">
				<Button variant="danger" disabled={disabled} onClick={() => { changed(); run(async () => { await workspace.deleteTemplate(removing.id, removing.revision); setRemoving(undefined); }); }}>{t('browser.workspace.promptDeleteConfirm')}</Button>
				<Button disabled={disabled} onClick={() => setRemoving(undefined)}>{t('browser.workspace.promptCancel')}</Button>
			</div>
		</section>}
		{editing && <section class="nand-browser-workspace-preview">
			<TextField label={t('browser.workspace.promptTitle')} value={title} onInput={setTitle} disabled={disabled} />
			<TextField label={t('browser.workspace.promptBody')} multiline rows={8} value={body} onInput={setBody} disabled={disabled} />
			<details><summary>{t('browser.workspace.promptRead')}</summary><Answer text={body} mount={mount} /></details>
			<div class="nand-browser-workspace-actions">
				<Button disabled={disabled || !title.trim() || !body.trim()} onClick={() => { changed(); run(async () => {
					await workspace.saveTemplate(title, body, editing === 'new' ? undefined : editing); setEditing(undefined);
				}); }}>{t('browser.workspace.promptSave')}</Button>
				<Button disabled={disabled} onClick={() => setEditing(undefined)}>{t('browser.workspace.promptCancel')}</Button>
			</div>
		</section>}
	</details>;
}
