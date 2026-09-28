import { readUsageSnapshots } from '../../platform/desktop/agents/usage';
import { usageContext } from '../../platform/obsidian/agents/usage-context';
import { enabledUsageAgents, usageBarVisible } from './usage-bar';
import { UsageModal } from './usage-modal';

export async function openUsage(plugin: Parameters<typeof usageContext>[0]): Promise<void> {
	if (!usageBarVisible(plugin)) return;
	const snapshots = await readUsageSnapshots(enabledUsageAgents(plugin), usageContext(plugin));
	new UsageModal(plugin.app, snapshots).open();
}
