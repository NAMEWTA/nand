// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/AgentWorkingSpinner.tsx
import { cn } from '../../lib/utils';
export function AgentWorkingSpinner({ className }: { className?: string }) {
	return (
		<span
			data-agent-spinner=""
			className={cn(
				'block rounded-full border-2 border-foreground border-t-transparent animate-spin motion-reduce:animate-none motion-reduce:border-t-foreground',
				className,
			)}
		/>
	);
}
