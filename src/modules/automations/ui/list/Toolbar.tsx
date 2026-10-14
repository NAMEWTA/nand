// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationListToolbar.tsx
import { History, Plus, RefreshCw } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { cn } from '../../../../ui/lib/utils';
import { useT } from '../../../../ui/react/hooks';
import type { AgentDescription } from '../../../../shared/automation/types';
import { IconButton } from '../parts';
import { SearchField } from './SearchField';
import { FilterMenu, type ListFilter } from './FilterMenu';
export function Toolbar({
	query,
	onQueryChange,
	filter,
	onFilterChange,
	agents,
	refreshing,
	onRefresh,
	onRuns,
	onCreate,
	onArrow,
	onEnter,
	disabled,
}: {
	query: string;
	onQueryChange: (query: string) => void;
	filter: ListFilter;
	onFilterChange: (filter: ListFilter) => void;
	agents: AgentDescription[];
	refreshing: boolean;
	onRefresh: () => void;
	onRuns: () => void;
	onCreate: () => void;
	onArrow: (key: 'ArrowUp' | 'ArrowDown') => void;
	onEnter: () => void;
	disabled: boolean;
}) {
	const t = useT();
	return (
		<div className="flex shrink-0 flex-wrap items-end justify-between gap-3 pb-4">
			<div className="flex min-w-0 flex-1 items-end gap-2">
				<SearchField query={query} onChange={onQueryChange} onArrowNavigate={onArrow} onEnter={onEnter} />
				<FilterMenu filter={filter} onChange={onFilterChange} agents={agents} />
				<IconButton
					label={t('automation.refresh')}
					onClick={onRefresh}
					disabled={refreshing}
					className="shrink-0 border border-border bg-background shadow-none hover:bg-muted/50"
				>
					<RefreshCw className={cn('size-4', refreshing && 'animate-spin motion-reduce:animate-none')} />
				</IconButton>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<Button variant="outline" size="sm" onClick={onRuns}>
					<History className="size-4" />
					{t('automation.history')}
				</Button>
				<Button size="sm" onClick={onCreate} disabled={disabled}>
					<Plus className="size-4" />
					{t('automation.new')}
				</Button>
			</div>
		</div>
	);
}
