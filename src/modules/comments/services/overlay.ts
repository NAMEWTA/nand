import { createStore } from 'zustand/vanilla';
import type { TextAnchorV2 } from '../core/model';

export interface OverlayRequest {
	path: string;
	ownerDocument: Document;
	rect(): DOMRect;
	visible?(): boolean;
	focus?(): void;
	threadIds?: string[];
	anchor?: TextAnchorV2;
	mode: 'threads' | 'compose' | 'selection' | 'resolve-all';
	pinned: boolean;
}
export function createOverlayChannel() {
	const state = createStore(() => ({ request: null as OverlayRequest | null, revision: 0, draft: false }));
	let closeTimer: number | null = null;
	let hovered = false;
	let timerWindow: Window | null = null;
	const cancelClose = () => {
		if (closeTimer !== null) timerWindow?.clearTimeout(closeTimer);
		closeTimer = null;
	};
	const close = (restore = true) => {
		cancelClose();
		hovered = false;
		const request = state.getState().request;
		state.setState({ request: null, draft: false });
		if (restore) request?.focus?.();
	};
	return {
		state, cancelClose, close,
		setHovered(value: boolean) { hovered = value; if (value) cancelClose(); },
		/** Returns false when the request was refused so callers can tell the user. */
		open(request: OverlayRequest): boolean {
			cancelClose();
			const current = state.getState();
			if ((current.draft && current.request !== request) || (current.request?.pinned && !request.pinned)) return false;
			state.setState({ request, draft: request.mode === 'compose', revision: current.revision + 1 });
			return true;
		},
		pin() { const request = state.getState().request; if (request) state.setState({ request: { ...request, pinned: true } }); },
		setDraft(draft: boolean) { state.setState({ draft }); },
		refresh() { const { request, draft } = state.getState(); if (!request) return; if (!request.pinned && !draft && request.visible && !request.visible()) close(false); else state.setState(s => ({ revision: s.revision + 1 })); },
		scheduleClose() {
			cancelClose();
			const { request, draft } = state.getState();
			if (!request || request.pinned || draft || hovered || request.mode === 'selection') return;
			timerWindow = request.ownerDocument.defaultView;
			closeTimer = timerWindow?.setTimeout(() => { closeTimer = null; const now = state.getState(); if (!now.request?.pinned && !now.draft && !hovered) close(false); }, 300) ?? null;
		},
		dispose() { close(false); },
	};
}
export type OverlayChannel = ReturnType<typeof createOverlayChannel>;
