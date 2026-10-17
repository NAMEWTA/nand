// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { SettingsHandle } from '../../../shared/settings/store';
import { createKeymap, type Keymap, type NavAction, type NavPane } from '../core/keymap';
import { resolveAppearance, type AppearanceOverride, type ListAppearance } from '../core/appearance';
import { compileHidden, type HiddenMatcher } from '../core/hidden';
import { folderNoteName, folderNotePath } from '../core/folder-notes';
import { buildNavTree, canonicalTag, folderAncestors, parentRowKey, type NavRow, type NavTree, type ShortcutRowInput } from '../core/nav-tree';
import { buildListItems, notePaths, notesForContext, type ListItem } from '../core/note-list';
import { moveSection, normalizeSections, type SectionId } from '../core/sections';
import { compileSearch, localeDateOrder, noteHasProperty, toggleFilter, type CompiledSearch } from '../core/search';
import { summarizeProfiles, switchProfile as switchProfileData, type ProfileSummary } from '../core/profiles';
import { dropShortcuts, hasShortcut, moveShortcut, pushRecent, remapShortcuts, shortcutContext, toggleShortcut, type Shortcut } from '../core/shortcuts';
import {
	clampIndex,
	EMPTY_SELECTION,
	nextAfterRemoval,
	remapSelection,
	selectAll,
	selectOnly,
	selectRange,
	toggleSelected,
	type Selection,
} from '../core/selection';
import { baseName, contextKey, joinPath, parentFolder, parseContextKey, ROOT_FOLDER, sameContext, type NavContext, type NoteEntry } from '../core/types';
import type { NavigatorListsSnapshot } from '../api';
import type { NavigatorSettings } from '../settings';

/** The vault, as the navigator reads it. */
export interface IndexPort {
	readonly version: number;
	notes: () => readonly NoteEntry[];
	folders: () => readonly string[];
	get: (path: string) => NoteEntry | undefined;
	subscribe: (listener: () => void) => () => void;
}

/** What the navigator can do to the vault and the workspace; implemented against Obsidian. */
export interface OpsPort {
	/** Open a note; `focus` moves the cursor into the editor, `newTab` opens a new tab. */
	open: (path: string, options: { focus?: boolean; newTab?: boolean }) => Promise<void>;
	activePath: () => string | undefined;
	isFolder: (path: string) => boolean;
	/** `folder` undefined means the vault's default location for new notes. */
	createNote: (folder: string | undefined, tag?: string) => Promise<string | undefined>;
	createFolder: (parent: string) => Promise<string | undefined>;
	rename: (path: string, newName: string) => Promise<string>;
	duplicate: (path: string) => Promise<string | undefined>;
	/** Move entries into a folder; `moved` maps old path to new path, `skipped` lists entries left in place (name clash, folder into itself). */
	move: (paths: readonly string[], folder: string) => Promise<MoveResult>;
	/** Tell the user which entries a move left in place. */
	notifySkipped: (paths: readonly string[]) => void;
	chooseFolder: () => Promise<string | undefined>;
	/** Make sure a folder exists. */
	ensureFolder: (path: string) => Promise<void>;
	/** Ask for a text (title and label are message keys); undefined when dismissed. */
	askName: (titleKey: string, value: string) => Promise<string | undefined>;
	/** Show a short message (a message key). */
	notify: (key: string, params?: Record<string, string | number>) => void;
	confirmDelete: (paths: readonly string[]) => Promise<boolean>;
	trash: (paths: readonly string[]) => Promise<void>;
	addTag: (paths: readonly string[], tag: string) => Promise<void>;
	copyPath: (path: string) => void;
	report: (error: unknown) => void;
}

export interface MoveResult {
	moved: ReadonlyMap<string, string>;
	skipped: readonly string[];
}

export interface NavLabels {
	folders: string;
	tags: string;
	untagged: string;
	root: string;
	shortcuts: string;
	recent: string;
	properties: string;
	/** Name of the implicit first vault profile; "Default" when missing. */
	defaultProfile?: string;
}

export interface ScrollRequest { key: string; nonce: number }

export interface NavigatorState {
	context: NavContext;
	selection: Selection;
	pane: NavPane;
	renaming: { path: string; folder: boolean } | null;
	expandedFolders: ReadonlySet<string>;
	expandedTags: ReadonlySet<string>;
	expandedProperties: ReadonlySet<string>;
	/** The list filter: applied while `open` and `query` is not empty. */
	search: { open: boolean; query: string };
	/** Counter bumped to ask the search field to take keyboard focus. */
	searchFocusNonce: number;
	/** Ask a pane to scroll a row into view; `nonce` makes repeated requests distinct. */
	navScroll: ScrollRequest | null;
	listScroll: ScrollRequest | null;
	history: { entries: readonly string[]; index: number };
	/** Counter bumped to ask the active pane's element to take keyboard focus. */
	focusNonce: number;
	/** Navigation row the keyboard is on when it is not the selected folder, tag or property (a section, shortcut or recent row). */
	navFocus: string | null;
	/** Ask a pane to open its context menu on the row the keyboard is on. */
	menuRequest: { pane: NavPane; nonce: number } | null;
}

export interface NavigatorServiceOptions {
	settings: SettingsHandle<NavigatorSettings>;
	index: IndexPort;
	ops: OpsPort;
	labels: () => NavLabels;
	isMac: boolean;
	now?: () => number;
	/** Timers of the window that owns the panel; without them UI state is saved at once. */
	timers?: { set: (callback: () => void, ms: number) => unknown; clear: (handle: unknown) => void };
}

const HISTORY_LIMIT = 100;
const SELECTION_LIMIT = 500;
const PERSIST_DELAY = 250;

/** History saved on this device, kept only when it still matches the restored context. */
function restoreHistory(saved: NavigatorSettings, context: NavContext): { entries: readonly string[]; index: number } {
	const key = contextKey(context);
	const entries = saved.history.filter((entry) => parseContextKey(entry) !== undefined).slice(-HISTORY_LIMIT);
	const index = Math.min(saved.historyIndex, entries.length - 1);
	return entries[index] === key ? { entries, index } : { entries: [key], index: 0 };
}

/** The saved selection narrowed to notes that exist; `complete` is false while some of them are not there (yet). */
function restoreSelection(saved: NavigatorSettings, notes: ReadonlySet<string>): { selection: Selection; complete: boolean } {
	const paths = saved.selectedNotes.filter((path) => notes.has(path));
	const cursor = paths.includes(saved.selectionCursor) ? saved.selectionCursor : null;
	const anchor = paths.includes(saved.selectionAnchor) ? saved.selectionAnchor : null;
	return { selection: paths.length ? { paths, anchor, cursor } : EMPTY_SELECTION, complete: paths.length === saved.selectedNotes.length };
}

export interface NavigatorService {
	readonly state: StoreApi<NavigatorState>;
	readonly settings: SettingsHandle<NavigatorSettings>;
	readonly index: IndexPort;
	keymap: () => Keymap;
	navTree: () => NavTree;
	listItems: () => readonly ListItem[];
	contextNotes: () => readonly NoteEntry[];
	isPinned: (path: string) => boolean;
	/** Notes the navigator shows: the index without what the hidden rules filter out (unless hidden items are shown). */
	visibleNotes: () => readonly NoteEntry[];
	visibleFolders: () => readonly string[];
	hidden: () => HiddenMatcher;
	toggleShowHidden: () => void;
	/** Add a hiding rule for a folder, tag or file path. */
	hideEntry: (kind: 'folder' | 'tag' | 'file', value: string) => void;
	/** List appearance of the selected context, or of `context`: global settings plus its overrides. */
	appearance: () => ListAppearance;
	appearanceFor: (context: NavContext) => ListAppearance;
	/** Change list options for the selected context: into its overrides where it has one for the option, else globally. */
	setListOptions: (patch: AppearanceOverride) => void;
	/** Replace the overrides of a context; undefined removes them. */
	setAppearance: (context: NavContext, override: AppearanceOverride | undefined) => void;
	/** The compiled list filter, or undefined while search is closed or empty. */
	activeSearch: () => CompiledSearch | undefined;
	setSearchQuery: (query: string) => void;
	openSearch: () => void;
	closeSearch: () => void;
	/** Leave the search field for the list, selecting the first result when nothing is selected. */
	focusListFromSearch: () => void;
	/** Add (or, if present, remove) a tag or property filter in the query; `mode` picks AND or OR. */
	toggleSearchFilter: (term: string, mode: 'and' | 'or') => void;
	/** Search the whole vault for `query` (selects the vault root and includes subfolders). */
	applySearch: (query: string) => void;
	toggleShortcut: (shortcut: Shortcut) => void;
	isShortcut: (kind: Shortcut['kind'], key: string) => boolean;
	removeShortcut: (id: string) => void;
	moveShortcut: (id: string, beforeId: string | null) => void;
	renameShortcut: (id: string, name: string) => void;
	openShortcut: (shortcut: Shortcut) => void;
	openShortcutAt: (position: number) => void;
	/** The vault profiles, the one in use marked. */
	profiles: () => ProfileSummary[];
	switchProfile: (id: string) => void;
	recordRecent: (path: string) => void;
	removeRecent: (path: string) => void;
	clearRecent: () => void;
	openRecent: (path: string) => void;
	/** Recent notes and shortcuts as the dashboard widgets see them (hiding rules and settings applied). */
	listsSnapshot: () => NavigatorListsSnapshot;
	subscribeLists: (listener: () => void) => () => void;
	toggleSection: (id: SectionId) => void;
	moveSection: (id: SectionId, beforeId: SectionId | null) => void;
	folderNote: (folder: string) => NoteEntry | undefined;
	setAsFolderNote: (path: string) => Promise<void>;
	detachFolderNote: (folder: string) => Promise<void>;
	convertToFolderNote: (path: string) => Promise<void>;
	pinFolderNotes: () => void;
	/** Run a keyboard action in `pane`; `pageSize` is the number of rows a page key moves. */
	perform: (action: NavAction, pane: NavPane, pageSize?: number) => void;
	setPane: (pane: NavPane) => void;
	selectContext: (context: NavContext, options?: { history?: boolean }) => void;
	/** A click on a navigation row: select it and, in single-pane mode, show its list. */
	activateRow: (row: NavRow) => void;
	toggleExpanded: (row: NavRow) => void;
	setExpanded: (row: NavRow, expanded: boolean) => void;
	collapseAll: () => void;
	expandAll: () => void;
	selectNote: (path: string, mode: 'only' | 'toggle' | 'range') => void;
	openNote: (path: string, options?: { focus?: boolean; newTab?: boolean }) => void;
	startRename: (path: string, folder: boolean) => void;
	cancelRename: () => void;
	commitRename: (newName: string) => Promise<void>;
	newNote: () => Promise<void>;
	newFolder: (parent?: string) => Promise<void>;
	duplicateSelected: () => Promise<void>;
	moveSelected: (folder?: string) => Promise<void>;
	deleteSelected: () => Promise<void>;
	deleteFolder: (path: string) => Promise<void>;
	togglePin: (paths: readonly string[]) => void;
	dropOnFolder: (paths: readonly string[], folder: string) => Promise<void>;
	dropOnTag: (paths: readonly string[], tag: string) => Promise<void>;
	reveal: (path: string, options?: { select?: boolean }) => void;
	step: (delta: number) => void;
	back: () => void;
	forward: () => void;
	setSingleView: (view: 'nav' | 'list') => void;
	/** Show a pane (in single-pane mode too) and give it keyboard focus. */
	focusPane: (pane: NavPane) => void;
	toggleLayout: () => void;
	toggleOrientation: () => void;
	toggleDescendants: () => void;
	toggleCompact: () => void;
	/** Show or hide the calendar under the navigation pane (this device). */
	toggleCalendar: () => void;
	/** Selected paths a drag started on `path` should carry. */
	dragPaths: (path: string) => readonly string[];
	onRenamed: (oldPath: string, newPath: string) => void;
	onDeleted: (path: string) => void;
	requestFocus: (pane: NavPane) => void;
	dispose: () => void;
}

export function createNavigatorService(options: NavigatorServiceOptions): NavigatorService {
	const { settings, index, ops, isMac } = options;
	const now = options.now ?? (() => Date.now());
	const initial = parseContextKey(settings.get().selectedContext) ?? ({ kind: 'folder', key: ROOT_FOLDER } satisfies NavContext);
	const restoredSelection = restoreSelection(settings.get(), new Set(index.notes().map((note) => note.path)));
	// While the vault is still loading, notes of the saved selection may be missing; they are restored when they appear.
	let pendingRestore = !restoredSelection.complete;
	let lastRestored: Selection = restoredSelection.selection;
	const state = createStore<NavigatorState>(() => ({
		context: initial,
		selection: restoredSelection.selection,
		pane: 'nav',
		renaming: null,
		expandedFolders: new Set([ROOT_FOLDER, ...settings.get().expandedFolders]),
		expandedTags: new Set(settings.get().expandedTags),
		expandedProperties: new Set(settings.get().expandedProperties),
		search: { open: settings.get().searchOpen, query: settings.get().searchQuery },
		searchFocusNonce: 0,
		navScroll: null,
		listScroll: null,
		history: restoreHistory(settings.get(), initial),
		focusNonce: 0,
		navFocus: null,
		menuRequest: null,
	}));
	let scrollNonce = 0;
	let keymapCache: { source: unknown; keymap: Keymap } | undefined;
	let treeCache: { deps: unknown[]; tree: NavTree } | undefined;
	let itemsCache: { deps: unknown[]; items: ListItem[]; notes: NoteEntry[] } | undefined;
	let visibleCache: { deps: unknown[]; matcher: HiddenMatcher; notes: readonly NoteEntry[]; folders: readonly string[] } | undefined;
	let searchCache: { key: string; compiled: CompiledSearch } | undefined;
	const dateOrder = localeDateOrder();

	let persistTimer: unknown;
	const same = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
	const patch = (change: Partial<NavigatorState>) => state.setState(change);

	/** Selection and history are device state: saved shortly after they change, and when the service stops. */
	function persistUi(): void {
		const { selection, history } = state.getState();
		const current = settings.get();
		// A selection that is only partly restored must not overwrite the saved one.
		const keepSaved = pendingRestore && selection === lastRestored;
		const paths = keepSaved ? current.selectedNotes : selection.paths.slice(0, SELECTION_LIMIT);
		const cursor = keepSaved ? current.selectionCursor : (selection.cursor ?? '');
		const anchor = keepSaved ? current.selectionAnchor : (selection.anchor ?? '');
		const { search } = state.getState();
		const unchanged = same(current.history, [...history.entries]) && current.historyIndex === history.index
			&& same(current.selectedNotes, paths) && current.selectionCursor === cursor && current.selectionAnchor === anchor
			&& current.searchQuery === search.query && current.searchOpen === search.open;
		if (unchanged) return;
		void settings.update((draft) => {
			draft.history = [...history.entries];
			draft.historyIndex = history.index;
			draft.selectedNotes = paths;
			draft.selectionCursor = cursor;
			draft.selectionAnchor = anchor;
			draft.searchQuery = search.query;
			draft.searchOpen = search.open;
		}).catch(ops.report);
	}
	const unsubscribePersist = state.subscribe((next, previous) => {
		if (next.selection === previous.selection && next.history === previous.history && next.search === previous.search) return;
		if (!options.timers) { persistUi(); return; }
		if (persistTimer !== undefined) options.timers.clear(persistTimer);
		persistTimer = options.timers.set(() => { persistTimer = undefined; persistUi(); }, PERSIST_DELAY);
	});

	/**
	 * Rewrite (or drop, when `rewrite` returns null) history entries after a rename or deletion. The visit the
	 * user is on is followed through the rewrite by position, so unrelated changes never move it.
	 */
	function rewriteHistory(rewrite: (key: string) => string | null): void {
		const { history, context } = state.getState();
		const entries: string[] = [];
		let index = -1;
		let lastKept = -1;
		history.entries.forEach((key, position) => {
			const next = rewrite(key);
			if (next !== null) {
				if (entries[entries.length - 1] !== next) entries.push(next);
				lastKept = entries.length - 1;
			}
			// A dropped current visit falls back to the nearest earlier one that is still there.
			if (position === history.index) index = lastKept;
		});
		const current = contextKey(context);
		if (!entries.length) entries.push(current);
		index = Math.max(index, 0);
		if (entries[index] !== current) {
			entries.splice(index + 1);
			entries.push(current);
			index = entries.length - 1;
		}
		if (same(entries, [...history.entries]) && index === history.index) return;
		patch({ history: { entries, index } });
	}

	/** Restore the saved selection for notes that have appeared since the service started, unless the user already chose. */
	// Any navigation or selection by the user ends the pending restore, even when the selection stays empty.
	let restoring = false;
	let disposed = false;
	const unsubscribeCancel = state.subscribe((next, previous) => {
		if (restoring || !pendingRestore) return;
		// A search is a user decision too: it changes which notes can be selected at all.
		if (next.selection !== previous.selection || next.search !== previous.search || contextKey(next.context) !== contextKey(previous.context)) pendingRestore = false;
	});
	/**
	 * Selection only ever holds notes the list shows. A search, a hiding rule or a vault change can take notes out
	 * of the list; they are dropped from the selection (and cursor and anchor follow) so nothing unseen can be
	 * deleted, moved or renamed.
	 */
	function syncSelection(): void {
		const { selection } = state.getState();
		if (!selection.paths.length && !selection.cursor && !selection.anchor) return;
		const shown = new Set(notePaths(ensureItems().items));
		// A path the index no longer has was renamed or deleted; the rename and delete handlers settle that one.
		const keep = (path: string) => shown.has(path) || !index.get(path);
		const paths = selection.paths.filter(keep);
		// Only a cursor or anchor that points outside the list is moved; an unset one stays unset.
		const cursor = selection.cursor === null || keep(selection.cursor) ? selection.cursor : (paths[paths.length - 1] ?? null);
		const anchor = selection.anchor === null || keep(selection.anchor) ? selection.anchor : cursor;
		if (paths.length === selection.paths.length && cursor === selection.cursor && anchor === selection.anchor) return;
		patch({ selection: paths.length ? { paths, anchor, cursor } : EMPTY_SELECTION });
	}
	/** The selected notes that are in the list right now: what file operations act on. */
	function visibleSelection(): string[] {
		const shown = new Set(notePaths(ensureItems().items));
		return state.getState().selection.paths.filter((path) => shown.has(path));
	}
	const unsubscribeSync = state.subscribe((next, previous) => {
		if (next.search !== previous.search || contextKey(next.context) !== contextKey(previous.context)) syncSelection();
	});
	const unsubscribeSyncIndex = index.subscribe(syncSelection);
	const unsubscribeSyncSettings = settings.subscribe(syncSelection);
	const defaultProfileName = () => options.labels().defaultProfile ?? 'Default';
	/** The recent list is per device and profile: when the profile changed elsewhere, swap in this profile's list. */
	function reconcileRecent(): void {
		const current = settings.get();
		if (disposed || current.recentOwner === current.activeProfile) return;
		void settings.update((draft) => {
			draft.profileRecent = { ...draft.profileRecent, [draft.recentOwner]: draft.recent };
			draft.recent = draft.profileRecent[draft.activeProfile] ?? [];
			draft.recentOwner = draft.activeProfile;
		}).catch(ops.report);
	}
	const unsubscribeRecent = settings.subscribe(reconcileRecent);
	reconcileRecent();
	const unsubscribeRestore = index.subscribe(() => {
		if (!pendingRestore) return;
		if (state.getState().selection !== lastRestored) { pendingRestore = false; return; }
		const next = restoreSelection(settings.get(), new Set(index.notes().map((note) => note.path)));
		if (next.selection.paths.length === lastRestored.paths.length) return;
		lastRestored = next.selection;
		if (next.complete) pendingRestore = false;
		restoring = true;
		try { patch({ selection: next.selection }); } finally { restoring = false; }
	});

	function persistExpanded(): void {
		const { expandedFolders, expandedTags, expandedProperties } = state.getState();
		void settings.update((draft) => {
			draft.expandedFolders = [...expandedFolders].filter((path) => path !== ROOT_FOLDER);
			draft.expandedTags = [...expandedTags];
			draft.expandedProperties = [...expandedProperties];
		}).catch(ops.report);
	}

	const service: NavigatorService = {
		state,
		settings,
		index,
		keymap() {
			const source = settings.get().keymap;
			if (!keymapCache || keymapCache.source !== source) keymapCache = { source, keymap: createKeymap(source, isMac) };
			return keymapCache.keymap;
		},
		navTree() {
			const { expandedFolders, expandedTags, expandedProperties } = state.getState();
			const s = settings.get();
			const visible = ensureVisible();
			const sections = normalizeSections(s.sections);
			const collapsed = new Set(s.collapsedSections.filter(isSection));
			const deps = [visible, expandedFolders, expandedTags, expandedProperties, s.showRoot, s.showTags, s.showUntagged, s.countDescendants, s.showProperties, s.propertyKeys, s.sections, s.collapsedSections, s.shortcuts, s.showRecent, s.recent, s.recentLimit];
			if (!treeCache || !same(treeCache.deps, deps)) {
				const labels = options.labels();
				const recent = visibleRecent();
				treeCache = {
					deps,
					tree: buildNavTree({
						folders: visible.folders,
						notes: visible.notes,
						expandedFolders,
						expandedTags,
						expandedProperties,
						showRoot: s.showRoot,
						showTags: s.showTags,
						showUntagged: s.showUntagged,
						showProperties: s.showProperties,
						propertyKeys: s.propertyKeys,
						countDescendants: s.countDescendants,
						sections,
						collapsed,
						shortcuts: shortcutRows(labels),
						recent,
						labels,
					}),
				};
			}
			return treeCache.tree;
		},
		listItems() {
			return ensureItems().items;
		},
		contextNotes() {
			return ensureItems().notes;
		},
		visibleNotes() {
			return ensureVisible().notes;
		},
		visibleFolders() {
			return ensureVisible().folders;
		},
		hidden() {
			return ensureVisible().matcher;
		},
		toggleShowHidden() {
			void settings.update((draft) => { draft.showHidden = !draft.showHidden; }).catch(ops.report);
		},
		hideEntry(kind, value) {
			void settings.update((draft) => {
				const rule = kind === 'tag' ? value.replace(/^#/, '') : `/${value}`;
				const list = kind === 'folder' ? draft.hiddenFolders : kind === 'tag' ? draft.hiddenTags : draft.hiddenFiles;
				if (!list.includes(rule)) list.push(rule);
			}).catch(ops.report);
		},
		appearance() {
			return appearanceFor(state.getState().context);
		},
		appearanceFor,
		setListOptions,
		setAppearance(context, override) {
			void settings.update((draft) => {
				const key = contextKey(context);
				if (override && Object.keys(override).length) draft.appearances[key] = override; else delete draft.appearances[key];
			}).catch(ops.report);
		},
		activeSearch,
		setSearchQuery(query) {
			patch({ search: { ...state.getState().search, query } });
		},
		openSearch() {
			const { search, searchFocusNonce } = state.getState();
			patch({ search: { ...search, open: true }, searchFocusNonce: searchFocusNonce + 1 });
		},
		closeSearch() {
			const { search } = state.getState();
			if (search.open) patch({ search: { ...search, open: false } });
		},
		focusListFromSearch() {
			focusList();
		},
		toggleSearchFilter(term, mode) {
			const { search, searchFocusNonce } = state.getState();
			// A closed search is not applied, so a click starts a fresh query instead of extending one nobody can see.
			patch({ search: { open: true, query: toggleFilter(search.open ? search.query : '', term, mode, searchOptions()) }, searchFocusNonce });
		},
		applySearch(query) {
			selectContext({ kind: 'folder', key: ROOT_FOLDER });
			patch({ search: { open: true, query }, searchFocusNonce: state.getState().searchFocusNonce + 1 });
		},
		toggleShortcut(shortcut) {
			void settings.update((draft) => { draft.shortcuts = toggleShortcut(draft.shortcuts, shortcut); }).catch(ops.report);
		},
		isShortcut(kind, key) {
			return hasShortcut(settings.get().shortcuts, { kind, key });
		},
		removeShortcut(id) {
			void settings.update((draft) => { draft.shortcuts = draft.shortcuts.filter((entry) => entry.id !== id); }).catch(ops.report);
		},
		moveShortcut(id, beforeId) {
			void settings.update((draft) => { draft.shortcuts = moveShortcut(draft.shortcuts, id, beforeId); }).catch(ops.report);
		},
		renameShortcut(id, name) {
			const label = name.trim();
			void settings.update((draft) => {
				draft.shortcuts = draft.shortcuts.map((entry) => {
					if (entry.id !== id) return entry;
					const { name: _old, ...rest } = entry;
					return label ? { ...rest, name: label } : rest;
				});
			}).catch(ops.report);
		},
		openShortcut(shortcut) {
			if (shortcut.kind === 'note') {
				const entry = index.get(shortcut.key);
				if (!entry || (!settings.get().showHidden && ensureVisible().matcher.note(entry))) return;
				service.openNote(shortcut.key);
				service.reveal(shortcut.key);
			} else if (shortcut.kind === 'search') {
				service.applySearch(shortcut.key);
			} else {
				const context = shortcutContext(shortcut);
				// Hidden or vanished targets are refused here, whoever asks (rows, commands or the dashboard).
				if (!context || !contextAvailable(context)) return;
				selectContext(context);
				patch({ pane: 'nav' });
				if (settings.get().layout === 'single') service.setSingleView('list');
			}
		},
		openShortcutAt(position) {
			// Numbers follow the rows as shown: shortcuts the hiding rules hide do not take a number.
			const shown = shortcutRows(options.labels())[position - 1];
			if (shown) service.openShortcut(shown.shortcut);
		},
		profiles: () => summarizeProfiles(settings.get().profiles, settings.get().activeProfile, defaultProfileName()),
		switchProfile(id) {
			const current = settings.get();
			const result = switchProfileData(current.profiles, current.activeProfile, current, id, defaultProfileName());
			if (!result) return;
			void settings.update((draft) => {
				draft.profiles = result.profiles;
				draft.hiddenFolders = result.data.hiddenFolders;
				draft.hiddenTags = result.data.hiddenTags;
				draft.hiddenFiles = result.data.hiddenFiles;
				draft.hiddenProperties = result.data.hiddenProperties;
				draft.shortcuts = result.data.shortcuts;
				draft.activeProfile = result.activeId;
				draft.profileRecent = { ...draft.profileRecent, [draft.recentOwner]: draft.recent };
				draft.recent = draft.profileRecent[result.activeId] ?? [];
				draft.recentOwner = result.activeId;
			}).catch(ops.report);
		},
		recordRecent(path) {
			if (!index.get(path)) return;
			if (settings.get().recent[0] === path) return;
			void settings.update((draft) => { draft.recent = pushRecent(draft.recent, path, 30); }).catch(ops.report);
		},
		removeRecent(path) {
			void settings.update((draft) => { draft.recent = draft.recent.filter((entry) => entry !== path); }).catch(ops.report);
		},
		clearRecent() {
			void settings.update((draft) => { draft.recent = []; }).catch(ops.report);
		},
		listsSnapshot,
		subscribeLists(listener) {
			let last = listsSnapshot();
			const check = () => {
				const next = listsSnapshot();
				if (next !== last) { last = next; listener(); }
			};
			const stops = [settings.subscribe(check), index.subscribe(check)];
			return () => { for (const stop of stops) stop(); };
		},
		openRecent(path) {
			const entry = index.get(path);
			if (!entry || (!settings.get().showHidden && ensureVisible().matcher.note(entry))) return;
			service.openNote(path);
			service.reveal(path);
		},
		toggleSection(id) {
			void settings.update((draft) => {
				draft.collapsedSections = draft.collapsedSections.includes(id) ? draft.collapsedSections.filter((entry) => entry !== id) : [...draft.collapsedSections, id];
			}).catch(ops.report);
		},
		moveSection(id, beforeId) {
			void settings.update((draft) => { draft.sections = moveSection(normalizeSections(draft.sections), id, beforeId); }).catch(ops.report);
		},
		folderNote,
		async setAsFolderNote(path) {
			const folder = parentFolder(path);
			const name = folderNoteName(folder, settings.get().folderNoteName);
			if (name === undefined || !path.endsWith('.md')) { ops.notify('navigator.folderNoteNone'); return; }
			if (index.get(joinPath(folder, `${name}.md`))) { ops.notify('navigator.folderNoteExists', { name }); return; }
			const next = await ops.rename(path, name);
			if (next !== path) service.onRenamed(path, next);
		},
		async detachFolderNote(folder) {
			const note = folderNote(folder);
			if (!note) return;
			const name = await ops.askName('navigator.detachFolderNote', `${note.name} (${baseName(folder)})`);
			// The prompt may outlive the navigator; a stopped navigator never renames on its answer.
			if (disposed || !name) return;
			const current = folderNote(folder);
			if (!current) return;
			if (index.get(joinPath(folder, `${name}.md`))) { ops.notify('navigator.folderNoteExists', { name }); return; }
			const next = await ops.rename(current.path, name);
			if (next !== current.path) service.onRenamed(current.path, next);
		},
		async convertToFolderNote(path) {
			const entry = index.get(path);
			if (!entry || entry.ext !== 'md') return;
			const target = joinPath(entry.folder, entry.name);
			if (index.folders().includes(target) || ops.isFolder(target)) { ops.notify('navigator.folderNoteExists', { name: entry.name }); return; }
			await ops.ensureFolder(target);
			if (disposed) return;
			await moveInto([path], target);
			const wanted = folderNoteName(target, settings.get().folderNoteName);
			if (wanted !== undefined && wanted !== entry.name) {
				const moved = joinPath(target, `${entry.name}.md`);
				const next = await ops.rename(moved, wanted);
				if (next !== moved) service.onRenamed(moved, next);
			}
			const s = state.getState();
			patch({ expandedFolders: new Set([...s.expandedFolders, ...folderAncestors(target)]) });
			persistExpanded();
		},
		pinFolderNotes() {
			const cfg = settings.get().folderNoteName;
			const found: Array<[string, string]> = [];
			for (const folder of ensureVisible().folders) {
				const path = folderNotePath(folder, cfg);
				if (path && index.get(path)) found.push([`folder:${folder}`, path]);
			}
			void settings.update((draft) => {
				for (const [context, path] of found) {
					const list = draft.pinned[context] ?? [];
					if (!list.includes(path)) draft.pinned[context] = [...list, path];
				}
			}).catch(ops.report);
		},
		isPinned(path) {
			return (settings.get().pinned[contextKey(state.getState().context)] ?? []).includes(path);
		},
		perform,
		setPane(pane) {
			if (state.getState().pane !== pane) patch({ pane });
		},
		selectContext,
		activateRow(row) {
			if (row.kind === 'shortcut' && row.shortcut) { service.openShortcut(row.shortcut); return; }
			if (row.kind === 'recent') { service.openRecent(row.path); return; }
			if (row.kind === 'section' && row.section) { service.toggleSection(row.section); return; }
			const context = rowContext(row);
			if (!context) return;
			patch({ navFocus: null });
			selectContext(context);
			patch({ pane: 'nav' });
			const cfg = settings.get();
			if (row.kind === 'folder' && cfg.folderNotes && cfg.folderNoteOpenOnClick) {
				const note = folderNote(row.path);
				if (note) service.openNote(note.path);
			}
			if (cfg.layout === 'single') service.setSingleView('list');
		},
		toggleExpanded(row) {
			service.setExpanded(row, !row.expanded);
		},
		setExpanded(row, expanded) {
			const s = state.getState();
			if (row.kind === 'folder') {
				const next = new Set(s.expandedFolders);
				if (expanded) next.add(row.path); else next.delete(row.path);
				patch({ expandedFolders: next });
			} else if (row.kind === 'tag') {
				const next = new Set(s.expandedTags);
				if (expanded) next.add(row.path); else next.delete(row.path);
				patch({ expandedTags: next });
			} else if (row.kind === 'property') {
				const next = new Set(s.expandedProperties);
				if (expanded) next.add(row.path); else next.delete(row.path);
				patch({ expandedProperties: next });
			}
			persistExpanded();
		},
		collapseAll() {
			patch({ expandedFolders: new Set([ROOT_FOLDER]), expandedTags: new Set(), expandedProperties: new Set() });
			persistExpanded();
		},
		expandAll() {
			patch({ expandedFolders: new Set(ensureVisible().folders), expandedTags: new Set(allTagKeys()), expandedProperties: new Set(service.navTree().rows.filter((row) => row.kind === 'property').map((row) => row.path)) });
			persistExpanded();
			// "Expand all" also opens folded sections, so a fully folded tree can always be reopened.
			if (settings.get().collapsedSections.length) void settings.update((draft) => { draft.collapsedSections = []; }).catch(ops.report);
		},
		selectNote(path, mode) {
			const s = state.getState();
			const order = notePaths(ensureItems().items);
			const selection = mode === 'toggle' ? toggleSelected(s.selection, path) : mode === 'range' ? selectRange(s.selection, order, path) : selectOnly(path);
			patch({ selection, pane: 'list' });
			if (mode === 'only' && settings.get().openOnSelect) service.openNote(path);
		},
		openNote(path, openOptions = {}) {
			void ops.open(path, openOptions).catch(ops.report);
		},
		startRename(path, folder) {
			patch({ renaming: { path, folder } });
		},
		cancelRename() {
			patch({ renaming: null, focusNonce: state.getState().focusNonce + 1 });
		},
		async commitRename(newName) {
			const target = state.getState().renaming;
			if (!target) return;
			const next = await ops.rename(target.path, newName);
			patch({ renaming: null, focusNonce: state.getState().focusNonce + 1 });
			if (next !== target.path) service.onRenamed(target.path, next);
		},
		async newNote() {
			const { context } = state.getState();
			const folder = context.kind === 'folder' ? context.key : undefined;
			const path = await ops.createNote(folder, context.kind === 'tag' ? canonicalTag(index.notes(), context.key) : undefined);
			if (!path) return;
			service.reveal(path, { select: true });
			service.openNote(path, { focus: true });
		},
		async newFolder(parent) {
			const { context } = state.getState();
			const base = parent ?? (context.kind === 'folder' ? context.key : ROOT_FOLDER);
			const path = await ops.createFolder(base);
			if (disposed || !path) return;
			const s = state.getState();
			patch({ expandedFolders: new Set([...s.expandedFolders, ...folderAncestors(path)]) });
			persistExpanded();
		},
		async duplicateSelected() {
			for (const path of visibleSelection()) await ops.duplicate(path);
		},
		async moveSelected(folder) {
			const paths = visibleSelection();
			if (!paths.length) return;
			const target = folder ?? (await ops.chooseFolder());
			if (disposed || target === undefined) return;
			await moveInto(paths, target);
		},
		async deleteSelected() {
			const paths = visibleSelection();
			if (!paths.length) return;
			const order = notePaths(ensureItems().items);
			if (settings.get().confirmDelete && !(await ops.confirmDelete(paths))) return;
			if (disposed) return;
			const next = nextAfterRemoval(order, paths);
			await ops.trash(paths);
			patch({ selection: next ? selectOnly(next) : EMPTY_SELECTION });
			if (next && settings.get().openOnSelect) service.openNote(next);
		},
		async deleteFolder(path) {
			if (path === ROOT_FOLDER) return;
			if (settings.get().confirmDelete && !(await ops.confirmDelete([path]))) return;
			await ops.trash([path]);
			service.onDeleted(path);
		},
		togglePin(paths) {
			const key = contextKey(state.getState().context);
			void settings.update((draft) => {
				const current = draft.pinned[key] ?? [];
				const allPinned = paths.every((path) => current.includes(path));
				const next = allPinned ? current.filter((path) => !paths.includes(path)) : [...new Set([...current, ...paths])];
				if (next.length) draft.pinned[key] = next; else delete draft.pinned[key];
			}).catch(ops.report);
		},
		async dropOnFolder(paths, folder) {
			await moveInto(paths, folder);
		},
		async dropOnTag(paths, tag) {
			const notes = paths.filter((path) => !ops.isFolder(path));
			if (notes.length) await ops.addTag(notes, canonicalTag(index.notes(), tag));
		},
		reveal(path, revealOptions = {}) {
			const entry = index.get(path);
			const s = state.getState();
			const keep = notePaths(ensureItems().items).includes(path);
			let context = s.context;
			if (!keep) context = { kind: 'folder', key: entry?.folder ?? parentFolder(path) };
			const expandedFolders = new Set([...s.expandedFolders, ...folderAncestors(entry?.folder ?? parentFolder(path)), entry?.folder ?? parentFolder(path)]);
			if (!sameContext(context, s.context)) {
				patch({ expandedFolders, context });
				recordHistory(context);
				persistContext(context);
			} else if (expandedFolders.size !== s.expandedFolders.size) patch({ expandedFolders });
			const current = state.getState().selection;
			const selection = revealOptions.select === false || current.paths.includes(path) ? current : selectOnly(path);
			patch({
				selection,
				listScroll: { key: path, nonce: ++scrollNonce },
				navScroll: { key: contextKey(state.getState().context), nonce: ++scrollNonce },
			});
			persistExpanded();
		},
		step(delta) {
			const order = notePaths(ensureItems().items);
			if (!order.length) return;
			const from = state.getState().selection.cursor ?? ops.activePath() ?? null;
			const next = order[clampIndex(from ? order.indexOf(from) : -1, delta, order.length)];
			if (!next) return;
			patch({ selection: selectOnly(next), listScroll: { key: next, nonce: ++scrollNonce } });
			service.openNote(next);
		},
		back() {
			moveHistory(-1);
		},
		forward() {
			moveHistory(1);
		},
		setSingleView(view) {
			void settings.update((draft) => { draft.singleView = view; }).catch(ops.report);
			patch({ pane: view });
		},
		focusPane(pane) {
			const s = settings.get();
			if (s.layout === 'single' && s.singleView !== pane) service.setSingleView(pane);
			service.requestFocus(pane);
		},
		toggleLayout() {
			void settings.update((draft) => { draft.layout = draft.layout === 'dual' ? 'single' : 'dual'; }).catch(ops.report);
		},
		toggleOrientation() {
			void settings.update((draft) => { draft.orientation = draft.orientation === 'horizontal' ? 'vertical' : 'horizontal'; }).catch(ops.report);
		},
		toggleDescendants() {
			setListOptions({ includeDescendants: !service.appearance().includeDescendants });
		},
		toggleCompact() {
			setListOptions({ compact: !service.appearance().compact });
		},
		toggleCalendar() {
			void settings.update((draft) => { draft.calendarOpen = !draft.calendarOpen; }).catch(ops.report);
		},
		dragPaths(path) {
			const selected = visibleSelection();
			return selected.includes(path) ? selected : [path];
		},
		onRenamed(oldPath, newPath) {
			const s = state.getState();
			const mapping = new Map<string, string>([[oldPath, newPath]]);
			const prefix = `${oldPath}/`;
			let context = s.context;
			if (context.kind === 'folder' && (context.key === oldPath || context.key.startsWith(prefix))) context = { kind: 'folder', key: newPath + context.key.slice(oldPath.length) };
			const remapFolders = (set: ReadonlySet<string>) => new Set([...set].map((path) => (path === oldPath || path.startsWith(prefix) ? newPath + path.slice(oldPath.length) : path)));
			const selection = remapSelection(s.selection, mapping);
			for (const path of s.selection.paths) if (path.startsWith(prefix)) mapping.set(path, newPath + path.slice(oldPath.length));
			patch({ context, selection: remapSelection(selection, mapping), expandedFolders: remapFolders(s.expandedFolders) });
			if (!sameContext(context, s.context)) persistContext(context);
			rewriteHistory((key) => {
				const parsed = parseContextKey(key);
				if (parsed?.kind !== 'folder' || !(parsed.key === oldPath || parsed.key.startsWith(prefix))) return key;
				return contextKey({ kind: 'folder', key: newPath + parsed.key.slice(oldPath.length) });
			});
			const mapPath = (path: string) => (path === oldPath ? newPath : path.startsWith(prefix) ? newPath + path.slice(oldPath.length) : path);
			const mapKey = (key: string) => (key === `folder:${oldPath}` || key.startsWith(`folder:${prefix}`) ? `folder:${newPath}${key.slice(7 + oldPath.length)}` : key);
			void settings.update((draft) => {
				const renamed: Record<string, string[]> = {};
				for (const [key, list] of Object.entries(draft.pinned)) renamed[mapKey(key)] = list.map(mapPath);
				draft.pinned = renamed;
				const appearances: typeof draft.appearances = {};
				for (const [key, override] of Object.entries(draft.appearances)) appearances[mapKey(key)] = override;
				draft.appearances = appearances;
				draft.shortcuts = remapShortcuts(draft.shortcuts, oldPath, newPath);
				draft.recent = [...new Set(draft.recent.map(mapPath))];
			}).catch(ops.report);
		},
		onDeleted(path) {
			const s = state.getState();
			const prefix = `${path}/`;
			const gone = (candidate: string) => candidate === path || candidate.startsWith(prefix);
			let context = s.context;
			if (context.kind === 'folder' && gone(context.key)) context = { kind: 'folder', key: parentFolder(context.key) };
			patch({
				context,
				selection: { paths: s.selection.paths.filter((entry) => !gone(entry)), anchor: s.selection.anchor && gone(s.selection.anchor) ? null : s.selection.anchor, cursor: s.selection.cursor && gone(s.selection.cursor) ? null : s.selection.cursor },
			});
			if (!sameContext(context, s.context)) persistContext(context);
			rewriteHistory((key) => {
				const parsed = parseContextKey(key);
				return parsed?.kind === 'folder' && gone(parsed.key) ? null : key;
			});
			void settings.update((draft) => {
				for (const [key, list] of Object.entries(draft.pinned)) {
					const left = list.filter((entry) => !gone(entry));
					if (left.length) draft.pinned[key] = left; else delete draft.pinned[key];
				}
				for (const key of Object.keys(draft.appearances)) if (key === `folder:${path}` || key.startsWith(`folder:${prefix}`)) delete draft.appearances[key];
				draft.shortcuts = dropShortcuts(draft.shortcuts, path);
				draft.recent = draft.recent.filter((entry) => !gone(entry));
			}).catch(ops.report);
		},
		requestFocus(pane) {
			patch({ pane, focusNonce: state.getState().focusNonce + 1 });
		},
		dispose() {
			disposed = true;
			unsubscribePersist();
			unsubscribeRestore();
			unsubscribeCancel();
			unsubscribeSync();
			unsubscribeSyncIndex();
			unsubscribeSyncSettings();
			unsubscribeRecent();
			if (persistTimer !== undefined) options.timers?.clear(persistTimer);
			persistTimer = undefined;
			persistUi();
			treeCache = undefined;
			itemsCache = undefined;
		},
	};

	function isSection(value: string): value is SectionId {
		return (['shortcuts', 'recent', 'folders', 'tags', 'properties'] as string[]).includes(value);
	}

	/** The index minus what the hidden rules filter out; hidden items stay in the index and come back with `showHidden`. */
	function ensureVisible(): NonNullable<typeof visibleCache> {
		const s = settings.get();
		const deps = [index.version, s.hiddenFolders, s.hiddenTags, s.hiddenFiles, s.hiddenProperties, s.showHidden];
		if (!visibleCache || !same(visibleCache.deps, deps)) {
			const matcher = compileHidden({ folders: s.hiddenFolders, tags: s.hiddenTags, files: s.hiddenFiles, properties: s.hiddenProperties });
			const keep = !s.showHidden && !matcher.empty;
			visibleCache = {
				deps,
				matcher,
				notes: keep ? index.notes().filter((entry) => !matcher.note(entry)) : index.notes(),
				folders: keep ? index.folders().filter((folder) => !matcher.folder(folder)) : index.folders(),
			};
		}
		return visibleCache;
	}

	function appearanceFor(context: NavContext): ListAppearance {
		const s = settings.get();
		return resolveAppearance(
			{ sortBy: s.sortBy, sortDirection: s.sortDirection, groupBy: s.groupBy, groupProperty: s.groupProperty, titleRows: s.titleRows, previewRows: s.previewRows, compact: s.compact, includeDescendants: s.includeDescendants },
			s.appearances[contextKey(context)],
		);
	}

	/** A list option goes to the selected context's overrides when it has one for that option, otherwise to the global setting. */
	function setListOptions(patchOptions: AppearanceOverride): void {
		const key = contextKey(state.getState().context);
		void settings.update((draft) => {
			const override = draft.appearances[key];
			const toOverride = (field: keyof AppearanceOverride) => override !== undefined && override[field] !== undefined;
			const target = draft as unknown as Record<string, unknown>;
			for (const [field, value] of Object.entries(patchOptions) as Array<[keyof AppearanceOverride, never]>) {
				// The group property travels with the grouping it belongs to.
				const routed = toOverride(field) || (field === 'groupProperty' && toOverride('groupBy'));
				if (routed && override) (override as Record<string, unknown>)[field] = value;
				else target[field] = value;
			}
		}).catch(ops.report);
	}

	function searchOptions() {
		const s = settings.get();
		const sortBy = service.appearance().sortBy;
		const defaultField: 'created' | 'modified' = sortBy === 'created' ? 'created' : sortBy === 'modified' ? 'modified' : s.dateWhenNameSort;
		return { now: now(), defaultField, weekStart: 1 as const, dateOrder };
	}

	function activeSearch(): CompiledSearch | undefined {
		const { search } = state.getState();
		if (!search.open || !search.query.trim()) return undefined;
		const parse = searchOptions();
		// Relative dates move at midnight, so the compiled filter is only reused within the same day.
		const key = `${search.query}\u0000${parse.defaultField}\u0000${new Date(parse.now).toDateString()}`;
		if (searchCache?.key !== key) searchCache = { key, compiled: compileSearch(search.query, parse) };
		return searchCache.compiled.active ? searchCache.compiled : undefined;
	}

	/** Whether a folder, tag or property selection still points at something that exists and is not hidden. */
	function contextAvailable(context: NavContext): boolean {
		const { notes, folders } = ensureVisible();
		switch (context.kind) {
			case 'folder': return context.key === ROOT_FOLDER || folders.includes(context.key);
			case 'untagged': return true;
			case 'tag': {
				const wanted = context.key.toLowerCase();
				return notes.some((entry) => entry.tags.some((tag) => { const lower = tag.toLowerCase(); return lower === wanted || lower.startsWith(`${wanted}/`); }));
			}
			default:
				return notes.some((entry) => noteHasProperty(entry, context.key, context.value));
		}
	}

	function folderNote(folder: string): NoteEntry | undefined {
		const s = settings.get();
		if (!s.folderNotes) return undefined;
		const path = folderNotePath(folder, s.folderNoteName);
		return path ? index.get(path) : undefined;
	}

	/** Recent notes the tree and the dashboard list: hidden ones are skipped before the limit is applied. */
	function visibleRecent(): Array<{ path: string; label: string; hidden: boolean }> {
		const s = settings.get();
		if (!s.showRecent) return [];
		const { matcher } = ensureVisible();
		return s.recent.flatMap((path) => {
			const entry = index.get(path);
			if (!entry) return [];
			// The history keeps hidden notes; they only come back to view with "show hidden".
			const hidden = !matcher.empty && matcher.note(entry);
			return hidden && !s.showHidden ? [] : [{ path, label: entry.name, hidden }];
		}).slice(0, s.recentLimit);
	}

	let listsCache: { deps: unknown[]; snapshot: NavigatorListsSnapshot } | undefined;
	function listsSnapshot(): NavigatorListsSnapshot {
		const s = settings.get();
		const visible = ensureVisible();
		const deps = [visible, s.shortcuts, s.recent, s.recentLimit, s.showRecent, s.showHidden];
		if (!listsCache || !same(listsCache.deps, deps)) {
			const snapshot: NavigatorListsSnapshot = {
				recent: visibleRecent().map((entry) => ({ path: entry.path, title: entry.label })),
				shortcuts: shortcutRows(options.labels()).filter((row) => !row.missing).map((row) => ({ kind: row.shortcut.kind, key: row.shortcut.key, title: row.label })),
			};
			// Equal content keeps the old object so subscribers only hear about real changes.
			const unchanged = listsCache && JSON.stringify(listsCache.snapshot) === JSON.stringify(snapshot);
			listsCache = { deps, snapshot: unchanged ? listsCache!.snapshot : snapshot };
		}
		return listsCache.snapshot;
	}

	function shortcutRows(labels: NavLabels): ShortcutRowInput[] {
		const folders = new Set(index.folders());
		const { matcher } = ensureVisible();
		const showHidden = settings.get().showHidden;
		return settings.get().shortcuts.flatMap((shortcut): ShortcutRowInput[] => {
			let label = shortcut.name;
			let missing = false;
			let hidden = false;
			switch (shortcut.kind) {
				case 'note': {
					const entry = index.get(shortcut.key);
					missing = !entry;
					hidden = !!entry && !matcher.empty && matcher.note(entry);
					label ??= entry?.name ?? baseName(shortcut.key).replace(/\.md$/, '');
					break;
				}
				case 'folder':
					missing = shortcut.key !== ROOT_FOLDER && !folders.has(shortcut.key);
					hidden = !matcher.empty && matcher.folder(shortcut.key);
					label ??= shortcut.key === ROOT_FOLDER ? labels.root : baseName(shortcut.key);
					break;
				case 'tag':
					missing = !contextAvailable({ kind: 'tag', key: shortcut.key });
					label ??= `#${shortcut.key}`;
					break;
				case 'property': {
					const context = shortcutContext(shortcut);
					missing = !context || !contextAvailable(context);
					label ??= context?.kind === 'property' ? (context.value === undefined ? context.key : `${context.key}: ${context.value}`) : shortcut.key;
					break;
				}
				default:
					label ??= shortcut.key;
			}
			// A shortcut to something hidden follows the hiding rules like everything else.
			return hidden && !showHidden ? [] : [{ shortcut, label, missing, hidden }];
		});
	}

	function ensureItems(): NonNullable<typeof itemsCache> {
		const s = settings.get();
		const { context } = state.getState();
		const key = contextKey(context);
		const pinnedList = s.pinned[key];
		const appearance = appearanceFor(context);
		const search = activeSearch();
		const day = Math.floor(now() / 3_600_000);
		const deps = [ensureVisible(), key, search, appearance.includeDescendants, appearance.sortBy, appearance.sortDirection, appearance.groupBy, appearance.groupProperty, pinnedList, day];
		if (!itemsCache || !same(itemsCache.deps, deps)) {
			// Searching looks through everything below the selection.
			let notes = notesForContext(ensureVisible().notes, { context, includeDescendants: appearance.includeDescendants || !!search });
			if (search) notes = notes.filter(search.matches);
			const items = buildListItems(notes, { sortBy: appearance.sortBy, direction: appearance.sortDirection, groupBy: appearance.groupBy, groupProperty: appearance.groupProperty, pinned: new Set(pinnedList ?? []), now: now() });
			itemsCache = { deps, items, notes };
		}
		return itemsCache;
	}

	function allTagKeys(): string[] {
		const keys = new Set<string>();
		for (const note of ensureVisible().notes) for (const tag of note.tags) {
			const parts = tag.toLowerCase().split('/');
			for (let i = 1; i <= parts.length; i++) keys.add(parts.slice(0, i).join('/'));
		}
		return [...keys];
	}

	function rowContext(row: NavRow): NavContext | undefined {
		return row.context;
	}

	function persistContext(context: NavContext): void {
		void settings.update((draft) => { draft.selectedContext = contextKey(context); }).catch(ops.report);
	}

	function recordHistory(context: NavContext): void {
		const { history } = state.getState();
		const key = contextKey(context);
		if (history.entries[history.index] === key) return;
		const entries = [...history.entries.slice(0, history.index + 1), key].slice(-HISTORY_LIMIT);
		patch({ history: { entries, index: entries.length - 1 } });
	}

	function selectContext(context: NavContext, selectOptions: { history?: boolean } = {}): void {
		const s = state.getState();
		if (sameContext(context, s.context)) return;
		patch({ context, selection: EMPTY_SELECTION, renaming: null, navFocus: null });
		if (selectOptions.history !== false) recordHistory(context);
		persistContext(context);
		patch({ navScroll: { key: contextKey(context), nonce: ++scrollNonce } });
	}

	function moveHistory(delta: number): void {
		const { history } = state.getState();
		const target = history.index + delta;
		const key = history.entries[target];
		const context = key ? parseContextKey(key) : undefined;
		if (!context) return;
		patch({ history: { ...history, index: target } });
		selectContext(context, { history: false });
	}

	async function moveInto(paths: readonly string[], folder: string): Promise<void> {
		const before = state.getState().selection.paths;
		const order = notePaths(ensureItems().items);
		const result = await ops.move(paths, folder);
		const movedFrom = [...result.moved.keys()];
		for (const [from, to] of result.moved) service.onRenamed(from, to);
		if (result.skipped.length) ops.notifySkipped(result.skipped);
		// Notes that left the list take the selection with them; continue with the next one.
		if (movedFrom.some((path) => before.includes(path))) {
			const next = nextAfterRemoval(order, movedFrom);
			patch({ selection: next ? selectOnly(next) : EMPTY_SELECTION, ...(next ? { listScroll: { key: next, nonce: ++scrollNonce } } : {}) });
			if (next && settings.get().openOnSelect) service.openNote(next);
		}
	}

	function perform(action: NavAction, pane: NavPane, pageSize = 10): void {
		const s = state.getState();
		if (pane === 'nav') performNav(action, pageSize);
		else performList(action, pageSize, s);
	}

	/**
	 * Keyboard movement in the navigation pane walks every row. A folder, tag or property row is selected as the
	 * keyboard reaches it; section, shortcut and recent rows only take the keyboard focus (`navFocus`) until they are
	 * activated, so the selection never jumps to an unrelated list.
	 */
	function performNav(action: NavAction, pageSize: number): void {
		const rows = service.navTree().rows;
		const { context, navFocus } = state.getState();
		const focusKey = navFocus && rows.some((row) => row.key === navFocus) ? navFocus : contextKey(context);
		const at = rows.findIndex((row) => row.key === focusKey);
		const row = rows[at];
		const go = (index: number) => {
			const target = rows[index];
			if (!target) return;
			if (target.context) { patch({ navFocus: null }); selectContext(target.context); }
			else patch({ navFocus: target.key });
			patch({ navScroll: { key: target.key, nonce: ++scrollNonce } });
		};
		const sectionRow = () => (row?.section ? rows.findIndex((candidate) => candidate.kind === 'section' && candidate.section === row.section) : -1);
		switch (action) {
			case 'moveUp': go(clampIndex(at, -1, rows.length)); break;
			case 'moveDown': go(clampIndex(at, 1, rows.length)); break;
			case 'pageUp': go(clampIndex(at, -pageSize, rows.length)); break;
			case 'pageDown': go(clampIndex(at, pageSize, rows.length)); break;
			case 'home': go(0); break;
			case 'end': go(rows.length - 1); break;
			case 'collapseOrParent': {
				if (!row) break;
				if (row.kind === 'section') { if (row.expanded && row.section) service.toggleSection(row.section); break; }
				if (row.hasChildren && row.expanded) { service.setExpanded(row, false); break; }
				const parent = parentRowKey(row, settings.get().showRoot);
				const parentIndex = parent ? rows.findIndex((candidate) => candidate.key === parent) : -1;
				// Rows without a parent row go up to the title of their section.
				go(parentIndex >= 0 ? parentIndex : sectionRow());
				break;
			}
			case 'expandOrFocusList': {
				if (row?.kind === 'section') {
					if (!row.expanded && row.section) service.toggleSection(row.section);
					else go(at + 1);
					break;
				}
				if (row?.kind === 'shortcut' || row?.kind === 'recent') { activateKeepingFocus(row); break; }
				if (row?.hasChildren && !row.expanded) { service.setExpanded(row, true); break; }
				focusList();
				break;
			}
			case 'focusList': focusList(); break;
			case 'open': {
				if (row && !row.context) { activateKeepingFocus(row); break; }
				focusList();
				break;
			}
			case 'rename': {
				if (row?.kind === 'shortcut' && row.shortcut) {
					const shortcut = row.shortcut;
					void ops.askName('navigator.shortcutRename', row.label).then((name) => { if (name !== undefined) service.renameShortcut(shortcut.id, name); }).catch(ops.report);
					break;
				}
				if (context.kind === 'folder' && context.key !== ROOT_FOLDER && !navFocus) service.startRename(context.key, true);
				break;
			}
			case 'delete': {
				if (row?.kind === 'shortcut' && row.shortcut) { service.removeShortcut(row.shortcut.id); break; }
				if (row?.kind === 'recent') { service.removeRecent(row.path); break; }
				if (context.kind === 'folder' && !navFocus) void service.deleteFolder(context.key).catch(ops.report);
				break;
			}
			case 'contextMenu': patch({ menuRequest: { pane: 'nav', nonce: ++scrollNonce } }); break;
			default: break;
		}
	}

	/** Activate a shortcut, recent or section row from the keyboard; the keyboard stays on that row. */
	function activateKeepingFocus(row: NavRow): void {
		service.activateRow(row);
		patch({ navFocus: row.key });
	}

	function focusList(): void {
		const order = notePaths(ensureItems().items);
		const s = state.getState();
		// The cursor only counts while its note is in the list.
		if ((!s.selection.cursor || !order.includes(s.selection.cursor)) && order[0]) patch({ selection: selectOnly(order[0]) });
		service.focusPane('list');
	}

	function performList(action: NavAction, pageSize: number, s: NavigatorState): void {
		const order = notePaths(ensureItems().items);
		const cursor = s.selection.cursor && order.includes(s.selection.cursor) ? s.selection.cursor : null;
		const at = cursor ? order.indexOf(cursor) : -1;
		const moveTo = (index: number, extend: boolean) => {
			const target = order[index];
			if (!target) return;
			const selection = extend ? selectRange(s.selection, order, target) : selectOnly(target);
			patch({ selection, listScroll: { key: target, nonce: ++scrollNonce } });
			if (!extend && settings.get().openOnSelect) service.openNote(target);
		};
		switch (action) {
			case 'moveUp': moveTo(clampIndex(at, -1, order.length), false); break;
			case 'moveDown': moveTo(clampIndex(at, 1, order.length), false); break;
			case 'pageUp': moveTo(clampIndex(at, -pageSize, order.length), false); break;
			case 'pageDown': moveTo(clampIndex(at, pageSize, order.length), false); break;
			case 'home': moveTo(0, false); break;
			case 'end': moveTo(order.length - 1, false); break;
			case 'extendUp': moveTo(clampIndex(at, -1, order.length), true); break;
			case 'extendDown': moveTo(clampIndex(at, 1, order.length), true); break;
			case 'rangeToStart': moveTo(0, true); break;
			case 'rangeToEnd': moveTo(order.length - 1, true); break;
			case 'selectAll': patch({ selection: selectAll(order, cursor) }); break;
			case 'focusNav':
				service.focusPane('nav');
				break;
			case 'focusEditor':
			case 'open':
				if (cursor) service.openNote(cursor, { focus: true });
				break;
			case 'rename':
				if (cursor && s.selection.paths.length <= 1) service.startRename(cursor, false);
				break;
			case 'delete':
				void service.deleteSelected().catch(ops.report);
				break;
			case 'contextMenu':
				if (cursor) patch({ menuRequest: { pane: 'list', nonce: ++scrollNonce } });
				break;
			default: break;
		}
	}

	return service;
}
