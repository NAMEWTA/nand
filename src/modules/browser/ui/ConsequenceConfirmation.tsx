import { t } from '../../../shared/i18n';
import { Button } from '../../../ui/primitives/Button';
import type { BrowserActionReview } from '../core/control';

/** Plain text only: observed page material cannot render controls or become permission. */
export function ConsequenceConfirmation({ review, decide }: { review: BrowserActionReview; decide: (allowed: boolean) => void }) {
	return <section class="nand-browser-consequence" data-action-review={review.id}>
		<h4>{t('browser.assistant.confirmTitle')}</h4>
		<p>{t('browser.assistant.confirmHelp')}</p>
		<dl><dt>{t('browser.assistant.object')}</dt><dd>{review.object.name} · {review.object.tag}</dd>
			<dt>{t('browser.assistant.page')}</dt><dd>{review.pageUrl}</dd>
			<dt>{t('browser.assistant.destination')}</dt><dd>{review.destination || t('browser.assistant.destinationUnknown')}</dd></dl>
		{review.action.kind === 'keypress' && <p>{t('browser.assistant.key', { key: review.action.key })}</p>}
		<div class="nand-browser-consequence-material">
			{review.fields.map((field, index) => <div key={index}><strong>{field.name || field.type}</strong><pre>{field.value}</pre>
				{field.checked !== undefined && <p>{t(field.checked ? 'browser.assistant.checked' : 'browser.assistant.unchecked')}</p>}</div>)}
			<details><summary>{t('browser.assistant.context')}</summary><pre>{review.content}</pre></details>
		</div>
		<p>{t('browser.assistant.confirmOnce')}</p>
		<div class="nand-browser-workspace-actions"><Button onClick={() => decide(false)}>{t('browser.assistant.decline')}</Button>
			<Button variant="primary" disabled={!review.destination} onClick={() => decide(true)}>{t('browser.assistant.confirm')}</Button></div>
	</section>;
}
