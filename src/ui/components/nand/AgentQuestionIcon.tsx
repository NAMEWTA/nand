// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/AgentQuestionIcon.tsx
import type { ComponentProps } from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import { cn } from '../../lib/utils';
export function AgentQuestionIcon({ className, ...props }: ComponentProps<typeof MessageCircleQuestion>) {
	return <MessageCircleQuestion {...props} className={cn('text-agent-question', className)} aria-hidden="true" />;
}
