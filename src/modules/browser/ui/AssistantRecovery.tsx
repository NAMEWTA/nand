import { useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import type { AssistantRecoveryReview } from '../core/assistant/recovery';
import { browserError } from '../core/text';
import type { BrowserModule } from '../services';
import { Answer, type MountMarkdown } from './WorkspaceAnswers';

export function AssistantRecovery({ module, mount, restored }: { module: BrowserModule; mount: MountMarkdown; restored: () => void }) {
	const [review, setReview] = useState<AssistantRecoveryReview>(), [failure, setFailure] = useState<unknown>(), [busy, setBusy] = useState(false);
	const inspect = (id?: string) => {
		setBusy(true); setFailure(undefined); setReview(undefined);
		void module.reviewAssistantRecovery(id).then(setReview, setFailure).finally(() => setBusy(false));
	};
	return <section class="nand-browser-recovery nand-browser-workspace" data-assistant-recovery>
		<Button disabled={busy} onClick={() => inspect()}>{t('browser.workspace.reviewRecovery')}</Button>
		{failure && <p role="alert">{browserError(failure)}</p>}
		{review && <>
			<h3>{t('browser.workspace.recoveryTitle')}</h3><p>{t('browser.assistant.recoveryHelp')}</p>
			{review.error && <p role="alert">{browserError(review.error)}</p>}
			{review.drafts.map(draft => <div key={draft.id} data-recovery-id={draft.id}><Button disabled={busy} onClick={() => inspect(draft.id)}>
				{draft.at ? t('browser.assistant.recoverySnapshot', { at: new Date(draft.at).toLocaleString(), tasks: draft.tasks }) : t('browser.workspace.recoveryUnreadable')}
			</Button></div>)}
			{([['local', review.local], ['draft', review.draft]] as const).map(([kind, data]) => data && <details key={kind}>
				<summary>{t(kind === 'local' ? 'browser.workspace.readLocalAnswers' : 'browser.workspace.readRecoveryAnswers')}</summary>
				{data.tasks.map(task => <article key={task.id} class="nand-browser-workspace-preview"><h4>{task.title}</h4>
					<p>{t('browser.assistant.status.' + task.status)}</p><pre>{task.goal}</pre><Answer text={task.text} mount={mount} />
					<details><summary>{t('browser.workspace.finalPrompt')}</summary><pre>{task.prompt}</pre></details>
					{task.steps.map(step => <details key={step.id}><summary>{t('browser.assistant.operation.' + step.operation)} · {t('browser.assistant.step.' + step.state)}</summary><pre>{step.evidence}</pre></details>)}
				</article>)}
			</details>)}
			{review.unchanged && <p>{t('browser.workspace.recoveryAlreadySaved')}</p>}
			{review.canRestore && <Button disabled={busy} onClick={() => {
				setBusy(true); setFailure(undefined);
				void module.restoreAssistantRecovery(review.id).then(() => { setReview(undefined); restored(); }, setFailure).finally(() => setBusy(false));
			}}>{t('browser.workspace.restoreRecovery')}</Button>}
			{!review.drafts.length && !review.error && <p>{t('browser.workspace.recoveryNone')}</p>}
			<p>{t('browser.workspace.recoveryFile')} <code>{review.file}</code></p>
		</>}
	</section>;
}
