import type { AgentId } from '../launch/types';
import type { LayoutNode } from '../terminal/layout';
import type { ShellChoice } from '../terminal/settings';

export type AgentState = 'working' | 'waiting' | 'permission' | 'done' | 'idle' | 'failed' | 'interrupted' | 'unknown';
export type TabColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'gray';
export interface ResumeInfo {
	customTitle?: string;
	nativeSessionId?: string;
	cwd: string;
	accountId?: string;
	transcriptPath?: string;
	agentId?: AgentId;
	shell?: ShellChoice;
}
interface TabBase {
	id: string;
	title: string;
	customTitle?: string;
	pinned?: boolean;
	color?: TabColor;
	createdAt: number;
}
export interface TerminalTabData extends TabBase {
	kind: 'terminal';
	agentId?: AgentId;
	sessionIds: string[];
	paneLayout: LayoutNode;
	focusedSessionId: string;
	/** Each pane keeps its own recovery metadata; no environment or credentials are persisted. */
	panes: Record<string, ResumeInfo>;
	resume?: ResumeInfo;
	state: AgentState;
	unread: boolean;
	updatedAt: number;
}
export interface BrowserTabData extends TabBase {
	kind: 'browser';
	pageId: string;
	url: string;
	faviconUrl?: string;
	profileId: string;
	zoom: number;
}
export type WorkspaceTab = TerminalTabData | BrowserTabData;
export interface TabGroup {
	id: string;
	tabIds: string[];
	activeTabId?: string;
	recentTabIds: string[];
}
export type GroupLayoutNode =
	| { kind: 'group'; groupId: string }
	| { kind: 'split'; direction: 'row' | 'column'; sizes: number[]; children: GroupLayoutNode[] };
export interface WorkspaceState {
	version: 1;
	tabs: Record<string, WorkspaceTab>;
	groups: TabGroup[];
	layout?: GroupLayoutNode;
	activeGroupId?: string;
	closedTabs: WorkspaceTab[];
}
export const MAX_GROUPS = 4;
export const emptyWorkspace = (): WorkspaceState => ({ version: 1, tabs: {}, groups: [], closedTabs: [] });
