// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/AgentStateDot.tsx
import { CircleCheck, CircleDashed } from 'lucide-react';
import { useT } from '../../react/hooks';
import { cn } from '../../lib/utils';
import { AgentQuestionIcon } from './AgentQuestionIcon';
import { AgentWorkingSpinner } from './AgentWorkingSpinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';
export type AgentStatus = 'idle' | 'working' | 'question' | 'completed' | 'interrupted' | 'failed' | 'unknown';
type State = 'working' | 'waiting' | 'permission' | 'done' | 'idle' | 'failed' | 'interrupted' | 'unknown';
export function StatusDot({
	state: supplied,
	status,
	label: suppliedLabel,
	size = 'sm',
	sidebar = false,
	className,
}: {
	state?: State;
	status?: AgentStatus;
	label?: string;
	size?: 'sm' | 'md';
	sidebar?: boolean;
	className?: string;
}) {
	const t = useT();
	const state =
		supplied ?? (status === 'question' ? 'permission' : status === 'completed' ? 'done' : (status ?? 'unknown'));
	const label =
		suppliedLabel ??
		t(
			`ui.${status ?? (state === 'done' ? 'completed' : state === 'permission' || state === 'waiting' ? 'question' : state)}`,
		);
	const icon = size === 'md' ? 'size-3' : 'size-2.5',
		inner = size === 'md' ? 'size-2' : 'size-1.5';
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span
					role="img"
					tabIndex={0}
					aria-label={label}
					className={cn('inline-flex shrink-0 items-center justify-center', icon, className)}
				>
					{state === 'working' ? (
						<AgentWorkingSpinner className={inner} />
					) : state === 'waiting' || state === 'permission' ? (
						<AgentQuestionIcon className={icon} />
					) : state === 'unknown' ? (
						<CircleDashed className={cn('text-status-warning', icon)} />
					) : state === 'done' && !sidebar ? (
						<CircleCheck className={cn('text-status-success', icon)} />
					) : (
						<span
							className={cn(
								'block rounded-full',
								inner,
								state === 'done'
									? 'bg-status-success'
									: state === 'failed' || state === 'interrupted'
										? 'bg-status-error'
										: 'bg-muted-foreground/50',
							)}
						/>
					)}
				</span>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}
