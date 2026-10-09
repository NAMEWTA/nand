import type { TextStorage } from '../../../shared/storage/ports';
import { JsonStore } from '../../../shared/json-store';
import type { AgentPromptResult } from '../../agent/api';
import { runMaterialAnalysis, type AnalysisRun } from '../core/analysis-run';
import { buildDailyEdition } from '../core/edition';
import { groupMaterials } from '../core/grouping';
import { closeHeatHour, heatFacts } from '../core/heat';
import { canonicalNewsUrl, isTodayMaterial, upsertMaterial, type MaterialInput } from '../core/materials';
import type { NewsAnalysis, NewsEdition, NewsHeatSnapshot, NewsMaterial, NewsOccurrence, NewsRun, NewsSource, NewsSourceHealth, NewsStory, NewsView } from '../core/model';
import { briefDocument, buildBriefPrompt } from '../core/prompts';
import { markSourceAttempt, sourceDue } from '../core/source-schedule';
import { parseFeed } from '../platform/feed-reader';
import { briefPath, favoritePath, parseMaterialNote, refreshBriefNote, refreshFavoriteNote, serializeBrief, serializeMaterial } from '../platform/notes';
import { parseStaticList } from '../platform/web-list-reader';
import { requestNews, type NewsFetcher } from '../platform/request-fetcher';
import type { NewsReadService } from '../api';

/** Device cache lives for 30 days. Favorite notes are not part of it. */
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
interface Envelope<T> { version: 1; items: T }
interface NewsEvents { stories: NewsStory[]; occurrences: NewsOccurrence[] }
interface ReaderState { health: Record<string, NewsSourceHealth>; read?: string[]; hidden?: string[] }
interface NewsData {
	materials: NewsMaterial[];
	health: Record<string, NewsSourceHealth>;
	analyses: NewsAnalysis[];
	stories: NewsStory[];
	occurrences: NewsOccurrence[];
	heat: NewsHeatSnapshot[];
	runs: NewsRun[];
	readIds: string[];
	hiddenIds: string[];
}
type SettingsReader = () => { enabled: boolean; sources: NewsSource[]; views: NewsView[]; autoRefresh?: boolean; interest?: string; analysisEnabled?: boolean; dailyEditionEnabled?: boolean };
const hash = (value: string): string => {
	let result = 2166136261;
	for (const char of value) {
		result ^= char.codePointAt(0) ?? 0;
		result = Math.imul(result, 16777619);
	}
	return (result >>> 0).toString(16);
};
const configHash = (source: NewsSource): string => hash(JSON.stringify({ ...source, kind: undefined }));
const isRecord = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object';
const isMaterial = (item: unknown): item is NewsMaterial => isRecord(item) && typeof item.id === 'string' && typeof item.sourceId === 'string' && typeof item.canonicalKey === 'string';
const isAnalysis = (item: unknown): item is NewsAnalysis => isRecord(item) && typeof item.materialId === 'string' && typeof item.createdAt === 'number';
const isStory = (item: unknown): item is NewsStory => isRecord(item) && typeof item.id === 'string' && Array.isArray(item.materialIds);
const isOccurrence = (item: unknown): item is NewsOccurrence => isRecord(item) && typeof item.id === 'string' && typeof item.storyId === 'string';
const isHeat = (item: unknown): item is NewsHeatSnapshot => isRecord(item) && typeof item.sourceId === 'string' && typeof item.observedAt === 'number';
const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isRun = (item: unknown): item is NewsRun => isRecord(item) && typeof item.id === 'string' && typeof item.at === 'number' && typeof item.status === 'string';
const isHealth = (item: unknown): item is NewsSourceHealth => isRecord(item) && typeof item.failureCount === 'number' && typeof item.configHash === 'string' && typeof item.initializedAt === 'number';
const isHealthMap = (value: unknown): value is Record<string, NewsSourceHealth> => isRecord(value) && Object.values(value).every(isHealth);
const isEvents = (value: unknown): value is NewsEvents => isRecord(value) && Array.isArray(value.stories) && value.stories.every(isStory) && Array.isArray(value.occurrences) && value.occurrences.every(isOccurrence);
const isReader = (value: unknown): value is ReaderState => isRecord(value) && isHealthMap(value.health) && (value.read === undefined || isStringList(value.read)) && (value.hidden === undefined || isStringList(value.hidden));
const isList = <T>(value: unknown, item: (value: unknown) => value is T): value is T[] => Array.isArray(value) && value.every(item);
function envelopeOf<T>(items: (value: unknown) => value is T): (value: unknown) => value is Envelope<T> {
	return (value): value is Envelope<T> => isRecord(value) && value.version === 1 && items(value.items);
}
const empty = (): NewsData => ({ materials: [], health: {}, analyses: [], stories: [], occurrences: [], heat: [], runs: [], readIds: [], hiddenIds: [] });
const identityOf = (material: NewsMaterial): NewsMaterial => ({
	id: material.id,
	sourceId: material.sourceId,
	sourceItemId: material.sourceItemId,
	originalUrl: material.originalUrl,
	canonicalKey: material.canonicalKey,
	title: material.title,
	bodyExcerpt: '',
	discoveredAt: material.discoveredAt,
	revision: material.revision,
	contentHash: material.contentHash,
	...(material.publishedAt !== undefined ? { publishedAt: material.publishedAt } : {}),
	...(material.backfillReason ? { backfillReason: material.backfillReason } : {}),
});

export class NewsService implements NewsReadService {
	private readonly listeners = new Set<() => void>();
	private readonly inFlight = new Map<string, Promise<void>>();
	private readonly materialsFile: JsonStore<Envelope<NewsMaterial[]>>;
	private readonly analysesFile: JsonStore<Envelope<NewsAnalysis[]>>;
	private readonly eventsFile: JsonStore<Envelope<NewsEvents>>;
	private readonly heatFile: JsonStore<Envelope<NewsHeatSnapshot[]>>;
	private readonly runsFile: JsonStore<Envelope<NewsRun[]>>;
	private focused = '';
	private briefSerial = 0;
	private readonly readerFile: JsonStore<Envelope<ReaderState>>;
	private data: NewsData = empty();
	private loaded = false;
	private tail: Promise<void> = Promise.resolve();
	readonly ready: Promise<void>;
	constructor(
		private readonly storage: TextStorage,
		private readonly settings: SettingsReader,
		private readonly fetcher: NewsFetcher = requestNews,
		private readonly directory = '.nand/news/local',
	) {
		this.materialsFile = new JsonStore(storage, `${directory}/materials.json`, envelopeOf((value): value is NewsMaterial[] => isList(value, isMaterial)));
		this.analysesFile = new JsonStore(storage, `${directory}/analyses.json`, envelopeOf((value): value is NewsAnalysis[] => isList(value, isAnalysis)));
		this.eventsFile = new JsonStore(storage, `${directory}/events.json`, envelopeOf(isEvents));
		this.heatFile = new JsonStore(storage, `${directory}/heat.json`, envelopeOf((value): value is NewsHeatSnapshot[] => isList(value, isHeat)));
		this.runsFile = new JsonStore(storage, `${directory}/runs.json`, envelopeOf((value): value is NewsRun[] => isList(value, isRun)));
		this.readerFile = new JsonStore(storage, `${directory}/reader-state.json`, envelopeOf(isReader));
		this.ready = this.load();
	}
	private async load(): Promise<void> {
		const [materials, analyses, events, heat, runs, reader] = await Promise.all([
			this.materialsFile.load({ version: 1, items: [] }),
			this.analysesFile.load({ version: 1, items: [] }),
			this.eventsFile.load({ version: 1, items: { stories: [], occurrences: [] } }),
			this.heatFile.load({ version: 1, items: [] }),
			this.runsFile.load({ version: 1, items: [] }),
			this.readerFile.load({ version: 1, items: { health: {} } }),
		]);
		this.data = { materials: materials.items, analyses: analyses.items, stories: events.items.stories, occurrences: events.items.occurrences, heat: heat.items, runs: runs.items, health: reader.items.health, readIds: reader.items.read ?? [], hiddenIds: reader.items.hidden ?? [] };
		this.loaded = true;
	}
	sources(): readonly NewsSource[] {
		return this.settings().sources;
	}
	health(sourceId: string): NewsSourceHealth | undefined {
		return this.data.health[sourceId];
	}
	materials(): readonly NewsMaterial[] {
		return this.data.materials;
	}
	analyses(): readonly NewsAnalysis[] {
		return this.data.analyses;
	}
	stories(): readonly NewsStory[] {
		return this.data.stories;
	}
	run(id: string): NewsRun | undefined {
		return this.data.runs.find((item) => item.id === id);
	}
	focusedId(): string {
		return this.focused;
	}
	focus(id: string): void {
		this.focused = id;
		this.emit();
	}
	isHidden(id: string): boolean {
		return this.data.hiddenIds.includes(id);
	}
	isRead(id: string): boolean {
		return this.data.readIds.includes(id);
	}
	async setReaderChoice(id: string, choice: 'read' | 'hidden' | 'visible'): Promise<void> {
		await this.ready;
		await this.exclusive(async () => {
			const read = new Set(this.data.readIds);
			const hidden = new Set(this.data.hiddenIds);
			if (choice === 'read') {
				read.add(id);
				hidden.delete(id);
			} else if (choice === 'hidden') {
				hidden.add(id);
				read.delete(id);
			} else {
				read.delete(id);
				hidden.delete(id);
			}
			this.data = { ...this.data, readIds: [...read], hiddenIds: [...hidden] };
			await this.persist();
		});
	}
	/** Today's featured edition. Weekly and monthly reports are not built here. */
	dailyEdition(now = Date.now()): NewsEdition | undefined {
		if (!this.settings().dailyEditionEnabled) return undefined;
		return buildDailyEdition(this.materials(), this.analyses(), this.stories(), now);
	}
	views(): readonly NewsView[] {
		return this.settings().views;
	}
	heat(): readonly NewsHeatSnapshot[] {
		return this.data.heat;
	}
	today(now = Date.now()): NewsMaterial[] {
		return this.materials().filter((material) => isTodayMaterial(material, now));
	}
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	private emit(): void {
		for (const listener of [...this.listeners]) listener();
	}
	private exclusive(work: () => Promise<void>): Promise<void> {
		const run = this.tail.then(work);
		this.tail = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}
	private async persist(now = Date.now()): Promise<void> {
		if (!this.loaded) throw new Error('Reload the news store before saving');
		const kept: NewsMaterial[] = [];
		for (const material of this.data.materials) {
			const at = material.updatedAt ?? material.discoveredAt;
			if (now - at <= RETENTION_MS) kept.push(material);
			else if (await this.storage.exists(favoritePath(material.id))) kept.push(identityOf(material));
		}
		const ids = new Set(kept.map((material) => material.id));
		const existing = this.data.stories
			.map((story) => ({ ...story, materialIds: story.materialIds.filter((id) => ids.has(id)) }))
			.filter((story) => story.materialIds.length > 0);
		const grouped = groupMaterials(kept, existing);
		const observed = closeHeatHour(heatFacts(kept, this.sources(), this.data.health, grouped.stories, now), now, this.data.heat);
		this.data = {
			...this.data,
			materials: kept,
			analyses: this.data.analyses.filter((item) => ids.has(item.materialId) && now - item.createdAt <= RETENTION_MS),
			stories: grouped.stories,
			occurrences: grouped.occurrences,
			heat: [...observed, ...this.data.heat].filter((item) => now - item.observedAt <= RETENTION_MS),
			runs: this.data.runs.filter((item) => now - item.at <= RETENTION_MS),
		};
		await Promise.all([
			this.materialsFile.save({ version: 1, items: this.data.materials }),
			this.analysesFile.save({ version: 1, items: this.data.analyses }),
			this.eventsFile.save({ version: 1, items: { stories: this.data.stories, occurrences: this.data.occurrences } }),
			this.heatFile.save({ version: 1, items: this.data.heat }),
			this.runsFile.save({ version: 1, items: this.data.runs }),
			this.readerFile.save({ version: 1, items: { health: this.data.health, read: this.data.readIds, hidden: this.data.hiddenIds } }),
		]);
		this.emit();
	}
	async refresh(sourceId?: string): Promise<void> {
		await this.ready;
		if (!this.settings().enabled) return;
		const selected = this.sources().filter((source) => source.enabled && (!sourceId || source.id === sourceId));
		const results = await Promise.allSettled(selected.map((source) => this.refreshSource(source)));
		const failed = results.find((result) => result.status === 'rejected');
		if (failed && failed.status === 'rejected' && selected.length === 1) throw failed.reason;
	}
	async refreshDue(now = Date.now()): Promise<void> {
		await this.ready;
		if (!this.settings().enabled || !this.settings().autoRefresh) return;
		await Promise.allSettled(this.sources().filter((source) => source.enabled && sourceDue(this.healthFor(source), now)).map((source) => this.refreshSource(source)));
	}
	private healthFor(source: NewsSource): NewsSourceHealth {
		return this.data.health[source.id] ?? { failureCount: 0, initializedAt: Date.now(), configHash: configHash(source) };
	}
	private refreshSource(source: NewsSource): Promise<void> {
		const existing = this.inFlight.get(source.id);
		if (existing) return existing;
		const task = this.fetchOne(source).finally(() => this.inFlight.delete(source.id));
		this.inFlight.set(source.id, task);
		return task;
	}
	private entriesFor(source: NewsSource, body: string): MaterialInput[] {
		if (source.type === 'web-list') {
			const parsed = parseStaticList(body, source.id, source.url, source.selectors ?? { item: 'li', link: 'a', title: 'a' });
			if (parsed.error) throw new Error(`news.list.${parsed.error}`);
			return parsed.items;
		}
		return parseFeed(body, source.id, source.url);
	}
	private async fetchOne(source: NewsSource): Promise<void> {
		const previousHealth = this.healthFor(source);
		await this.exclusive(async () => {
			const attempted = { ...previousHealth, lastAttempt: Date.now(), configHash: configHash(source) };
			this.data = { ...this.data, health: { ...this.data.health, [source.id]: attempted } };
			await this.persist();
		});
		try {
			const response = await this.fetcher.fetch(source, {
				...(previousHealth.etag ? { 'If-None-Match': previousHealth.etag } : {}),
				...(previousHealth.lastModified ? { 'If-Modified-Since': previousHealth.lastModified } : {}),
			});
			await this.exclusive(async () => {
				if (response.status === 304) {
					this.data = { ...this.data, health: { ...this.data.health, [source.id]: markSourceAttempt(previousHealth, source, Date.now(), true) } };
					await this.persist();
					return;
				}
				if (response.status < 200 || response.status >= 300) throw new Error(`news.http.${response.status}`);
				const entries = this.entriesFor(source, response.text);
				let materials = this.data.materials.slice();
				for (const entry of entries) {
					const canonical = canonicalNewsUrl(entry.url, source.selectors?.preserveFragment === true);
					const previous = materials.find((item) => item.canonicalKey === canonical || (item.sourceId === source.id && item.sourceItemId === entry.sourceItemId));
					const next = upsertMaterial(previous, entry, Date.now(), source.selectors?.preserveFragment === true);
					materials = previous ? materials.map((item) => (item.id === previous.id ? next : item)) : [...materials, next];
					await this.keepFavorite(next);
				}
				const health = markSourceAttempt(previousHealth, source, Date.now(), true, entries.length);
				this.data = {
					...this.data,
					materials,
					health: { ...this.data.health, [source.id]: { ...health, ...(response.etag ? { etag: response.etag } : {}), ...(response.lastModified ? { lastModified: response.lastModified } : {}) } },
				};
				await this.persist();
			});
		} catch (error) {
			await this.exclusive(async () => {
				this.data = { ...this.data, health: { ...this.data.health, [source.id]: { ...markSourceAttempt(previousHealth, source, Date.now(), false), configHash: configHash(source) } } };
				await this.persist();
			});
			throw error;
		}
	}
	/** One stable Markdown note. The annotation survives refresh and a cache clear. */
	async saveFavorite(material: NewsMaterial, notes: string): Promise<void> {
		await this.ready;
		const path = favoritePath(material.id);
		await this.storage.mkdir('.nand/news/favorites');
		await this.storage.write(path, serializeMaterial(material, notes));
	}
	async favoriteNotes(id: string): Promise<string> {
		const path = favoritePath(id);
		if (!(await this.storage.exists(path))) return '';
		return parseMaterialNote(await this.storage.read(path)).notes;
	}
	private async keepFavorite(material: NewsMaterial): Promise<void> {
		const path = favoritePath(material.id);
		if (!(await this.storage.exists(path))) return;
		await this.storage.write(path, refreshFavoriteNote(await this.storage.read(path), material));
	}
	/**
	 * One brief from already analyzed reports. A failed write leaves the previous note in place.
	 * The runner call counts against the same budget as analysis.
	 */
	async writeBrief(storyId: string, runner: { run(prompt: string): Promise<AgentPromptResult> }, budget = 8): Promise<{ status: 'complete' | 'needs-attention' | 'budget' | 'failed'; runId: string; path?: string; calls: number }> {
		await this.ready;
		const skipped = { status: 'failed' as const, runId: '', calls: 0 };
		if (!this.settings().enabled || this.settings().analysisEnabled === false) return skipped;
		const story = this.data.stories.find((item) => item.id === storyId);
		if (!story) return skipped;
		const materials = story.materialIds.flatMap((id) => {
			const material = this.data.materials.find((item) => item.id === id);
			return material && this.data.analyses.some((item) => item.materialId === material.id) ? [material] : [];
		});
		if (!materials.length) return skipped;
		const spent = this.data.runs.reduce((sum, item) => sum + item.calls, 0);
		if (spent >= budget) return { status: 'budget', runId: '', calls: 0 };
		const urls = materials.map((material) => material.originalUrl);
		const prompt = buildBriefPrompt(
			story.title,
			materials.map((material) => ({
				id: material.id,
				title: material.title,
				url: material.originalUrl,
				summary: material.summary || material.body || material.bodyExcerpt,
				source: this.sources().find((item) => item.id === material.sourceId)?.name ?? material.sourceId,
			})),
			this.settings().interest ?? '',
		);
		let result: AgentPromptResult;
		try {
			result = await runner.run(prompt);
		} catch {
			result = { status: 'failed', text: '' };
		}
		let status: 'complete' | 'needs-attention' | 'budget' | 'failed' = 'failed';
		if (result.status === 'budget') status = 'budget';
		else if (result.status === 'truncated') status = 'needs-attention';
		else if (result.status === 'complete') status = briefDocument(result.text, urls) ? 'complete' : 'needs-attention';
		const runId = `brief-${Date.now().toString(36)}-${this.briefSerial++}`;
		let path: string | undefined;
		if (status === 'complete') {
			path = briefPath(story.id);
			const existing = (await this.storage.exists(path)) ? await this.storage.read(path) : '';
			try {
				await this.storage.mkdir('NAND/新闻/简报');
				await this.storage.write(path, existing ? refreshBriefNote(existing, story.id, story.title, result.text) : serializeBrief(story.id, story.title, result.text));
			} catch {
				status = 'failed';
				path = undefined;
			}
		}
		const materialId = story.representativeId ?? materials[0]!.id;
		await this.exclusive(async () => {
			this.data = { ...this.data, runs: [...this.data.runs, { id: runId, at: Date.now(), status, calls: 1, spent: spent + 1, storyId: story.id, materialId }] };
			await this.persist();
		});
		return { status, runId, ...(path && status === 'complete' ? { path } : {}), calls: 1 };
	}
	/** Drop collected cache. Favorite notes stay on disk. */
	async clearCache(): Promise<void> {
		await this.ready;
		await this.exclusive(async () => {
			this.data = { ...this.data, materials: [], health: {}, analyses: [], stories: [], occurrences: [], heat: [], runs: [] };
			await this.persist();
		});
	}
	async analyze(runner: { run(prompt: string): Promise<AgentPromptResult> }, budget = 8): Promise<AnalysisRun> {
		await this.ready;
		if (!this.settings().enabled || this.settings().analysisEnabled === false) return { status: 'failed', analyses: [...this.analyses()], spent: 0, calls: 0 };
		const result = await runMaterialAnalysis(this.materials(), this.analyses(), runner, budget);
		await this.exclusive(async () => {
			this.data = { ...this.data, analyses: result.analyses, runs: [...this.data.runs, { id: `run-${Date.now().toString(36)}`, at: Date.now(), status: result.status, calls: result.calls, spent: result.spent }] };
			await this.persist();
		});
		return result;
	}
	async shutdown(): Promise<void> {
		await Promise.all([this.materialsFile.flush(), this.analysesFile.flush(), this.eventsFile.flush(), this.heatFile.flush(), this.runsFile.flush(), this.readerFile.flush()]);
		this.listeners.clear();
	}
}
