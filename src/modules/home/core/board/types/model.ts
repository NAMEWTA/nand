import { DEFAULT_TASK_ARCHIVE_PATH, DEFAULT_HIGHLIGHT_IMPORT_PATH } from '../default-paths';
import type { TaskAutomationMeta } from '../../../../../shared/automation/metadata';
import type { AutomationDefinition } from '../../../../../shared/automation/types';
import type { CalendarTaskFilter } from '../../calendar/task-filter';
import type {
	WereadContentType,
	WereadGroupBy,
	WereadNoteState,
	WereadReadingState,
	WereadRecency,
} from '../../weread/weread-shelf-model';

/** Fixed destination override for calendar-added tasks. */
export interface CalendarTaskTarget {
	kind: 'file' | 'folder';
	path: string;
}

export interface DashboardSettings {
	/** Path of the ACTIVE workspace file (no .md extension). */
	dashboardFile: string;
	/** All workspace board files in switcher order (button i+1). Paths follow
	    the dashboardFile convention (no leading '/', no .md extension). */
	workspaceFiles: string[];
	/** Optional display names, parallel to workspaceFiles ('' = number only). */
	workspaceNames?: string[];
	recentDocCount: number;
	/** Habit card height ratio in the stacked layout (side layout ignores it;
	    the card is content-height there). */
	habitHeightRatio: WidgetHeightRatio;
	/** Reading card height ratio in the stacked layout (side layout ignores it). */
	readingHeightRatio: WidgetHeightRatio;
	/** Side-layout sidebar width in px, clamped 180-420 (220 default). Desktop
	    only; the drag handle persists it, and render applies it as the
	    --db-sidebar-w CSS variable. */
	sidebarWidth: number;
	/** Stacked-layout widget strip unit height in px (the 6-row grid unit),
	    clamped 240-560 (300 default). Applied as --db-widget-unit-h. */
	widgetUnitHeight: number;
	widgetWeatherEnabled: boolean;
	widgetWeatherCity: string;
	widgetWeatherLat: number;
	widgetWeatherLon: number;
	pomodoroEnabled: boolean;
	pomodoroWorkMinutes: number;
	pomodoroShortBreakMinutes: number;
	pomodoroLongBreakMinutes: number;
	pomodoroLongBreakInterval: number;
	/** Daily pomodoro completion goal (count), shown as "1/8" in KPIs/gauge. */
	pomodoroDailyGoal: number;
	pomodoroAutoStartBreak: boolean;
	pomodoroSoundEnabled: boolean;
	/** Floating body-level mini countdown panel shown while a pomodoro runs. */
	pomodoroMiniPanelEnabled: boolean;
	widgetLunarEnabled: boolean;
	/** Year-progress widget: shows how much % of the current year has elapsed. */
	widgetYearProgressEnabled: boolean;
	/** Calendar widget: a month/week calendar of vault tasks in the sidebar. */
	widgetCalendarEnabled: boolean;
	/** Folders whose tasks are excluded from the calendar widget/section. */
	calendarExcludeFolders: string[];
	/** Active task filter in the full-screen calendar modal ('all' default).
	    Persisted memory only — the sidebar widget stays unfiltered. */
	calendarTaskFilter: CalendarTaskFilter;
	/** Where calendar-added tasks land in the day's daily note: right below
	    frontmatter ('start') or at the bottom ('end'). */
	calendarTaskInsertPosition: 'start' | 'end';
	/** Optional fixed destination for calendar-added tasks: a specific file
	    (task inserted per calendarTaskInsertPosition) or a folder (one note
	    per day, named YYYY-MM-DD, created on first task). Unset = the clicked
	    day's own daily note (created in the core Daily Notes folder when missing). */
	calendarTaskTarget?: CalendarTaskTarget;
	/** Habit check-in widget: boolean daily check-offs tracked per habit. */
	widgetHabitEnabled: boolean;
	/** Expense tracker widget: quick expense/income entry in the sidebar. */
	widgetExpenseEnabled: boolean;
	/** Currency symbol shown before amounts in the expense widget/stats (e.g. ¥, $). */
	expenseCurrency: string;
	/** Photo-album widget: auto-rotating slideshow of a vault folder's images.
	 *  The widgetAlbum* fields are the settings shape the album renderer reads;
	 *  every albums[] entry is rendered through them (see render-sidebar-widgets). */
	widgetAlbumEnabled: boolean;
	/** Vault folder whose images the album rotates through ('' = unset). */
	widgetAlbumFolder: string;
	/** Seconds each photo stays on screen before auto-advancing. */
	widgetAlbumIntervalSec: number;
	/** Include images from subfolders of the album folder. */
	widgetAlbumRecursive: boolean;
	/** Panel aspect ratio of the album frame ('1:1' square, '3:4' portrait). */
	widgetAlbumRatio: '1:1' | '3:4';
	/** Photo transition animation between slides ('fade' default). */
	widgetAlbumTransition: 'fade' | 'slide-left' | 'slide-right' | 'zoom';
	/** Album widgets (multiple): one slideshow card per entry. */
	albums: AlbumConfig[];
	/** Anniversary ("纪念日") widgets master toggle (entries in anniversaries[]). */
	anniversaryEnabled: boolean;
	/** Anniversary entries: elapsed time since a historical date each. */
	anniversaries: AnniversaryConfig[];
	/** Singleton widget card backgrounds (undefined = none). */
	quickActionsBackground?: WidgetBackground;
	pomodoroBackground?: WidgetBackground;
	habitBackground?: WidgetBackground;
	musicBackground?: WidgetBackground;
	yearProgressBackground?: WidgetBackground;
	/** Music player widget: search & play NetEase free songs in the sidebar
	    (desktop only; no account, VIP tracks are skipped). */
	widgetMusicEnabled: boolean;
	/** Player volume 0-1. */
	musicVolume: number;
	/** Repeat mode of the music player. */
	musicRepeatMode: MusicRepeatMode;
	/** Persisted playlist; cover URLs are lazily backfilled and then saved. */
	musicPlaylist: MusicTrack[];
	/** Highlighted track index restored on restart; playback never auto-resumes. */
	musicCurrentIndex: number;
	/** Quick-buttons ("快捷按钮") rendered as a draggable sidebar widget. */
	widgetQuickActionsEnabled: boolean;
	/** Optional custom background color for the quick-buttons widget (user
	 *  picked via the palette button; undefined = theme default). */
	quickButtonsBgColor?: string;
	/** Optional custom button color for the quick-buttons widget (palette
	 *  picker; undefined = theme default). */
	quickButtonsBtnColor?: string;
	widgetOrder: string[];
	/** Weread (WeChat Read) official API key (wrk-...), shared account-wide. */
	wereadApiKey: string;
	/** Folder where weread highlights are imported as notes. */
	wereadImportPath: string;
	/** Skip the note popover: open notes directly in a tab on card click. */
	disableNotePopover: boolean;
	/** Global dashboard background image (vault path or URL). Empty = none. */
	bgImage: string;
	/** Background dimming overlay 0-100 (keeps text readable over busy images). */
	bgDim: number;
	/** Background blur in px 0-30 (depth-of-field over the image). */
	bgBlur: number;
	/** Background fill mode. */
	bgSize: BgSize;
	/** Surface (card/section/sidebar) opacity 0-100. null = theme default. */
	surfaceOpacity: number | null;
	/** Frosted-glass blur in px 0-20. null = theme default. */
	glassBlur: number | null;
	/** Corner-radius base in px 0-22 (drives sm/md/lg). null = theme default. */
	radiusScale: number | null;
	/** Global dashboard text size. 'medium' (default) keeps the inherited
	    base size; 'small'/'large' scale it (em-based sizes cascade from the
	    root, so titles/body/banner/widgets grow or shrink together). */
	fontScale: 'small' | 'medium' | 'large';
	/** Quick Notes region master toggle (pinned top of the kanban). */
	quickNotesEnabled: boolean;
	/** Quick-create presets (template + folder + filename). Global (Layer 1). */
	quickNotePresets: QuickNotePreset[];
	/** Inline capture box shown in the Quick Notes region. */
	quickCaptureEnabled: boolean;
	/** Note path to append captures to. Empty = create a new fleeting note. */
	quickCaptureTarget: string;
	/** Folder for new fleeting notes when no capture target is set. */
	quickCaptureFolder: string;
	/** Template path applied to new fleeting notes created in the capture folder. Empty = none. */
	quickCaptureTemplate: string;
	/** Where captured lines land in the note: after frontmatter ('start') or at the bottom ('end'). */
	quickCapturePosition: 'start' | 'end';
	/** Pinned-note shortcuts rendered as one-click open buttons. */
	pinnedNotes: PinnedNote[];
	/** Quick-command shortcuts rendered as one-click execute buttons. */
	quickCommands: QuickCommand[];
	/** Show a "Today" button that creates/opens the core Daily Notes note. */
	quickDailyEnabled: boolean;
	countdownEnabled: boolean;
	/** Multiple countdowns managed in settings; rendered in the sidebar. */
	countdowns: CountdownConfig[];
	/** User-defined tags for media files (images/videos sections), keyed by
	 *  vault path. Managed by MediaTagService; optional so settings without it stay valid. */
	mediaTags?: Record<string, string[]>;
	readingEnabled: boolean;
	readingSoundEnabled: boolean;
	taskTemplates: TaskTemplate[];
	memoSavePath: string;
	/** Template note applied when a memo card is saved as a note ('' = built-in
	    default: 创建时间 + type: memo frontmatter). */
	memoTemplatePath: string;
	/** Where one-click archive writes completed tasks: a fixed file
	    (taskArchivePath, the default) or today's daily note
	    (created from the daily-notes template when missing). */
	taskArchiveTarget: 'file' | 'daily';
	taskArchivePath: string;
	/** Library sections: folder where the toolbar "new note" button creates notes
	 *  (frontmatter pre-filled to match the section's filters). '' = vault root. */
	libraryNewNotePath: string;
}


/** How a dashboard background image fills the background layer. */
export type BgSize = 'cover' | 'contain';

/** One "quick-create" button in the Quick Notes region: creates a note from a
 *  template file into a folder, with `{{date}}`/`{{time}}`/`{{title}}` resolved. */
export interface QuickNotePreset {
	id: string;
	/** Button label. */
	label: string;
	/** Lucide icon name (e.g. 'calendar-days'). */
	icon: string;
	/** Vault path to a template file. Empty = create a blank note. */
	templatePath: string;
	/** Destination folder (vault root if empty). Created if missing. */
	folder: string;
	/** Filename pattern, supports {{date}}, {{date:F}}, {{time}}, {{title}}. */
	filename: string;
}

/** A pinned note shortcut in the Quick Notes region: one-click open. */
export interface PinnedNote {
	id: string;
	label: string;
	/** Lucide icon name. */
	icon: string;
	/** Vault path to the note. */
	path: string;
}

/** A quick-command shortcut in the Common Actions bar: one-click execute. */
export interface QuickCommand {
	id: string;
	/** Button label. */
	label: string;
	/** Lucide icon name. */
	icon: string;
	/** Obsidian command id (e.g. 'editor:toggle-pin'). */
	commandId: string;
}

export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
	dashboardFile: 'dashboard',
	workspaceFiles: ['dashboard'],
	workspaceNames: [''],
	recentDocCount: 5,
	// Defaults match the CSS spans/sizes until the user drags or picks a tier.
	habitHeightRatio: 'twoThirds',
	readingHeightRatio: 'half',
	sidebarWidth: 220,
	widgetUnitHeight: 300,
	widgetWeatherEnabled: false,
	widgetWeatherCity: 'Shanghai',
	widgetWeatherLat: 31.23,
	widgetWeatherLon: 121.47,
	pomodoroEnabled: true,
	pomodoroWorkMinutes: 25,
	pomodoroShortBreakMinutes: 5,
	pomodoroLongBreakMinutes: 15,
	pomodoroLongBreakInterval: 4,
	pomodoroDailyGoal: 8,
	pomodoroAutoStartBreak: true,
	pomodoroSoundEnabled: true,
	pomodoroMiniPanelEnabled: true,
	widgetLunarEnabled: true,
	widgetYearProgressEnabled: false,
	widgetCalendarEnabled: false,
	calendarExcludeFolders: [],
	calendarTaskFilter: 'all',
	calendarTaskInsertPosition: 'start',
	widgetHabitEnabled: false,
	widgetExpenseEnabled: false,
	expenseCurrency: '¥',
	widgetAlbumEnabled: false,
	widgetAlbumFolder: '',
	widgetAlbumIntervalSec: 8,
	widgetAlbumRecursive: true,
	widgetAlbumRatio: '1:1',
	widgetAlbumTransition: 'fade',
	albums: [],
	anniversaryEnabled: false,
	anniversaries: [],
	widgetMusicEnabled: false,
	musicVolume: 0.8,
	musicRepeatMode: 'list',
	musicPlaylist: [] as MusicTrack[],
	musicCurrentIndex: -1,
	widgetQuickActionsEnabled: true,
	widgetOrder: [
		'quickActions',
		'weather',
		'lunar',
		'pomodoro',
		'reading',
		'countdown',
		'yearProgress',
		'calendar',
		'habit',
		'expense',
		'album',
		'music',
	],
	wereadApiKey: '',
	wereadImportPath: DEFAULT_HIGHLIGHT_IMPORT_PATH,
	disableNotePopover: false,
	bgImage: '',
	bgDim: 40,
	bgBlur: 0,
	bgSize: 'cover',
	surfaceOpacity: null,
	glassBlur: null,
	radiusScale: null,
	fontScale: 'medium',
	quickNotesEnabled: false,
	quickNotePresets: [] as QuickNotePreset[],
	quickCaptureEnabled: false,
	quickCaptureTarget: '',
	quickCaptureFolder: '',
	quickCaptureTemplate: '',
	quickCapturePosition: 'start',
	pinnedNotes: [] as PinnedNote[],
	quickCommands: [] as QuickCommand[],
	quickDailyEnabled: false,
	countdownEnabled: false,
	countdowns: [] as CountdownConfig[],
	mediaTags: {},
	readingEnabled: false,
	readingSoundEnabled: true,
	taskTemplates: [],
	memoSavePath: '',
	memoTemplatePath: '',
	taskArchiveTarget: 'file',
	taskArchivePath: DEFAULT_TASK_ARCHIVE_PATH,
	libraryNewNotePath: '',
};

export interface QuoteItem {
	quote: string;
	author: string;
}

/** Banner display mode: classic poster+quote, or the stats dashboard. */
export type BannerMode = 'quote' | 'stats';

/** Configuration for the stats banner. Columns are role-fixed (scale / activity
 *  / productivity), so this only holds cross-cutting options. */
export type BannerLeftStat =
	| 'totalNotes'
	| 'tagsCount'
	| 'totalLinks'
	| 'newThisMonth'
	| 'newThisWeek'
	| 'totalTasks'
	| 'doneTasks'
	| 'pendingTasks';

export type BannerCenterStat = 'streak' | 'taskCompletion' | 'connectivity' | 'newThisWeek';

export type BannerRightStat = 'taskCompletion' | 'connectivity' | 'orphanRate' | 'avgLinksPerNote';

export interface BannerStatsConfig {
	/** Daily-notes folder for the streak metric. Empty/undefined = auto-detect
	 *  the core Daily notes plugin. */
	dailyFolder?: string;
	dailyFormat?: string;
	/** Whether the center streak counts daily notes (default) or any note
	 *  creation activity across the vault. */
	streakFromDaily?: boolean;
	/** Folders excluded from all stats (matched by path prefix,
	 *  case-insensitive). */
	excludeFolders?: string[];
	/** Accent color override; undefined = follow theme. */
	accent?: string;
	/** Background blur in px (0–16). */
	blur?: number;
	/** Background darkness 0–100 (higher = darker). */
	darkness?: number;
	/** Show secondary content (left strip, center heatmap, right bars). */
	showDetails?: boolean;
	/** Per-column visibility (default all true). */
	showLeft?: boolean;
	showCenter?: boolean;
	showRight?: boolean;
	/** Stat featured in each column. */
	leftStat?: BannerLeftStat;
	centerStat?: BannerCenterStat;
	/** Progress metrics shown in the right column, in order. */
	rightStats?: BannerRightStat[];
	/** Center heatmap data source: vault note activity (default) or habit
	 *  check-ins from the habit widget. */
	heatmapSource?: 'notes' | 'habit';
	/** Which habit feeds the center heatmap when heatmapSource === 'habit'.
	 *  'all' = daily count of completed habits; otherwise a habit id. */
	heatmapHabitId?: string;
}

export interface BannerData {
	mode?: BannerMode;
	quote: string;
	author: string;
	image: string;
	quoteColor?: string;
	/** CSS font-family for the quote/author text; empty = theme default. */
	quoteFont?: string;
	quotes?: QuoteItem[];
	images?: string[];
	statsConfig?: BannerStatsConfig;
}

export interface QuickAction {
	name: string;
	icon: string;
	type: 'file' | 'command' | 'action';
	target: string;
}

export const PRESET_ACTIONS: QuickAction[] = [
	{ name: 'New Journal', icon: 'calendar-plus', type: 'command', target: 'daily-notes' },
	{ name: 'New Note', icon: 'plus-circle', type: 'command', target: 'file-explorer:new-file' },
];

export interface ColumnDef {
	name: string;
	color: string;
}

export type CardType = 'task' | 'note' | 'link' | 'web' | 'project' | 'habit' | 'generic' | 'weather' | 'tracker';

export interface WeatherConfig {
	latitude: number;
	longitude: number;
	cityName: string;
}

export interface WeatherData {
	temperature: number;
	weatherCode: number;
	windSpeed: number;
	humidity: number;
	feelsLike: number;
	dailyMax: number[];
	dailyMin: number[];
	dailyCodes: number[];
	dailyDates: string[];
	fetchedAt: number;
}

export type TrackerStyle = 'line' | 'heatmap' | 'bar';

export interface TrackerConfig {
	key: string;
	days: number;
	style: TrackerStyle;
}

export interface TrackerDataPoint {
	date: string;
	value: number | null;
}

export interface TaskItem extends TaskAutomationMeta {
	text: string;
	checked: boolean;
	reminder?: string;
	children?: TaskItem[];
	collapsed?: boolean;
}

export interface DocNode {
	path: string;
	children?: DocNode[];
	collapsed?: boolean;
}

export interface TaskTemplate {
	id: string;
	name: string;
	tasks: string[];
}

export type CardSize = 'S' | 'M' | 'L';

export interface DashboardCard {
	/** Only web shortcut cards use this. */
	openIn?: 'modal' | 'tab';
	/** Original note appearance when a note is moved into a mixed sticky section. */
	noteStyle?: 'cover' | 'plain';
	id: string;
	title: string;
	type: CardType;
	column: string;
	body: string;
	tasks: TaskItem[];
	docs: DocNode[];
	url: string;
	wikiLink: string;
	progress: number;
	streak: number;
	dueDate: string;
	blockquote: string;
	color: string;
	coverImage: string;
	width: number;
	size: CardSize;
	gridCols: number;
	gridRows: number;
	gridCol: number;
	gridRow: number;
	chartConfig?: never;
	weatherConfig?: WeatherConfig;
	trackerConfig?: TrackerConfig;
}

export type LibraryViewMode = 'grid' | 'gallery' | 'list' | 'table' | 'kanban';

export interface PropertyFilter {
	property: string;
	values: string[];
	/** How checked values compare against a file's property value.
	 *  equals (default): exact match, OR across values.
	 *  contains: substring match (case-insensitive), values may be free text.
	 *  notEquals: exclude files whose value exactly equals any checked value. */
	operator?: PropertyFilterOperator;
	dateRange?: { start: string; end: string };
}

export type PropertyFilterOperator = 'equals' | 'contains' | 'notEquals';

export interface LibraryConfig {
	filters: PropertyFilter[];
	viewMode: LibraryViewMode;
	sortBy: string;
	sortDesc: boolean;
	kanbanGroupBy?: string;
	/** Kanban grouping mode: by frontmatter property (default, keyed by
	 *  kanbanGroupBy) or by the file's top-level subfolder under the configured
	 *  scan folders (folder sections). */
	groupMode?: 'property' | 'folder';
	/** Toolbar grouping for grid/gallery/list/table: off (default), by the
	    top-level folder under the scan folders ('folder'), or by a frontmatter
	    property key (viewGroupBy). Kanban uses kanbanGroupBy/groupMode instead. */
	viewGroupMode?: 'none' | 'folder' | 'property';
	/** Property key when viewGroupMode === 'property'. */
	viewGroupBy?: string;
	/** Kanban view: show each card's cover image (same extraction as the
	    gallery view — 封面/cover keys first, any image-shaped value fallback).
	    Defaults to false. */
	kanbanShowCovers?: boolean;
	pageSize?: number;
	/** Grid card view: show note frontmatter properties as key:value badges. Defaults to true. */
	showProperties?: boolean;
	/** Grid card view: max number of property badges per card. Defaults to 6.
	    Applies to cards that hit none of `visibleProperties` (fallback mode). */
	propertyLimit?: number;
	/** Grid/gallery card size. Defaults to 'medium'. Only affects the card
	    views — list/table/kanban ignore it. */
	cardSize?: 'small' | 'medium' | 'large';
	/** Grid card view: hand-picked properties to show (order preserved). A card
	    matching at least one shows exactly those matches; a card matching none
	    falls back to the automatic first-`propertyLimit` display. Empty/undefined
	    = automatic mode for every card. */
	visibleProperties?: string[];
	/** Quick date filter. When `days` is set it is a rolling "last N days"
	    window evaluated relative to today (start/end ignored); otherwise the
	    fixed start/end date range applies. */
	quickDateFilter?: { property: 'created' | 'modified'; start: string; end: string; days?: number };
	/** Folder section: scan scope. A file shows if it lives under any of these folders (recursive). */
	folders?: string[];
	/** Library/folder funnel: persistent folder-prefix filter (OR across entries). */
	folderFilter?: string[];
	/** Folders excluded from this section's data (all-tasks aggregation, library
	 *  scans, images/videos scans). Matched by path prefix, case-insensitive;
	 *  files inside them never reach the section. */
	excludeFolders?: string[];
	/** Media sections (images/videos): when non-empty, ONLY files under these
	 *  folders reach the section (excludes still subtract within the scope).
	 *  Empty = whole vault. */
	includeFolders?: string[];
	/** New notes created from this section's toolbar button start from this
	 *  template note's content ({{title}} / {{date:...}} substituted). Empty = bare note. */
	templatePath?: string;
	/** All-tasks section: dimension used to group tasks into list sections / kanban columns. */
	taskGroupBy?: 'date' | 'priority' | 'none';
}

/** One countdown entry. Multiple countdowns are managed in settings (countdowns[]). */
export interface CountdownConfig {
	automation?: AutomationDefinition;
	id: string;
	label: string;
	/** Follow the localized example name until the user edits it. */
	defaultLabel?: boolean;
	targetDate: string;
	displayMode: 'days' | 'hours' | 'minutes';
	reminderDays: number;
	/** Optional decorative card background. */
	background?: WidgetBackground;
}

/** Stacked-layout card height ratios: exact fractions of the calendar unit
 *  (the 6-row widget grid: 6 / 4 / 3 / 2 rows). */
export type WidgetHeightRatio = 'full' | 'twoThirds' | 'half' | 'third';

/** Optional decorative background for a widget card: image + readability
 *  controls (image opacity, black dimming overlay, blur). */
export interface WidgetBackground {
	/** Vault path or http(s) URL of the image ('' = none). */
	image: string;
	/** Image opacity 0-100 (100 = solid). */
	opacity: number;
	/** Black dimming overlay 0-100 (keeps the card text readable). */
	dim: number;
	/** Background blur 0-20 px. */
	blur: number;
	/** Text/icon color scheme over the image: 'light' | 'dark' | custom
	 *  '#rrggbb' | undefined (follow the theme). */
	foreground?: string;
}

/** Factory with sane defaults (solid image, mild dim, no blur). */
export const DEFAULT_WIDGET_BACKGROUND = (): WidgetBackground => ({ image: '', opacity: 100, dim: 30, blur: 0 });

/** One photo-album widget entry. Multiple albums are managed in settings
 *  (albums[]); each renders its own slideshow card in the sidebar. */
export interface AlbumConfig {
	id: number;
	/** Vault folder the slideshow rotates through. */
	folder: string;
	/** Seconds each photo stays on screen. */
	intervalSec: number;
	/** Include images from subfolders. */
	recursive: boolean;
	/** Frame aspect ratio ('1:1' square, '3:4' portrait). */
	ratio: '1:1' | '3:4';
	/** Transition animation between slides. */
	transition: 'fade' | 'slide-left' | 'slide-right' | 'zoom';
	/** Stacked-layout card height ratio (side layout ignores it). */
	heightRatio: WidgetHeightRatio;
}

/** One anniversary ("纪念日") entry: elapsed time since a historical date,
 *  with an optional same-day-every-year reminder. */
export interface AnniversaryConfig {
	automation?: AutomationDefinition;
	id: string;
	label: string;
	/** Follow the localized example name until the user edits it. */
	defaultLabel?: boolean;
	/** Historical date the elapsed time is measured from (YYYY-MM-DD or
	 *  YYYY-MM-DDTHH:mm). */
	startDate: string;
	/** Elapsed display granularity: calendar years/months/days, total days,
	 *  or days + hours. */
	precision: 'ymd' | 'days' | 'hours';
	/** Fire a reminder once a year on the anniversary's month/day. */
	annualReminder: boolean;
	/** Optional decorative card background. */
	background?: WidgetBackground;
}

/** One playable NetEase track. Shared by search results, playlist imports and
    the persisted sidebar playlist. `fee` drives playability: 0/8 are free,
    1/2/4 need an account the widget deliberately does not have. */
export interface MusicTrack {
	/** NetEase song id. */
	id: number;
	/** Song title. */
	name: string;
	/** artists[].name joined with ' / '. */
	artist: string;
	/** Album name. */
	album: string;
	/** Song duration in milliseconds (API original). */
	durationMs: number;
	/** NetEase fee flag: 0|8 free, 1 VIP, 2|4 album purchase. */
	fee: number;
	/** Cover URL, lazily backfilled from /api/song/detail then persisted. */
	picUrl?: string;
}

/** Repeat mode of the music player widget. */
export type MusicRepeatMode = 'list' | 'one' | 'shuffle';

/** One widget within a weread section (a section stacks multiple, top-to-bottom). */
export interface WereadWidget {
	id: string;
	view: 'shelf' | 'stats' | 'notes';
	/** Stats widget: ordered list of visible blocks (order = display order).
	 *  Absent = all blocks in the default order. Hidden blocks are simply
	 *  missing from the list. */
	statsItems?: WereadStatItem[];
	/** Shelf progress filter (multi-select): 'notStarted' | 'reading' | 'finished'. Empty = all. */
	progressFilters?: WereadReadingState[];
	/** Stable shelf item classes: electronic book, audio, or article collection. */
	contentTypeFilters?: WereadContentType[];
	/** Disjoint activity buckets based on the latest reading timestamp. */
	recencyFilters?: WereadRecency[];
	/** Note/highlight state from the notebooks endpoint. */
	noteFilters?: WereadNoteState[];
	/** Optional visual shelf grouping. Defaults to readingState for new widgets. */
	groupBy?: WereadGroupBy;
	/** Genre (category) filter. */
	categoryFilters?: string[];
	title?: string;
}

/** Blocks of the weread stats widget. */
export type WereadStatItem = 'kpi' | 'trend' | 'topRead' | 'preferCategory';

/** Weread (WeChat Read) section config. The API key is account-wide (wereadApiKey). */
export interface WereadConfig {
	/** Ordered widgets rendered top-to-bottom. */
	widgets: WereadWidget[];
}

/** Dataview (DQL) section config. The raw DQL query string is the sole required
 *  field; `title` optionally overrides the column name in the section header.
 *  The display fields (pageSize/density/striped/rowNumbers) are view-layer
 *  preferences — the query result itself is unaffected by them. */
export interface DataviewConfig {
	/** Raw DQL query, e.g. `TABLE file.name FROM "Books" WHERE rating >= 4 SORT file.name`. */
	query: string;
	/** Optional display title override (defaults to column name). */
	title?: string;
	/** Rows per page for TABLE/LIST/TASK results (default 50). */
	pageSize?: number;
	/** Presentation mode: 'auto' renders each query type in its native Dataview
	 *  shape (TABLE -> compact table, LIST -> bullet list with bold group
	 *  headers, TASK -> checkbox list); 'table'/'list' force one layout across
	 *  all query shapes. Only affects rendering, never the query. Default 'auto'. */
	viewMode?: 'table' | 'list' | 'auto';
	/** Show the source-note columns/summary (title, path, created date).
	 *  Default on. */
	showSource?: boolean;
	/** Row density: 'normal' (comfortable) or 'compact' (halved paddings). */
	density?: 'normal' | 'compact';
	/** Zebra-striping on table rows / list items (default off). */
	striped?: boolean;
	/** Prepend a row-number column to TABLE results (default off). */
	rowNumbers?: boolean;
	/** Vault folders excluded from the query's page set (matched by path prefix,
	 *  case-insensitive). Pages under them are dropped before the query runs, so
	 *  FROM / WHERE / GROUP BY never see them. */
	excludeFolders?: string[];
}

/** Web embed section config (sectionType 'web'). The URL is the sole required
 *  field; the section embeds that page as an iframe (or, on desktop, an
 *  Electron webview for sites that refuse framing — see web-precheck). */
export interface WebEmbedConfig {
	/** Page to embed. Must be a valid http(s) URL once normalized
	 *  (normalizeWebUrl in web-precheck adds the https:// scheme when missing). */
	url: string;
	/** Display zoom, 0.5–2 (default 1). Shrinks dense web apps (Keep-style)
	 *  so they fit a half-width section. iframe -> css zoom, webview ->
	 *  setZoomFactor after dom-ready. */
	zoom?: number;
}

export interface DashboardColumn {
	name: string;
	color: string;
	sectionType?: string;
	cards: DashboardCard[];
	libraryConfig?: LibraryConfig;
	/** Weread section config (sectionType 'weread'). */
	wereadConfig?: WereadConfig;
	/** Dataview section config (sectionType 'dataview'). */
	dataviewConfig?: DataviewConfig;
	/** Web embed section config (sectionType 'web'). */
	webConfig?: WebEmbedConfig;
	/** User-set max height in px (drag-resize, desktop only). */
	height?: number;
	/** Side-by-side pairing: two adjacent `half` columns render as one row
	 *  (drag a section beside another, desktop only). Maintained by
	 *  src/column-pairs.ts; adjacency is the pairing identity. */
	half?: boolean;
	/** Width split of a paired row: the LEFT member's share in percent
	 *  (20–80, default 50), set by dragging the pair's divider. Only read on
	 *  a left half member; cleared together with `half` by the pair
	 *  transforms. Desktop only. */
	width?: number;
}

export interface DashboardData {
	/** Original text and its owned projection; retained through immutable UI updates. */
	document?: { source: string; baseline: string };
	banner: BannerData;
	quickActions: QuickAction[];
	quickActionOrder?: string[];
	hiddenPresets?: string[];
	columns: DashboardColumn[];
}
