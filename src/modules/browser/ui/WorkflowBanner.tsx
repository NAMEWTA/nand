import { useLayoutEffect, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import type { BrowserPageTarget } from '../core/control';
import { browserError } from '../core/text';
import type { BrowserHost } from '../services/page-host';
import { ConsequenceConfirmation } from './ConsequenceConfirmation';

export function WorkflowBanner({ host, target }: { host: BrowserHost; target: BrowserPageTarget }) {
	const [, redraw] = useState(0), [failure, setFailure] = useState<unknown>();
	useLayoutEffect(() => host.subscribe(() => redraw(value => value + 1)), [host]);
	const workflows = host.peekWorkflows?.(), record = workflows?.records().find(run => workflows.busy(run.runId)
		&& run.bindings.some(b => b.target.pageId === target.pageId && b.target.profileId === target.profileId && b.target.generation === target.generation));
	if (!workflows || !record) return null; const review = workflows.confirmation(record.runId);
	return <aside class="nand-browser-assistant-banner" data-workflow-banner={record.runId}><p role="status">{record.spec.title} · {t('browser.assistant.status.' + record.phase)}</p>
		<div class="nand-browser-workspace-actions">{record.phase === 'paused'
			? <Button onClick={() => { void workflows.resume(record.runId).catch(setFailure); }}>{t('browser.workflow.resume')}</Button>
			: <Button onClick={() => workflows.pause(record.runId)}>{t('browser.assistant.pause')}</Button>}
			<Button onClick={() => { void workflows.takeover(record.runId, target).catch(setFailure); }}>{t('browser.assistant.takeover')}</Button>
			<Button onClick={() => { void workflows.cancel(record.runId).catch(setFailure); }}>{t('browser.assistant.stop')}</Button>
			<Button onClick={event => { void host.openWorkflows?.(record.runId, event.currentTarget.win).catch(setFailure); }}>{t('browser.assistant.details')}</Button></div>
		{review && <ConsequenceConfirmation review={review} decide={allowed => { try { workflows.decide(record.runId, review.id, allowed); } catch (error) { setFailure(error); } }} />}
		{failure && <p role="alert">{browserError(failure)}</p>}
	</aside>;
}
