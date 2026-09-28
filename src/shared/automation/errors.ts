import { t } from '../i18n/index';
import type { AutomationMessage, RunStatus } from './types';
/** Persist the code; translate when rendering a run, including after a language change. */
export class AutomationError extends Error {
	constructor(readonly code: string, readonly params?: Record<string, string | number>) {
		super(t(`automation.${code}`, params));
	}
}

/** Unknown codes and legacy free text are never guessed or rewritten. */
export function automationMessage(value: AutomationMessage): string {
	const fallback = typeof value.message === 'string' ? value.message : '';
	if (typeof value.errorCode !== 'string') return fallback;
	const key = `automation.${value.errorCode}`;
	const template = t(key);
	const params = value.errorParams;
	if (
		template === key ||
		(params !== undefined &&
			(!params || typeof params !== 'object' || Array.isArray(params) ||
				Object.values(params).some(v => typeof v !== 'string' && typeof v !== 'number')))
	) return fallback;
	if (Array.from(template.matchAll(/\{([^}]+)\}/g)).some(match => params?.[match[1]!] === undefined))
		return fallback;
	return t(key, params);
}

export function automationOutcome(value: AutomationMessage & { status: RunStatus }): string {
	const message = automationMessage(value).slice(0, 240);
	return `${t(`automation.${value.status}`)}${message ? t('automation.colon') + message : ''}`;
}

export function automationFailure(error: unknown): AutomationMessage {
	const message = error instanceof Error ? error.message : String(error);
	return error instanceof AutomationError
		? { message, errorCode: error.code, errorParams: error.params }
		: { message, errorCode: 'operationFailed', errorParams: { detail: message } };
}
