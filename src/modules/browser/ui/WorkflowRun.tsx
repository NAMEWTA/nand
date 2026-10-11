import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import type { WorkflowExecution } from '../core/workflows/model';
import { browserError } from '../core/text';
import type { BrowserModule } from '../services';
import type { BrowserWorkflows } from '../services/workflows';
import { ConsequenceConfirmation } from './ConsequenceConfirmation';

export function WorkflowRun({ module, workflows, record, work }: { module: BrowserModule; workflows: BrowserWorkflows; record: WorkflowExecution; work: (action: () => Promise<unknown>) => void }) {
	const confirmation = workflows.confirmation(record.runId), busy = workflows.busy(record.runId);
	return <article class="nand-browser-workspace-preview" data-workflow-run={record.runId}>
		<h3>{record.spec.title} · {t('browser.workflow.version', { version: record.spec.version })}</h3>
		<p role="status">{t('browser.assistant.status.' + record.phase)}</p><p><code>{record.runId}</code></p>
		{record.errorCode && <p role="alert">{browserError(record.errorCode)}</p>}
		<div class="nand-browser-workspace-actions">{busy && <>
			{record.phase === 'paused' ? <Button onClick={() => work(() => workflows.resume(record.runId))}>{t('browser.workflow.resume')}</Button>
				: <Button onClick={() => workflows.pause(record.runId)}>{t('browser.assistant.pause')}</Button>}
			<Button onClick={() => work(() => workflows.cancel(record.runId))}>{t('browser.assistant.stop')}</Button>
		</>}{record.phase === 'succeeded' && <Button disabled={workflows.unsaved(record.runId)} onClick={() => work(() => workflows.saveVerified(record.runId))}>{t('browser.workflow.saveVerified')}</Button>}</div>
		{record.bindings.map(binding => <div key={binding.scopeId}><p>{binding.title} · {binding.accountLabel} · {binding.url}</p>
			<div class="nand-browser-workspace-actions"><Button onClick={() => work(() => module.activate(binding.target.pageId))}>{t('browser.assistant.showPage')}</Button>
				{busy && <Button onClick={() => work(() => workflows.takeover(record.runId, binding.target))}>{t('browser.assistant.takeover')}</Button>}</div></div>)}
		{record.secretNames.length > 0 && <p>{t('browser.workflow.secretEvidence')}</p>}
		{confirmation && <ConsequenceConfirmation review={confirmation} decide={allowed => work(async () => workflows.decide(record.runId, confirmation.id, allowed))} />}
		<ol>{record.steps.map((step, index) => <li key={step.id}><strong>{t('browser.workflow.operation.' + record.spec.steps[index]!.operation)}</strong> · {t('browser.workflow.step.' + step.state)}
			{step.errorCode && <p>{browserError(step.errorCode)}</p>}
			{(['precondition', 'postcondition'] as const).map(kind => <details key={kind}><summary>{t('browser.workflow.' + kind)} · {step[kind].filter(c => c.matched).length}/{record.spec.steps[index]![kind].length}</summary>
				<ul>{record.spec.steps[index]![kind].map((condition, at) => <li key={at}>{t('browser.workflow.condition.' + condition.kind)} · {'element' in condition && `${condition.element.role}: ${condition.element.name}`}
					{'equals' in condition && <pre>{condition.equals}</pre>}
					<span>{t(step[kind][at] ? step[kind][at].matched ? 'browser.workflow.matched' : 'browser.workflow.notMatched' : 'browser.workflow.notChecked')}</span>
					{step[kind][at]?.observed !== undefined && <pre>{step[kind][at].observed}</pre>}</li>)}</ul>
			</details>)}
		</li>)}</ol>
		{record.result && <><h4>{t('browser.workflow.result')}</h4><pre>{record.result}</pre></>}
		{workflows.unsaved(record.runId) && <><p role="alert">{t('browser.workspace.synthesis.unsaved')}</p><p><code>{workflows.recoveryPath(record.runId)}</code></p>
			<Button onClick={() => work(() => workflows.retrySave())}>{t('browser.workspace.retrySave')}</Button></>}
	</article>;
}
