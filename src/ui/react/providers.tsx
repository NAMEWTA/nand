import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { registerMessages } from '../../shared/i18n';
import { messages } from '../../shared/i18n/lazy/ui';
import { TooltipProvider } from '../components/tooltip';
import { Toaster } from '../components/sonner';
import { OwnerDocumentContext, PortalContainerContext, VisibilityContext } from './contexts';
import { acquirePortalRoot, registerToastHost, releasePortalRoot } from './portal';
import { useContainerDocument } from './owner-document';
import { ErrorBoundary } from './error-boundary';

function createPortalLease() {
	let portal: HTMLElement | null = null;
	return {
		getSnapshot: () => portal,
		subscribe(doc: Document, notify: () => void) {
			registerMessages(messages);
			portal = acquirePortalRoot(doc);
			notify();
			return () => releasePortalRoot(doc);
		},
	};
}

export function NandProviders({
	ownerDocument,
	visible = true,
	children,
}: {
	ownerDocument: Document;
	visible?: boolean;
	children: ReactNode;
}) {
	// Keep the last acquired snapshot while React resubscribes after adoption.
	// A missing target portal must never replace the mounted page with null.
	const [lease] = useState(createPortalLease);
	const portal = useSyncExternalStore(
		useCallback((notify) => lease.subscribe(ownerDocument, notify), [lease, ownerDocument]),
		lease.getSnapshot,
		() => null,
	);
	const [toastHost, setToastHost] = useState(false);
	const portalDocument = portal?.ownerDocument ?? ownerDocument;
	useEffect(() => registerToastHost(portalDocument, setToastHost), [portalDocument]);
	if (!portal) return null;
	return (
		<OwnerDocumentContext.Provider value={portalDocument}>
			<PortalContainerContext.Provider value={portal}>
				<VisibilityContext.Provider value={visible}>
					<TooltipProvider delayDuration={400}>
						<ErrorBoundary>{children}</ErrorBoundary>
						{toastHost && <Toaster container={portal} />}
					</TooltipProvider>
				</VisibilityContext.Provider>
			</PortalContainerContext.Provider>
		</OwnerDocumentContext.Provider>
	);
}

export function ContainerProviders({
	container,
	visible = true,
	children,
}: {
	container: HTMLElement;
	visible?: boolean;
	children: ReactNode;
}) {
	const ownerDocument = useContainerDocument(container);
	return (
		<NandProviders ownerDocument={ownerDocument} visible={visible}>
			{children}
		</NandProviders>
	);
}
