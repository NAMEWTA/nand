import { renderEmptyState } from '../../shared/empty-state';
import { t } from '../../shared/i18n';
import type { EditorDomain } from '../host/registry';

/** Placeholder domain. A later iteration owns this folder; do not grow it here. */
export const writingStatsDomain: EditorDomain = {
	id: 'writing-stats',
	titleKey: 'editor.writingStats.title',
	icon: 'bar-chart-3',
	mountPanel(el) {
		el.empty();
		renderEmptyState(el, { icon: 'bar-chart-3', title: t('editor.writingStats.title'), description: t('editor.writingStats.placeholder') });
		return () => {
			el.empty();
		};
	},
};
