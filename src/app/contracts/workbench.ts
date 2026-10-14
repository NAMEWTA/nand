/** Rendering and navigation contracts; no Plugin, Vault, PTY or service locator. */
import type { ModuleId } from './module';

export const WORKBENCH_FEATURES = ['dashboard', 'terminal', 'browser', 'contacts', 'automations', 'notifications', 'icons', 'records', 'sync', 'content', 'settings'] as const;
export type WorkbenchFeature = typeof WORKBENCH_FEATURES[number];

/** The module that owns each workbench feature (`settings` belongs to the app). */
export const FEATURE_MODULES: Readonly<Record<WorkbenchFeature, ModuleId | 'app'>> = {
	dashboard: 'home',
	terminal: 'agent',
	browser: 'browser',
	contacts: 'archives',
	automations: 'automations',
	notifications: 'notifications',
	icons: 'icons',
	records: 'home',
	sync: 'sync',
	settings: 'app',
	content: 'app',
};

export interface WorkbenchTarget {
	feature: WorkbenchFeature;
	section?: string;
	resourceId?: string;
	focusId?: string;
}
export interface FeatureAvailability {
	enabled: boolean;
	supported: boolean;
	ready: boolean;
	reason?: string;
}
export interface NavigationItem {
	id: string;
	labelKey: string;
	icon: string;
	target?: WorkbenchTarget;
	children?: readonly NavigationItem[];
	badge?: number;
	aliases?: readonly string[];
}

/** A page the workbench keeps (or restores) with its bounded state. */
export interface SavedPage {
	target: WorkbenchTarget;
	state: Record<string, unknown>;
}

/** One row in the side panel (column 2). */
export interface PanelItem {
	id: string;
	label: string;
	icon?: string;
	meta?: string;
	badge?: number;
	/** Navigates the page; omitted for rows that only run `select`. */
	target?: WorkbenchTarget;
	/** Runs instead of (or before) navigating, e.g. switching the active board. */
	select?: () => void | Promise<void>;
	/** Row menu entries (shown on hover as "⋯" and on right click). */
	menu?: () => ReadonlyArray<{ title: string; icon?: string; danger?: boolean; run: () => void | Promise<void> }>;
	active?: boolean;
}
export interface PanelSection {
	id: string;
	title?: string;
	items: readonly PanelItem[];
	emptyText?: string;
}
export interface PanelModel {
	/** The main action of the module, shown at the top of the panel ("New session", "New board"). */
	primary?: { label: string; icon: string; run: () => void | Promise<void> };
	/** Show a search field that filters every section by label. */
	searchable?: boolean;
	sections: readonly PanelSection[];
}

export interface WorkbenchPage {
	/** May change the selected object, but must not implicitly start a session. */
	navigate(target: WorkbenchTarget, signal: AbortSignal): Promise<void>;
	setVisible(visible: boolean): void;
	getState(): Record<string, unknown>;
	setState(state: Record<string, unknown>): Promise<void>;
	/** Releases UI; business shutdown belongs to the owning module. */
	dispose(): Promise<void>;
}
export interface WorkbenchStatus {
	id: string;
	kind: 'error' | 'running' | 'unread' | 'info';
	label: string;
	target: WorkbenchTarget;
}

export type PageChrome = 'standard' | 'none';
export interface StatusSegment {
 id: string;
 icon: string;
 label: string;
 tone?: 'neutral' | 'running' | 'attention' | 'error';
 count?: number;
 target?: WorkbenchTarget;
 order: number;
}
export interface StatusBarPreferences {
 visible: boolean;
 segments: Record<string, boolean>;
 usageMode: 'verbose' | 'compact';
 usageDisplay: 'used' | 'remaining';
 mirrorToObsidian: boolean;
}
/** Transport-only quota model; shell never imports a module implementation. */
export interface UsageProvider {
 id: string;
 name: string;
 account?: string;
 status?: string;
 stale?: boolean;
 failed?: boolean;
 windows: readonly { label: string; usedPercent: number; resetsAt?: number }[];
}
export interface UsageSnapshot {
 providers: readonly UsageProvider[];
 refreshing: boolean;
}
export interface AgentUsage {
 snapshot(): UsageSnapshot;
 subscribe(listener: () => void): () => void;
 refresh(): Promise<void>;
 setDisplay(display: StatusBarPreferences['usageDisplay']): void;
}
