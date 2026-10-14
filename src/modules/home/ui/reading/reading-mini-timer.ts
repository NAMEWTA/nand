import { createElement as h } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NandProviders } from '../../../../ui/react/providers';
import { widgetClasses } from '../theme/widget-classes';
import type { ReadingService } from '../../platform/reading/reading-service';
import { t } from '../../../../shared/i18n';
import { applyModalTheme } from '../appearance/modal-theme';
import { restoreFloatingPos, wireFloatingDrag } from '../ui/floating-panel-utils';
import { ReadingMiniPanel } from './ReadingMiniPanel';
import { openEndReadingModal } from './reading-dialogs';
export interface ReadingMiniTimer {
	refresh(): void;
	destroy(): void;
}
export function createReadingMiniTimer(service: ReadingService, doc: Document): ReadingMiniTimer {
	let root: HTMLElement | null = null;
	let reactRoot: Root | null = null;
	const unmount = () => {
		if (root) {
			reactRoot?.unmount();
			reactRoot = null;
			root.remove();
			root = null;
		}
	};
	const stop = () => {
		const state = service.getState();
		if (state.status === 'idle' || !state.currentBook) return;
		if (state.status === 'running') service.pause();
		openEndReadingModal(doc, service, state.currentBook, service.getElapsedSeconds(), refresh);
	};
	function refresh(): void {
		const state = service.getState();
		if (state.status === 'idle' || !state.currentBook) {
			unmount();
			return;
		}
		if (!root) {
			root = doc.body.createDiv({ cls: widgetClasses('nand-ui nand-dashboard-root dashboard-reading-mini') });
			applyModalTheme(root);
			reactRoot = createRoot(root);
			wireFloatingDrag(
				root,
				doc,
				'nand.dashboard.reading-mini-pos',
				'.dashboard-reading-mini-btn',
				service.getApp(),
			);
			restoreFloatingPos(root, doc, 'nand.dashboard.reading-mini-pos', service.getApp());
		}
		root.toggleClass('dashboard-reading-mini--paused', state.status === 'paused');
		root.title = `${state.currentBook.title} · ${t(state.status === 'paused' ? 'reading.miniPaused' : 'reading.miniReading')}`;
		reactRoot?.render(
			h(NandProviders, {
				ownerDocument: doc,
				children: h(ReadingMiniPanel, { elapsed: state.elapsedSeconds, stop }),
			}),
		);
	}
	const data = service.subscribe(refresh),
		tick = service.subscribeTick(refresh);
	refresh();
	return {
		refresh,
		destroy: () => {
			data();
			tick();
			unmount();
		},
	};
}
