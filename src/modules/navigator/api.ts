// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { serviceKey } from '../../app/contracts/module';

/** The navigator side panel (`nand-navigator-view`) renders through this while the module is active. */
export interface NavigatorPanel {
	/** Render the panel into `container`; returns the cleanup. */
	mount(container: HTMLElement): () => void;
	/** Select a note's folder in the navigator, scroll it into view and select it (without opening it). */
	reveal(path: string): void;
	/** Move keyboard focus into one pane of the open navigator. */
	focus(pane: 'nav' | 'list'): void;
}

export const NAVIGATOR_PANEL = serviceKey<NavigatorPanel>('navigator', 'panel');

/** What a navigator entry points at. `key` is a note or folder path, a lower-case tag, a property context key (`property:status=done`) or a search query. */
export interface NavigatorListTarget {
	kind: 'note' | 'folder' | 'tag' | 'property' | 'search';
	key: string;
}

export interface NavigatorListsSnapshot {
	/** Recently opened notes on this device, newest first, limited to the configured count. */
	recent: ReadonlyArray<{ path: string; title: string }>;
	/** The navigator's shortcuts in their saved order. */
	shortcuts: ReadonlyArray<NavigatorListTarget & { title: string }>;
}

/**
 * Read-only view of the navigator's recent notes and shortcuts, for dashboard widgets. Anything the hiding rules
 * hide (while "show hidden" is off), shortcuts whose note or folder no longer exists, and the recent list when it
 * is switched off in the settings are left out. Provided only while the navigator module is active.
 */
export interface NavigatorLists {
	/** The current lists; the same object is returned until they change. */
	snapshot(): NavigatorListsSnapshot;
	/** Run `listener` when `snapshot()` would return something different; returns the unsubscribe function. */
	subscribe(listener: () => void): () => void;
	/** Open a note, or reveal the navigator and select the folder, tag or property / run the saved search. */
	open(target: NavigatorListTarget): void;
}

export const NAVIGATOR_LISTS = serviceKey<NavigatorLists>('navigator', 'lists');
