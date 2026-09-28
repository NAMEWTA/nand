import { h, render } from 'preact';
import { t } from '../../../shared/i18n/index';
import { EmptyState } from '../../primitives/EmptyState';
import type { EditorDomain } from '../domain';

/** Placeholder domain. A later iteration owns this folder; do not grow it here. */
export const writingStatsDomain: EditorDomain = {
	id: 'writing-stats',
	titleKey: 'editor.writingStats.title',
	icon: 'bar-chart-3',
	mountPanel(el) {
		el.empty();
		render(
			h(EmptyState, {
				icon: 'bar-chart-3',
				title: t('editor.writingStats.title'),
				description: t('editor.writingStats.placeholder'),
			}),
			el,
		);
		return () => {
			render(null, el);
		};
	},
};
