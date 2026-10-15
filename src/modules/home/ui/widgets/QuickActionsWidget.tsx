import { observeBoardAction } from '../board/actions';
// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/quick-actions.ts
import { useState } from 'react';
import { useStore } from 'zustand';
import { Plus } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../../ui/components/tabs';
import { ObsidianIcon } from '../../../../ui/components/nand/ObsidianIcon';
import { useT } from '../../../../ui/react/hooks';
import type { BoardStore } from '../../services/board-store';
import type { QuickAction } from '../../core/board/types/model';
import { buildOrderedActions } from '../../core/board/quick-actions';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { DashboardIconPicker } from '../quickbar/DashboardIconPicker';
export function QuickActionsWidget({ store }: { store: BoardStore }) {
	const { data, files } = useStore(store.state),
		t = useT(),
		[adding, setAdding] = useState(false),
		[query, setQuery] = useState(''),
		[draft, setDraft] = useState<QuickAction>({ name: '', type: 'file', icon: 'file-text', target: '' });
	const actions = buildOrderedActions(data!.quickActions, data!.quickActionOrder, data!.hiddenPresets);
	return (
		<>
			<div className="mb-0.5 flex h-5 items-center border-b border-[var(--db-border)] pb-0.5">
				<h3 className="m-0 flex-1 text-[.72em] font-semibold tracking-[.05em] opacity-70">
					{t('home.dashboard.widget.quickActions')}
				</h3>
				<Button
					variant="ghost"
					size="icon-xs"
					className="size-4"
					aria-label={t('common.add')}
					onClick={() => setAdding(true)}
				>
					<Plus className="size-3" />
				</Button>
			</div>
			<div className="dashboard-qa-list mb-2 grid grid-cols-2 gap-[5px]">
				{actions.map((item, index) => (
					<Button
						key={item.key}
					size="xs"
						variant="secondary"
						className="h-7 min-w-0 justify-start gap-[3px] rounded-[4px] border border-[var(--db-border-btn)] bg-[var(--db-bg-btn)] px-[7px] py-1.5 text-[.75em]"
						onClick={() => {
							void store.action(item.action);
						}}
						onContextMenu={(e) => {
							e.preventDefault();
							void observeBoardAction(store.sync.removeQuickActionByKey(item.key));
						}}
						onKeyDown={(e) => {
							if (!e.altKey || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key))
								return;
							e.preventDefault();
							const next = Math.max(
									0,
									Math.min(
										actions.length - 1,
										index +
											(e.key === 'ArrowUp'
												? -2
												: e.key === 'ArrowDown'
													? 2
													: e.key === 'ArrowLeft'
														? -1
														: 1),
									),
								),
								order = actions.map((a) => a.key);
							order.splice(index, 1);
							order.splice(next, 0, item.key);
							void observeBoardAction(store.sync.reorderQuickActions(order));
						}}
					>
						<ObsidianIcon name={item.action.icon} className="size-3" />
						<span className="truncate">
							{item.isPreset
								? t(
										item.action.target === 'daily-notes'
											? 'home.dashboard.today'
											: 'home.dashboard.newNote',
									)
								: item.action.name}
						</span>
					</Button>
				))}
			</div>
			{adding && (
				<DashboardDialog
					title={t('home.dashboard.widget.quickActions')}
					onClose={() => setAdding(false)}
					onSave={() => {
						if (draft.target && draft.name)
							void observeBoardAction(store.sync.addQuickAction(draft).then(() => setAdding(false)));
					}}
				>
					<Tabs
						value={draft.type}
						onValueChange={(type) => setDraft({ ...draft, type: type as QuickAction['type'], target: '' })}
					>
						<TabsList>
							{['file', 'command', 'action'].map((type) => (
								<TabsTrigger key={type} value={type}>
									{t(`home.dashboard.action.${type}`)}
								</TabsTrigger>
							))}
						</TabsList>
						<Input
							aria-label={t('ui.search')}
							placeholder={t('ui.search')}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>
						{(['file', 'command', 'action'] as const).map((type) => (
							<TabsContent key={type} value={type} className="max-h-60 overflow-y-auto">
								{(type === 'file'
									? files.map((file) => ({ id: file.path, name: file.basename }))
									: type === 'command'
										? store.commands()
										: (store.host.automationHost?.actions?.() ?? [])
								)
									.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
									.slice(0, 100)
									.map((item) => (
										<Button
											key={item.id}
											variant={draft.target === item.id ? 'secondary' : 'ghost'}
											className="h-8 w-full justify-start truncate text-xs"
											onClick={() => setDraft({ ...draft, target: item.id, name: item.name })}
										>
											{item.name}
										</Button>
									))}
							</TabsContent>
						))}
					</Tabs>
					<div className="flex gap-2">
						<DashboardIconPicker value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
						<Input
							aria-label={t('home.dashboard.name')}
							value={draft.name}
							onChange={(e) => setDraft({ ...draft, name: e.target.value })}
						/>
					</div>
				</DashboardDialog>
			)}
		</>
	);
}
