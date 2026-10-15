import { useTransient } from '../use-transient';
// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/automations/AutomationListFilterMenu.tsx
import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuCheckboxItem,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
} from '../../../../ui/components/dropdown-menu';
import { useT } from '../../../../ui/react/hooks';
import type { AgentDescription, AutomationAction } from '../../../../shared/automation/types';
import { actionDescriptors } from '../../core/actions/executor';
export interface ListFilter {
	status: string;
	result: string;
	kinds: AutomationAction['kind'][];
	agents: string[];
}
export const EMPTY_FILTER: ListFilter = { status: 'all', result: 'all', kinds: [], agents: [] };
const toggle = <T,>(values: T[], value: T) =>
	values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
export function FilterMenu({
	filter,
	onChange,
	agents,
}: {
	filter: ListFilter;
	onChange: (filter: ListFilter) => void;
	agents: AgentDescription[];
}) {
	const t = useT(),
		layer = useTransient(),
		[search, setSearch] = useState('');
	return (
		<DropdownMenu open={layer.open} onOpenChange={layer.onOpenChange}>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm">
					<Filter className="size-3.5" />
					{t('automation.filters')}
				</Button>
			</DropdownMenuTrigger>
			{layer.visible && (
				<DropdownMenuContent onCloseAutoFocus={layer.onCloseAutoFocus} className="w-56" align="start">
					<DropdownMenuLabel>{t('automation.status')}</DropdownMenuLabel>
					{['enabled', 'disabled'].map((value) => (
						<DropdownMenuCheckboxItem
							key={value}
							checked={filter.status === value}
							onCheckedChange={(checked) => onChange({ ...filter, status: checked ? value : 'all' })}
						>
							{t(`automation.${value}`)}
						</DropdownMenuCheckboxItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuLabel>{t('automation.lastRun')}</DropdownMenuLabel>
					{['failed', 'succeeded', 'neverRun'].map((value) => (
						<DropdownMenuCheckboxItem
							key={value}
							checked={filter.result === value}
							onCheckedChange={(checked) => onChange({ ...filter, result: checked ? value : 'all' })}
						>
							{t(`automation.${value}`)}
						</DropdownMenuCheckboxItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>{t('automation.action')}</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							{actionDescriptors.map((item) => (
								<DropdownMenuCheckboxItem
									key={item.kind}
									checked={filter.kinds.includes(item.kind)}
									onSelect={(event) => event.preventDefault()}
									onCheckedChange={() =>
										onChange({ ...filter, kinds: toggle(filter.kinds, item.kind) })
									}
								>
									{t(item.name)}
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>{t('automation.agent')}</DropdownMenuSubTrigger>
						<DropdownMenuSubContent className="w-60">
							<Input
								aria-label={t('automation.agentFilter')}
								placeholder={t('ui.search')}
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								onKeyDown={(event) => event.stopPropagation()}
							/>
							{agents
								.filter((agent) =>
									`${agent.id} ${agent.title}`.toLowerCase().includes(search.toLowerCase()),
								)
								.map((agent) => (
									<DropdownMenuCheckboxItem
										key={agent.id}
										checked={filter.agents.includes(agent.id)}
										onSelect={(event) => event.preventDefault()}
										onCheckedChange={() =>
											onChange({ ...filter, agents: toggle(filter.agents, agent.id) })
										}
									>
										{agent.title}
									</DropdownMenuCheckboxItem>
								))}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				</DropdownMenuContent>
			)}
		</DropdownMenu>
	);
}
export function FilterPills({ filter, onChange }: { filter: ListFilter; onChange: (filter: ListFilter) => void }) {
	const t = useT();
	const chips = [
		...(filter.status !== 'all'
			? [{ label: t(`automation.${filter.status}`), clear: () => onChange({ ...filter, status: 'all' }) }]
			: []),
		...(filter.result !== 'all'
			? [{ label: t(`automation.${filter.result}`), clear: () => onChange({ ...filter, result: 'all' }) }]
			: []),
		...filter.kinds.map((kind) => ({
			label: t(`automation.${kind}`),
			clear: () => onChange({ ...filter, kinds: toggle(filter.kinds, kind) }),
		})),
		...filter.agents.map((agent) => ({
			label: agent,
			clear: () => onChange({ ...filter, agents: toggle(filter.agents, agent) }),
		})),
	];
	if (!chips.length) return null;
	return (
		<div className="flex flex-wrap items-center gap-2 pb-3">
			{chips.map((chip) => (
				<Button
					key={chip.label}
					variant="secondary"
					size="xs"
					className="rounded-full"
					onClick={chip.clear}
					aria-label={t('automation.removeFilter', { name: chip.label })}
				>
					{chip.label}
					<X className="size-3" />
				</Button>
			))}
			<Button variant="ghost" size="xs" onClick={() => onChange(EMPTY_FILTER)}>
				{t('automation.clearAll')}
			</Button>
		</div>
	);
}
