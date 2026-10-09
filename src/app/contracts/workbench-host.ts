import type { ItemView, Menu } from 'obsidian';
import type { FeatureAvailability, NavigationItem, PanelModel, SavedPage, WorkbenchFeature, WorkbenchStatus, WorkbenchTarget } from './workbench';
import type { NativeSurface, NativeSurfaceContext } from '../../ui/native-surface';

export interface WorkbenchPageBinding {
	surface: NativeSurface;
	navigate(target: WorkbenchTarget, signal: AbortSignal): Promise<void>;
	getState?: () => Record<string, unknown>;
	getTarget?: () => WorkbenchTarget;
	restore?: (state: Record<string, unknown>) => Promise<void>;
}

/** What a side panel provider can read and do in the leaf it renders for. */
export interface PanelContext {
	target: WorkbenchTarget;
	pages: (feature: WorkbenchFeature) => SavedPage[];
	navigate: (target: WorkbenchTarget) => void;
}

export interface WorkbenchContribution {
	id: WorkbenchFeature;
	navigation: NavigationItem;
	/** Position in the rail; features without a rail entry are reached by links only. */
	rail?: { slot: 'top' | 'bottom'; badge?: () => number };
	/** A feature without its own rail entry highlights this one instead (records pages belong to Home). */
	railParent?: WorkbenchFeature;
	/** The side panel; defaults to the navigation children as rows. */
	panel?: (context: PanelContext) => PanelModel | undefined;
	/** Page title for the header (defaults to the navigation label, plus the section). */
	title?: (target: WorkbenchTarget) => string | undefined;
	availability(): FeatureAvailability;
	stateKeys: readonly string[];
	resourcePages?: boolean;
	navigationContext?: boolean;
	releaseWhenHidden?: boolean;
	create(context: NativeSurfaceContext, target: WorkbenchTarget, state: Record<string, unknown>, signal: AbortSignal): Promise<WorkbenchPageBinding>;
}

export interface WorkbenchHost {
	contributions: readonly WorkbenchContribution[];
	subscribe(listener: () => void): () => void;
	/** Open workbench settings for a feature (or the General category). */
	openSettings: (feature?: WorkbenchFeature) => void;
	/** Open the page in a focus-mode workbench leaf (new tab or split). */
	openFocus: (target: WorkbenchTarget, state: Record<string, unknown>, placement: 'tab' | 'split', ownerWindow: Window) => Promise<void>;
	/** From a focus-mode leaf: show this page in the full workbench of the same window. */
	openInWorkbench: (target: WorkbenchTarget, state: Record<string, unknown>, ownerWindow: Window) => Promise<void>;
	/** Whether a module failed to start (shown as a warning on its rail icon). */
	failed: (feature: WorkbenchFeature) => boolean;
	statuses?: () => readonly WorkbenchStatus[];
	report: (error: unknown) => void;
}

/** Creates a page for a workbench feature (modules provide these through `ModuleInstance.pages`). */
export type PageCreate = WorkbenchContribution['create'];

/** The workbench leaf as the shell sees it. */
export interface WorkbenchLeafView extends ItemView {
	lastActivatedAt: number;
}

/** The workbench UI of one leaf (rail, side panel, pages); created by the shell when the leaf opens. */
export interface WorkbenchSurface {
	readonly focusMode: boolean;
	displayText(): string;
	icon(): string;
	navigate(target: WorkbenchTarget, initial?: Record<string, unknown>): Promise<void>;
	ensureActivePage(): Promise<void>;
	getSavedPages(feature?: WorkbenchFeature): SavedPage[];
	activateResource(feature: WorkbenchFeature, id: string): Promise<boolean>;
	getNativeSurfaces(): readonly NativeSurface[];
	getState(): Record<string, unknown>;
	setState(raw: Record<string, unknown>): Promise<void>;
	prepareModuleChanges(disabled: ReadonlySet<WorkbenchFeature>): Promise<void>;
	onResize(): void;
	onPaneMenu(menu: Menu, source: string): void;
	dispose(): Promise<void>;
}
