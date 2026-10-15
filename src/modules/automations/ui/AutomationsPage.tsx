// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationsPage.tsx, AutomationsPageSurface.tsx
import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { toast } from 'sonner';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import type { AutomationDefinition } from '../../../shared/automation/types';
import type { AutomationEditRequest } from '../core/api';
import type { AutomationTemplate } from '../core/templates';
import { actionText } from '../core/switch-action';
import { useT } from '../../../ui/react/hooks';
import { useVisible } from '../../../ui/react/contexts';
import { Button } from '../../../ui/components/button';
import type { AutomationViewHost } from './panel-contract';
import { TopBar } from './TopBar';
import { Toolbar } from './list/Toolbar';
import { FilterPills, type ListFilter } from './list/FilterMenu';
import { AutomationsTable, type ListSort } from './list/AutomationsTable';
import type { RowActions } from './list/AutomationRow';
import { EmptyState } from './list/EmptyState';
import { AutomationDetail } from './detail/AutomationDetail';
import type { RunActions } from './detail/RunHistory';
import { RunsPage } from './runs/RunsPage';
import { RunDetail } from './runs/RunDetail';
import { EditorDialog } from './editor/EditorDialog';
import { DeleteDialog } from './dialogs/DeleteDialog';

export interface AutomationPageState {
	search: string;
	filter: ListFilter;
	selected: string;
	sort: ListSort;
}
export function initialPageState(raw: Record<string, unknown>): AutomationPageState {
	const filter = raw.filter as Partial<ListFilter> | undefined,
		sort = raw.sort as Partial<ListSort> | undefined;
	return {
		search: typeof raw.search === 'string' ? raw.search.slice(0, 2048) : '',
		selected: typeof raw.selected === 'string' ? raw.selected : '',
		filter: {
			status: ['enabled', 'disabled'].includes(filter?.status ?? '') ? filter!.status! : 'all',
			result: ['failed', 'succeeded', 'neverRun'].includes(filter?.result ?? '') ? filter!.result! : 'all',
			kinds: Array.isArray(filter?.kinds) ? filter.kinds.slice(0, 7) : [],
			agents: Array.isArray(filter?.agents) ? filter.agents.slice(0, 30) : [],
		},
		sort: { by: sort?.by === 'name' ? 'name' : 'lastRun', direction: sort?.direction === 'asc' ? 'asc' : 'desc' },
	};
}
export function AutomationsPage({
	host,
	target,
	request,
	initialState,
	onState,
	onNavigate,
	onPageMenu,
	onNavigation,
	onEditConsumed,
}: {
	host: AutomationViewHost;
	target: WorkbenchTarget;
	request?: AutomationEditRequest;
	initialState: AutomationPageState;
	onState: (state: AutomationPageState) => void;
	onNavigate: (target: WorkbenchTarget) => void;
	onPageMenu: (event: MouseEvent) => void;
	onNavigation: () => void;
	onEditConsumed: () => void;
}) {
	const t = useT(),
		visible = useVisible();
	const { definitions, runs, loadError, executionEnabled } = useStore(host.store);
	const [state, setState] = useState(initialState),
		[refreshing, setRefreshing] = useState(false),
		[error, setError] = useState('');
	const [edit, setEdit] = useState<{ request: AutomationEditRequest; template?: AutomationTemplate }>(),
		[deleting, setDeleting] = useState<AutomationDefinition>();
	const [skipDelete, setSkipDelete] = useState(() => host.skipDeleteConfirmation?.() ?? false);
	useEffect(() => {
		if (request) {
			setEdit({ request });
			onEditConsumed();
		}
	}, [request, onEditConsumed]);
	useEffect(() => {
		if (!visible) {
			setDeleting(undefined);
			setEdit(undefined);
		}
	}, [visible]);
	const update = (patch: Partial<AutomationPageState>) => {
		const next = { ...state, ...patch };
		setState(next);
		onState(next);
	};
	const perform = (operation: () => Promise<unknown>) => {
		setError('');
		void operation().catch((e) => {
			const message = e instanceof Error ? e.message : String(e);
			setError(message);
			toast.error(message);
		});
	};
	const navigate = (section = 'tasks', resourceId?: string) =>
		onNavigate({ feature: 'automations', section, resourceId });
	const shown = useMemo(() => {
		const latest = new Map(runs.map((run) => [run.automationId, run]));
		const filter = state.filter,
			query = state.search.trim().toLocaleLowerCase();
		return definitions
			.filter((d) => {
				const last = latest.get(d.id);
				return (
					(!query ||
						`${d.name} ${actionText(d.action)} ${'cwd' in d.action ? d.action.cwd : ''}`
							.toLocaleLowerCase()
							.includes(query)) &&
					(filter.status === 'all' || d.enabled === (filter.status === 'enabled')) &&
					(filter.result === 'all' ||
						(filter.result === 'neverRun' ? !last : last?.status === filter.result)) &&
					(!filter.kinds.length || filter.kinds.includes(d.action.kind)) &&
					(!filter.agents.length || (d.action.kind === 'agent' && filter.agents.includes(d.action.agentId)))
				);
			})
			.sort((a, b) => {
				const result =
					state.sort.by === 'name'
						? a.name.localeCompare(b.name)
						: (latest.get(a.id)?.startedAt ?? 0) - (latest.get(b.id)?.startedAt ?? 0);
				return (state.sort.direction === 'asc' ? result : -result) || a.name.localeCompare(b.name);
			});
	}, [definitions, runs, state]);
	const disabled = !executionEnabled || !!loadError;
	const rowActions: RowActions = {
		onOpen: (d) => {
			if (!d.removedAction) navigate('tasks', d.id);
		},
		onRun: (d) =>
			perform(async () => {
				const run = await host.service.run(d);
				if (run) navigate('runs', run.id);
			}),
		onEdit: (d) => setEdit({ request: { existing: d } }),
		onToggle: (d) => perform(() => host.service.save({ ...d, enabled: !d.enabled })),
		onDelete: (d) => {
			if (skipDelete)
				perform(async () => {
					await host.service.remove(d);
					navigate();
				});
			else setDeleting(d);
		},
	};
	const runActions: RunActions = {
		onOpen: (run) => navigate('runs', run.id),
		onTerminal: (run) =>
			perform(
				() =>
					host.service.openRun?.(run) ??
					host.service.agent()?.open(run.terminalId ?? '') ??
					Promise.resolve(),
			),
		onStop: (run) => perform(() => host.service.stop(run)),
		onRerun: (run) => {
			const d = definitions.find((item) => item.id === run.automationId) ?? run.definition;
			if (d) rowActions.onRun(d);
		},
	};
	const selectedDefinition =
		target.section !== 'runs' && target.resourceId
			? definitions.find((d) => d.id === target.resourceId)
			: undefined;
	const selectedRun =
		target.section === 'runs' && target.resourceId ? runs.find((run) => run.id === target.resourceId) : undefined;
	const openCreate = (template?: AutomationTemplate) => setEdit({ request: {}, template });
	const refresh = () => {
		if (refreshing) return;
		setRefreshing(true);
		perform(async () => {
			try {
				await (loadError ? host.retry() : host.refresh());
			} finally {
				setRefreshing(false);
			}
		});
	};
	return (
		<main
			className="relative flex h-full min-h-0 flex-col bg-background pt-5 text-foreground md:pt-6"
			data-automation-page
		>
			<TopBar
				name={
					selectedRun
						? selectedRun.title
						: (selectedDefinition?.name ??
							(target.section === 'runs' ? t('automation.history') : undefined))
				}
				detail={selectedRun ? new Date(selectedRun.startedAt).toLocaleString() : undefined}
				onList={() => navigate()}
				onBack={() => navigate(selectedRun ? 'runs' : 'tasks')}
				onMenu={onPageMenu}
				onNavigation={onNavigation}
			/>
			{(loadError || error || !executionEnabled) && (
				<div role="alert" className="mx-6 mb-4 rounded-md border border-destructive/40 p-3 text-sm">
					{loadError || error || t('automation.moduleOff')}
					{loadError && (
						<Button variant="outline" size="sm" disabled={refreshing} onClick={refresh}>
							{t('automation.retry')}
						</Button>
					)}
				</div>
			)}
			{selectedRun ? (
				<RunDetail run={selectedRun} disabled={disabled} {...runActions} />
			) : target.section === 'runs' ? (
				<RunsPage runs={runs} disabled={disabled} {...runActions} />
			) : selectedDefinition ? (
				<AutomationDetail
					definition={selectedDefinition}
					runs={runs.filter((run) => run.automationId === selectedDefinition.id)}
					disabled={disabled || selectedDefinition.deviceId !== host.service.deviceId}
					rowActions={rowActions}
					runActions={runActions}
					onSource={() => {
						if (selectedDefinition.source)
							perform(() => host.service.sources.open(selectedDefinition.source!));
					}}
				/>
			) : (
				<div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
					<Toolbar
						query={state.search}
						onQueryChange={(search) => update({ search, selected: '' })}
						filter={state.filter}
						onFilterChange={(filter) => update({ filter, selected: '' })}
						agents={host.service.agent()?.listAgents() ?? []}
						refreshing={refreshing}
						onRefresh={refresh}
						onRuns={() => navigate('runs')}
						onCreate={() => openCreate()}
						onArrow={(key) => {
							const index = shown.findIndex((d) => d.id === state.selected);
							const next =
								index < 0
									? key === 'ArrowDown'
										? 0
										: shown.length - 1
									: Math.max(0, Math.min(shown.length - 1, index + (key === 'ArrowDown' ? 1 : -1)));
							update({ selected: shown[next]?.id ?? '' });
						}}
						onEnter={() => {
							const d = shown.find((d) => d.id === state.selected) ?? shown[0];
							if (d) rowActions.onOpen(d);
						}}
						disabled={disabled}
					/>
					<FilterPills filter={state.filter} onChange={(filter) => update({ filter, selected: '' })} />
					{definitions.length ? (
						<AutomationsTable
							definitions={shown}
							runs={runs}
							selected={state.selected}
							sort={state.sort}
							onSort={(sort) => update({ sort })}
							deviceId={host.service.deviceId}
							disabled={disabled}
							{...rowActions}
						/>
					) : (
						<EmptyState onCreate={openCreate} disabled={disabled} />
					)}
				</div>
			)}
			{edit && visible && (
				<EditorDialog
					request={edit.request}
					template={edit.template}
					host={host}
					onClose={() => setEdit(undefined)}
				/>
			)}
			{deleting && visible && (
				<DeleteDialog
					definition={deleting}
					onCancel={() => setDeleting(undefined)}
					onConfirm={async (skip) => {
						await host.service.remove(deleting);
						await host.setSkipDeleteConfirmation?.(skip);
						setSkipDelete(skip);
						setDeleting(undefined);
						navigate();
					}}
				/>
			)}
		</main>
	);
}
