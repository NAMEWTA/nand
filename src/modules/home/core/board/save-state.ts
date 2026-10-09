import { t } from '../../../../shared/i18n/index';
export const DASHBOARD_CONFLICT_DIR = '.nand/recovery/dashboard/conflicts';
export type DashboardSaveStatus = 'saved' | 'saving' | 'conflict-pending' | 'conflict-saved' | 'recovery-error' | 'save-error';
export interface DashboardSaveState {
	status: DashboardSaveStatus;
	localRevision: number;
	recoveryRevision: number;
	recoveryPath: string | null;
	detail: string;
}
export class DashboardSaveError extends Error {
	constructor(readonly code: 'conflict' | 'saveFailed' | 'recoveryFailed' | 'changed' | 'closed', message: string) { super(message); this.name = 'DashboardSaveError'; }
}
export function dashboardSaveMessage(state: Readonly<DashboardSaveState>): string {
	if (state.status === 'saved') return '';
	const keys = { saving: 'dashboard.sync.saving', 'conflict-pending': 'dashboard.sync.conflictPending', 'conflict-saved': 'dashboard.sync.conflict', 'recovery-error': 'dashboard.sync.recoveryFailed', 'save-error': 'dashboard.sync.saveFailed' };
	return t(keys[state.status], { path: state.recoveryPath ?? DASHBOARD_CONFLICT_DIR });
}
