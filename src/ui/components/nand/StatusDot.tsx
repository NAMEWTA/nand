import { Check, Circle, CircleHelp, Loader2, Pause, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useT } from '../../react/hooks';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';
const states = {
	idle: { icon: Circle, color: 'text-muted-foreground', label: 'ui.idle' },
	working: {
		icon: Loader2,
		color: 'text-foreground animate-spin motion-reduce:animate-none',
		label: 'ui.working',
	},
	question: { icon: CircleHelp, color: 'text-agent-question', label: 'ui.question' },
	completed: { icon: Check, color: 'text-status-success', label: 'ui.completed' },
	interrupted: { icon: Pause, color: 'text-muted-foreground', label: 'ui.interrupted' },
	failed: { icon: X, color: 'text-destructive', label: 'ui.failed' },
	unknown: { icon: CircleHelp, color: 'text-muted-foreground', label: 'ui.unknown' },
};
export type AgentStatus = keyof typeof states;
export function StatusDot({ status, className }: { status: AgentStatus; className?: string }) {
	const t = useT();
	const { icon: Icon, color, label } = states[status];
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span tabIndex={0} role="img" aria-label={t(label)} className="inline-flex">
					<Icon aria-hidden className={cn('size-3.5', color, className)} />
				</span>
			</TooltipTrigger>
			<TooltipContent>{t(label)}</TooltipContent>
		</Tooltip>
	);
}
