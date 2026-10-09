/** Public surface of the home module (types and service keys). */
import { serviceKey } from '../../app/contracts/module';
import type { PanelModel, WorkbenchTarget } from '../../app/contracts/workbench';

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
	readonly sync: { getSaveState(): { status: string } };
}

/** What the workbench shows for Home: the board and records panel, records titles and board save problems. */
export interface HomeWorkbench {
	panel(target: WorkbenchTarget): PanelModel;
	recordsTitle(section: string | undefined): string;
	saveStatuses(): ReadonlyArray<{ path: string; status: string; message: string }>;
	subscribe(listener: () => void): () => void;
}

export const HOME_WORKBENCH = serviceKey<HomeWorkbench>('home', 'workbench');
