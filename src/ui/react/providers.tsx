import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { registerMessages } from '../../shared/i18n';
import { messages } from '../../shared/i18n/lazy/ui';
import { TooltipProvider } from '../components/tooltip';
import { Toaster } from '../components/sonner';
import { OwnerDocumentContext, PortalContainerContext, VisibilityContext, usePortalContainer } from './contexts';
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

function SurfaceAppearance({ container }: { container: HTMLElement }) {
	const portal = usePortalContainer();
	useLayoutEffect(() => {
		const sync = () => { container.setAttribute('data-font', portal.dataset.font ?? 'geist'); container.setAttribute('data-palette', portal.dataset.palette ?? 'host'); };
		sync();
		const Observer = (portal.ownerDocument.defaultView as Window & { MutationObserver?: typeof MutationObserver } | null)?.MutationObserver;
		const observer = Observer ? new Observer(sync) : undefined;
		observer?.observe(portal, { attributes: true, attributeFilter: ['data-font', 'data-palette'] });
		return () => observer?.disconnect();
	}, [container, portal]);
	return null;
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
			<SurfaceAppearance container={container} />
			{children}
		</NandProviders>
	);
}
