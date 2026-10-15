// Adapted from stablyai/orca 464bd5a (MIT), Copyright (c) 2026 Lovecast Inc.: src/renderer/src/components/tab-bar/tab-bar-surface.tsx
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../../../../ui/components/dropdown-menu';
import { Button } from '../../../../ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../ui/components/tooltip';
import { useOwnerDocument } from '../../../../ui/react/contexts';
import { useT } from '../../../../ui/react/hooks';
import type { AgentController } from '../../services/controller';
import { Omnibox } from './Omnibox';
export function NewTabMenu({
	controller,
	groupId,
	open: controlled,
	onOpenChange,
}: {
	controller: AgentController;
	groupId?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}) {
	const t = useT(),
		doc = useOwnerDocument(),
		[local, setLocal] = useState(false),
		open = controlled ?? local;
	const setOpen = onOpenChange ?? setLocal;
	return (
		<DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon-xs"
							className="ml-2 my-auto h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground"
							aria-label={t('agent.workspace.newTab')}
						>
							<Plus className="size-3.5" />
						</Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>{t('agent.workspace.newTab')} · Ctrl Shift N</TooltipContent>
			</Tooltip>
			<DropdownMenuContent
				align="start"
				sideOffset={6}
				className="w-72 max-w-[calc(100vw-1rem)] rounded-[11px] border-border/80 p-1 shadow-[0_16px_36px_rgba(0,0,0,0.24)]"
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					const tab = controller.workspace.active;
					if (tab?.kind === 'terminal') {
						doc.querySelector<HTMLElement>(
							`[data-terminal-host="${tab.focusedSessionId}"] textarea`,
						)?.focus();
					}
				}}
				onKeyDown={(event) => {
					if (event.key !== 'Escape') event.stopPropagation();
				}}
			>
				<Omnibox controller={controller} groupId={groupId} onDone={() => setOpen(false)} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
