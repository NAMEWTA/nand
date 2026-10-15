import { openTerminalUrl } from '../../core/terminal/links';
// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/terminal-pane/TerminalContextMenu.tsx, TerminalProcessExitOverlay.tsx
import { useEffect, useLayoutEffect, useRef, useState, Fragment } from 'react';
import { RotateCw, X } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelGroupHandle } from 'react-resizable-panels';
import type { TerminalTabData } from '../../core/workspace/model';
import type { LayoutNode } from '../../core/terminal/layout';
import { Button } from '../../../../ui/components/button';
import { TerminalSearch } from './TerminalSearch';
import { StatusDot } from '../../../../ui/components/nand/StatusDot';
import { sessionState } from '../../services/terminal/status';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '../../../../ui/components/dialog';
import { Input } from '../../../../ui/components/input';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
 ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger,
	ContextMenuTrigger,
} from '../../../../ui/components/context-menu';
import { EmptyState } from '../../../../ui/components/nand/EmptyState';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import { TerminalView } from './terminal-view';
import { HiddenRendererRetention } from './hidden-renderer-retention';
import { useWorkspaceUI } from '../workspace/workspace-context';
import { openPath } from '../../platform/desktop/files';
import { useAgentSettings } from '../settings/settings-context';
import { pickMaterial } from './material-picker';

export function TerminalHost({
	tab,
	sessionId,
	active,
	focused,
	retention,
}: {
	tab: TerminalTabData;
	sessionId: string;
	active: boolean;
	focused: boolean;
	retention: HiddenRendererRetention;
}) {
	const { controller, confirm } = useWorkspaceUI(),
		workspace = controller.workspace,
		t = useT(),
		doc = useOwnerDocument();
	const settings = useAgentSettings(controller.settings);
	const session = controller.sessions.get(sessionId),
		ref = useRef<HTMLDivElement>(null),
		view = useRef<TerminalView | undefined>(undefined);
	const [search, setSearch] = useState(false),
		[rename, setRename] = useState(false),
		[draft, setDraft] = useState(''),
		[busy, setBusy] = useState(false),
		[error, setError] = useState(''),
		[contextMenuVisible, setContextMenuVisible] = useState(false);
	const [wasActive, setWasActive] = useState(active);
	if (wasActive !== active) {
		setWasActive(active);
		if (!active) {
			setSearch(false);
			setRename(false);
			setContextMenuVisible(false);
		}
	}
	const info = tab.panes[sessionId] ?? tab.resume;
	useLayoutEffect(() => {
		if (!session || !ref.current) return;
		const current = new TerminalView(ref.current, session, {
			app: controller.app,
			settings: () => controller.settings.get(),
			retention,
			vaultPath: () => controller.vaultPath(),
			focused: () => workspace.focusSession(sessionId),
 openLink:(url,event)=>openTerminalUrl(url,event,controller.browserHost(),()=>{ref.current?.win.open(url);}),
		});
		view.current = current;
		const host = ref.current,
			find = () => setSearch(true);
		host.addEventListener('nand-terminal-find', find);
		const off = controller.settings.subscribe(() => current.applySettings());
		const cssEvent = controller.app.workspace.on('css-change', () => current.applySettings());
		const win = doc.defaultView as (Window & { MutationObserver: typeof MutationObserver }) | null;
		const themeObserver = win ? new win.MutationObserver(() => current.applySettings()) : undefined;
		themeObserver?.observe(doc.body, { attributes: true, attributeFilter: ['class', 'style'] });
		return () => {
			host.removeEventListener('nand-terminal-find', find);
			off();
			controller.app.workspace.offref(cssEvent);
			themeObserver?.disconnect();
			current.dispose();
			if (view.current === current) view.current = undefined;
		};
	}, [session, sessionId, controller, workspace, doc, retention]);
	useEffect(() => {
		view.current?.setVisible(active);
		if (active && focused) view.current?.focus();
	}, [active, focused, session, doc]);
	const restore = async (restart = false) => {
		setBusy(true);
		setError('');
		try {
			await workspace.restore(tab.id, sessionId, restart);
		} catch (error) {
			setError(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(false);
		}
	};
	const closePane = () => {
		void workspace.closePane(sessionId, confirm).catch((error) => workspace.report(error));
	};
	const showSearch = () => setSearch(true);
	const run = (action: () => unknown) => {
		void Promise.resolve()
			.then(action)
			.catch((error) => workspace.report(error));
	};
	return (
		<div
			className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
			onPointerDown={() => workspace.focusSession(sessionId)}
		>
			{tab.sessionIds.length > 1 && (
				<div
					className={`flex h-[22px] shrink-0 items-center gap-2 px-2 text-[11px] ${focused ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}
				>
					<span className="min-w-0 flex-1 truncate">{info?.customTitle || session?.title || tab.title}</span>
					{(session ? session.agentId : info?.agentId) && (
						<StatusDot state={session ? sessionState(session) : 'unknown'} />
					)}
					<Button
						variant="ghost"
						size="icon-xs"
						className="size-4"
						aria-label={t('agent.closePane')}
						onClick={closePane}
					>
						<X className="size-3" />
					</Button>
				</div>
			)}
			{session ? (
				<ContextMenu onOpenChange={setContextMenuVisible}>
					<ContextMenuTrigger asChild>
						<div
							ref={ref}
							data-terminal-host={sessionId}
							onContextMenuCapture={(event) => {
								// Native xterm/host handlers can consume the inner event before Radix.
								// Route it once through the React trigger, retaining this document and point.
								setContextMenuVisible(true);
								if (event.target === event.currentTarget) return;
								event.preventDefault();
								event.stopPropagation();
								const trigger = event.currentTarget,
									clientX = event.clientX,
									clientY = event.clientY;
								const win = doc.defaultView as Window & { MouseEvent: typeof MouseEvent };
								// Wait for native right-click focus handling to finish before Radix takes focus.
								win.requestAnimationFrame(() => {
									if (trigger.isConnected && trigger.checkVisibility())
										trigger.dispatchEvent(
											new win.MouseEvent('contextmenu', {
												bubbles: true,
												cancelable: true,
												clientX,
												clientY,
											}),
										);
								});
							}}
							className="relative min-h-0 w-full flex-1"
							onKeyDownCapture={(event) => {
								if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
									event.preventDefault();
									event.stopPropagation();
									showSearch();
								}
							}}
						/>
					</ContextMenuTrigger>
					{active && contextMenuVisible && (
						<ContextMenuContent>
							<ContextMenuItem onSelect={() => run(() => view.current?.copy())}>
								{t('agent.copy')}
							</ContextMenuItem>
							<ContextMenuItem onSelect={() => run(() => view.current?.copy(true))}>
								{t('agent.copyPlain')}
							</ContextMenuItem>
							<ContextMenuItem onSelect={() => run(() => view.current?.paste())}>
								{t('agent.paste')}
							</ContextMenuItem>
							<ContextMenuItem onSelect={() => view.current?.selectAll()}>
								{t('agent.selectAll')}
							</ContextMenuItem>
							<ContextMenuItem onSelect={() => view.current?.selectLine()}>
								{t('agent.selectLine')}
							</ContextMenuItem>
							<ContextMenuItem onSelect={showSearch}>{t('agent.search')}</ContextMenuItem>
							<ContextMenuSub><ContextMenuSubTrigger disabled={!settings.quickCommands.length}>{t('agent.quick.insert')}</ContextMenuSubTrigger><ContextMenuSubContent>{settings.quickCommands.map(command=><ContextMenuItem key={command.id} onSelect={()=>{session.paste(command.content);}}>{command.name}</ContextMenuItem>)}</ContextMenuSubContent></ContextMenuSub>
        <ContextMenuSeparator />
							<ContextMenuItem onSelect={() => view.current?.clear()}>{t('agent.clear')}</ContextMenuItem>
							<ContextMenuItem onSelect={() => view.current?.clearScrollback()}>
								{t('agent.clearScrollback')}
							</ContextMenuItem>
							<ContextMenuItem onSelect={() => view.current?.reset()}>
								{t('agent.resetTerminal')}
							</ContextMenuItem>
							<ContextMenuItem onSelect={() => run(() => view.current?.copyContext())}>
								{t('agent.copyContext')}
							</ContextMenuItem>
							{(['previous', 'next', 'failed'] as const).map((kind) => (
								<ContextMenuItem key={kind} onSelect={() => view.current?.jump(kind)}>
									{t(`agent.prompt${kind[0]!.toUpperCase()}${kind.slice(1)}`)}
								</ContextMenuItem>
							))}
							{([1, -1, 0] as const).map((step) => (
								<ContextMenuItem key={step} onSelect={() => view.current?.zoom(step)}>
									{t(
										step === 1
											? 'agent.fontLarger'
											: step === -1
												? 'agent.fontSmaller'
												: 'agent.fontReset',
									)}
								</ContextMenuItem>
							))}
							<ContextMenuSeparator />
							{session.agentId && (
								<ContextMenuItem onSelect={() => pickMaterial(controller, sessionId)}>
									{t('agent.attach')}
								</ContextMenuItem>
							)}
							<ContextMenuItem
								onSelect={() =>
									run(() =>
										doc.defaultView?.navigator.clipboard.writeText(
											session.nativeSessionId ?? sessionId,
										),
									)
								}
							>
								{t('agent.copyId')}
							</ContextMenuItem>
							<ContextMenuItem
								onSelect={() => run(() => doc.defaultView?.navigator.clipboard.writeText(session.cwd))}
							>
								{t('agent.copyPath')}
							</ContextMenuItem>
							<ContextMenuItem onSelect={() => run(() => openPath(session.cwd))}>
								{t('agent.reveal')}
							</ContextMenuItem>
							<ContextMenuItem
								onSelect={() => {
									setDraft(info?.customTitle || session.title);
									setRename(true);
								}}
							>
								{t('agent.paneTitle')}
							</ContextMenuItem>
							{(['row', 'column'] as const).map((direction) => (
								<ContextMenuItem
									key={direction}
									disabled={tab.sessionIds.length >= 4}
									onSelect={() => run(() => workspace.splitPane(sessionId, direction))}
								>
									{t(direction === 'row' ? 'agent.splitRight' : 'agent.splitDown')}
								</ContextMenuItem>
							))}
							<ContextMenuSeparator />
							<ContextMenuItem
								disabled={tab.sessionIds.length < 2}
								onSelect={() => workspace.equalizePanes(tab.id)}
							>
								{t('agent.equalizePanes')}
							</ContextMenuItem>
							<ContextMenuItem variant="destructive" onSelect={closePane}>
								{t('agent.closePane')}
							</ContextMenuItem>
						</ContextMenuContent>
					)}
				</ContextMenu>
			) : (
				<EmptyState
					className="flex-1"
					title={t('agent.workspace.ended')}
					description={
						<>
							{tab.customTitle || tab.title}
							<br />
							{info?.cwd}
						</>
					}
					action={
						<div className="flex gap-2">
							<Button
								disabled={busy}
								onClick={() => {
									void restore();
								}}
							>
								<RotateCw className="size-4" />
								{t(info?.nativeSessionId ? 'agent.workspace.restore' : 'agent.workspace.restart')}
							</Button>
							<Button variant="ghost" onClick={closePane}>
								{t('agent.closePane')}
							</Button>
						</div>
					}
				/>
			)}
			{search && active && (
				<TerminalSearch
					find={(query, direction, options) => view.current?.find(query, direction, options) ?? false}
					close={() => {
						setSearch(false);
						view.current?.clearSearch();
						view.current?.focus();
					}}
				/>
			)}
			<Dialog open={rename && active} onOpenChange={setRename}>
				<DialogContent>
					<DialogTitle>{t('agent.paneTitle')}</DialogTitle>
					<Input
						autoFocus
						aria-label={t('agent.renameLabel')}
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
								workspace.renamePane(tab.id, sessionId, draft);
								setRename(false);
							}
						}}
					/>
					<DialogFooter>
						<Button
							onClick={() => {
								workspace.renamePane(tab.id, sessionId, draft);
								setRename(false);
							}}
						>
							{t('common.save')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{session && !session.running && (
				<div className="pointer-events-none absolute inset-0 z-[var(--layer-popover)] flex items-end justify-center p-4">
					<div
						role="status"
						className="pointer-events-auto flex w-full max-w-md flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xs"
					>
						<div className="space-y-1">
							<div className="text-sm font-medium text-foreground">
								{t('agent.workspace.exited', { title: session.title, code: session.exitCode ?? '—' })}
							</div>
							{session.error && <div className="text-xs text-muted-foreground">{session.error}</div>}
						</div>
						<div className="flex justify-end gap-2">
							<Button variant="ghost" size="sm" onClick={closePane}>
								<X />
								{t('agent.closePane')}
							</Button>
							<Button
								size="sm"
								disabled={busy}
								onClick={() => {
									void restore(true);
								}}
							>
								<RotateCw />
								{t('agent.workspace.restart')}
							</Button>
						</div>
					</div>
				</div>
			)}
			{error && (
				<p
					role="alert"
					className="absolute bottom-2 left-2 rounded border bg-card p-2 text-xs text-destructive"
				>
					{error}
				</p>
			)}
		</div>
	);
}
function PaneTree({
	node,
	path,
	tab,
	active,
	retention,
}: {
	node: LayoutNode;
	path: ('first' | 'second')[];
	tab: TerminalTabData;
	active: boolean;
	retention: HiddenRendererRetention;
}) {
	const { controller } = useWorkspaceUI(),
		panel = useRef<ImperativePanelGroupHandle>(null);
	useLayoutEffect(() => {
		if (
			node.kind === 'split' &&
			panel.current &&
			Math.abs(panel.current.getLayout()[0]! / 100 - node.ratio) > 0.001
		)
			panel.current.setLayout([node.ratio * 100, (1 - node.ratio) * 100]);
	}, [node]);
	if (node.kind === 'pane')
		return (
			<TerminalHost
				tab={tab}
				sessionId={node.session}
				active={active}
				focused={tab.focusedSessionId === node.session && controller.workspace.active?.id === tab.id}
				retention={retention}
			/>
		);
	return (
		<PanelGroup
			ref={panel}
			direction={node.direction === 'row' ? 'horizontal' : 'vertical'}
			onLayout={(sizes) => {
				if (Math.abs(sizes[0]! / 100 - node.ratio) > 0.001)
					controller.workspace.resizePane(tab.id, path, sizes[0]! / 100);
			}}
		>
			{(['first', 'second'] as const).map((part, i) => (
				<Fragment key={part}>
					{i > 0 && (
						<PanelResizeHandle
							className="nand-agent-resize w-px bg-border data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full hover:bg-ring"
							onDoubleClick={() => panel.current?.setLayout([50, 50])}
						/>
					)}
					<Panel minSize={15} defaultSize={(i ? 1 - node.ratio : node.ratio) * 100}>
						<PaneTree
							node={node[part]}
							path={[...path, part]}
							tab={tab}
							active={active}
							retention={retention}
						/>
					</Panel>
				</Fragment>
			))}
		</PanelGroup>
	);
}
export function TerminalTabView({
	tab,
	active,
	retention,
}: {
	tab: TerminalTabData;
	active: boolean;
	retention: HiddenRendererRetention;
}) {
	return <PaneTree node={tab.paneLayout} path={[]} tab={tab} active={active} retention={retention} />;
}
