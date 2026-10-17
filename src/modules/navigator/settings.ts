// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { defineSettings, f } from '../../shared/settings/schema';
import { normalizeOverride, type AppearanceOverride } from './core/appearance';
import { NAV_ACTIONS, type NavAction } from './core/keymap';
import { normalizeCreateCommands, type CreateNoteCommand } from './core/create-commands';
import { normalizeFolderTemplates, type FolderTemplate } from './core/folder-templates';
import { normalizePeriodRules, type PeriodRules } from './core/periodic';
import { normalizeProfiles, type Profile } from './core/profiles';
import { normalizeSections, type SectionId } from './core/sections';
import { normalizeShortcuts, type Shortcut } from './core/shortcuts';

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function normalizeKeymap(value: unknown): Partial<Record<NavAction, string[]>> {
	if (!isRecord(value)) return {};
	const result: Partial<Record<NavAction, string[]>> = {};
	for (const action of NAV_ACTIONS) {
		const keys = value[action];
		if (Array.isArray(keys)) result[action] = keys.filter((key): key is string => typeof key === 'string' && key !== '').slice(0, 6);
	}
	return result;
}

function normalizePinned(value: unknown): Record<string, string[]> {
	if (!isRecord(value)) return {};
	const result: Record<string, string[]> = {};
	for (const [context, paths] of Object.entries(value)) {
		if (!Array.isArray(paths)) continue;
		const list = [...new Set(paths.filter((path): path is string => typeof path === 'string' && path !== ''))];
		if (list.length) result[context] = list;
	}
	return result;
}

function normalizeProfileRecent(value: unknown): Record<string, string[]> {
	if (!isRecord(value)) return {};
	const result: Record<string, string[]> = {};
	for (const [id, paths] of Object.entries(value)) {
		if (Array.isArray(paths)) result[id] = paths.filter((path): path is string => typeof path === 'string' && path !== '').slice(0, 30);
	}
	return result;
}

const stringList = (max: number) => f.list(f.string({ default: '', max: 500 }), { default: [], max, scope: 'device' });
const rulesList = f.list(f.string({ default: '', max: 300 }), { default: [], max: 300 });

function normalizeAppearances(value: unknown): Record<string, AppearanceOverride> {
	if (!isRecord(value)) return {};
	const result: Record<string, AppearanceOverride> = {};
	for (const [context, override] of Object.entries(value)) {
		const clean = normalizeOverride(override);
		if (Object.keys(clean).length) result[context] = clean;
	}
	return result;
}

/** Settings namespace `navigator`. Display and behaviour follow the vault; layout and expansion state are per device. */
export const navigatorSchema = defineSettings({
	showRoot: f.boolean({ default: true }),
	showTags: f.boolean({ default: true }),
	showUntagged: f.boolean({ default: true }),
	countDescendants: f.boolean({ default: false }),
	includeDescendants: f.boolean({ default: false }),
	showAllFiles: f.boolean({ default: false }),
	sortBy: f.enum(['modified', 'created', 'name'] as const, { default: 'modified' }),
	sortDirection: f.enum(['asc', 'desc'] as const, { default: 'desc' }),
	groupBy: f.enum(['none', 'date', 'folder', 'property'] as const, { default: 'date' }),
	/** The property notes are grouped by when `groupBy` is `property`. */
	groupProperty: f.string({ default: '', max: 60 }),
	/** Properties offered in the group menu. */
	groupProperties: f.list(f.string({ default: '', max: 60 }), { default: [], max: 12 }),
	/** The date field `@...` filters use while the list is sorted by name. */
	dateWhenNameSort: f.enum(['modified', 'created'] as const, { default: 'modified' }),
	titleRows: f.number({ default: 1, min: 1, max: 3, integer: true }),
	compact: f.boolean({ default: false }),
	showPreview: f.boolean({ default: true }),
	previewRows: f.number({ default: 2, min: 1, max: 5, integer: true }),
	showThumbnail: f.boolean({ default: true }),
	showDate: f.boolean({ default: true }),
	showNoteTags: f.boolean({ default: true }),
	showParentFolder: f.boolean({ default: false }),
	/** Empty means a short locale date; otherwise a pattern with YYYY MM DD HH mm tokens. */
	dateFormat: f.string({ default: '', max: 40 }),
	imageProperties: f.list(f.string({ default: '', max: 60 }), { default: ['cover', 'image', 'thumbnail'], max: 8 }),
	autoReveal: f.boolean({ default: true }),
	openOnSelect: f.boolean({ default: true }),
	confirmDelete: f.boolean({ default: true }),
	indexInBackground: f.boolean({ default: true }),
	keymap: f.custom<Partial<Record<NavAction, string[]>>>({ default: {}, normalize: normalizeKeymap }),
	pinned: f.custom<Record<string, string[]>>({ default: {}, normalize: normalizePinned }),
	/** Per-folder, per-tag and per-property list settings, keyed by the context key. */
	appearances: f.custom<Record<string, AppearanceOverride>>({ default: {}, normalize: normalizeAppearances }),
	shortcuts: f.custom<Shortcut[]>({ default: [], normalize: normalizeShortcuts }),
	sections: f.custom<SectionId[]>({ default: normalizeSections([]), normalize: normalizeSections }),
	showRecent: f.boolean({ default: true }),
	recentLimit: f.number({ default: 5, min: 1, max: 30, integer: true }),
	showProperties: f.boolean({ default: true }),
	/** Property keys the browser shows; empty means all but the built-in ones. */
	propertyKeys: f.list(f.string({ default: '', max: 60 }), { default: [], max: 40 }),
	hiddenFolders: rulesList,
	hiddenTags: rulesList,
	hiddenFiles: rulesList,
	hiddenProperties: rulesList,
	folderNotes: f.boolean({ default: false }),
	/** Name of every folder note; empty means the folder's own name. */
	folderNoteName: f.string({ default: '', max: 60 }),
	folderNoteOpenOnClick: f.boolean({ default: true }),
	panelAutoPlaced: f.boolean({ default: false }),
	/** Calendar: month view in the navigation pane, and where periodic notes live. */
	calendarOpen: f.boolean({ default: false, scope: 'device' }),
	calendarSource: f.enum(['nand', 'core'] as const, { default: 'nand' }),
	calendarWeekStart: f.enum(['auto', 'monday', 'sunday', 'saturday'] as const, { default: 'auto' }),
	calendarWeekNumbers: f.boolean({ default: true }),
	calendarImages: f.boolean({ default: false }),
	periodRules: f.custom<PeriodRules>({ default: normalizePeriodRules(undefined), normalize: normalizePeriodRules }),
	/** Templates: folder of template notes, which engine fills them, and the default date and time formats. */
	templateFolder: f.string({ default: '', max: 300 }),
	templateEngine: f.enum(['auto', 'builtin', 'templater'] as const, { default: 'auto' }),
	templateDateFormat: f.string({ default: 'YYYY-MM-DD', max: 60 }),
	templateTimeFormat: f.string({ default: 'HH:mm', max: 60 }),
	folderTemplates: f.custom<FolderTemplate[]>({ default: [], normalize: normalizeFolderTemplates }),
	createCommands: f.custom<CreateNoteCommand[]>({ default: [], normalize: normalizeCreateCommands }),
	/** Vault profiles: hiding rules, shortcuts and banner kept apart. The active profile's rules and shortcuts are the live fields above. */
	profiles: f.custom<Profile[]>({ default: [], normalize: normalizeProfiles }),
	activeProfile: f.string({ default: 'default', max: 60 }),
	/** Recent notes of the profiles this device is not showing; `recentOwner` is the profile `recent` belongs to. */
	profileRecent: f.custom<Record<string, string[]>>({ default: {}, normalize: normalizeProfileRecent, scope: 'device' }),
	recentOwner: f.string({ default: 'default', max: 60, scope: 'device' }),
	layout: f.enum(['dual', 'single'] as const, { default: 'dual', scope: 'device' }),
	orientation: f.enum(['horizontal', 'vertical'] as const, { default: 'vertical', scope: 'device' }),
	navSize: f.number({ default: 40, min: 15, max: 85, scope: 'device' }),
	singleView: f.enum(['nav', 'list'] as const, { default: 'nav', scope: 'device' }),
	selectedContext: f.string({ default: 'folder:/', max: 500, scope: 'device' }),
	history: stringList(100),
	historyIndex: f.number({ default: 0, min: 0, max: 100, integer: true, scope: 'device' }),
	selectedNotes: stringList(500),
	selectionCursor: f.string({ default: '', max: 500, scope: 'device' }),
	selectionAnchor: f.string({ default: '', max: 500, scope: 'device' }),
	searchQuery: f.string({ default: '', max: 500, scope: 'device' }),
	searchOpen: f.boolean({ default: false, scope: 'device' }),
	showHidden: f.boolean({ default: false, scope: 'device' }),
	recent: stringList(30),
	collapsedSections: stringList(8),
	expandedProperties: stringList(500),
	expandedFolders: stringList(2000),
	expandedTags: stringList(2000),
});

export type NavigatorSettings = ReturnType<typeof navigatorSchema.defaults>;
