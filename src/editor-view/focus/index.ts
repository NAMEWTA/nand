import { renderEmptyState } from '../../shared/empty-state';
import { t } from '../../shared/i18n';
import type { EditorDomain } from '../host/registry';

/** Placeholder domain. A later iteration owns this folder; do not grow it here. */
export const focusDomain: EditorDomain = {
	id: 'focus',
	titleKey: 'editor.focus.title',
	icon: 'crosshair',
	mountPanel(el) {
		el.empty();
		renderEmptyState(el, { icon: 'crosshair', title: t('editor.focus.title'), description: t('editor.focus.placeholder') });
		return () => {
			el.empty();
		};
	},
};
