import { Platform } from 'obsidian';
import { useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import type { WorkspaceData } from '../core/workspace/model';
import { taskTurns } from '../core/workspace/history';
import type { WorkspaceRecoveryReview } from '../core/workspace/recovery';
import { browserError } from '../core/text';
import type { BrowserModule } from '../services';
import { Answer, CaptureDetails, CaptureHistory, IncompleteAnswer, ImportedTranscript, type CopyAnswer, type MountMarkdown } from './WorkspaceAnswers';
import { SynthesisDocument } from './SynthesisPanel';

function RecoveryDocuments({ data, copy, mount }: { data: WorkspaceData; copy: CopyAnswer; mount: MountMarkdown }) {
	return <div class="nand-browser-workspace-turns">{data.tasks.map(task => <section key={task.id} class="nand-browser-workspace-preview">
		<h4>{task.title}</h4>
		{task.draft && <><h5>{t('browser.workspace.recoveryQuestion')}</h5><pre>{task.draft}</pre></>}
		{taskTurns(data, task.id).map(turn => <section key={turn.id}>
			<h5>{t('browser.workspace.recoveryRound', { sequence: turn.sequence })}</h5><pre>{turn.finalPrompt}</pre>
			{turn.targets.map(target => {
				const exchange = data.exchanges.find(exchange => exchange.turnId === turn.id && exchange.targetId === target.id);
				if (!exchange) return null;
				const capture = exchange.captures.at(-1);
				return <section key={exchange.id}>
					<h5>{target && t('browser.workspace.provider.' + target.provider)} · {target?.accountLabel}</h5>
					{exchange.imported ? <ImportedTranscript source={exchange.imported} mount={mount} copy={copy} /> : capture ? <>
						<p>{t(capture.complete ? 'browser.workspace.acquire.complete' : 'browser.workspace.acquire.incomplete')}</p>
						{!capture.complete && <IncompleteAnswer reasons={capture.reasons} />}
						<Answer text={capture.markdown} mount={mount} /><CaptureDetails capture={capture} copy={copy} />
						{exchange.captures.length > 1 && <CaptureHistory captures={exchange.captures.slice(0, -1)} mount={mount} copy={copy} />}
					</> : <p>{t('browser.workspace.recoveryNoAnswer')}</p>}
					{!!exchange.selections?.length && <section><h5>{t('browser.guidance.excerpts')}</h5><CaptureHistory captures={exchange.selections} mount={mount} copy={copy} /></section>}
				</section>;
			})}
		</section>)}
	</section>)}{data.syntheses.map(record => <SynthesisDocument key={record.id} record={record} copy={copy} mount={mount} />)}</div>;
}

/** Also available when journal initialization fails. These readers have no provider controls. */
export function WorkspaceRecovery({ module, mount, restored }: { module: BrowserModule; mount: MountMarkdown; restored: () => void }) {
	const [review, setReview] = useState<WorkspaceRecoveryReview>(), [failure, setFailure] = useState<unknown>(), [busy, setBusy] = useState(false);
	const [showLocal, setShowLocal] = useState(false), [showDraft, setShowDraft] = useState(false);
	const copy: CopyAnswer = async (text, win) => { if (Platform.isDesktopApp) module.copyText(text); else await win.navigator.clipboard.writeText(text); };
	const inspect = (draftId?: string) => {
		setBusy(true); setFailure(undefined); setReview(undefined); setShowLocal(false); setShowDraft(false);
		void module.reviewWorkspaceRecovery(draftId).then(setReview, setFailure).finally(() => setBusy(false));
	};
	return <section class="nand-browser-recovery nand-browser-workspace">
		<Button disabled={busy} onClick={() => inspect()}>{t('browser.workspace.reviewRecovery')}</Button>
		{failure && <p role="alert">{browserError(failure)}</p>}
		{review && <>
			<h3>{t('browser.workspace.recoveryTitle')}</h3>
			<p>{t('browser.workspace.recoveryScope')}</p>
			{review.error && <p role="alert">{t('browser.' + review.error)}</p>}
			{review.drafts.length > 0 && <>
				<p>{t('browser.workspace.recoveryChoose')}</p>
				{review.drafts.map(draft => <div key={draft.id} data-recovery-id={draft.id}>
					<Button disabled={busy} onClick={() => inspect(draft.id)}>{draft.at
						? t('browser.workspace.recoverySnapshot', { at: new Date(draft.at).toLocaleString(), answers: draft.captures })
						: t('browser.workspace.recoveryUnreadable')}</Button>
				</div>)}
			</>}
			{review.local && <>
				<Button onClick={() => setShowLocal(!showLocal)}>{t(showLocal ? 'browser.workspace.hideLocalAnswers' : 'browser.workspace.readLocalAnswers')}</Button>
				{showLocal && <RecoveryDocuments data={review.local} copy={copy} mount={mount} />}
			</>}
			{review.draft ? <>
				<p>{t('browser.workspace.recoverySavedAt', { at: new Date(review.at!).toLocaleString() })}</p>
				<p>{t('browser.workspace.recoveryCounts', { tasks: review.draft.tasks.length, rounds: review.draft.turns.length, answers: review.draft.exchanges.reduce((count, exchange) => count + exchange.captures.length + Number(!!exchange.imported), review.draft.syntheses.length) })}</p>
				<Button onClick={() => setShowDraft(!showDraft)}>{t(showDraft ? 'browser.workspace.hideRecoveryAnswers' : 'browser.workspace.readRecoveryAnswers')}</Button>
				{showDraft && <RecoveryDocuments data={review.draft} copy={copy} mount={mount} />}
				{review.unchanged && <p>{t('browser.workspace.recoveryAlreadySaved')}</p>}
				{review.canRestore && <Button disabled={busy} onClick={() => {
					setBusy(true); setFailure(undefined);
					void module.restoreWorkspaceRecovery(review.id).then(() => { setReview(undefined); restored(); }, setFailure).finally(() => setBusy(false));
				}}>{t('browser.workspace.restoreRecovery')}</Button>}
			</> : !review.error && !review.drafts.length && <p>{t('browser.workspace.recoveryNone')}</p>}
			<p>{t('browser.workspace.recoveryFile')} <code>{review.file}</code></p>
		</>}
	</section>;
}
