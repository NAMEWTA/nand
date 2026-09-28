import { h, render } from 'preact';
import type { ReadingService } from '../../../platform/obsidian/reading/reading-service';
import { t } from '../../../shared/i18n';
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
	const unmount = () => {
		if (root) {
			render(null, root);
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
			root = doc.body.createDiv({ cls: 'dashboard-reading-mini' });
			applyModalTheme(root);
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
		render(h(ReadingMiniPanel, { elapsed: state.elapsedSeconds, stop }), root);
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
