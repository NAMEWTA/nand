import { useCallback, useSyncExternalStore } from 'react';

/** Obsidian adopts the existing view DOM when moving a leaf to a popout. Its React
 * root survives, so the Portal document must follow adoption without a new page. */
export function useContainerDocument(container: HTMLElement): Document {
	const subscribe = useCallback(
		(notify: () => void) => {
			let doc = container.ownerDocument;
			let observer: MutationObserver | undefined;
			const observe = () => {
				observer?.disconnect();
				const MutationObserverType = doc.defaultView?.MutationObserver;
				if (!MutationObserverType) return;
				observer = new MutationObserverType(() => {
					const next = container.ownerDocument;
					if (next === doc) return;
					doc = next;
					observe();
					notify();
				});
				observer.observe(doc.body, { childList: true, subtree: true });
			};
			observe();
			return () => observer?.disconnect();
		},
		[container],
	);
	const snapshot = useCallback(() => container.ownerDocument, [container]);
	return useSyncExternalStore(subscribe, snapshot, snapshot);
}
