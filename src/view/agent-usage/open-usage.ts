import type { App } from 'obsidian';
import type { AgentUsageSource } from '../../core/agent-launch/usage-source';
import { UsageModal } from './usage-modal';

export async function openUsage(host: { app: App; usageSource?: AgentUsageSource; openUsagePage?: () => Promise<void> }): Promise<void> {
 if (host.openUsagePage) { await host.openUsagePage(); return; }
 const source = host.usageSource;
 new UsageModal(host.app, source?.getState().snapshots ?? [], source).open();
}
