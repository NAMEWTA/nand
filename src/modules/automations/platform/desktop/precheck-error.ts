import { AutomationError } from '../../../../shared/automation/errors';

export function precheckError(error: unknown): Error {
	return error instanceof Error
		? error
		: typeof error === 'string'
			? new Error(error)
			: new AutomationError('precheckProcessFailed');
}
