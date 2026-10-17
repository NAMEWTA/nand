// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/modal-theme.ts
import { createRoot } from 'react-dom/client';
import type { ReactNode } from 'react';
import { NandProviders } from '../../../../ui/react/providers';
import { RecordDialog } from './RecordDialog';

import { trackRecordDialog } from './record-lifetime';
/** Transitional command/legacy renderer entry. React widgets render RecordDialog in their own tree. */
export function openRecordDialog(
	doc: Document,
	title: string,
	classes: string,
	render: (close: () => void, root: HTMLElement) => ReactNode,
): () => void {
	return openRecordOverlay(doc, (close, host) => (
		<RecordDialog title={title} classes={classes} onClose={close}>
			{render(close, host)}
		</RecordDialog>
	));
}
export function openRecordOverlay(
	doc: Document,
	render: (close: () => void, host: HTMLElement) => ReactNode,
): () => void {
	const host = doc.createElement('div');
	host.className = 'nand-ui';
	doc.body.append(host);
	const root = createRoot(host);
	let closed = false;
	const close = () => {
		if (closed) return;
		closed = true;
		untrack();
		doc.defaultView?.removeEventListener('unload', close);
		root.unmount();
		host.remove();
	};
	const untrack = trackRecordDialog(close);
	doc.defaultView?.addEventListener('unload', close, { once: true });
	root.render(<NandProviders ownerDocument={doc}>{render(close, host)}</NandProviders>);
	return close;
}
