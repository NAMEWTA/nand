import type { App, WorkspaceLeaf } from 'obsidian';
import type { AgentId } from '../../core/agent-launch/types';
import type { VaultSession } from '../../core/ai-vault/types';
import type { PresetScript, TerminalSettings } from '../../core/pty/settings';
import type { PtySession } from '../../platform/desktop/terminal/pty-session';
import type { TerminalInstance } from './runtime/terminal-instance';
import type { TerminalView } from './terminal-view';

export interface WorkbenchHost {
	app: App;
	manifest: { dir?: string };
	settings: TerminalSettings;
	openAutomationCenter(): Promise<void>;
	openNotificationCenter(): void;
	runPresetScript(script: PresetScript): Promise<void>;
	launchAgent(id: AgentId): Promise<void>;
	resumeSession(session: VaultSession): Promise<void>;
}
export interface TerminalViewHost extends WorkbenchHost {
	getTerminalRenderer(session: PtySession): Promise<TerminalInstance>;
	activateTerminalView(leaf?: WorkspaceLeaf): Promise<void>;
	toggleAlwaysOnTopTerminal(view?: TerminalView | null): Promise<void>;
	getAlwaysOnTopTerminalLabel(view?: TerminalView | null): string;
	isAlwaysOnTopTerminal(view?: TerminalView | null): boolean;
	handleTerminalViewClosed(view: TerminalView): void;
}
