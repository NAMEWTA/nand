import { h, render } from 'preact';
import type { App } from 'obsidian';
import { onLanguageChanged, t } from '../../../../shared/i18n';
import { formatFocalPoint } from '../../core/board/focal-point';
import type { FocalPointOptions } from './FocalPointPanel';
import { ownDialog } from '../ui/dialog-scope';

/** A lazy editor owned by one native form row. Closing before import completes is safe. */
export function mountFocalEditor(root: HTMLElement, initial: FocalPointOptions, app: App): { update: (source: string | null, value: unknown) => void; dispose: () => void } {
	let options = initial, closed = false, failed = false;
	let panel: typeof import('./FocalPointPanel').FocalPointPanel | undefined;
	const draw = () => {
		if (closed) return;
		if (!panel) {
			if (failed) render(h('p', { role: 'alert' }, t('focal.loadError')), root);
			return;
		}
		render(h(panel, { ...options, key: options.source ?? '', captureEscape: cancel => ownDialog(app, cancel, root), change: point => {
			options = { ...options, value: formatFocalPoint(point) };
			options.change(point); draw();
		} }), root);
	};
	const unsubscribe = onLanguageChanged(draw);
	void import('./FocalPointPanel').then(module => { panel = module.FocalPointPanel; draw(); }, () => { failed = true; draw(); });
	return {
		update(source, value) { options = { ...options, source, value }; draw(); },
		dispose() { closed = true; unsubscribe(); render(null, root); },
	};
}
