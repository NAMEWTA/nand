/** Rendering and navigation contracts; no Plugin, Vault, PTY or service locator. */
export const WORKBENCH_FEATURES = ['dashboard', 'terminal', 'browser', 'contacts', 'automations', 'notifications', 'habit', 'expense'] as const;
export type WorkbenchFeature = typeof WORKBENCH_FEATURES[number];
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
