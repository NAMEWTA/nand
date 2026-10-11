import { Platform, type App } from 'obsidian';
import { privateVaultStorage } from '../../../host/obsidian/storage/private-storage';
import { deviceId } from '../../../host/obsidian/storage/device-id';
import type { BrowserPageTarget } from '../core/control';
import type { TargetBinding } from '../core/workspace/model';
import type { BrowserPage } from '../platform/desktop/page';
import { BrowserError } from '../core/model';
import { WorkspaceJournal } from '../platform/workspace-journal';
import { markdownWorkspaceStore } from '../platform/workspace-store';
import { workspaceRecoveryDirectory } from '../platform/workspace-recovery';
import { Workspace } from './workspace';
import { ownedProviders } from './owned-providers';
import type { PageLease } from '../core/page-ownership';
import type { SynthesisAgents } from './synthesis';
import type { ProviderOverride } from '../core/providers/user-adapter';

/** Second-level lazy loading: ordinary browsing never initializes task documents or provider sessions. */
export async function createWorkspaceRuntime(app: App, folder: string, ports: {
	enabled(): boolean;
	page(target: BrowserPageTarget): BrowserPage;
	target(binding: TargetBinding): BrowserPageTarget;
	activate(target: BrowserPageTarget, signal: AbortSignal): Promise<void>;
	claim(target: BrowserPageTarget, taskId: string, signal: AbortSignal): PageLease;
	changed(): void;
	agents?: SynthesisAgents;
	adapter?(binding: TargetBinding, taskId: string): Promise<ProviderOverride | undefined>;
}): Promise<Workspace> {
	const providers = Platform.isDesktopApp ? (await import('../platform/desktop/provider-registry')).workspaceProviders(ports)
		: { connect: async () => { throw new BrowserError('browser_workspace_desktop'); } };
	if (!ports.enabled()) throw new BrowserError('browser_disabled');
	const recovery = (await workspaceRecoveryDirectory(app, folder)) + '/' + crypto.randomUUID() + '.json';
	if (!ports.enabled()) throw new BrowserError('browser_disabled');
	const store = markdownWorkspaceStore(app, folder, () => ports.changed(), recovery);
	const journal = new WorkspaceJournal(privateVaultStorage(app), `.nand/browser/${deviceId(app)}/workspace-journal.json`, () => ports.changed());
	return new Workspace({ store, journal, providers: ownedProviders(providers, (target, taskId, signal) => ports.claim(target, taskId, signal)), target: binding => ports.target(binding),
		id: () => crypto.randomUUID(), now: () => Date.now(), agents: ports.agents,
		hash: async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('') });
}
