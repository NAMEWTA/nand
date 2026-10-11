import { useLayoutEffect, useState } from 'preact/hooks';
import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import type { BrowserPageTarget } from '../core/control';
import { browserError } from '../core/text';
import type { BrowserHost } from '../services/page-host';
import { ConsequenceConfirmation } from './ConsequenceConfirmation';

export function AccessBanner({ host, target }: { host: BrowserHost; target: BrowserPageTarget }) {
	const [, redraw] = useState(0), [failure, setFailure] = useState<unknown>();
	useLayoutEffect(() => host.subscribe(() => redraw(value => value + 1)), [host]);
	const grants = host.peekGrants?.(), records = grants?.list().filter(record => record.state === 'active' && record.pages.some(page => page.target.pageId === target.pageId
		&& page.target.profileId === target.profileId && page.target.generation === target.generation));
	if (!grants || !records?.length) return null;
	return <aside class="nand-browser-assistant-banner" data-access-banner><p role="status">{t('browser.access.activeOnPage')}</p>
		{records.map(record => <section key={record.id}><strong>{record.purpose}</strong><div class="nand-browser-workspace-actions">
			<Button onClick={() => { void grants.takeover(record.id, target).catch(setFailure); }}>{t('browser.access.takeover')}</Button>
			<Button onClick={() => grants.revoke(record.id)}>{t('browser.access.revoke')}</Button>
			<Button onClick={event => { void host.openAccess?.(event.currentTarget.win).catch(setFailure); }}>{t('browser.assistant.details')}</Button></div>
			{grants.confirmations(record.id).filter(review => review.target.pageId === target.pageId).map(review => <ConsequenceConfirmation key={review.id} review={review} decide={allowed => {
				try { grants.decide(record.id, review.id, allowed); } catch (error) { setFailure(error); }
			}} />)}
		</section>)}
		{failure && <p role="alert">{browserError(failure)}</p>}
	</aside>;
}
