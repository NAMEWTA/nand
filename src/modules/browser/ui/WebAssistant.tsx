import { Platform } from 'obsidian';
import { useRef, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import { TextField } from '../../../ui/primitives/TextField';
import type { AssistantTask } from '../core/assistant/model';
import type { ScopedBrowserOperation } from '../core/scoped-grant';
import { SCOPED_BROWSER_OPERATIONS } from '../core/scoped-grant';
import { browserError } from '../core/text';
import type { BrowserModule } from '../services';
import type { WebAssistant as AssistantService } from '../services/assistant';
import type { SynthesisChoices } from '../services/synthesis';
import { Answer, type MountMarkdown } from './WorkspaceAnswers';

export function WebAssistant({ module, assistant, taskId, mount }: { module: BrowserModule; assistant: AssistantService; taskId?: string; mount: MountMarkdown }) {
	const [enabled, setEnabled] = useState(false), [choices, setChoices] = useState<SynthesisChoices>();
	const [mode, setMode] = useState<'automatic' | 'existing'>('automatic'), [agentId, setAgentId] = useState(''), [sessionId, setSessionId] = useState('');
	const [title, setTitle] = useState(''), [goal, setGoal] = useState(''), [pageIds, setPageIds] = useState<string[]>([]);
	const [operations, setOperations] = useState<ScopedBrowserOperation[]>(['snapshot', 'get', 'fill', 'focus', 'tab.switch']);
	const [limit, setLimit] = useState(40), [minutes, setMinutes] = useState(10), [previous, setPrevious] = useState<string>();
	const [preview, setPreview] = useState<AssistantTask>(), [failure, setFailure] = useState<unknown>(), [editing, setEditing] = useState(false);
	const locked = useRef(false), pages = module.control.list(), records = assistant.records().filter(task => !taskId || task.id === taskId);
	const change = (work: () => void) => { setPreview(undefined); work(); };
	const run = (work: () => Promise<unknown>) => {
		if (locked.current) return; locked.current = true; setEditing(true); setFailure(undefined);
		void work().catch(setFailure).finally(() => { locked.current = false; setEditing(false); });
	};
	const session = choices?.sessions.find(row => row.id === sessionId && row.agentId);
	const available = mode === 'automatic' ? choices?.automatic && choices.agents.some(agent => agent.id === agentId) : choices?.existing && !!session;
	return <div class="nand-browser-workspace nand-browser-assistant">
		<h2>{t('browser.assistant.title')}</h2><p>{t('browser.assistant.intro')}</p>
		{!Platform.isDesktopApp && <p role="status">{t('browser.browser_workspace_desktop')}</p>}
		{failure && <p role="alert">{browserError(failure)}</p>}
		{Platform.isDesktopApp && <section>
			<label class="nand-browser-workspace-check"><input type="checkbox" checked={enabled} disabled={editing} onChange={event => {
				change(() => setEnabled(event.currentTarget.checked)); if (event.currentTarget.checked) run(async () => setChoices(await assistant.choices()));
			}} />{t('browser.assistant.enable')}</label>
			{enabled && <>
				<p>{t('browser.assistant.extraCall')}</p>
				<Button disabled={editing} onClick={() => run(async () => { setChoices(await assistant.choices()); setPreview(undefined); })}>{t('browser.assistant.refresh')}</Button>
				<label class="nand-field"><span class="nand-field-label">{t('browser.workspace.synthesis.mode')}</span>
					<select value={mode} disabled={editing} onChange={event => change(() => setMode(event.currentTarget.value as 'automatic' | 'existing'))}>
						<option value="automatic">{t('browser.workspace.synthesis.automatic')}</option><option value="existing">{t('browser.workspace.synthesis.existing')}</option>
					</select></label>
				{mode === 'automatic' ? <label class="nand-field"><span class="nand-field-label">{t('browser.workspace.synthesis.agent')}</span>
					<select value={agentId} disabled={editing} onChange={event => change(() => setAgentId(event.currentTarget.value))}>
						<option value="">{t('browser.workspace.synthesis.choose')}</option>{choices?.agents.map(agent => <option key={agent.id} value={agent.id}>{agent.title}</option>)}
					</select></label> : <label class="nand-field"><span class="nand-field-label">{t('browser.workspace.synthesis.existing')}</span>
					<select value={sessionId} disabled={editing} onChange={event => change(() => setSessionId(event.currentTarget.value))}>
						<option value="">{t('browser.workspace.synthesis.choose')}</option>{choices?.sessions.filter(row => row.agentId).map(row => <option key={row.id} value={row.id}>{row.title} · {row.agentId}</option>)}
					</select></label>}
				{mode === 'existing' && <p>{t('browser.assistant.pasteHelp')}</p>}
				{choices && !(mode === 'automatic' ? choices.automatic && choices.agents.length : choices.existing && choices.sessions.some(row => row.agentId))
					&& <p role="status">{t('browser.browser_workspace_synthesis_agent')}</p>}
				<TextField label={t('browser.assistant.taskTitle')} value={title} disabled={editing} onInput={value => change(() => setTitle(value))} />
				<label class="nand-field"><span class="nand-field-label">{t('browser.assistant.goal')}</span><textarea rows={4} value={goal} disabled={editing} onInput={event => change(() => setGoal(event.currentTarget.value))} /></label>
				<fieldset disabled={editing}><legend>{t('browser.assistant.pages')}</legend>
					{!pages.length && <p>{t('browser.assistant.noPages')}</p>}
					{pages.map(page => <label class="nand-browser-workspace-check" key={page.target.pageId}>
						<input type="checkbox" checked={pageIds.includes(page.target.pageId)} onChange={event => change(() => setPageIds(event.currentTarget.checked ? [...pageIds, page.target.pageId] : pageIds.filter(id => id !== page.target.pageId)))} />
						<span>{page.title || page.url} · {module.profiles().find(profile => profile.id === page.target.profileId)?.label || t('browser.profile.default')}<small>{page.url}</small></span>
					</label>)}
				</fieldset>
				<fieldset disabled={editing}><legend>{t('browser.assistant.operations')}</legend><div class="nand-browser-assistant-operations">
					{SCOPED_BROWSER_OPERATIONS.map(operation => <label class="nand-browser-workspace-check" key={operation}>
						<input type="checkbox" checked={operations.includes(operation)} disabled={operation === 'snapshot'} onChange={event => change(() => setOperations(event.currentTarget.checked ? [...operations, operation] : operations.filter(item => item !== operation)))} />
						{t('browser.assistant.operation.' + operation)}
					</label>)}
				</div></fieldset>
				<div class="nand-browser-assistant-limits">
					<label class="nand-field"><span class="nand-field-label">{t('browser.assistant.maxOperations')}</span><input type="number" min={1} max={200} value={limit} disabled={editing} onInput={event => change(() => setLimit(event.currentTarget.valueAsNumber))} /></label>
					<label class="nand-field"><span class="nand-field-label">{t('browser.assistant.minutes')}</span><input type="number" min={1} max={30} value={minutes} disabled={editing} onInput={event => change(() => setMinutes(event.currentTarget.valueAsNumber))} /></label>
				</div>
				{previous && <p>{t('browser.assistant.continuation')}</p>}
				<Button disabled={editing || !available || !title.trim() || !goal.trim() || !pageIds.length} onClick={() => run(async () => {
					setPreview(await assistant.review({ title, goal, targets: pages.filter(page => pageIds.includes(page.target.pageId)).map(page => page.target), operations,
						maxOperations: limit, timeoutMs: minutes * 60_000, destination: mode === 'automatic' ? { kind: 'automatic', agentId }
							: { kind: 'existing', agentId: session!.agentId!, sessionId, sessionTitle: session!.title }, previousTaskId: previous }));
				})}>{t('browser.assistant.preview')}</Button>
				{preview && <section class="nand-browser-workspace-preview" data-assistant-preview={preview.id}>
					<h3>{t('browser.assistant.reviewTitle')}</h3><p>{preview.title} · {preview.destination.agentId}</p>
					<p>{t('browser.assistant.bounds', { count: preview.maxOperations, minutes: preview.timeoutMs / 60_000 })}</p>
					<ul>{preview.pages.map(page => <li key={page.target.pageId}>{page.title} · {page.accountLabel} · {page.url}</li>)}</ul>
					<p>{preview.operations.map(operation => t('browser.assistant.operation.' + operation)).join(', ')}</p>
					<details><summary>{t('browser.workspace.finalPrompt')}</summary><pre>{preview.prompt}</pre></details>
					<Button variant="primary" disabled={editing} onClick={event => {
						const saved = preview, win = event.currentTarget.win; setPreview(undefined); setEnabled(false); setFailure(undefined);
						void module.openAssistant(saved.id, win).then(() => assistant.start(saved.id)).catch(setFailure);
					}}>{t(preview.destination.kind === 'automatic' ? 'browser.assistant.start' : 'browser.assistant.paste')}</Button>
				</section>}
			</>}
		</section>}
		<section><h3>{t('browser.assistant.history')}</h3>{!records.length && <p>{t('browser.assistant.empty')}</p>}
			{records.map(task => <article class="nand-browser-workspace-preview" key={task.id} data-assistant-record={task.id}>
				<h3>{task.title}</h3><p role="status">{t('browser.assistant.status.' + task.status)} · {task.destination.agentId}</p>
				<p>{t('browser.assistant.operationCount', { count: task.steps.length, limit: task.maxOperations })} · {t('browser.assistant.bounds', { count: task.maxOperations, minutes: task.timeoutMs / 60_000 })}</p>
				{task.errorCode && <p role="alert">{browserError(task.errorCode)}</p>}
				<pre>{task.goal}</pre>
				<div class="nand-browser-workspace-actions">
					{assistant.busy(task.id) && <><Button onClick={() => assistant.stop(task.id, 'paused')}>{t('browser.assistant.pause')}</Button><Button onClick={() => assistant.stop(task.id)}>{t('browser.assistant.stop')}</Button>
						{task.terminalId && <Button onClick={() => { void assistant.openTerminal(task.id).catch(setFailure); }}>{t('browser.workspace.synthesis.open')}</Button>}</>}
					{Platform.isDesktopApp && !assistant.busy(task.id) && <Button disabled={editing} onClick={() => run(async () => {
						setChoices(await assistant.choices()); setEnabled(true); setPreview(undefined); setTitle(task.title); setGoal(task.goal); setOperations([...task.operations]);
						setLimit(task.maxOperations); setMinutes(task.timeoutMs / 60_000); setPrevious(task.id); setPageIds(task.pages.filter(page => pages.some(current => current.target.pageId === page.target.pageId && current.target.profileId === page.target.profileId)).map(page => page.target.pageId));
						setMode(task.destination.kind); setAgentId(task.destination.agentId); if (task.destination.kind === 'existing') setSessionId(task.destination.sessionId);
					})}>{t('browser.assistant.resume')}</Button>}
				</div>
				{assistant.confirmation(task.id) && <p role="status">{t('browser.assistant.confirmOnPage')}</p>}
				{task.pages.map(page => <div key={page.target.pageId} class="nand-browser-workspace-actions"><span>{page.title} · {page.accountLabel}</span>
					{Platform.isDesktopApp && <><Button onClick={() => { void module.activate(page.target.pageId).catch(setFailure); }}>{t('browser.assistant.showPage')}</Button>
						{assistant.busy(task.id) && <Button onClick={() => { void assistant.takeover(task.id, page.target).catch(setFailure); }}>{t('browser.assistant.takeover')}</Button>}</>}
				</div>)}
				{assistant.unsaved(task.id) && <><p role="alert">{t('browser.workspace.synthesis.unsaved')}</p>
					{assistant.recoveryPath(task.id) && <p><code>{assistant.recoveryPath(task.id)}</code></p>}
					<Button disabled={editing} onClick={() => run(() => assistant.retrySave())}>{t('browser.workspace.retrySave')}</Button></>}
				{task.text && <Answer text={task.text} mount={mount} />}
				{task.usage && <p>{task.usage.known ? t('browser.workspace.synthesis.usage', { input: task.usage.input, output: task.usage.output }) : t('browser.workspace.synthesis.usageUnknown')}
					{task.usage.partial && ` · ${t('browser.workspace.synthesis.usagePartial')}`}</p>}
				{task.text && <Button onClick={event => { const win = event.currentTarget.win;
					run(async () => { if (Platform.isDesktopApp) module.copyText(task.text); else await win.navigator.clipboard.writeText(task.text); });
				}}>{t('browser.workspace.copyAnswer')}</Button>}
				{task.steps.length > 0 && <><p>{t('browser.assistant.evidenceHelp')}</p><ol>{task.steps.map(step => <li key={step.id}>
					<strong>{t('browser.assistant.operation.' + step.operation)}</strong> · {t('browser.assistant.step.' + step.state)}
					{step.errorCode && <p><code>{step.errorCode}</code></p>}{step.evidence && <details><summary>{t('browser.assistant.evidence')}</summary><pre>{step.evidence}</pre></details>}
				</li>)}</ol></>}
				<details><summary>{t('browser.workspace.finalPrompt')}</summary><pre>{task.prompt}</pre></details>
			</article>)}
		</section>
	</div>;
}
