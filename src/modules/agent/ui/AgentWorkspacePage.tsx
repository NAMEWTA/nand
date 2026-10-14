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
export function AgentWorkspace({
	controller,
	context,
}: {
	controller: AgentController;
	context: NativeSurfaceContext;
}) {
	const t = useT(),
		workspace = controller.workspace,
		state = useStore(workspace.store),
		visible = useVisible(),
		doc = useOwnerDocument();
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
	const visibleIds = visible ? state.groups.flatMap((g) => (g.activeTabId ? [g.activeTabId] : [])).join(',') : '';
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
		if (!visible) {
			confirmationRef.current?.resolve(false);
			confirmationRef.current = undefined;
		}
	}, [visible]);
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
		if (action === 'newMenu') setMenu(workspace.store.getState().activeGroupId ?? 'empty');
		else if (action === 'newTerminal') void workspace.newTerminal().catch((error) => workspace.report(error));
		else if (action === 'newAgent') {
			const agent = controller.runtime.listAgents().find((a) => a.enabled && a.installed);
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
		<WorkspaceUIContext value={{ controller, confirm, close, chrome: { context, menu, setMenu } }}>
			<div
				className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
				data-agent-workspace=""
				ref={root}
			>
				<WorkspaceLayout />
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
			<AgentWorkspace controller={this.controller} context={this.context} />
		) : (
			<EmptyState title={t('agent.workspace.desktopOnly')} />
		);
	}
	show(target: WorkbenchTarget): void {
		if (target.resourceId && this.controller) {
			if (this.controller.workspace.store.getState().tabs[target.resourceId])
				this.controller.workspace.activate(target.resourceId);
			else this.controller.show(target.resourceId);
		}
	}
	getTarget(): WorkbenchTarget {
		return { feature: 'terminal', section: 'running' };
	}
}
export const createAgentPage =
	(controller: () => AgentController | undefined): PageCreate =>
	async (context, target, _state, signal) => {
		const current = controller();
		await current?.workspace.persistence.ready;
		signal.throwIfAborted();
		const page = new AgentWorkspacePage(context, current);
		page.show(target);
		return { surface: page, getTarget: () => page.getTarget(), navigate: async (next) => page.show(next) };
	};
