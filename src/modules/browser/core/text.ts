import { t } from '../../../shared/i18n';
import { BrowserError, type BrowserGrab } from './model';

/** User-facing text for a browser failure (`browser_*` codes are localized). */
export function browserError(error: unknown): string {
	const message = error instanceof BrowserError ? error.code : error instanceof Error ? error.message : String(error);
	if (!message.startsWith('browser_')) return message;
	const translated = t(`browser.${message}`);
	return translated === `browser.${message}` ? t('browser.browser_failed') : translated;
}

/** A design-mode selection as plain text material (copy, or paste into an agent session). */
export function grabText(grab: BrowserGrab): string {
	return [
		t('browser.material'),
		grab.title,
		grab.url,
		`${t('browser.selector')}: ${grab.selector}`,
		`${t('browser.source')}: ${grab.source || t('browser.sourceMissing')}`,
		grab.text,
		JSON.stringify(grab.styles, null, 2),
		grab.html,
	].join('\n\n');
}
