import type { NativeSession, NativeSessionSummary } from '../../platform/terminal-server/agent-data-client';

/** Owned by the leaf, including pending actions that must survive window migration. */
export interface WorkbenchState {
	sidebarWidth: number;
	wideSidebarOpen: boolean;
	drawerOpen: boolean;
	navigation: 'running' | 'history';
	sessionQuery: string;
	historyQuery: string;
	historyFilter: 'active' | 'favorite' | 'archived';
	historyOffset: number;
	selectedHistory: NativeSessionSummary | null;
	showHistory: boolean;
	preview: NativeSession | null;
	resumeKey: string | null;
	exportKey: string | null;
}
export type WorkbenchChange = (patch: Partial<WorkbenchState>) => void;
export function sidebarWidth(value: number): number {
	return Math.min(360, Math.max(240, Number.isFinite(value) ? value : 272));
}
export function createWorkbenchState(): WorkbenchState {
	return {
		sidebarWidth: 272, wideSidebarOpen: true, drawerOpen: false, navigation: 'running',
		sessionQuery: '', historyQuery: '', historyFilter: 'active', historyOffset: 0,
		selectedHistory: null, showHistory: false, preview: null, resumeKey: null, exportKey: null,
	};
}
