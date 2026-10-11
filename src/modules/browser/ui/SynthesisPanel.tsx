import { useRef, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import { TextField } from '../../../ui/primitives/TextField';
import type { CaptureReference } from '../core/workspace/comparison';
import type { SynthesisRecord } from '../core/workspace/synthesis-model';
import { browserError } from '../core/text';
import type { SynthesisChoices } from '../services/synthesis';
import type { Workspace } from '../services/workspace';
import { Answer, type CopyAnswer, type MountMarkdown } from './WorkspaceAnswers';

export function SynthesisDocument({ record, copy, mount }: { record: SynthesisRecord; copy: CopyAnswer; mount: MountMarkdown }) {
	const [failure, setFailure] = useState<unknown>();
	return <article class="nand-browser-workspace-preview" data-synthesis-id={record.id}>
		<h4>{record.title}</h4><p>{record.taskTitle} · {record.destination.agentId}</p>
		<p role="status">{t('browser.workspace.synthesis.status.' + record.status)}</p>
		{record.destination.kind === 'existing' && <p>{t('browser.workspace.synthesis.session', { title: record.destination.sessionTitle })}</p>}
		{record.errorCode && <p role="status">{t('browser.workspace.synthesis.ownerError')} <code>{record.errorCode}</code></p>}
		{record.text && <><Answer text={record.text} mount={mount} />
			<Button onClick={event => { setFailure(undefined); void copy(record.text, event.currentTarget.win).catch(setFailure); }}>{t('browser.workspace.synthesis.copy')}</Button></>}
		{failure && <p role="alert">{browserError(failure)}</p>}
		{record.usage && <p>{record.usage.known ? t('browser.workspace.synthesis.usage', { input: record.usage.input, output: record.usage.output }) : t('browser.workspace.synthesis.usageUnknown')}
			{record.usage.partial && ` · ${t('browser.workspace.synthesis.usagePartial')}`}</p>}
		<details><summary>{t('browser.workspace.synthesis.materials')}</summary>
			<pre>{record.instruction}</pre>
			{record.inputs.map((input, index) => <section key={input.captureId}>
				<h5>{`[S${index + 1}] `}{t('browser.workspace.provider.' + input.provider)} · {t('browser.workspace.turn', { sequence: input.sequence })} · {t('browser.workspace.synthesis.revision', { revision: input.revision })}</h5>
				<p>{t(input.complete ? 'browser.workspace.acquire.complete' : 'browser.workspace.acquire.incomplete')}</p>
				{input.selection && <><p>{t('browser.guidance.partialHelp')}</p><code>{input.selection.selector}</code><pre>{JSON.stringify(input.selection, null, 2)}</pre></>}
				<p><code>{input.exchangeId} / {input.captureId}</code></p><pre>{input.question}</pre><Answer text={input.text} mount={mount} />
				{input.url && <a href={input.url} target="_blank" rel="noopener noreferrer">{t('browser.workspace.synthesis.source')}</a>}
			</section>)}
		</details>
		<details><summary>{t('browser.workspace.finalPrompt')}</summary><pre>{record.prompt}</pre></details>
	</article>;
}

/** Saved results stay readable in history even after their original task is removed. */
export function SynthesisHistory({ workspace, taskId, copy, mount }: { workspace: Workspace; taskId?: string; copy: CopyAnswer; mount: MountMarkdown }) {
	const [failure, setFailure] = useState<unknown>(), [saving, setSaving] = useState(false);
	const records = workspace.synthesis.records().filter(record => !taskId || record.taskId === taskId);
	if (!records.length) return null;
	return <section class="nand-browser-synthesis-history">
		<h3>{t('browser.workspace.synthesis.saved')}</h3><p>{t('browser.workspace.synthesis.independent')}</p>
		{failure && <p role="alert">{browserError(failure)}</p>}
		{records.map(record => <section key={record.id}>
			<SynthesisDocument record={record} copy={copy} mount={mount} />
			{workspace.synthesis.busy(record.id) && <div class="nand-browser-workspace-actions">
				<Button onClick={() => workspace.synthesis.cancel(record.id)}>{t('browser.workspace.synthesis.cancel')}</Button>
				{record.destination.kind === 'automatic' && record.terminalId && <Button onClick={() => { setFailure(undefined); void workspace.synthesis.open(record.id).catch(setFailure); }}>{t('browser.workspace.synthesis.open')}</Button>}
			</div>}
			{workspace.synthesis.unsaved(record.id) && <>
				<p role="alert">{t('browser.workspace.synthesis.unsaved')}</p>
				<Button disabled={saving} onClick={() => { setSaving(true); setFailure(undefined); void workspace.retrySave().catch(setFailure).finally(() => setSaving(false)); }}>{t('browser.workspace.retrySave')}</Button>
			</>}
		</section>)}
	</section>;
}

export function SynthesisPanel({ workspace, taskId, copy, mount }: { workspace: Workspace; taskId: string; copy: CopyAnswer; mount: MountMarkdown }) {
	const [enabled, setEnabled] = useState(false), [choices, setChoices] = useState<SynthesisChoices>();
	const [mode, setMode] = useState<'automatic' | 'existing'>('automatic'), [agentId, setAgentId] = useState(''), [sessionId, setSessionId] = useState('');
	const [title, setTitle] = useState(''), [instruction, setInstruction] = useState(''), [selected, setSelected] = useState<CaptureReference[]>([]);
	const [preview, setPreview] = useState<SynthesisRecord>(), [failure, setFailure] = useState<unknown>(), [acting, setActing] = useState(false);
	const locked = useRef(false), data = workspace.data();
	const run = (action: () => Promise<unknown>) => {
		if (locked.current) return; locked.current = true; setActing(true); setFailure(undefined);
		void action().catch(setFailure).finally(() => { locked.current = false; setActing(false); });
	};
	const refresh = () => run(async () => { setPreview(undefined); setChoices(await workspace.synthesis.choices()); });
	const session = choices?.sessions.find(row => row.id === sessionId && row.agentId);
	const available = mode === 'automatic' ? choices?.automatic && choices.agents.some(row => row.id === agentId) : choices?.existing && !!session;
	const turns = data.turns.filter(turn => turn.taskId === taskId).toSorted((a, b) => a.sequence - b.sequence);
	return <section class="nand-browser-synthesis">
		<label class="nand-browser-workspace-check"><input type="checkbox" checked={enabled} disabled={acting} onChange={event => {
			setEnabled(event.currentTarget.checked); setPreview(undefined); if (event.currentTarget.checked) refresh();
		}} />{t('browser.workspace.synthesis.enable')}</label>
		{enabled && <>
			<p>{t('browser.workspace.synthesis.scope')}</p>
			<Button disabled={acting} onClick={refresh}>{t('browser.workspace.synthesis.refresh')}</Button>
			<label class="nand-field"><span class="nand-field-label">{t('browser.workspace.synthesis.mode')}</span>
				<select value={mode} disabled={acting} onChange={event => { setMode(event.currentTarget.value as 'automatic' | 'existing'); setPreview(undefined); }}>
					<option value="automatic">{t('browser.workspace.synthesis.automatic')}</option><option value="existing">{t('browser.workspace.synthesis.existing')}</option>
				</select>
			</label>
			{mode === 'automatic' ? <label class="nand-field"><span class="nand-field-label">{t('browser.workspace.synthesis.agent')}</span>
				<select value={agentId} disabled={acting} onChange={event => { setAgentId(event.currentTarget.value); setPreview(undefined); }}>
					<option value="">{t('browser.workspace.synthesis.choose')}</option>{choices?.agents.map(agent => <option key={agent.id} value={agent.id}>{agent.title}</option>)}
				</select>
			</label> : <label class="nand-field"><span class="nand-field-label">{t('browser.workspace.synthesis.existing')}</span>
				<select value={sessionId} disabled={acting} onChange={event => { setSessionId(event.currentTarget.value); setPreview(undefined); }}>
					<option value="">{t('browser.workspace.synthesis.choose')}</option>{choices?.sessions.filter(row => row.agentId).map(row => <option key={row.id} value={row.id}>{row.title} · {row.agentId}</option>)}
				</select>
			</label>}
			{choices && !(mode === 'automatic' ? choices.automatic && choices.agents.length : choices.existing && choices.sessions.some(row => row.agentId)) && <p role="status">{t('browser.browser_workspace_synthesis_agent')}</p>}
			<p>{t(mode === 'automatic' ? 'browser.workspace.synthesis.automaticHelp' : 'browser.workspace.synthesis.existingHelp')}</p>
			<TextField label={t('browser.workspace.synthesis.title')} value={title} disabled={acting} onInput={value => { setTitle(value); setPreview(undefined); }} />
			<label class="nand-field"><span class="nand-field-label">{t('browser.workspace.synthesis.instruction')}</span>
				<textarea value={instruction} rows={4} disabled={acting} onInput={event => { setInstruction(event.currentTarget.value); setPreview(undefined); }} />
			</label>
			<fieldset disabled={acting}><legend>{t('browser.workspace.synthesis.select')}</legend>
				{turns.map(turn => data.exchanges.filter(exchange => exchange.turnId === turn.id).map(exchange => {
					const target = turn.targets.find(row => row.id === exchange.targetId)!;
					return [...exchange.captures, ...(exchange.selections ?? [])].filter(capture => capture.markdown.trim()).map(capture => <label key={capture.id} class="nand-browser-workspace-check">
						<input type="checkbox" checked={selected.some(ref => ref.captureId === capture.id)} onChange={event => {
							setSelected(event.currentTarget.checked ? [...selected, { exchangeId: exchange.id, captureId: capture.id }] : selected.filter(ref => ref.captureId !== capture.id)); setPreview(undefined);
						}} />{t('browser.workspace.turn', { sequence: turn.sequence })} · {t('browser.workspace.provider.' + target.provider)} · {target.accountLabel} · {t(capture.source === 'user-selection' ? 'browser.guidance.excerpt' : 'browser.workspace.synthesis.revision', { revision: capture.revision })} · {t(capture.complete ? 'browser.workspace.acquire.complete' : 'browser.workspace.acquire.incomplete')}
					</label>);
				}))}
			</fieldset>
			<Button disabled={acting || !available || !title.trim() || !instruction.trim() || !selected.length} onClick={() => run(async () => {
				setPreview(await workspace.synthesis.review({ taskId, references: selected, title, instruction, destination: mode === 'automatic'
					? { kind: 'automatic', agentId } : { kind: 'existing', agentId: session!.agentId!, sessionId: session!.id, sessionTitle: session!.title } }));
			})}>{t('browser.workspace.synthesis.preview')}</Button>
			{preview && <section aria-label={t('browser.workspace.synthesis.preview')}>
				<SynthesisDocument record={preview} copy={copy} mount={mount} />
				<Button variant="primary" disabled={acting} onClick={() => { const id = preview.id; setPreview(undefined); run(() => workspace.synthesis.start(id)); }}>{t(mode === 'automatic' ? 'browser.workspace.synthesis.start' : 'browser.workspace.synthesis.paste')}</Button>
			</section>}
		</>}
		{failure && <p role="alert">{browserError(failure)}</p>}
		<SynthesisHistory workspace={workspace} taskId={taskId} copy={copy} mount={mount} />
	</section>;
}
