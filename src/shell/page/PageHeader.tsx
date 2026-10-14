import { Loader2 } from 'lucide-react';
import type { StatusSegment } from '../../app/contracts/workbench';
import { t } from '../../shared/i18n';
import { Button } from '../../ui/components/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/components/tooltip';
import { ShellIcon } from '../icon';
export interface PageHeaderProps {
	title: string;
	busy: boolean;
	panelToggle?: { open: boolean; icon: string; onToggle: () => void };
	statuses: readonly StatusSegment[];
	openStatus: (status: StatusSegment) => void;
	openInWorkbench?: () => void;
	more: (event: MouseEvent) => void;
}
export function PageHeader({ title, busy, panelToggle, statuses, openStatus, openInWorkbench, more }: PageHeaderProps) {
	return (
		<header className="nand-page-header flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
			{panelToggle && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							className="nand-page-panel-toggle"
							variant="ghost"
							size="icon-sm"
							aria-label={t('workbench.toggleNavigation')}
							aria-expanded={panelToggle.open}
							onClick={panelToggle.onToggle}
						>
							<ShellIcon name={panelToggle.icon} />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{t('workbench.toggleNavigation')}</TooltipContent>
				</Tooltip>
			)}
			<h1
				tabIndex={-1}
				data-workbench-focus="title"
				className="min-w-0 truncate rounded-sm text-sm font-semibold focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				{title}
			</h1>
			{busy && (
				<Loader2
					role="status"
					aria-label={t('workbench.loading')}
					className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
				/>
			)}
			<div className="flex-1" />
			{statuses.slice(0, 3).map((s) => (
				<Button key={s.id} variant="ghost" size="xs" onClick={() => openStatus(s)} aria-label={s.label}>
					<ShellIcon name={s.icon} />
					{s.count ?? s.label}
				</Button>
			))}
			{openInWorkbench && (
				<Button variant="ghost" size="sm" onClick={openInWorkbench}>
					<ShellIcon name="panels-top-left" />
					{t('workbench.openInWorkbench')}
				</Button>
			)}
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={t('workbench.more')}
						onClick={(e) => more(e.nativeEvent)}
					>
						<ShellIcon name="more-horizontal" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>{t('workbench.more')}</TooltipContent>
			</Tooltip>
		</header>
	);
}
