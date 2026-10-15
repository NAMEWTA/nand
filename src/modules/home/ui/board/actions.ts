import { toast } from 'sonner';
import { DashboardSaveError } from '../../core/board/save-state';
import { t } from '../../../../shared/i18n';

/** Observe the complete React event chain, including success callbacks. Save-state
 * errors already have the durable recovery banner; other failures need feedback.
 * Return the original promise so callers that await it still see the failure. */
export function observeBoardAction<T>(promise: Promise<T>): Promise<T> {
	void promise.catch((error: unknown) => {
		if (!(error instanceof DashboardSaveError)) toast(t('storage.unsaved'));
	});
	return promise;
}
