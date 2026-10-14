import type { AgentUsage, UsageSnapshot } from '../api';
import type { AgentController } from './controller';
import { getAgent } from '../core/launch/catalog';
import { getLanguage, t } from '../../../shared/i18n';
/** Stage 3 transport adapter. Retaining a subscriber is demand for the existing quota reader. */
export function agentUsage(controller: Pick<AgentController, 'usage' | 'usageAgents' | 'subscribe'>): AgentUsage {
	let cached: UsageSnapshot | undefined;
	let previous: ReturnType<typeof controller.usage.getState> | undefined;
	let agentsKey = '';
	return {
		snapshot: () => {
			const state = controller.usage.getState();
			const agents = controller.usageAgents();
			const key = `${getLanguage()}:${agents.join()}`;
			if (cached && previous === state && agentsKey === key) return cached;
			previous = state;
			agentsKey = key;
			cached = {
				refreshing: state.refreshing,
				providers: agents.map((id) => {
					const item = state.snapshots.find((s) => s.agentId === id);
					const retained = item?.failed ? cached?.providers.find(provider => provider.id === id) : undefined;
					return {
						id,
						name: getAgent(id).title,
						account: item?.account ?? undefined,
						status: item?.statusKey ? t(`agent.usage.status.${item.statusKey}`) : item?.status,
						failed: item?.failed,
						stale: item?.stale || !!retained,
						windows: item?.failed && !item.windows.some(window => window.usedPct !== null) && retained ? retained.windows : (item?.windows ?? []).flatMap((w) =>
							w.usedPct === null
								? []
								: [
										{
											label: w.name,
											usedPercent: Math.max(0, Math.min(100, w.usedPct)),
											resetsAt: w.resetAt ? Date.parse(w.resetAt) || undefined : undefined,
										},
									],
						),
					};
				}),
			};
			return cached;
		},
		subscribe: (listener) => {
			const release = controller.usage.retain();
			const off = controller.subscribe(listener);
			return () => {
				off();
				release();
			};
		},
		refresh: async () => {
			await controller.usage.refresh(true);
		},
		// Percentage display is a shell preference; the reader always returns used percentages.
		setDisplay: () => {},
	};
}
