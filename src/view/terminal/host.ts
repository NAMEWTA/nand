import type { AgentUsageSource } from '../../core/agent-launch/usage-source';
import type { App, WorkspaceLeaf } from 'obsidian';
import type { ContextMaterial } from '../../core/agent-launch/session-api';
import type { AgentId } from '../../core/agent-launch/types';
import type { VaultSession } from '../../core/ai-vault/types';
import type { PresetScript, TerminalSettings } from '../../core/pty/settings';
import type { PtySession } from '../../platform/desktop/terminal/pty-session';
import type { TerminalInstance } from './runtime/terminal-instance';
import type { TerminalSurface } from './terminal-surface';

export interface WorkbenchHost {
	app: App;
	manifest: { dir?: string };
	settings: TerminalSettings;
	getUsageSource?(): AgentUsageSource | undefined;
	openAutomationCenter(): Promise<void>;
	openNotificationCenter(): void;
	runPresetScript(script: PresetScript): Promise<void>;
	launchAgent(id: AgentId): Promise<void>;
	resumeSession(session: VaultSession): Promise<void>;
}
export interface TerminalViewHost extends WorkbenchHost {
	pickContextMaterial?(): Promise<ContextMaterial | null>;
	attachContext?(id: string, materials: readonly ContextMaterial[], signal?: AbortSignal): Promise<void>;
	getTerminalRenderer(session: PtySession): Promise<TerminalInstance>;
	recordActiveSession(id: string): void;
	showSessionSwitcher(view: TerminalSurface): void;
	activateTerminalView(leaf?: WorkspaceLeaf): Promise<void>;
	toggleAlwaysOnTopTerminal(view?: TerminalSurface | null): Promise<void>;
	getAlwaysOnTopTerminalLabel(view?: TerminalSurface | null): string;
	isAlwaysOnTopTerminal(view?: TerminalSurface | null): boolean;
	handleTerminalViewClosed(view: TerminalSurface): void;
}
