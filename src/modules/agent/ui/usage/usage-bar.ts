import { AGENT_CATALOG } from '../../core/launch/catalog';
import type { AgentId, AgentSettings, UsageSnapshot } from '../../core/launch/types';
import { formatUsageChip } from '../../core/launch/usage-format';
import { t } from '../../../../shared/i18n/index';

export interface UsageBarHost {
	isActive?: () => boolean;
	settings: { agentSettings: AgentSettings };
}

export interface UsageBarElement {
	toggleClass(name: string, on: boolean): void;
	replaceChildren(): void;
	createSpan(spec: { cls?: string; text?: string }): UsageBarElement;
}

export function enabledUsageAgents(plugin: UsageBarHost): AgentId[] {
	const { agents } = plugin.settings.agentSettings;
	return AGENT_CATALOG.filter(
		(agent) =>
			agent.usage !== 'none' && agents[agent.id]?.enabled !== false && agents[agent.id]?.showUsage !== false,
	).map((agent) => agent.id);
}

export function usageBarVisible(plugin: UsageBarHost): boolean {
	if (plugin.isActive && !plugin.isActive()) return false;
	if (!plugin.settings.agentSettings.showUsageInStatusBar) return false;
	return enabledUsageAgents(plugin).length > 0;
}

/** Repaint cached data without changing the polling schedule or reading providers. */
export function renderUsageBar(
	status: UsageBarElement,
	plugin: UsageBarHost,
	snapshots: readonly UsageSnapshot[],
): boolean {
	const show = usageBarVisible(plugin);
	status.toggleClass('is-hidden', !show);
	status.replaceChildren();
	if (!show) return false;
	const chips = snapshots.flatMap((snapshot) => {
		const rest = formatUsageChip(snapshot);
		return rest ? [{ provider: snapshot.provider, rest }] : [];
	});
	if (chips.length === 0) {
		status.createSpan({ cls: 'terminal-usage-rest', text: t('agent.usage.chip') });
	} else {
		for (const chip of chips) {
			const item = status.createSpan({ cls: 'terminal-usage-item' });
			item.createSpan({ cls: 'terminal-usage-agent', text: chip.provider });
			item.createSpan({ cls: 'terminal-usage-rest', text: chip.rest });
		}
	}
	return true;
}

/**
 * Paint the usage status item. Returns the snapshots that should be kept,
 * or null when the bar is hidden or a result arrived after the host went inactive.
 * The "用量" label is written before the network read.
 */
export async function paintUsageBar(
	status: UsageBarElement,
	plugin: UsageBarHost,
	readSnapshots: (ids: readonly AgentId[]) => Promise<UsageSnapshot[]>,
): Promise<UsageSnapshot[] | null> {
	if (!renderUsageBar(status, plugin, [])) return null;
	const latest = await readSnapshots(enabledUsageAgents(plugin));
	return renderUsageBar(status, plugin, latest) ? latest : null;
}
