// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/status-bar/StatusBarSurface.tsx
import type { AgentUsage, StatusBarPreferences, StatusSegment, WorkbenchTarget } from '../../app/contracts/workbench';
import { t } from '../../shared/i18n';
import { Button } from '../../ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/components/tooltip';
import { ShellIcon } from '../icon';
import { UsageCluster } from './UsageCluster';
import { VisibilityMenu } from './VisibilityMenu';
export function StatusBar({
	preferences,
	onPreferences,
	segments,
	usage,
	navigate,
	report,
}: {
	preferences: StatusBarPreferences;
	onPreferences: (value: StatusBarPreferences) => void;
	segments: readonly StatusSegment[];
	usage?: AgentUsage;
	navigate: (target: WorkbenchTarget) => void;
	report: (error: unknown) => void;
}) {
	return (
		<VisibilityMenu preferences={preferences} onPreferences={onPreferences}>
			<footer
				data-shell-region="status"
				tabIndex={-1}
				aria-label={t('shell.statusBar')}
				className="nand-status-bar flex items-center h-6 min-h-[24px] px-3 gap-4 overflow-clip [overflow-clip-margin:3px] whitespace-nowrap border-t border-border bg-sidebar text-xs select-none shrink-0 relative"
			>
				{preferences.segments.usage !== false ? (
					<UsageCluster
						usage={usage}
						preferences={preferences}
						onPreferences={onPreferences}
						navigate={navigate}
						report={report}
					/>
				) : (
					<div className="flex-1" />
				)}
				<div className="min-w-0 max-w-[calc(100%_-_1rem)] shrink-0 overflow-x-auto scrollbar-none">
					<div className="flex w-max items-center gap-3">
						{[...segments]
							.sort((a, b) => a.order - b.order)
							.filter(
								(s) =>
									preferences.segments[s.id] !== false &&
									preferences.segments[s.id.split(':')[0]!] !== false,
							)
							.map((s) => (
								<Tooltip key={s.id}>
									<TooltipTrigger asChild>
										<Button
											data-status-segment={s.id}
											variant="ghost"
											size="xs"
											className={`h-5 gap-1 rounded px-1 ${s.tone === 'error' ? 'text-destructive' : s.tone === 'attention' ? 'text-agent-question' : ''}`}
											aria-label={s.label}
											onClick={() => {
												if (s.target) navigate(s.target);
											}}
										>
											<ShellIcon
												name={s.icon}
												className={`size-3.5 ${s.tone === 'running' ? 'animate-spin motion-reduce:animate-none' : ''}`}
											/>
											<span className="tabular-nums">{s.count ?? s.label}</span>
										</Button>
									</TooltipTrigger>
									<TooltipContent side="top" sideOffset={6}>
										{s.label}
									</TooltipContent>
								</Tooltip>
							))}
					</div>
				</div>
			</footer>
		</VisibilityMenu>
	);
}
