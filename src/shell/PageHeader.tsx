import type { WorkbenchStatus } from '../app/contracts/workbench';
import { t } from '../shared/i18n';
import { Button } from '../ui/primitives/Button';
import { IconButton } from '../ui/primitives/IconButton';

export interface PageHeaderProps {
	title: string;
	busy: boolean;
	/** Show the panel toggle (collapsed panel, overlay layouts or the narrow drawer). */
	panelToggle?: { open: boolean; label: string; icon: string; onToggle: () => void };
	statuses: readonly WorkbenchStatus[];
	openStatus: (status: WorkbenchStatus) => void;
	/** Focus-mode leaves offer a way back into the full workbench. */
	openInWorkbench?: () => void;
	more: (event: MouseEvent) => void;
}

/** Column 3 header: where you are and what you can do here. */
export function PageHeader({ title, busy, panelToggle, statuses, openStatus, openInWorkbench, more }: PageHeaderProps) {
	return (
		<header class="nand-page-header">
			{panelToggle && <IconButton className="nand-page-panel-toggle" icon={panelToggle.icon} label={panelToggle.label} pressed={panelToggle.open} onClick={panelToggle.onToggle} />}
			<h1 class="nand-page-title" tabIndex={-1} data-workbench-focus="title">{title}</h1>
			{busy && <span class="nand-page-busy" role="status" aria-label={t('workbench.loading')} />}
			<span class="nand-ui-spacer" />
			<div class="nand-page-statuses">
				{statuses.slice(0, 3).map((status) => (
					<button type="button" key={status.id} class={`nand-status-chip is-${status.kind}`} onClick={() => openStatus(status)}>
						<span class="nand-status-dot" aria-hidden="true" />
						{status.label}
					</button>
				))}
			</div>
			{openInWorkbench && <Button className="nand-page-open-workbench" size="sm" variant="ghost" icon="panels-top-left" onClick={openInWorkbench}>{t('workbench.openInWorkbench')}</Button>}
			<IconButton icon="more-horizontal" label={t('workbench.more')} onClick={(event) => more(event)} />
		</header>
	);
}
