import { Notice } from 'obsidian';
import { DashboardSaveError } from '../core/board/save-state';
import { t } from '../../../shared/i18n/index';
/** Expected save errors already own a per-dashboard state/notice. Unknown errors remain visible. */
export function reportDashboardFailure(error: unknown): void {
	if (error instanceof DashboardSaveError) return;
	new Notice(t('dashboard.sync.operationFailed', { detail: error instanceof Error ? error.message : String(error) }));
}
/** Observe at the UI boundary, but return the ORIGINAL rejected promise for callers which await it. */
export function observeDashboardPromise<T>(promise: Promise<T>): Promise<T> {
	void promise.catch(reportDashboardFailure);
	return promise;
}
export function guardDashboardCallbacks<T extends object>(actions: T): T {
	const guarded = { ...actions };
	for (const key of Object.keys(actions)) {
		const action: unknown = Reflect.get(actions, key);
		if (typeof action !== 'function') continue;
		Reflect.set(guarded, key, (...args: unknown[]): unknown => {
			try {
				const result: unknown = Reflect.apply(action, undefined, args);
				if (result && typeof result === 'object' && 'then' in result && typeof result.then === 'function')
					void observeDashboardPromise(Promise.resolve(result as PromiseLike<unknown>));
				return result;
			} catch (error) { reportDashboardFailure(error); return undefined; }
		});
	}
	return guarded;
}
