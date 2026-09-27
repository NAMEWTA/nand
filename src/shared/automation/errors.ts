import { t } from '../i18n';
/** Persist the code; translate when rendering a run, including after a language change. */
export class AutomationError extends Error {
	constructor(readonly code: string) {
		super(t(`automation.${code}`));
	}
}
