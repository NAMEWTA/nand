/** Public surface of the home module (types and service keys). */
import { contributionPoint, serviceKey } from '../../app/contracts/module';
import type { PanelModel, WorkbenchTarget } from '../../app/contracts/workbench';
import type { BoardLayout } from './core/board/types/model';

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

export interface HomeWidgetInstance { id: string; label?: string; icon?: string; }

export interface HomeWidgetKind {
	key: string;
	titleKey: string;
	icon: string;
	/** Width in canonical columns and height in 10px fine rows. */
	defaultSize: { w: number; h: number };
	minSize: { w: number; h: number };
	multiple?: boolean;
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
	create(name: string, layout?: BoardLayout): Promise<void>;
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
	readonly sync: { getSaveState(): { status: string }; setBoardLayout(layout: BoardLayout): Promise<void> };
}

/** What the workbench shows for Home: the board and records panel, records titles and board save problems. */
export interface HomeWorkbench {
	panel(target: WorkbenchTarget): PanelModel;
	recordsTitle(section: string | undefined): string;
	saveStatuses(): ReadonlyArray<{ path: string; status: string; message: string }>;
	subscribe(listener: () => void): () => void;
}

export const HOME_WORKBENCH = serviceKey<HomeWorkbench>('home', 'workbench');
