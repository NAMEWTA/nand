import { useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { getLanguage, onLanguageChanged, t } from '../../shared/i18n';
import { useOwnerDocument } from './contexts';

export function useLanguage() {
	return useSyncExternalStore(onLanguageChanged, getLanguage, getLanguage);
}
export function useT(): typeof t {
	useLanguage();
	return t;
}
export function useStoreSelector<S, T>(store: StoreApi<S>, selector: (state: S) => T): T {
	return useStore(store, selector);
}
export function useOwnerWindow(): Window {
	const win = useOwnerDocument().defaultView;
	if (!win) throw new Error('NAND owner window is closed');
	return win;
}
