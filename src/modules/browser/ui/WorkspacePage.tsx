import { Notice, Platform } from 'obsidian';
import { useRef, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import { TextField } from '../../../ui/primitives/TextField';
import type { BrowserPageState } from '../core/model';
import { browserError } from '../core/text';
import type { TargetBinding, WorkspaceTurn, WorkspaceProvider, WorkspaceRetryPreview } from '../core/workspace/model';
import type { BrowserModule } from '../services';
import type { BrowserHost } from '../services/page-host';
import type { Workspace } from '../services/workspace';
import { WorkspacePanels } from './WorkspacePanels';
import { Answer, CaptureDetails, CaptureHistory, IncompleteAnswer, ImportedTranscript, type CopyAnswer, type MountMarkdown } from './WorkspaceAnswers';
import { AnswerComparison } from './AnswerComparison';
import { PromptLibrary } from './PromptLibrary';
import { WorkspaceHistory } from './WorkspaceHistory';
import { HistoryExport } from './HistoryExport';
import { HistoryTransfer } from './HistoryTransfer';
import { SynthesisHistory, SynthesisPanel } from './SynthesisPanel';

export function WorkspacePage({ workspace, module, host, taskId, panes, openTarget, closeTarget, create, mountMarkdown }: {
	workspace: Workspace; module: BrowserModule; host: BrowserHost; taskId?: string;
	panes: ReadonlyMap<string, { state: BrowserPageState }>;
	openTarget: (binding: TargetBinding) => Promise<void>; closeTarget: (id: string) => void;
	create: (title: string, profileId: string, accountLabel: string, provider: WorkspaceProvider) => Promise<void>; mountMarkdown: MountMarkdown;
}) {
	const data = workspace.data(), task = data.tasks.find(task => task.id === taskId);
	const livePages = module.control.list();
	const profiles = module.profiles().filter(profile => profile.state === 'ready');
	const [title, setTitle] = useState(''), [profileId, setProfileId] = useState('default');
	const [provider, setProvider] = useState<WorkspaceProvider>('deepseek');
	const [preview, setPreview] = useState<WorkspaceTurn>(), [failure, setFailure] = useState<unknown>(), [acting, setActing] = useState(false);
	const [retryPreview, setRetryPreview] = useState<WorkspaceRetryPreview>();
	const clearPreviews = () => { setPreview(undefined); setRetryPreview(undefined); };
	const locked = useRef(false);
	const composer = useRef<HTMLDivElement>(null);
	const copyAnswer: CopyAnswer = async (text, win) => { if (Platform.isDesktopApp) module.copyText(text); else await win.navigator.clipboard.writeText(text); };
	const run = (action: () => Promise<unknown>) => {
		if (locked.current) return;
		locked.current = true; setActing(true); setFailure(undefined);
		void action().catch(setFailure).finally(() => { locked.current = false; setActing(false); });
	};
	const busy = !!task && workspace.busy(task.id);
	const error = failure ? <p class="nand-browser-workspace-error" role="alert">{browserError(failure)}</p> : null;
	const save = <Button onClick={() => run(() => workspace.retrySave())} disabled={acting}>{t('browser.workspace.retrySave')}</Button>;
	if (!task) return <div class="nand-browser-workspace nand-browser-workspace-start">
		<h2>{t('browser.workspace.title')}</h2>
		{taskId ? <p role="alert">{t('browser.browser_workspace_task_missing')}</p> : <>
			<p>{t('browser.workspace.intro')}</p>
			<TextField label={t('browser.workspace.taskTitle')} value={title} onInput={setTitle} disabled={acting} />
			<label class="nand-field"><span class="nand-field-label">{t('browser.workspace.provider')}</span>
				<select value={provider} onChange={event => setProvider(event.currentTarget.value as WorkspaceProvider)} disabled={acting}>
					{(['deepseek', 'kimi', 'chatgpt', 'claude', 'qwen', 'doubao', 'coze', 'minimax'] as const).map(id => <option key={id} value={id}>{t('browser.workspace.provider.' + id)}</option>)}
				</select>
			</label>
			<label class="nand-field"><span class="nand-field-label">{t('browser.profile.label')}</span>
				<select value={profileId} onChange={event => setProfileId(event.currentTarget.value)} disabled={acting}>
					{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.kind === 'default' ? t('browser.profile.default') : profile.label}</option>)}
				</select>
			</label>
			<Button variant="primary" disabled={acting || !title.trim() || !profiles.some(profile => profile.id === profileId)}
				onClick={() => run(() => create(title, profileId, profiles.find(profile => profile.id === profileId)!.label, provider))}>{t('browser.workspace.create')}</Button>
		</>}
		{error}{failure && save}
		<PromptLibrary workspace={workspace} disabled={acting} run={run} changed={clearPreviews} mount={mountMarkdown} />
		<SynthesisHistory workspace={workspace} copy={copyAnswer} mount={mountMarkdown} />
		<WorkspaceHistory workspace={workspace} module={module} disabled={acting} run={run} />
		<HistoryExport workspace={workspace} module={module} disabled={acting} run={run} copy={copyAnswer} />
		<HistoryTransfer workspace={workspace} module={module} disabled={acting} run={run} />
	</div>;
	const disabled = busy || acting;
	const turns = data.turns.filter(turn => turn.taskId === task.id).toSorted((a, b) => b.sequence - a.sequence);
	return <div class="nand-browser-workspace">
		<div class="nand-browser-workspace-heading">
			<h2>{task.title}</h2>
			<Button variant="ghost" disabled={acting} onClick={event => { const win = event.currentTarget.win; run(() => module.openWorkspace(undefined, win)); }}>{t('browser.workspace.history')}</Button>
			<Button variant="ghost" disabled={disabled} onClick={() => run(() => workspace.updateTask(task.id, { pinned: !task.pinned }))}>
				{t(task.pinned ? 'browser.workspace.unpin' : 'browser.workspace.pin')}</Button>
		</div>
		{!Platform.isDesktopApp && <p>{t('browser.browser_workspace_desktop')}</p>}
		<section class="nand-browser-workspace-target">
			<h3>{t('browser.workspace.addTarget')}</h3>
			<label class="nand-field"><span class="nand-field-label">{t('browser.workspace.provider')}</span>
				<select value={provider} onChange={event => setProvider(event.currentTarget.value as WorkspaceProvider)} disabled={disabled}>
					{(['deepseek', 'kimi', 'chatgpt', 'claude', 'qwen', 'doubao', 'coze', 'minimax'] as const).map(id => <option key={id} value={id}>{t('browser.workspace.provider.' + id)}</option>)}
				</select>
			</label>
			<label class="nand-field"><span class="nand-field-label">{t('browser.profile.label')}</span>
				<select value={profileId} onChange={event => setProfileId(event.currentTarget.value)} disabled={disabled}>
					{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.kind === 'default' ? t('browser.profile.default') : profile.label}</option>)}
				</select>
			</label>
			<Button disabled={disabled || !profiles.some(profile => profile.id === profileId)} onClick={() => {
				clearPreviews(); run(() => module.addWorkspaceTarget(task.id, provider, profileId, profiles.find(profile => profile.id === profileId)!.label));
			}}>{t('browser.workspace.addTarget')}</Button>
			<p>{t('browser.workspace.targetMembership')}</p>
		</section>
		<div class="nand-browser-workspace-actions">
			<Button disabled={disabled || !task.targets.length} onClick={() => { clearPreviews(); run(() => workspace.updateTask(task.id, { selectedTargetIds: task.targets.map(target => target.id) })); }}>{t('browser.workspace.selectAll')}</Button>
			<Button disabled={disabled || !task.selectedTargetIds.length} onClick={() => { clearPreviews(); run(() => workspace.updateTask(task.id, { selectedTargetIds: [] })); }}>{t('browser.workspace.selectNone')}</Button>
			<Button disabled={!Platform.isDesktopApp || disabled || !task.selectedTargetIds.length} onClick={() => { clearPreviews(); run(() => workspace.checkTargets(task.id)); }}>{t('browser.workspace.recheck')}</Button>
		</div>
		<div class="nand-browser-workspace-targets">
			{task.targets.map(target => { const check = workspace.targetCheck(task.id, target.id), available = profiles.some(profile => profile.id === target.profileId); return <section key={target.id} class="nand-browser-workspace-target">
				<strong>{t('browser.workspace.target', { provider: t('browser.workspace.provider.' + target.provider), account: target.accountLabel })}</strong>
				{target.adapterVersion && <p>{t('browser.workspace.adapterVersion')}: {target.adapterVersion}</p>}
				<span>{t('browser.workspace.targetState.' + ((check?.state ?? target.status) === 'ready' && !livePages.some(page =>
					page.target.pageId === target.page?.pageId && page.target.profileId === target.profileId && page.target.generation === target.page?.generation)
					? 'disconnected' : check?.state ?? target.status))}</span>
				{check?.reason && <p role="status">{browserError(new Error(check.reason))}</p>}
				{!available && <>
					<p>{t('browser.workspace.importedBinding')}</p>
					<Button disabled={disabled || !profiles.some(profile => profile.id === profileId)} onClick={() => { clearPreviews(); run(() => module.rebindWorkspaceTarget(task.id, target.id, profileId)); }}>{t('browser.workspace.rebindAccount')}</Button>
				</>}
				<div class="nand-browser-workspace-actions">
					<label><input type="checkbox" checked={task.selectedTargetIds.includes(target.id)} disabled={disabled}
						onChange={event => { const selected = event.currentTarget.checked; clearPreviews(); run(() => workspace.updateTask(task.id, {
							selectedTargetIds: selected ? [...task.selectedTargetIds, target.id] : task.selectedTargetIds.filter(id => id !== target.id),
						})); }} />{t('browser.workspace.recipient')}</label>
					<label><input type="checkbox" checked={task.visibleTargetIds.includes(target.id)}
						onChange={event => { void workspace.setTargetVisible(task.id, target.id, event.currentTarget.checked).catch(setFailure); }} />{t('browser.workspace.showPane')}</label>
					<Button disabled={!Platform.isDesktopApp || disabled || !available} onClick={() => run(() => openTarget(target))}>{t('browser.workspace.openPage')}</Button>
					<Button disabled={!Platform.isDesktopApp || disabled || !panes.has(target.id)} onClick={() => { clearPreviews(); run(() => workspace.prepareTarget(task.id, target.id, false)); }}>
						{t('browser.workspace.useCurrent')}</Button>
					<Button disabled={!Platform.isDesktopApp || disabled || !panes.has(target.id)} onClick={() => { clearPreviews(); run(() => workspace.prepareTarget(task.id, target.id, true)); }}>
						{t('browser.workspace.newConversation')}</Button>
					{panes.has(target.id) && <Button variant="ghost" onClick={() => closeTarget(target.id)}>{t('browser.workspace.closePage')}</Button>}
					{panes.has(target.id) && <Button onClick={() => { clearPreviews(); void module.takeoverWorkspaceTarget(task.id, target.id).catch(setFailure); }}>{t('browser.workspace.takeover')}</Button>}
					<Button variant="ghost" disabled={disabled} onClick={() => { clearPreviews(); run(() => module.removeWorkspaceTarget(task.id, target.id)); }}>{t('browser.workspace.removeTarget')}</Button>
				</div>
			</section>; })}
		</div>
		<WorkspacePanels workspace={workspace} task={task} host={host} panes={panes} />
		<div class="nand-browser-workspace-composer" ref={composer}>
			<PromptLibrary workspace={workspace} taskId={task.id} disabled={disabled} run={run} changed={clearPreviews} mount={mountMarkdown} />
			<TextField label={t('browser.workspace.question')} multiline rows={4} value={task.draft} disabled={disabled}
				onInput={value => { clearPreviews(); try { void workspace.stageDraft(task.id, value).catch(setFailure); } catch (error) { setFailure(error); } }} />
			<p role="status">{t(workspace.draftPending(task.id) ? 'browser.workspace.draftPending' : 'browser.workspace.draftSaved')}</p>
			<p>{t('browser.workspace.nextRecipients', { targets: task.targets.filter(target => task.selectedTargetIds.includes(target.id))
				.map(target => t('browser.workspace.target', { provider: t('browser.workspace.provider.' + target.provider), account: target.accountLabel })).join(', ') || t('browser.workspace.noRecipients') })}</p>
			{error}
			<div class="nand-browser-workspace-actions">
				{busy ? <Button onClick={() => workspace.pause(task.id)}>{t('browser.workspace.pause')}</Button> :
					<Button variant={preview ? 'default' : 'primary'} disabled={!Platform.isDesktopApp || disabled || (!task.draft.trim() && !task.promptTemplateIds?.length)}
						onClick={() => { clearPreviews(); run(async () => setPreview(await workspace.preview(task.id))); }}>{t('browser.workspace.preview')}</Button>}
				{!busy && <Button disabled={!Platform.isDesktopApp || disabled || (!task.draft.trim() && !task.promptTemplateIds?.length)} onClick={() => { clearPreviews(); run(async () => setPreview(await workspace.preview(task.id, undefined, undefined, true))); }}>
					{t('browser.workspace.previewReady')}</Button>}
				{save}
			</div>
			{preview && <section class="nand-browser-workspace-preview" aria-label={t('browser.workspace.preview')}>
				<h3>{t('browser.workspace.finalPrompt')}</h3>
				<pre>{preview.finalPrompt}</pre>
				<ul>{preview.targets.map(target => <li key={target.id}>{t('browser.workspace.target', { provider: t('browser.workspace.provider.' + target.provider), account: target.accountLabel })}
					{target.adapterVersion && <p>{t('browser.workspace.adapterVersion')}: {target.adapterVersion}</p>}</li>)}</ul>
				<Button variant="primary" disabled={disabled} onClick={() => { const id = preview.id; clearPreviews(); run(() => workspace.send(id)); }}>{t('browser.workspace.send')}</Button>
			</section>}
		</div>
		<div class="nand-browser-workspace-turns">
			<SynthesisPanel key={task.id} workspace={workspace} taskId={task.id} copy={copyAnswer} mount={mountMarkdown} />
			<HistoryExport key={task.id} workspace={workspace} module={module} taskId={task.id} disabled={acting} run={run} copy={copyAnswer} />
			{turns.map(turn => <article key={turn.id} class="nand-browser-workspace-turn">
				<h3>{t('browser.workspace.turn', { sequence: turn.sequence })}</h3>
				<pre>{turn.question}</pre>
				{turn.templates.length > 0 && <details><summary>{t('browser.workspace.promptFrozen')}</summary>
					{turn.templates.map(template => <section key={template.id}><h4>{template.title}</h4><Answer text={template.body} mount={mountMarkdown} /></section>)}
					<pre>{turn.finalPrompt}</pre>
				</details>}
				<AnswerComparison turn={turn} exchanges={data.exchanges} mount={mountMarkdown} copy={copyAnswer} />
				{turn.targets.map(target => {
					const exchange = data.exchanges.find(row => row.turnId === turn.id && row.targetId === target.id);
					if (!exchange) return null;
					const capture = exchange.captures.find(row => row.id === exchange.currentCaptureId);
					return <section key={target.id}>
						<h4>{t('browser.workspace.target', { provider: t('browser.workspace.provider.' + target.provider), account: target.accountLabel })}</h4>
						<dl class="nand-browser-workspace-status">
							<div><dt>{t('browser.workspace.submission')}</dt><dd>{t('browser.workspace.submit.' + exchange.submitState)}</dd></div>
							<div><dt>{t('browser.workspace.acquisition')}</dt><dd>{t('browser.workspace.acquire.' + exchange.acquisitionState)}</dd></div>
							<div><dt>{t('browser.workspace.saving')}</dt><dd>{t('browser.workspace.save.' + exchange.saveState)}</dd></div>
						</dl>
						{exchange.lastError && <p role="status">{browserError(new Error(exchange.lastError))}</p>}
						{exchange.imported && <ImportedTranscript source={exchange.imported} mount={mountMarkdown} copy={copyAnswer} />}
						{capture && !capture.complete && <IncompleteAnswer reasons={capture.reasons} />}
						{capture && <CaptureDetails key={capture.id} capture={capture} copy={copyAnswer} />}
						{capture && <Answer text={capture.markdown} mount={mountMarkdown} />}
						{exchange.captures.length > 1 && <CaptureHistory captures={exchange.captures} currentId={exchange.currentCaptureId} mount={mountMarkdown} copy={copyAnswer} />}
						{!!exchange.selections?.length && <section><h5>{t('browser.guidance.excerpts')}</h5><CaptureHistory captures={exchange.selections} mount={mountMarkdown} copy={copyAnswer} /></section>}
						{exchange.receipt && <Button disabled={!Platform.isDesktopApp || disabled} onClick={() => run(() => workspace.recollect(exchange.id))}>
							{t('browser.workspace.recollect')}</Button>}
						{exchange.receipt && task.targets.some(row => row.id === target.id) && <Button disabled={!Platform.isDesktopApp || disabled}
							onClick={() => { clearPreviews(); run(async () => { await workspace.followUp(exchange.id);
								composer.current?.win.requestAnimationFrame(() => { composer.current?.scrollIntoView({ block: 'center' }); composer.current?.querySelector('textarea')?.focus(); });
							}); }}>{t('browser.workspace.followUp')}</Button>}
						{capture && <Button disabled={!Platform.isDesktopApp || disabled}
							onClick={event => { const win = event.currentTarget.win; run(async () => { try { await module.openWorkspaceAnswer(exchange.id, capture.id, win); }
								catch (error) { new Notice(browserError(error)); throw error; } }); }}>
							{t('browser.workspace.openOriginalAnswer')}</Button>}
						{!exchange.imported && !exchange.receipt && ['not-sent', 'unknown', 'paused'].includes(exchange.submitState) && task.targets.some(row => row.id === target.id) &&
							<Button disabled={!Platform.isDesktopApp || disabled} onClick={() => { clearPreviews(); run(async () => setRetryPreview(await workspace.previewRetry(exchange.id))); }}>
								{t('browser.workspace.previewRetry')}</Button>}
						{retryPreview?.exchangeId === exchange.id && <section class="nand-browser-workspace-preview" aria-label={t('browser.workspace.previewRetry')}>
							<h5>{t('browser.workspace.finalPrompt')}</h5>
							<pre>{retryPreview.finalPrompt}</pre>
							<p>{t('browser.workspace.target', { provider: t('browser.workspace.provider.' + retryPreview.target.provider), account: retryPreview.target.accountLabel })}</p>
							{retryPreview.duplicateRisk && <p role="status">{t('browser.workspace.duplicateRisk')}</p>}
							<Button variant="primary" disabled={disabled} onClick={() => { const id = retryPreview.id; clearPreviews(); run(() => workspace.retrySend(id)); }}>
								{t('browser.workspace.retrySend')}</Button>
						</section>}
					</section>;
				})}
			</article>)}
		</div>
	</div>;
}
