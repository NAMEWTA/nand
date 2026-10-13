import { listenNative, type NativeEvents } from './electron-api';

/** The remote will-download callback can arrive after the native item completes. */
export function watchDownload(item: NativeEvents & { getState(): string }, update: (state: string) => void, finished: () => void): () => void {
	const offUpdate = listenNative(item, 'updated', (_event, state) => update(String(state)));
	const offDone = listenNative(item, 'done', (_event, state) => { update(String(state)); dispose(); finished(); });
	const dispose = () => { offUpdate(); offDone(); };
	try {
		const state = item.getState();
		update(state);
		if (state === 'completed' || state === 'cancelled') { dispose(); finished(); }
	} catch (error) { dispose(); throw error; }
	return dispose;
}
