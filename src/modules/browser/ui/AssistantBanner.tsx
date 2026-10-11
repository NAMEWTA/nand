import { useLayoutEffect, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import type { BrowserPageTarget } from '../core/control';
import { browserError } from '../core/text';
import type { BrowserHost } from '../services/page-host';
import { ConsequenceConfirmation } from './ConsequenceConfirmation';

/** On the original guest page: pause/takeover stays reachable when the agent reveals that page. */
export function AssistantBanner({ host, target }: { host: BrowserHost; target: BrowserPageTarget }) {
	const [, redraw] = useState(0), [failure, setFailure] = useState<unknown>();
	useLayoutEffect(() => host.subscribe(() => redraw(value => value + 1)), [host]);
	const assistant = host.peekAssistant?.(), task = assistant?.records().find(task => assistant.busy(task.id)
		&& task.pages.some(page => page.target.pageId === target.pageId && page.target.profileId === target.profileId && page.target.generation === target.generation));
	if (!assistant || !task) return null;
	const confirmation = assistant.confirmation(task.id);
	return <aside class="nand-browser-assistant-banner" data-assistant-task={task.id}>
		<p role="status">{task.title} · {t('browser.assistant.status.' + task.status)} · {t('browser.assistant.operationCount', { count: task.steps.length, limit: task.maxOperations })}</p>
		<div class="nand-browser-workspace-actions">
			<Button onClick={() => assistant.stop(task.id, 'paused')}>{t('browser.assistant.pause')}</Button>
			<Button onClick={() => { void assistant.takeover(task.id, target).catch(setFailure); }}>{t('browser.assistant.takeover')}</Button>
			<Button onClick={() => assistant.stop(task.id)}>{t('browser.assistant.stop')}</Button>
			<Button onClick={event => { void host.openAssistant?.(task.id, event.currentTarget.win).catch(setFailure); }}>{t('browser.assistant.details')}</Button>
		</div>
		{confirmation && <ConsequenceConfirmation review={confirmation.review} decide={allowed => {
			try { assistant.decide(task.id, confirmation.review.id, allowed); } catch (error) { setFailure(error); }
		}} />}
		{failure && <p role="alert">{browserError(failure)}</p>}
	</aside>;
}
