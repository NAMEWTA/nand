import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from 'zustand';
import type { PageCreate } from '../../../app/contracts/workbench-host';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import { t } from '../../../shared/i18n';
import { ReactSurface } from '../../../ui/react/surface';
import type { NativeSurfaceContext } from '../../../ui/native-surface';
import { useOwnerDocument, useVisible } from '../../../ui/react/contexts';
import { useT } from '../../../ui/react/hooks';
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
	AlertDialogAction,
} from '../../../ui/components/alert-dialog';
import { EmptyState } from '../../../ui/components/nand/EmptyState';
import type { AgentController } from '../services/controller';
import { type WorkspaceCommand } from '../core/workspace/shortcuts';
import { AgentSidebar } from './sidebar/AgentSidebar';
import { WorkspaceLayout } from './workspace/WorkspaceLayout';
import { WorkspaceUIContext } from './workspace/workspace-context';
import { bindWorkspaceKeyboard } from './workspace/keyboard-scope';
import { createWorkspaceView, type WorkspaceViewStore } from '../services/workspace-view';
import { SessionHistoryPanel, HISTORY_DRAG } from './history/SessionHistoryPanel';
import { AgentBoard } from './dashboard/AgentBoard';
import { UsageStatsPage } from './usage/UsageStatsPage';
import { JumpPalette } from './jump/JumpPalette';
import { Button } from '../../../ui/components/button';
import { VisibilityContext } from '../../../ui/react/contexts';
export function AgentWorkspace({
	controller,
	context,
	view: suppliedView,
}: {
	controller: AgentController;
	context: NativeSurfaceContext;
	view?: WorkspaceViewStore;
}) {
	const t = useT(),
		workspace = controller.workspace,
		state = useStore(workspace.store),
		visible = useVisible(),
		doc = useOwnerDocument();
	const [localView] = useState(() => createWorkspaceView());
	const viewStore = suppliedView ?? localView,
		page = useStore(viewStore);
	const select = (id: string) => {
		workspace.activate(id);
		viewStore.setState({ view: 'running' });
	};
	useEffect(() => {
		if (doc.defaultView) return controller.usageStore.observeWindow(doc.defaultView);
  return undefined;
	}, [controller, doc]);
	const root = useRef<HTMLDivElement>(null);
	const [menu, setMenu] = useState<string>(),
		[confirmation, setConfirmation] = useState<{ message: string; resolve: (yes: boolean) => void }>();
	const confirmationRef = useRef(confirmation);
	const [wasVisible, setWasVisible] = useState(visible);
	if (wasVisible !== visible) {
		setWasVisible(visible);
		if (!visible) {
			setMenu(undefined);
			setConfirmation(undefined);
		}
	}
	const alive = useRef(true),
		interactive = useRef(visible);
	const owner = useRef({}),
		closeQueue = useRef(Promise.resolve());
	const visibleIds =
		visible && page.view === 'running'
			? state.groups.flatMap((g) => (g.activeTabId ? [g.activeTabId] : [])).join(',')
			: '';
	useEffect(() => {
		const key = owner.current;
		workspace.setVisible(key, visibleIds ? visibleIds.split(',') : []);
		return () => workspace.setVisible(key, []);
	}, [workspace, visibleIds]);
	useEffect(
		() =>
			workspace.onMenu(() => {
				if (visible) setMenu(workspace.store.getState().activeGroupId ?? 'empty');
			}),
		[workspace, visible],
	);
	useEffect(() => {
		interactive.current = visible;
		if (!visible) viewStore.setState({ jump: false });
		if (!visible) {
			confirmationRef.current?.resolve(false);
			confirmationRef.current = undefined;
		}
	}, [visible, viewStore]);
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
			confirmationRef.current?.resolve(false);
		};
	}, []);
	const confirm = (message: string) =>
		new Promise<boolean>((resolve) => {
			if (!alive.current || !interactive.current) {
				resolve(false);
				return;
			}
			confirmationRef.current?.resolve(false);
			const next = { message, resolve };
			confirmationRef.current = next;
			setConfirmation(next);
		});
	const close = (id: string) => {
		closeQueue.current = closeQueue.current
			.then(() => workspace.close(id, confirm))
			.catch((error) => workspace.report(error));
	};
	const finish = (yes: boolean) => {
		confirmationRef.current?.resolve(yes);
		confirmationRef.current = undefined;
		setConfirmation(undefined);
	};
	const command = (action: WorkspaceCommand) => {
		const tab = workspace.active;
		if (action === 'jump') {
			viewStore.setState({ jump: true });
			void controller.historyStore.refresh(false);
		} else if (action === 'newMenu') setMenu(workspace.store.getState().activeGroupId ?? 'empty');
		else if (action === 'newTerminal') void workspace.newTerminal().catch((error) => workspace.report(error));
		else if (action === 'newAgent') {
			const agent = controller.agents.list()[0];
			if (agent) void workspace.newAgent(agent.id).catch((error) => workspace.report(error));
		} else if (action === 'newBrowser') {
			try {
				workspace.newBrowser();
			} catch (error) {
				workspace.report(error);
			}
		} else if (action === 'close' && tab && !tab.pinned) close(tab.id);
		else if (action === 'reopen') workspace.reopen();
		else if (action === 'next' || action === 'previous') workspace.next(action === 'next' ? 1 : -1);
		else if (action === 'recent') workspace.recent();
		else if (tab && (action === 'splitRight' || action === 'splitDown')) {
			const group = workspace.group(tab.id);
			if (group)
				workspace.move(tab.id, { split: action === 'splitRight' ? 'right' : 'down', ofGroupId: group.id });
		}
	};
	const commandRef = useRef(command);
	useLayoutEffect(() => {
		commandRef.current = command;
	});
	useEffect(() => {
		if (!visible || !root.current) return;
		return bindWorkspaceKeyboard(controller.app, root.current, (action) => commandRef.current(action));
	}, [controller, visible, doc]);
	return (
		<WorkspaceUIContext value={{ controller, confirm, close, chrome: { context, menu, setMenu, view: viewStore } }}>
			<div
				className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
				data-agent-workspace=""
				ref={root}
			>
				{page.view !== 'running' && (
					<div className="flex h-9 shrink-0 items-center border-b border-border px-3">
						<Button variant="ghost" size="sm" onClick={() => viewStore.setState({ view: 'running' })}>
							{t('agent.workspace.backToTabs')}
						</Button>
						<Button variant="ghost" size="sm" onClick={(e) => context.openPageMenu?.(e.nativeEvent)}>
							{t('agent.workspace.pageMenu')}
						</Button>
					</div>
				)}
				<div className="flex min-h-0 flex-1">
					<div
						className="relative min-w-0 flex-1"
						onDragOver={(e) => {
							if (e.dataTransfer.types.includes(HISTORY_DRAG)) e.preventDefault();
						}}
						onDrop={(e) => {
							const key = e.dataTransfer.getData(HISTORY_DRAG);
							if (!key) return;
							e.preventDefault();
							const row = controller.historyStore.store.getState().rows.find((r) => r.key === key);
							if (!row) return;
							const element = (e.target as HTMLElement).closest<HTMLElement>('[data-group-id]');
							const group = element?.dataset.groupId;
							const rect = element?.getBoundingClientRect();
							const split =
								rect && e.clientX > rect.right - rect.width * 0.3
									? 'right'
									: rect && e.clientY > rect.bottom - rect.height * 0.3
										? 'down'
										: undefined;
							void controller.resumeAt(row, group, split).catch((error) => workspace.report(error));
						}}
					>
						<div
							className="absolute inset-0"
							hidden={page.view !== 'running'}
							inert={page.view !== 'running'}
						>
							<VisibilityContext value={visible && page.view === 'running'}>
								<WorkspaceLayout />
							</VisibilityContext>
						</div>
						{page.view === 'board' && <AgentBoard controller={controller} select={select} />}
						{page.view === 'usage' && (
							<UsageStatsPage key={page.provider} controller={controller} provider={page.provider} />
						)}
					</div>
					{page.history && page.view === 'running' && (
						<>
							<div
								role="separator"
								aria-label={t('agent.historyUI.resize')}
								aria-orientation="vertical"
								aria-valuenow={page.historyWidth}
								tabIndex={0}
								className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-ring"
								onKeyDown={(e) => {
									if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
										e.preventDefault();
										viewStore.setState({
											historyWidth:
												e.key === 'Home'
													? 240
													: e.key === 'End'
														? 480
														: Math.max(
																240,
																Math.min(
																	480,
																	page.historyWidth +
																		(e.key === 'ArrowLeft' ? 8 : -8),
																),
															),
										});
									}
								}}
								onPointerDown={(e) => {
									e.currentTarget.setPointerCapture(e.pointerId);
								}}
								onPointerMove={(e) => {
									if (e.currentTarget.hasPointerCapture(e.pointerId)) {
										const box = root.current?.getBoundingClientRect();
										if (box)
											viewStore.setState({
												historyWidth: Math.max(240, Math.min(480, box.right - e.clientX)),
											});
									}
								}}
							/>
							<div className="min-h-0 shrink-0" style={{ width: page.historyWidth }}>
								<SessionHistoryPanel
									controller={controller}
									close={() => viewStore.setState({ history: false })}
								/>
							</div>
						</>
					)}
				</div>
				{page.jump && visible && (
					<JumpPalette
						controller={controller}
						close={() => viewStore.setState({ jump: false })}
						select={select}
					/>
				)}
			</div>
			{visible &&
				context.navigationEl &&
				createPortal(<AgentSidebar togglePanel={context.togglePanel} />, context.navigationEl)}
			<AlertDialog
				open={!!confirmation && visible}
				onOpenChange={(open) => {
					if (!open) finish(false);
				}}
			>
				<AlertDialogContent>
					<AlertDialogTitle>{t('agent.confirmTitle')}</AlertDialogTitle>
					<AlertDialogDescription>{confirmation?.message}</AlertDialogDescription>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => finish(false)}>{t('common.cancel')}</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => finish(true)}
						>
							{t('agent.end')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</WorkspaceUIContext>
	);
}
export class AgentWorkspacePage extends ReactSurface {
	readonly view = createWorkspaceView();
	constructor(
		context: NativeSurfaceContext,
		private controller?: AgentController,
	) {
		super(context);
	}
	getViewType(): string {
		return 'nand-agent-page';
	}
	getDisplayText(): string {
		return t('workbench.agent');
	}
	getIcon(): string {
		return 'bot';
	}
	protected renderContent() {
		return this.controller ? (
			<AgentWorkspace controller={this.controller} context={this.context} view={this.view} />
		) : (
			<EmptyState title={t('agent.workspace.desktopOnly')} />
		);
	}
	show(target: WorkbenchTarget): void {
		this.view.setState({
			view: target.section === 'board' ? 'board' : target.section === 'usage' ? 'usage' : 'running',
			provider: target.section === 'usage' ? target.resourceId : undefined,
			...(target.section === 'history' ? { history: true } : {}),
			...(target.section === 'jump' ? { jump: true } : {}),
		});
		if (target.resourceId && this.controller && target.section !== 'usage') {
			if (this.controller.workspace.store.getState().tabs[target.resourceId])
				this.controller.workspace.activate(target.resourceId);
			else this.controller.show(target.resourceId);
		}
	}
	getTarget(): WorkbenchTarget {
		return { feature: 'terminal', section: this.view.getState().view };
	}
}
export const createAgentPage =
	(controller: () => AgentController | undefined): PageCreate =>
	async (context, target, state, signal) => {
		const current = controller();
		await current?.workspace.persistence.ready;
		signal.throwIfAborted();
		const page = new AgentWorkspacePage(context, current);
		page.view.setState(createWorkspaceView(state).getState());
		page.show(target);
		const off = page.view.subscribe(() => context.changed?.());
		signal.addEventListener('abort', off, { once: true });
		return {
			surface: page,
			getState: () => ({
				agentView: page.view.getState().view,
				agentHistory: page.view.getState().history,
				agentHistoryWidth: page.view.getState().historyWidth,
			}),
			getTarget: () => page.getTarget(),
			navigate: async (next) => page.show(next),
		};
	};
