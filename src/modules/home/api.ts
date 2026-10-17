/** Public surface of the home module (types and service keys). */
import { contributionPoint, serviceKey } from '../../app/contracts/module';
import type { HomeWidgetCategory, HomeWidgetTier } from './core/board/widget-tiers';

export interface HomeWidgetContext {
	readonly boardPath: string;
	readonly memberId: string;
	readonly instanceId: string;
	readonly document: Document;
	readonly window: Window;
	readonly signal: AbortSignal;
	/** Register resources as soon as they exist, including before an asynchronous mount finishes. */
	register(this: void, dispose: () => void): void;
	/** Providers report failures from asynchronous updates through the same isolated error state. */
	reportError(this: void, error: unknown): void;
	openSettings(this: void): void;
}

export interface HomeWidgetInstance {
	id: string;
	label?: string;
	icon?: string;
}

export {
	HOME_WIDGET_CATEGORIES,
	HOME_WIDGET_TIERS,
	type HomeWidgetCategory,
	type HomeWidgetTier,
} from './core/board/widget-tiers';

export interface HomeWidgetKind {
	key: string;
	titleKey: string;
	icon: string;
	/** Group shown in the add-widget panel. */
	category: HomeWidgetCategory;
	/** The one size table of this widget: the tiers it supports, as grid cells (w columns × h fine rows). */
	sizes: Readonly<Partial<Record<HomeWidgetTier, { w: number; h: number }>>>;
	/** The tier a new instance starts at; it must be one of `sizes`. */
	defaultTier: HomeWidgetTier;
	/** Smallest size a free resize may reach. */
	minSize: { w: number; h: number };
	multiple?: boolean;
	/** A board content section (notes, projects, library...) this kind creates; such kinds have no provider instances. */
	section?: string;
	/** The provider owns instance configuration; absent instances remain as board placeholders. */
	instances(): readonly HomeWidgetInstance[];
	create?(context: HomeWidgetContext): Promise<HomeWidgetInstance | null>;
	configure?(context: HomeWidgetContext): Promise<void>;
	render(host: HTMLElement, context: HomeWidgetContext): void | (() => void) | Promise<void | (() => void)>;
}

export interface HomeWidgetBundle {
	kinds: readonly HomeWidgetKind[];
	/** Notify only when instance availability, labels or configuration change. */
	subscribeInstances?(listener: () => void): () => void;
}

/** One bundle per contributing module. Home collects them and mounts by kind. */
export const HOME_WIDGETS = contributionPoint<HomeWidgetBundle>('home', 'widgets');

/** Multi-board registry operations exposed to the shell and other modules. */
export interface BoardOperations {
	switch(path: string): Promise<void>;
	create(name: string): Promise<void>;
	rename(path: string, name: string): Promise<void>;
	remove(path: string): Promise<void>;
	reorder(from: number, to: number): Promise<void>;
	retarget(oldPath: string, newPath: string): Promise<void>;
	/** The board after (`1`) or before (`-1`) `active`, wrapping around; undefined with one board. */
	adjacent(active: string, delta: 1 | -1): string | undefined;
}

/** View type string of a board page (its `NativeSurface.getViewType()`). */
export const BOARD_SURFACE_TYPE = 'nand-dashboard-view';

/** What other code may call on an open board page, without loading the board code. */
export interface BoardSurfaceApi {
	getViewType(): string;
	readonly contentEl: HTMLElement;
	readonly leaf: unknown;
	readonly plugin: { settings: { dashboardFile: string }; switchWorkspace(path: string): Promise<void> };
	refresh(): Promise<void>;
	reloadFromDisk(): Promise<void>;
	applyWorkspaceSwitch(): Promise<void>;
	addSection(): Promise<void>;
	toggleBannerMode(): Promise<void>;
	/** Unsaved, failed or conflicting board writes, as one sentence (empty when saved). */
	saveMessage(): string;
	readonly sync: {
		flush?(): Promise<void>;
		getSaveState(): { status: string };
	};
}

/** Board save problems exposed to the workbench status bar. */
export interface HomeWorkbench {
	saveStatuses(): ReadonlyArray<{ path: string; status: string; message: string }>;
	subscribe(listener: () => void): () => void;
}

export const HOME_WORKBENCH = serviceKey<HomeWorkbench>('home', 'workbench');
