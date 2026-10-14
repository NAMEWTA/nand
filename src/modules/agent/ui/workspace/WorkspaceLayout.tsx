// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/tab-group/TabGroupSplitNodeTree.tsx, TabGroupPanel.tsx
import { Fragment, useRef, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, pointerWithin, rectIntersection } from '@dnd-kit/core';
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelGroupHandle } from 'react-resizable-panels';
import { useStore } from 'zustand';
import { Globe, TerminalSquare } from 'lucide-react';
import type { GroupLayoutNode } from '../../core/workspace/model';
import { useVisible } from '../../../../ui/react/contexts';
import { EmptyState } from '../../../../ui/components/nand/EmptyState';
import { Button } from '../../../../ui/components/button';
import { useT } from '../../../../ui/react/hooks';
import { cn } from '../../../../ui/lib/utils';
import { TabStrip } from '../tabs/TabStrip';
import { TerminalTabView } from '../terminal/TerminalTabView';
import { HiddenRendererRetention } from '../terminal/hidden-renderer-retention';
import { DropZones } from './DropZones';
import { useWorkspaceUI } from './workspace-context';
function Tree({
	node,
	path,
	dragging,
	retention,
}: {
	node: GroupLayoutNode;
	path: number[];
	dragging: boolean;
	retention: HiddenRendererRetention;
}) {
	const { controller } = useWorkspaceUI(),
		workspace = controller.workspace,
		state = useStore(workspace.store),
		visible = useVisible(),
		t = useT();
	const panel = useRef<ImperativePanelGroupHandle>(null);
	if (node.kind === 'group') {
		const group = state.groups.find((g) => g.id === node.groupId);
		if (!group) return null;
		return (
			<div
				className={cn(
					'flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden',
					state.groups.length > 1 && state.activeGroupId === group.id && 'ring-1 ring-inset ring-ring/40',
				)}
				data-group-id={group.id}
				onPointerDown={() => {
					if (state.activeGroupId !== group.id && group.activeTabId) workspace.activate(group.activeTabId);
				}}
			>
				{visible && <TabStrip group={group} />}
				<div className="relative min-h-0 flex-1 overflow-hidden">
					{group.tabIds.map((id) => {
						const tab = state.tabs[id];
						if (!tab) return null;
						const active = group.activeTabId === id;
						return (
							<div
								key={id}
								className="absolute inset-0"
								hidden={!active}
								inert={!active}
								data-tab-content={id}
								role="tabpanel"
								aria-label={tab.customTitle || tab.title}
							>
								{tab.kind === 'terminal' ? (
									<TerminalTabView tab={tab} active={active && visible} retention={retention} />
								) : (
									<EmptyState
										className="h-full"
										icon={<Globe />}
										title={t('agent.workspace.browserDisabled')}
										description={tab.url}
									/>
								)}
							</div>
						);
					})}
					{dragging && <DropZones groupId={group.id} />}
				</div>
			</div>
		);
	}
	return (
		<PanelGroup
			ref={panel}
			direction={node.direction === 'row' ? 'horizontal' : 'vertical'}
			onLayout={(sizes) => {
				if (sizes.some((n, i) => Math.abs(n - (node.sizes[i] ?? 0)) > 0.1)) workspace.resize(path, sizes);
			}}
		>
			{node.children.map((child, i) => (
				<Fragment key={child.kind === 'group' ? child.groupId : `split-${i}`}>
					{i > 0 && (
						<PanelResizeHandle
							className="nand-agent-resize w-px bg-border data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full hover:bg-ring"
							onDoubleClick={() =>
								panel.current?.setLayout(node.children.map(() => 100 / node.children.length))
							}
						/>
					)}
					<Panel minSize={15} defaultSize={node.sizes[i]}>
						<Tree node={child} path={[...path, i]} dragging={dragging} retention={retention} />
					</Panel>
				</Fragment>
			))}
		</PanelGroup>
	);
}
export function WorkspaceLayout() {
	const { controller } = useWorkspaceUI(),
		workspace = controller.workspace,
		state = useStore(workspace.store),
		t = useT();
	const [dragging, setDragging] = useState(false),
		[retention] = useState(() => new HiddenRendererRetention(2));
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
	return (
		<DndContext
			sensors={sensors}
			collisionDetection={(args) => {
				const hits = pointerWithin(args);
				return hits.length ? hits : rectIntersection(args);
			}}
			onDragStart={() => setDragging(true)}
			onDragCancel={() => setDragging(false)}
			onDragEnd={({ active, over }) => {
				setDragging(false);
				if (!over) return;
				const data = over.data.current as
					{ kind?: string; groupId?: string; edge?: 'left' | 'right' | 'up' | 'down' | 'center' } | undefined;
				const group = state.groups.find((g) => g.id === data?.groupId);
				if (!group) return;
				if (data?.edge && data.edge !== 'center')
					workspace.move(String(active.id), { split: data.edge, ofGroupId: group.id });
				else
					workspace.move(String(active.id), {
						groupId: group.id,
						index: data?.kind === 'tab' ? group.tabIds.indexOf(String(over.id)) : group.tabIds.length,
					});
			}}
		>
			<div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
				{state.layout ? (
					<Tree node={state.layout} path={[]} dragging={dragging} retention={retention} />
				) : (
					<div className="flex h-full w-full min-w-0 flex-col">
						<TabStrip group={{ id: 'empty', tabIds: [], recentTabIds: [] }} />
						<EmptyState
							className="flex-1"
							icon={<TerminalSquare />}
							title={t('agent.workspace.empty')}
							description={t('agent.workspace.emptyHint')}
							action={
								<Button
									onClick={() => {
										void workspace.newTerminal().catch((error) => workspace.report(error));
									}}
								>
									{t('agent.workspace.newTerminal')}
								</Button>
							}
						/>
					</div>
				)}
			</div>
		</DndContext>
	);
}
