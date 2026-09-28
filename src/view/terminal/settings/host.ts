import type { AiLauncherCatalogEntry } from '../../../core/pty/ai-launcher-catalog';
import type { AiLauncherStatusSnapshot } from '../../../core/pty/ai-launcher-status';
import type { PresetScript } from '../../../core/pty/settings';
import type { ServerManager } from '../../../platform/terminal-server/server-manager';
import type { AgentSettingsHost } from './agents';

export interface TerminalSettingsHost extends AgentSettingsHost {
	getServerManager(): Promise<ServerManager>;
	getAiLauncherSnapshot(presetId: string): AiLauncherStatusSnapshot | undefined;
	onAiLauncherSnapshotsChanged(listener: (presetId: string, snapshot: AiLauncherStatusSnapshot) => void): () => void;
	openAiLauncherUpgradeModalForPreset(script: PresetScript): boolean;
	refreshAiLauncherSnapshot(entry: AiLauncherCatalogEntry): Promise<AiLauncherStatusSnapshot | null>;
	refreshAiLauncherStatusFromSettings(options?: { force?: boolean }): Promise<void>;
	updateFeatureVisibility(): void;
}
