import { createStore } from 'zustand/vanilla';
import { contentFiles, type ContentFile } from '../../../host/obsidian/storage/content-files';
import type { AppWithCommands } from '../../../host/obsidian/obsidian-internal';
import { contentPath } from '../../../shared/storage/content-paths';
import { readMarkdownDocument, readYaml } from '../../../shared/storage/markdown-document';
import { memoCardText } from '../platform/board/card-move';
import { archiveCompleted } from '../core/board/task-tree';
import { extractCardParts } from '../core/board/parser/extract-card-parts';
import type { DashboardCard } from '../core/board/types/model';
import { hotkeyKeys } from '../core/board/shortcut-buttons';
import { nowMoment } from '../../../host/obsidian/datetime';
import { placeCaptureLine } from '../core/board/capture';
import { t } from '../../../shared/i18n';
import { getOrCreateDailyNote, substituteTemplateVars } from '../platform/calendar/daily-notes';
import { SyncEngine } from '../platform/board/sync';
import type { DashboardData, DashboardSettings, QuickAction, WeatherData } from '../core/board/types/model';
import { DashboardSaveError, SwitchRefusedError, type DashboardSaveState } from '../core/board/save-state';
import { fetchWeather, geocodeCity } from '../platform/widgets/weather-service';
import type { HomeHost } from './home-host';
import { queryVaultFiles } from './library-query';
import { homeServices } from './instances';
import { SUPPORTED_FILE_EXTS } from '../../../shared/file-types';
import { isRecentUserDocument } from '../core/board/recent-doc-policy';

export interface BoardSnapshot {
	path: string;
	data: DashboardData | null;
	settings: DashboardSettings;
	save: Readonly<DashboardSaveState>;
	files: ContentFile[];
	weather: WeatherData | null;
	weatherError: string;
	widgetRevision: number;
	dialog: 'section' | null;
	/** True while the page is moving to another board file: data and path are published together when it ends. */
	switching: boolean;
	/** Counts board switches. Everything opened before a switch belongs to an older generation and is void afterwards. */
	generation: number;
	/** Why the last switch failed (empty when it did not). */
	switchError: string;
	previewPath: string | null;
	captureDraft: string;
}

/** Store methods that change the board or notes on the board's behalf; a view of an older generation refuses them. */
/** Shared page state that asynchronous completions touch: a call from an older generation is ignored, never applied. */
const BOARD_STATE_SETTERS: ReadonlySet<string> = new Set(['setCaptureDraft', 'setDialog', 'closePreview', 'openFile']);

/** Synchronous side effects on the host (Obsidian commands): a view of an older generation does nothing and reports false. */
const BOARD_HOST_ACTIONS: ReadonlySet<string> = new Set(['runCommand']);

const BOARD_WRITERS: ReadonlySet<string> = new Set([
	'edit',
	'saveMemo',
	'archiveTasks',
	'saveCard',
	'newNote',
	'capture',
	'trash',
	'action',
	'today',
]);

/** One page's file pointer; durable writes and conflict recovery remain in SyncEngine. */
type HotkeyLike = { modifiers: readonly string[]; key: string };

export class BoardStore {
	readonly sync: SyncEngine;
	get ownerWindow(): Window | undefined {
		return typeof this.ownerWindowSource === 'function' ? this.ownerWindowSource() : this.ownerWindowSource;
	}
	get captureDraft(): string {
		return this.state.getState().captureDraft;
	}
	setCaptureDraft(value: string): void {
		this.state.setState({ captureDraft: value });
	}
	memoDraftKey(cardId: string): string {
		return `${this.state.getState().path}\0${cardId}`;
	}
	readonly memoDrafts = new Map<string, { original: string; text: string; submitted?: string }>();
	readonly state;
	private readonly cleanup: (() => void)[] = [];
	private disposed = false;
	private readonly root: BoardStore = this;
	private readonly views = new Map<number, BoardStore>();
	private switching = false;
	/** A failed switch could not be undone: the page stays read-only until another board is chosen. */
	private broken = false;
	private heldData: DashboardData | undefined;
	private visible = true;
	setVisible(value: boolean): void {
		this.visible = value;
		if (value) this.state.setState((s) => ({ widgetRevision: s.widgetRevision + 1 }));
	}
	private weatherGeneration = 0;
	private switchTail: Promise<void> = Promise.resolve();
	constructor(
		readonly host: HomeHost,
		path: string,
		private readonly ownerWindowSource?: Window | (() => Window | undefined),
	) {
		this.sync = new SyncEngine(host.app, { ...host.settings, dashboardFile: path });
		this.state = createStore<BoardSnapshot>(() => ({
			path,
			data: null,
			settings: { ...host.settings },
			save: this.sync.getSaveState(),
			files: [],
			weather: null,
			weatherError: '',
			widgetRevision: 0,
			dialog: null,
			switching: false,
			generation: 0,
			switchError: '',
			previewPath: null,
			captureDraft: '',
		}));
		this.cleanup.push(
			this.sync.onDataUpdate((data) => {
				// While switching, the engine already holds the target board but the page still shows the old one:
				// hold the new data back so path and data change in one commit.
				if (this.switching) this.heldData = data;
				else this.state.setState({ data: structuredClone(data) });
			}),
		);
		this.cleanup.push(
			this.sync.onSaveStateUpdate((save) => {
				this.state.setState({ save });
				host.workbenchRefresh();
			}),
		);
		this.cleanup.push(
			host.subscribeSettings(() => {
				this.state.setState({ settings: { ...host.settings } });
				this.sync.updateSettings({ ...host.settings, dashboardFile: this.state.getState().path });
			}),
		);
		const changed = () => {
			if (this.visible && !this.disposed) this.state.setState((s) => ({ widgetRevision: s.widgetRevision + 1 }));
		};
		for (const service of [homeServices.habit, homeServices.expense, homeServices.pomodoro, homeServices.reading])
			if (service) this.cleanup.push(service.subscribe(changed));
		if (homeServices.pomodoro) this.cleanup.push(homeServices.pomodoro.subscribeTick(changed));
		if (homeServices.reading) this.cleanup.push(homeServices.reading.subscribeTick(changed));
		this.cleanup.push(contentFiles(host.app).subscribe(() => this.refreshFiles()));
		if (host.automationHost?.subscribe) this.cleanup.push(host.automationHost.subscribe(changed));
	}
	async init(): Promise<void> {
		await this.sync.init();
		if (!this.disposed) this.refreshFiles();
	}
	refreshFiles(): void {
		this.state.setState({
			files: contentFiles(this.host.app)
				.getMarkdownFiles()
				.sort((a, b) => b.stat.mtime - a.stat.mtime),
		});
	}
	searchFiles(query: string): ContentFile[] {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return contentFiles(this.host.app)
			.getFiles()
			.filter(
				(file) =>
					SUPPORTED_FILE_EXTS.has(file.extension) &&
					!file.path
						.replace(/^\.nand\/content\//, '')
						.split('/')
						.some((part) => part.startsWith('.')),
			)
			.filter((file) => file.path.toLowerCase().includes(q) || file.basename.toLowerCase().includes(q))
			.sort((a, b) => a.basename.length - b.basename.length)
			.slice(0, 8);
	}
	recentFiles(): ContentFile[] {
		return this.state
			.getState()
			.files.filter((file) => isRecentUserDocument(file.path, this.host.settings))
			.slice(0, 10);
	}
	/**
	 * Move the page to another board file as one transaction. The page goes read-only and the engine refuses edits
	 * while it loads (and, for an old board, converts) the target in memory. Only when that succeeded are the new
	 * path and the new data published together; on failure the engine is pointed back at the board being left, whose
	 * path and data are the only ones ever shown.
	 */
	switch(path: string): Promise<void> {
		const run = this.switchTail.then(async () => {
			if (this.disposed || (path === this.state.getState().path && !this.broken)) return;
			const from = this.state.getState().path;
			const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
			// Start of the transaction: the board's page goes read-only and everything opened on it is closed and
			// voided (dialogs, previews, views of the old generation), not merely hidden.
			const generation = this.state.getState().generation + 1;
			this.switching = true;
			this.heldData = undefined;
			this.sync.setEpoch?.(generation);
			this.host.closeOverlays?.();
			this.state.setState({ switching: true, switchError: '', generation, dialog: null, previewPath: null });
			try {
				await this.sync.flush();
			} catch (error) {
				// Unsaved edits of the board being left stay where they are: nothing was switched, nothing to undo.
				this.finishSwitch({ switchError: messageOf(error) });
				throw error;
			}
			try {
				this.sync.setSwitchLock?.(true);
				this.sync.updateSettings({ ...this.host.settings, dashboardFile: path });
				await this.sync.switchFile(this.broken);
				const data = this.sync.getData?.() ?? this.heldData;
				this.broken = false;
				this.finishSwitch({ path, ...(data ? { data: structuredClone(data) } : {}) });
			} catch (error) {
				if (error instanceof SwitchRefusedError) {
					// Refused before the engine moved: the board being left keeps its data, dirty state and conflicts untouched.
					this.sync.updateSettings({ ...this.host.settings, dashboardFile: from });
					this.finishSwitch({ switchError: error.message });
					throw error;
				}
				// The engine had already moved to the target: reload the board being left; nothing of the target is published.
				try {
					this.sync.updateSettings({ ...this.host.settings, dashboardFile: from });
					await this.sync.switchFile(true);
					const data = this.sync.getData?.() ?? this.heldData;
					this.broken = false;
					this.finishSwitch({
						switchError: messageOf(error),
						...(data ? { data: structuredClone(data) } : {}),
					});
				} catch (rollback) {
					// Neither board is reliably loaded: stay read-only with the reason until a board is picked again.
					this.broken = true;
					this.heldData = undefined;
					if (!this.disposed) this.state.setState({ switchError: messageOf(rollback) });
				}
				throw error;
			}
		});
		this.switchTail = run.catch(() => undefined);
		return run;
	}
	/**
	 * A view of this store for one board generation. Writers called through it after a later switch started throw, so
	 * a dialog, menu or timer callback that outlives its board cannot act on the one now shown.
	 */
	view(generation: number = this.state.getState().generation): BoardStore {
		const root = this.root;
		let view = root.views.get(generation);
		if (view) return view;
		type Call = (...args: unknown[]) => unknown;
		const isStale = () => root.state.getState().generation !== generation;
		const sync = new Proxy(root.sync, {
			get(target, prop) {
				const value: unknown = Reflect.get(target, prop, target);
				return typeof value === 'function'
					? (...args: unknown[]) => target.runAs(generation, () => (value as Call).apply(target, args))
					: value;
			},
		});
		view = new Proxy(root, {
			get(target, prop, receiver) {
				if (prop === 'sync') return sync;
				const value: unknown = Reflect.get(target, prop, receiver);
				if (typeof prop === 'string' && BOARD_STATE_SETTERS.has(prop) && typeof value === 'function')
					return (...args: unknown[]) => {
						if (!isStale()) return (value as Call).apply(receiver, args);
						// openFile is asynchronous; the setters are not. Either way a stale call changes nothing.
						return prop === 'openFile' ? Promise.resolve() : undefined;
					};
				if (prop === 'isCurrent') return () => !isStale();
				if (typeof prop === 'string' && BOARD_HOST_ACTIONS.has(prop) && typeof value === 'function')
					return (...args: unknown[]) => (isStale() ? false : (value as Call).apply(receiver, args));
				if (typeof prop === 'string' && BOARD_WRITERS.has(prop) && typeof value === 'function')
					return (...args: unknown[]) =>
						// Every writer is asynchronous: a void call is a rejected promise like any other failed write.
						isStale()
							? Promise.reject(new DashboardSaveError('stale', t('dashboard.sync.stale')))
							: (value as Call).apply(receiver, args);
				return value;
			},
		});
		root.views.set(generation, view);
		return view;
	}
	private finishSwitch(next: Partial<BoardSnapshot>): void {
		this.switching = false;
		this.heldData = undefined;
		this.sync.setSwitchLock?.(false);
		if (!this.disposed) this.state.setState({ switching: false, ...next });
	}
	async dispose(): Promise<void> {
		this.disposed = true;
		this.weatherGeneration++;
		for (const off of this.cleanup.splice(0)) off();
		await this.switchTail;
		await this.sync.close();
	}
	settings(update: (draft: DashboardSettings) => void): Promise<void> {
		return this.host.updateSettings(update);
	}
	edit(update: (draft: DashboardData) => void): Promise<void> {
		const current = this.state.getState().data;
		if (!current) return Promise.resolve();
		const next = structuredClone(current);
		update(next);
		return this.sync.replaceData(next);
	}
	setDialog(dialog: BoardSnapshot['dialog']): void {
		this.state.setState({ dialog });
	}
	async openFile(path: string, direct = false, sourcePath = this.state.getState().path + '.md'): Promise<void> {
		const file = contentFiles(this.host.app).resolveLink(path, sourcePath);
		if (!file) return;
		if (direct || this.host.settings.disableNotePopover)
			await contentFiles(this.host.app).open(file.path, this.ownerWindow);
		else this.state.setState({ previewPath: file.path });
	}
	closePreview(): void {
		this.state.setState({ previewPath: null });
	}
	readNote(path: string): Promise<string> {
		return contentFiles(this.host.app).read(path);
	}
	async saveNote(path: string, text: string, original: string): Promise<void> {
		await contentFiles(this.host.app).process(path, (current) => {
			if (current !== original) throw new Error(t('home.dashboard.noteChanged'));
			return text;
		});
	}
	async saveMemo(cardId: string, text: string, original: string): Promise<void> {
		const draftKey = this.memoDraftKey(cardId),
			draft = this.memoDrafts.get(draftKey);
		const card = this.state
			.getState()
			.data?.columns.flatMap((column) => column.cards)
			.find((c) => c.id === cardId);
		if (
			!card ||
			(memoCardText(card) !== original &&
				!(draft?.original === original && draft.submitted === memoCardText(card)))
		)
			throw new Error(t('home.dashboard.memoChanged'));
		const parts = extractCardParts(text);
		const updates = { ...parts, body: parts.cleanBody };
		// SyncEngine keeps its optimistic snapshot on I/O failure. Only this edit
		// session's own canonical submission may stand in for its original baseline.
		// Keep it with the draft across retrySave() and layout remounts; a different
		// external body still fails the comparison above (or SyncEngine's disk check).
		if (draft) draft.submitted = memoCardText({ ...card, ...updates });
		await this.sync.updateMemoCard(cardId, updates);
		this.memoDrafts.delete(draftKey);
	}
	completedTasks(columnName: string): { task: string; card: string }[] {
		return (
			this.state
				.getState()
				.data?.columns.find((c) => c.name === columnName)
				?.cards.flatMap((card) =>
					archiveCompleted(card.tasks).archived.map((task) => ({
						task: task.text,
						card: card.title.trim() || t('notice.memoUntitled'),
					})),
				) ?? []
		);
	}
	/** Apex view.ts archiveCompletedTasks: the archive must exist before removing any tasks. */
	async archiveTasks(columnName: string): Promise<void> {
		await this.sync.flush();
		const entries = this.completedTasks(columnName);
		if (!entries.length) return;
		const state = this.state.getState(),
			original = JSON.stringify(state.data?.columns.find((c) => c.name === columnName)?.cards),
			files = contentFiles(this.host.app),
			now = nowMoment();
		let path: string;
		if (this.host.settings.taskArchiveTarget === 'daily') {
			const note = await getOrCreateDailyNote(this.host.app, now.format('YYYY-MM-DD'));
			if (!note) throw new Error(t('notice.archiveDailyUnavailable'));
			path = note.path;
		} else {
			const configured = this.host.settings.taskArchivePath.trim() || '归档/已完成.md';
			path =
				files.resolveLink(configured)?.path ??
				contentPath(configured.endsWith('.md') ? configured : configured + '.md');
		}
		const lines =
			entries
				.map((entry) => t('notice.archiveLine', { time: now.format('YYYY-MM-DD HH:mm'), ...entry }))
				.join('\n') + '\n';
		await files.process(path, (raw) => (raw ?? '') + (raw && !raw.endsWith('\n') ? '\n' : '') + lines);
		// An external edit during the archive write must not remove newly completed tasks.
		const latest = this.state.getState();
		if (
			latest.path !== state.path ||
			JSON.stringify(latest.data?.columns.find((c) => c.name === columnName)?.cards) !== original
		)
			throw new Error(t('home.dashboard.archiveChanged'));
		await this.sync.archiveTasks(columnName);
	}
	image(path: string): Promise<string> {
		return /^https?:\/\//i.test(path) ? Promise.resolve(path) : contentFiles(this.host.app).resourceUrl(path);
	}
	imageFiles(): ContentFile[] {
		return contentFiles(this.host.app)
			.getFiles()
			.filter((file) => /^(png|jpe?g|gif|webp|svg|avif)$/i.test(file.extension));
	}
	commands(): { id: string; name: string }[] {
		return Object.entries((this.host.app as AppWithCommands).commands.commands).map(([id, cmd]) => ({
			id,
			name: cmd.name ?? id,
		}));
	}
	/** False on a view whose board has been left: what it started must no longer act. */
	isCurrent(): boolean {
		return true;
	}
	/** Whether a note path or link still resolves to a note. */
	hasFile(path: string): boolean {
		return !!contentFiles(this.host.app).resolveLink(path, this.state.getState().path + '.md');
	}
	hasCommand(id: string): boolean {
		return !!(this.host.app as AppWithCommands).commands.commands[id];
	}
	/** Run an Obsidian command; false when Obsidian could not (the command is gone or its check failed). */
	runCommand(id: string): boolean {
		const registry = (this.host.app as AppWithCommands).commands as { executeCommandById(id: string): boolean | void };
		return registry.executeCommandById(id) !== false;
	}
	/** The first hotkey of an Obsidian command as key names (user binding first, then the default); empty without one. */
	hotkeysOf(commandId: string): string[] {
		const manager = (
			this.host.app as unknown as {
				hotkeyManager?: {
					getHotkeys?(id: string): HotkeyLike[] | undefined;
					getDefaultHotkeys?(id: string): HotkeyLike[] | undefined;
				};
			}
		).hotkeyManager;
		const first = (manager?.getHotkeys?.(commandId) ?? manager?.getDefaultHotkeys?.(commandId) ?? [])[0];
		return first ? hotkeyKeys(first) : [];
	}
	async action(action: QuickAction): Promise<void> {
		if (action.type === 'command' && action.target === 'daily-notes') {
			await this.today();
			return;
		}
		if (action.type === 'file') await this.openFile(action.target);
		else if (action.type === 'command')
			(this.host.app as AppWithCommands).commands.executeCommandById(action.target);
		else await this.host.automationHost?.runAction?.(action.target);
	}
	async today(): Promise<void> {
		const date = new Date();
		const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
		const file = await getOrCreateDailyNote(this.host.app, key);
		if (file) await contentFiles(this.host.app).open(file.path, this.ownerWindow);
	}
	async capture(text: string): Promise<void> {
		if (!text.trim()) return;
		const settings = this.host.settings,
			files = contentFiles(this.host.app),
			now = nowMoment();
		const line = `- ${text} *([[${now.format('YYYY-MM-DD')}]] ${now.format('HH:mm')})*`;
		if (settings.quickCaptureTarget.trim()) {
			const target = settings.quickCaptureTarget.trim();
			const existing = files.resolveLink(target);
			const path = existing?.path ?? contentPath(target.endsWith('.md') ? target : target + '.md');
			await files.process(path, (raw) => placeCaptureLine(raw ?? '', line, settings.quickCapturePosition));
			return;
		}
		const folder = settings.quickCaptureFolder.trim().replace(/^\/+|\/+$/g, '');
		const base = contentPath(`${folder ? folder + '/' : ''}${now.format('YYYY-MM-DD-HHmm')}`);
		let path = base + '.md';
		for (let n = 2; files.getFileByPath(path); n++) path = `${base}-${n}.md`;
		const template = files.resolveLink(settings.quickCaptureTemplate);
		const body = template ? substituteTemplateVars(await files.read(template), { now }) : '';
		await files.create(path, placeCaptureLine(body, line, settings.quickCapturePosition));
	}
	async saveCard(card: DashboardCard): Promise<void> {
		if (card.type === 'task') {
			const files = contentFiles(this.host.app),
				file = await getOrCreateDailyNote(this.host.app, nowMoment().format('YYYY-MM-DD'));
			if (file)
				await files.process(
					file.path,
					(raw) => (raw ?? '') + '\n## ' + card.title + '\n' + memoCardText(card) + '\n',
				);
			return;
		}
		await this.newNote(
			this.host.settings.memoSavePath,
			card.title,
			this.host.settings.memoTemplatePath,
			{},
			memoCardText(card),
		);
	}
	async newNote(
		folder: string,
		name: string,
		template = '',
		properties: Record<string, unknown> = {},
		append = '',
	): Promise<string> {
		const files = contentFiles(this.host.app);
		name = substituteTemplateVars(name, { title: name }).trim().replace(/\.md$/i, '');
		const base = contentPath(
			`${folder || this.host.settings.libraryNewNotePath || 'NAND'}/${name.replace(/[\\/:*?"<>|]/g, '-')}`,
		);
		let path = base + '.md';
		for (let n = 2; files.getFileByPath(path); n++) path = `${base}-${n}.md`;
		const source = template ? files.resolveLink(template) : null;
		let body = source
			? substituteTemplateVars(await files.read(source), { title: name })
			: Object.keys(properties).length
				? `---\n${Object.entries(properties)
						.map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
						.join('\n')}\n---\n`
				: '';
		if (Object.keys(properties).length) {
			const doc = readMarkdownDocument(body),
				yaml = readYaml(doc.yaml);
			for (const [key, value] of Object.entries(properties)) yaml.set(key, value);
			body = `---\n${yaml.toString({ lineWidth: 0 })}---\n${doc.body}`;
		}
		await files.create(path, body + (append ? '\n' + append + '\n' : ''));
		await this.openFile(path);
		return path;
	}
	library(config: import('../core/board/types/model').LibraryConfig): ReturnType<typeof queryVaultFiles> {
		return queryVaultFiles(this.host.app, config);
	}
	metadata(file: ContentFile): Record<string, unknown> {
		return contentFiles(this.host.app).getMetadata(file)?.frontmatter ?? {};
	}
	async trash(file: ContentFile): Promise<void> {
		await contentFiles(this.host.app).trash(file);
	}
	async weather(): Promise<void> {
		const generation = ++this.weatherGeneration,
			s = this.host.settings;
		try {
			const weather = await fetchWeather({
				cityName: s.widgetWeatherCity,
				latitude: s.widgetWeatherLat,
				longitude: s.widgetWeatherLon,
			});
			if (!this.disposed && generation === this.weatherGeneration)
				this.state.setState({ weather, weatherError: '' });
		} catch (error) {
			if (!this.disposed && generation === this.weatherGeneration)
				this.state.setState({ weatherError: error instanceof Error ? error.message : t('workbench.failed') });
		}
	}
	cities(query: string): ReturnType<typeof geocodeCity> {
		return geocodeCity(query);
	}
	get widgets(): typeof homeServices {
		return homeServices;
	}
}
