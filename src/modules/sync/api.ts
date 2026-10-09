import { serviceKey } from '../../app/contracts/module';
import type { PanelModel, WorkbenchTarget } from '../../app/contracts/workbench';

/** A status bar row about git sync; the workbench opens the sync page (`section`) when it is clicked. */
export interface SyncStatusRow {
	id: string;
	kind: 'error' | 'running' | 'info';
	label: string;
	section?: string;
}

/** What the workbench shows for git sync: the side panel, page title and status rows. */
export interface SyncWorkbench {
	panel(target: WorkbenchTarget): PanelModel;
	title(target: WorkbenchTarget): string | undefined;
	status(): readonly SyncStatusRow[];
	subscribe(listener: () => void): () => void;
}

export const SYNC_WORKBENCH = serviceKey<SyncWorkbench>('sync', 'workbench');
