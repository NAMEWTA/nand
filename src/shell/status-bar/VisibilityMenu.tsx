// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/status-bar/StatusBarVisibilityMenu.tsx
import type { ReactNode } from 'react';
import type { StatusBarPreferences } from '../../app/contracts/workbench';
import {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuCheckboxItem,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuLabel,
	ContextMenuItem,
} from '../../ui/components/context-menu';
import { t } from '../../shared/i18n';
import { useShellCloseAutoFocus } from '../interaction-lifetime';
export const segmentLabels = {
	usage: 'shell.usage',
	'agents-waiting': 'shell.waiting',
	'agents-running': 'shell.running',
	automations: 'shell.automations',
	'automation-load': 'shell.automationError',
	sync: 'shell.sync',
	'dashboard-save': 'shell.saveError',
	notifications: 'shell.notifications',
} as const;
export function VisibilityMenu({
	preferences,
	onPreferences,
	children,
}: {
	preferences: StatusBarPreferences;
	onPreferences: (next: StatusBarPreferences) => void;
	children: ReactNode;
}) {
	const closeAutoFocus = useShellCloseAutoFocus();
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
			<ContextMenuContent onCloseAutoFocus={closeAutoFocus}>
				{Object.entries(segmentLabels).map(([id, key]) => (
					<ContextMenuCheckboxItem
						key={id}
						checked={preferences.segments[id] !== false}
						onCheckedChange={(checked) =>
							onPreferences({ ...preferences, segments: { ...preferences.segments, [id]: checked } })
						}
					>
						{t(key)}
					</ContextMenuCheckboxItem>
				))}
				<ContextMenuSeparator />
				<ContextMenuLabel>{t('shell.usageDisplay')}</ContextMenuLabel>
				<ContextMenuRadioGroup
					value={preferences.usageDisplay}
					onValueChange={(value) =>
						onPreferences({ ...preferences, usageDisplay: value === 'remaining' ? 'remaining' : 'used' })
					}
				>
					<ContextMenuRadioItem value="used">{t('shell.used')}</ContextMenuRadioItem>
					<ContextMenuRadioItem value="remaining">{t('shell.remaining')}</ContextMenuRadioItem>
				</ContextMenuRadioGroup>
				<ContextMenuLabel>{t('shell.usageMode')}</ContextMenuLabel>
				<ContextMenuRadioGroup
					value={preferences.usageMode}
					onValueChange={(value) =>
						onPreferences({ ...preferences, usageMode: value === 'compact' ? 'compact' : 'verbose' })
					}
				>
					<ContextMenuRadioItem value="verbose">{t('shell.verbose')}</ContextMenuRadioItem>
					<ContextMenuRadioItem value="compact">{t('shell.compact')}</ContextMenuRadioItem>
				</ContextMenuRadioGroup>
				<ContextMenuSeparator />
				<ContextMenuItem onSelect={() => onPreferences({ ...preferences, visible: false })}>
					{t('shell.hideStatusBar')}
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
