import { h, render } from 'preact';
import { t } from '../../../shared/i18n/index';
import { EmptyState } from '../../primitives/EmptyState';
import type { EditorDomain } from '../domain';

/** Placeholder domain. A later iteration owns this folder; do not grow it here. */
export const focusDomain: EditorDomain = {
	id: 'focus',
	titleKey: 'editor.focus.title',
	icon: 'crosshair',
	mountPanel(el) {
		el.empty();
		render(
			h(EmptyState, {
				icon: 'crosshair',
				title: t('editor.focus.title'),
				description: t('editor.focus.placeholder'),
			}),
			el,
		);
		return () => {
			render(null, el);
		};
	},
};
