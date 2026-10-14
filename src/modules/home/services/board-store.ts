import { createStore } from 'zustand/vanilla';
import { contentFiles, type ContentFile } from '../../../host/obsidian/storage/content-files';
import type { AppWithCommands } from '../../../host/obsidian/obsidian-internal';
import { contentPath } from '../../../shared/storage/content-paths';
import { readMarkdownDocument, readYaml } from '../../../shared/storage/markdown-document';
import { memoCardText } from '../platform/board/card-move';
import { archiveCompleted } from '../core/board/task-tree';
import { extractCardParts } from '../core/board/parser/extract-card-parts';
import type { DashboardCard } from '../core/board/types/model';
import { nowMoment } from '../../../host/obsidian/datetime';
import { placeCaptureLine } from '../core/board/capture';
import { t } from '../../../shared/i18n';
import { getOrCreateDailyNote, substituteTemplateVars } from '../platform/calendar/daily-notes';
import { SyncEngine } from '../platform/board/sync';
import type { DashboardData, DashboardSettings, QuickAction, WeatherData } from '../core/board/types/model';
import type { DashboardSaveState } from '../core/board/save-state';
import { fetchWeather, geocodeCity } from '../platform/widgets/weather-service';
import type { HomeHost } from './home-host';
import { queryVaultFiles } from './library-query';
import { homeServices } from './instances';

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
	previewPath: string | null;
	captureDraft: string;
}

/** One page's file pointer; durable writes and conflict recovery remain in SyncEngine. */
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
			previewPath: null,
			captureDraft: '',
		}));
		this.cleanup.push(this.sync.onDataUpdate((data) => this.state.setState({ data: structuredClone(data) })));
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
		for (const service of [homeServices.habit, homeServices.expense, homeServices.pomodoro])
			if (service) this.cleanup.push(service.subscribe(changed));
		if (homeServices.pomodoro) this.cleanup.push(homeServices.pomodoro.subscribeTick(changed));
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
	switch(path: string): Promise<void> {
		const run = this.switchTail.then(async () => {
			if (this.disposed || path === this.state.getState().path) return;
			await this.sync.flush();
			if (this.disposed) return;
			this.sync.updateSettings({ ...this.host.settings, dashboardFile: path });
			await this.sync.switchFile();
			if (!this.disposed) this.state.setState({ path });
		});
		this.switchTail = run.catch(() => undefined);
		return run;
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
