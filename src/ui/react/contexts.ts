import { createContext, useContext } from 'react';

export const OwnerDocumentContext = createContext<Document | null>(null);
export const PortalContainerContext = createContext<HTMLElement | null>(null);
export const VisibilityContext = createContext(true);

export function useOwnerDocument(): Document {
	const doc = useContext(OwnerDocumentContext);
	if (!doc) throw new Error('NAND components require NandProviders');
	return doc;
}
export function usePortalContainer(): HTMLElement {
	const container = useContext(PortalContainerContext);
	if (!container) throw new Error('NAND portals require NandProviders');
	return container;
}
export function useVisible(): boolean {
	return useContext(VisibilityContext);
}
