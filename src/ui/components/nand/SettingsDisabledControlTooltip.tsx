// Adapted from stablyai/orca 464bd5a54b3364021c5cc0319859616e5ec41bbf (MIT), Copyright (c) 2026 Lovecast Inc.
// Original: src/renderer/src/components/settings/SettingsDisabledControlTooltip.tsx
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip';
export function SettingsDisabledControlTooltip({ reason, children }: { reason?: string; children: ReactNode }) {
	if (!reason) return <>{children}</>;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span tabIndex={0}>{children}</span>
			</TooltipTrigger>
			<TooltipContent>{reason}</TooltipContent>
		</Tooltip>
	);
}
