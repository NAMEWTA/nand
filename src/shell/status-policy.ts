import type { WorkbenchStatus } from '../app/contracts/workbench';
/** The page header replaces a missing native status bar. It does not add a second poller. */
export function headerStatuses(hasNativeStatusBar: boolean, rows: readonly WorkbenchStatus[]): readonly WorkbenchStatus[] {
	return hasNativeStatusBar ? [] : rows;
}
