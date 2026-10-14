import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Globe } from 'lucide-react';
import type { BrowserTabData } from '../../core/workspace/model';
import type { BrowserPageHandle } from '../../../browser/api';
import { Button } from '../../../../ui/components/button';
import { EmptyState } from '../../../../ui/components/nand/EmptyState';
import { NandProviders } from '../../../../ui/react/providers';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import { useWorkspaceUI } from '../workspace/workspace-context';
export function BrowserTabView({ tab, active }: { tab: BrowserTabData; active: boolean }) {
	const { controller } = useWorkspaceUI(),
		t = useT(),
		inheritedDocument = useOwnerDocument(),
		host = controller.browserHost();
	const ref = useRef<HTMLDivElement>(null),
		[chrome, setChrome] = useState<ReactNode>(null),
		[page, setPage] = useState<BrowserPageHandle>();
	const [error, setError] = useState('');
	// A popout can close before its MutationObserver delivers the adoption. Watch
	// the stable workspace document as well, and keep browser portals on the new owner.
	const snapshotDocument = useCallback(() => ref.current?.ownerDocument ?? inheritedDocument, [inheritedDocument]);
	const ownerDocument = useSyncExternalStore(
		useCallback(
			(notify) => {
				const workspace = controller.app.workspace,
					win = workspace.containerEl.win;
				let frame: number | undefined;
				const sync = () => {
					notify();
					if (frame === undefined)
						frame = win.requestAnimationFrame(() => {
							frame = undefined;
							notify();
						});
				};
				const observer = new (win as Window & { MutationObserver: typeof MutationObserver }).MutationObserver(
					sync,
				);
				observer.observe(workspace.containerEl.ownerDocument.body, { childList: true, subtree: true });
				const changed = workspace.on('layout-change', sync);
				const closed = workspace.on('window-close', sync);
				return () => {
					observer.disconnect();
					workspace.offref(changed);
					workspace.offref(closed);
					if (frame !== undefined) win.cancelAnimationFrame(frame);
				};
			},
			[controller],
		),
		snapshotDocument,
		snapshotDocument,
	);

	useLayoutEffect(() => {
		let live = true;
		void Promise.resolve().then(() => {
			if (!live) return;
			if (!host) {
				setPage(undefined);
				return;
			}
			try {
				setPage(
					host.getPage(tab.pageId) ??
						host.createPage({
							restoreId: tab.pageId,
							url: tab.url,
							profileId: tab.profileId,
							zoom: tab.zoom,
						}),
				);
				setError('');
			} catch (error) {
				setError(String(error));
			}
		});
		return () => {
			live = false;
		};
	}, [host, tab.pageId, tab.url, tab.profileId, tab.zoom]);
	useLayoutEffect(() => {
		if (!page || !ref.current) return;
		if (active) page.mount(ref.current);
		else page.unmount(ownerDocument);
		return () => page.unmount();
	}, [page, active, ownerDocument]);
	useEffect(() => {
		if (!page || !host) return;
		let live = true;
		void host
			.renderChrome(page)
			.then((node) => {
				if (live) setChrome(node as ReactNode);
			})
			.catch((error) => setError(String(error)));
		const sync = () => controller.workspace.updateBrowser(tab.id, page.store.getState());
		sync();
		const off = page.store.subscribe(sync);
		return () => {
			live = false;
			off();
		};
	}, [host, page, controller, tab.id]);
	if (!host)
		return (
			<EmptyState
				className="h-full"
				icon={<Globe />}
				title={t('agent.workspace.browserDisabled')}
				description={tab.url}
				action={
					<Button
						onClick={() => {
							void controller.configureBrowser();
						}}
					>
						{t('agent.workspace.menu.settings')}
					</Button>
				}
			/>
		);
	if (error) return <EmptyState title={t('browser.loadFailed')} description={error} />;
	return (
		<div className="nand-browser-tab flex h-full min-h-0 flex-col">
			<NandProviders ownerDocument={ownerDocument} visible={active}>
				{chrome}
			</NandProviders>
			<div ref={ref} data-browser-placeholder={tab.pageId} className="relative min-h-0 flex-1" />
		</div>
	);
}
