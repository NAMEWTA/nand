import { createStore } from 'zustand/vanilla';
export type AgentView = 'running' | 'board' | 'usage';
export function createWorkspaceView(saved: Record<string, unknown> = {}) {
	const view = saved.agentView === 'board' || saved.agentView === 'usage' ? saved.agentView : 'running';
	return createStore<{ view: AgentView; history: boolean; historyWidth: number; jump: boolean; provider?: string }>(
		() => ({
			view,
			history: saved.agentHistory === true,
			historyWidth:
				typeof saved.agentHistoryWidth === 'number'
					? Math.max(240, Math.min(480, saved.agentHistoryWidth))
					: 300,
			jump: false,
		}),
	);
}
export type WorkspaceViewStore = ReturnType<typeof createWorkspaceView>;
