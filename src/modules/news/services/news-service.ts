import type { TextStorage } from '../../../shared/storage/ports';
import { JsonStore } from '../../../shared/json-store';
import type { AgentPromptResult } from '../../agent/api';
import { runMaterialAnalysis, type AnalysisRun, type AnalysisRunner } from '../core/analysis-run';
import { ITEM_TYPES, QUALITY_FLAGS, recomputeAnalysis, validAxes } from '../core/scoring';
import type { NewsSettings } from '../settings';
import { buildDailyEdition, editionMemory } from '../core/edition';
import { DEFAULT_HEAT_RULES, type HeatRules } from '../core/editorial-rules';
import { confirmedMaterialIds, emptyEvents, groupMaterials, resolveStory } from '../core/grouping';
import { recallCandidates } from '../core/recall';
import { chooseRepresentative } from '../core/representative';
import { heatFacts, observeHeatHour, rankHeat, repairHeatHours, type HeatFact, type HeatRank } from '../core/heat';
import { canonicalNewsUrl, isTodayMaterial, upsertMaterial, type MaterialInput } from '../core/materials';
import type { NewsAnalysis, NewsBrief, NewsBriefResult, NewsEdition, NewsEvents, NewsHeatSnapshot, NewsMaterial, NewsOccurrence, NewsRun, NewsSource, NewsSourceHealth, NewsStory, NewsView } from '../core/model';
import { briefDocument, briefPlan, materialBody } from '../core/prompts';
import { markSourceAttempt, nextAdaptiveIntervalMinutes, sourceBackoffMinutes, sourceDue } from '../core/source-schedule';
import { parseFeed } from '../platform/feed-reader';
import type { NewsNotePort } from '../platform/note-port';
import { parseStaticList } from '../platform/web-list-reader';
import { requestNews, type NewsFetcher } from '../platform/request-fetcher';
import type { NewsReadService } from '../api';
import { NewsNotebook } from './news-notebook';
import { NewsRunJournal } from './run-journal';
import { recoverGroupReviews, reviewGroups, type GroupReviewPort } from './group-review';
import { defaultNewsWidgets, type NewsWidgetConfig } from '../core/home-widgets';

/** Device cache lives for 30 days. Favorite notes are not part of it. */
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
interface Envelope<T> { version: 1; items: T }
interface ReaderState { health: Record<string, NewsSourceHealth>; read?: string[]; hidden?: string[]; editions?: NewsEdition[] }
interface NewsData extends NewsEvents {
	materials: NewsMaterial[];
	health: Record<string, NewsSourceHealth>;
	analyses: NewsAnalysis[];
	stories: NewsStory[];
	occurrences: NewsOccurrence[];
	heat: NewsHeatSnapshot[];
	runs: NewsRun[];
	readIds: string[];
	hiddenIds: string[];
	editions: NewsEdition[];
}
type SettingsReader = () => Pick<NewsSettings, 'enabled' | 'sources' | 'views'> & Partial<NewsSettings>;
const hash = (value: string): string => {
	let result = 2166136261;
	for (const char of value) {
		result ^= char.codePointAt(0) ?? 0;
		result = Math.imul(result, 16777619);
	}
	return (result >>> 0).toString(16);
};
const configHash = (source: NewsSource): string => hash(JSON.stringify({ type: source.type, url: source.url, selectors: source.selectors }));
const isRecord = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object';
const isMaterial = (item: unknown): item is NewsMaterial => isRecord(item) && typeof item.id === 'string' && typeof item.sourceId === 'string' && typeof item.canonicalKey === 'string'
	&& (item.seenContentHashes === undefined || isStringList(item.seenContentHashes));
const isAnalysis = (item: unknown): item is NewsAnalysis => isRecord(item) && typeof item.materialId === 'string' && typeof item.createdAt === 'number'
	&& typeof item.titleZh === 'string' && typeof item.summaryZh === 'string' && typeof item.contentHash === 'string' && typeof item.revision === 'number'
	&& Array.isArray(item.relations) && Array.isArray(item.samples) && item.samples.length >= 1 && item.samples.length <= 2 && item.samples.every(sample => isRecord(sample) && ITEM_TYPES.includes(sample.itemType as NewsAnalysis['itemType']) && validAxes(sample.axes) && Array.isArray(sample.qualityFlags) && sample.qualityFlags.every(flag => QUALITY_FLAGS.includes(flag as NewsAnalysis['qualityFlags'][number])));
const isStory = (item: unknown): item is NewsStory => isRecord(item) && typeof item.id === 'string' && Array.isArray(item.materialIds);
const isOccurrence = (item: unknown): item is NewsOccurrence => isRecord(item) && typeof item.id === 'string' && typeof item.storyId === 'string';
const isHeat = (item: unknown): item is NewsHeatSnapshot => isRecord(item) && typeof item.eventId === 'string' && typeof item.hour === 'number' && typeof item.observedAt === 'number' && typeof item.complete === 'boolean';
const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isRun = (item: unknown): item is NewsRun => isRecord(item) && typeof item.id === 'string' && typeof item.at === 'number' && Number.isFinite(item.at) && typeof item.status === 'string'
	&& typeof item.calls === 'number' && Number.isInteger(item.calls) && item.calls >= 0 && typeof item.spent === 'number' && Number.isFinite(item.spent)
	&& (item.receipt === undefined || isRecord(item.receipt) && ['analysis', 'brief', 'grouping'].includes(String(item.receipt.kind)) && ['started', 'received', 'applied', 'failed', 'interrupted'].includes(String(item.receipt.state)) && typeof item.receipt.batchId === 'string' && typeof item.receipt.day === 'string');
const isHealth = (item: unknown): item is NewsSourceHealth => isRecord(item) && typeof item.failureCount === 'number' && typeof item.configHash === 'string' && typeof item.initializedAt === 'number';
const isHealthMap = (value: unknown): value is Record<string, NewsSourceHealth> => isRecord(value) && Object.values(value).every(isHealth);
const isEvents = (value: unknown): value is NewsEvents => isRecord(value) && Array.isArray(value.stories) && value.stories.every(isStory) && Array.isArray(value.occurrences) && value.occurrences.every(isOccurrence) && ['records', 'mentions', 'proposals', 'reviews'].every(key => Array.isArray(value[key]));
const isEdition = (value: unknown): value is NewsEdition => isRecord(value) && typeof value.date === 'string' && typeof value.startAt === 'number' && typeof value.endAt === 'number' && Array.isArray(value.main) && Array.isArray(value.flashes) && (value.main as unknown[]).concat(value.flashes as unknown[]).every(item => isRecord(item) && typeof item.materialId === 'string' && isStringList(item.occurrenceIds) && isStringList(item.relatedIds));
const isReader = (value: unknown): value is ReaderState => isRecord(value) && isHealthMap(value.health) && (value.read === undefined || isStringList(value.read)) && (value.hidden === undefined || isStringList(value.hidden)) && (value.editions === undefined || Array.isArray(value.editions) && value.editions.every(isEdition));
const isList = <T>(value: unknown, item: (value: unknown) => value is T): value is T[] => Array.isArray(value) && value.every(item);
function envelopeOf<T>(items: (value: unknown) => value is T): (value: unknown) => value is Envelope<T> {
	return (value): value is Envelope<T> => isRecord(value) && value.version === 1 && items(value.items);
}
const empty = (): NewsData => ({ ...emptyEvents(), materials: [], health: {}, analyses: [], heat: [], runs: [], readIds: [], hiddenIds: [], editions: [] });
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
	private readonly notebook: NewsNotebook;
	private readonly listeners = new Set<() => void>();
	private readonly inFlight = new Map<string, Promise<void>>();
	private collectionAbort = new AbortController();
	private collectionGeneration = 0;
	private collectionConfig = '';
	private readonly collectionTails: Promise<void>[] = [Promise.resolve(), Promise.resolve(), Promise.resolve()];
	private collectionSlot = 0;
	private stopped = false;
	private readonly materialsFile: JsonStore<Envelope<NewsMaterial[]>>;
	private readonly analysesFile: JsonStore<Envelope<NewsAnalysis[]>>;
	private readonly eventsFile: JsonStore<Envelope<NewsEvents>>;
	private readonly heatFile: JsonStore<Envelope<NewsHeatSnapshot[]>>;
	private readonly runsFile: JsonStore<Envelope<NewsRun[]>>;
	private readonly journal: NewsRunJournal;
	private analysisTask?: Promise<AnalysisRun>;
	private readonly briefTasks = new Map<string, Promise<NewsBriefResult>>();
	private readonly activities = new Map<string, { status: 'running' | 'needs-attention'; terminalId: string }>();
	private readonly readerFile: JsonStore<Envelope<ReaderState>>;
	private data: NewsData = empty();
	private loaded = false;
	private tail: Promise<void> = Promise.resolve();
	readonly ready: Promise<void>;
	constructor(
		storage: TextStorage,
		notes: NewsNotePort,
		private readonly settings: SettingsReader,
		private readonly fetcher: NewsFetcher = requestNews,
		private readonly directory = '.nand/news/local',
	) {
		this.collectionConfig = this.collectionSettings();
		this.materialsFile = new JsonStore(storage, `${directory}/materials.json`, envelopeOf((value): value is NewsMaterial[] => isList(value, isMaterial)));
		this.analysesFile = new JsonStore(storage, `${directory}/analyses.json`, envelopeOf((value): value is NewsAnalysis[] => isList(value, isAnalysis)));
		this.eventsFile = new JsonStore(storage, `${directory}/events.json`, envelopeOf(isEvents));
		this.heatFile = new JsonStore(storage, `${directory}/heat.json`, envelopeOf((value): value is NewsHeatSnapshot[] => isList(value, isHeat)));
		this.runsFile = new JsonStore(storage, `${directory}/runs.json`, envelopeOf((value): value is NewsRun[] => isList(value, isRun)));
		this.readerFile = new JsonStore(storage, `${directory}/reader-state.json`, envelopeOf(isReader));
		this.notebook = new NewsNotebook(notes, () => this.emit(), this.settings);
		this.journal = new NewsRunJournal(() => this.data.runs, runs => this.exclusive(async () => {
			await this.runsFile.save({ version: 1, items: runs });
			this.data = { ...this.data, runs };
			this.emit();
		}));
		this.ready = Promise.all([this.load(), this.notebook.ready]).then(() => undefined);
	}
	private async load(): Promise<void> {
		const [materials, analyses, events, heat, runs, reader] = await Promise.all([
			this.materialsFile.load({ version: 1, items: [] }),
			this.analysesFile.load({ version: 1, items: [] }),
			this.eventsFile.load({ version: 1, items: emptyEvents() }),
			this.heatFile.load({ version: 1, items: [] }),
			this.runsFile.load({ version: 1, items: [] }),
			this.readerFile.load({ version: 1, items: { health: {} } }),
		]);
		this.data = { ...events.items, materials: materials.items, analyses: analyses.items, heat: heat.items, runs: runs.items, health: reader.items.health, readIds: reader.items.read ?? [], hiddenIds: reader.items.hidden ?? [], editions: reader.items.editions ?? [] };
		this.loaded = true;
		await this.journal.recover();
		await this.journal.retireObsolete(this.materials());
		// Startup consumes durable answers locally. No unfinished call is sent on activation.
		const recovery = this.journal.resume(new Set(), this.materials(), this.analyses());
		if (recovery.resume.length) await runMaterialAnalysis([], this.analyses(), { run: async () => { throw new Error('news.resume.noSend'); } }, 0, 0, Date.now(), {
			...this.settings(), ...recovery, onBatch: (fresh, id) => this.applyBatch(fresh, id), onFailure: (id, code) => this.journal.finish(id, 'failed', code),
		});
		for (const run of this.data.runs.filter(item => item.receipt?.kind === 'brief' && item.receipt.state === 'received')) await this.applyBrief(run);
		await recoverGroupReviews(this.groupReviewPort(), this.journal);
	}
	sources(): readonly NewsSource[] {
		return this.settings().sources;
	}
	health(sourceId: string): NewsSourceHealth | undefined {
		const source = this.sources().find(item => item.id === sourceId);
		return source ? this.healthFor(source) : undefined;
	}
	materials(): readonly NewsMaterial[] {
		return this.data.materials;
	}
	favorites(): readonly NewsMaterial[] { return this.notebook.list(); }
	favoriteIssues(): readonly string[] { return this.notebook.issues(); }
	favoriteLocation(id: string): string | undefined { return this.notebook.path(id); }
	analyses(): readonly NewsAnalysis[] {
		const settings = this.settings();
		const materials = new Map(this.materials().map(item => [item.id, item]));
		const tiers = new Map(this.sources().map(item => [item.id, item.tier]));
		const confirmed = confirmedMaterialIds(this.events());
		return this.data.analyses.filter(analysis => {
			const material = materials.get(analysis.materialId);
			return material?.revision === analysis.revision && material.contentHash === analysis.contentHash;
		}).map(analysis => {
			const material = materials.get(analysis.materialId);
			const groupConfirmed = confirmed.has(analysis.materialId) && material?.revision === analysis.revision && material.contentHash === analysis.contentHash;
			return recomputeAnalysis({ ...analysis, groupConfirmed }, tiers.get(material?.sourceId ?? '') ?? 'unlisted', settings.weights, settings.thresholds, settings.understandFloor);
		});
	}
	stories(): readonly NewsStory[] {
		const analyses = this.analyses();
		return this.data.stories.map(story => ({ ...story, representativeId: chooseRepresentative(story, this.materials(), this.sources(), this.data.occurrences, analyses) }));
	}
	occurrences(): readonly NewsOccurrence[] { return this.data.occurrences; }
	story(id: string): NewsStory | undefined { return resolveStory(this.stories(), id); }
	brief(id: string): NewsBrief | undefined {
		const story = this.story(id);
		return this.notebook.brief(story ? [story.id, ...(story.aliases ?? [])] : [id]);
	}
	private events(): NewsEvents {
		const { stories, occurrences, records, mentions, proposals, reviews } = this.data;
		return { stories, occurrences, records, mentions, proposals, reviews };
	}
	private groupReviewPort(): GroupReviewPort {
		return { events: () => this.events(), runs: () => this.data.runs, stopped: () => this.stopped, apply: review => this.exclusive(async () => {
			const events = this.events();
			const proposal = events.proposals.find(item => item.id === review.proposalId);
			if (!proposal || ![proposal.left, proposal.right].every(saved => this.materials().some(item => item.id === saved.id && item.revision === saved.revision && item.contentHash === saved.contentHash))) return;
			const next = groupMaterials(this.materials(), [], { ...events, reviews: [...events.reviews.filter(item => item.proposalId !== review.proposalId), review] });
			await this.eventsFile.save({ version: 1, items: next });
			this.data = { ...this.data, ...next };
			this.emit();
		}) };
	}
	run(id: string): NewsRun | undefined {
		return this.data.runs.find((item) => item.id === id);
	}
	runHistory(): readonly NewsRun[] { return this.data.runs.slice().reverse(); }
	callBudget(): { used: number; limit: number } { return { used: this.journal.spent(), limit: this.settings().dailyCallLimit ?? 20 }; }
	analysisActivity(): { id: string; status: 'running' | 'needs-attention'; terminalId: string }[] { return [...this.activities].map(([id, state]) => ({ id, ...state })); }
	setRunActivity(id: string, state?: { status: 'running' | 'needs-attention'; terminalId: string }): void {
		if (state) this.activities.set(id, state); else this.activities.delete(id);
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
			await this.saveReader({ read: [...read], hidden: [...hidden] });
			this.data = { ...this.data, readIds: [...read], hiddenIds: [...hidden] };
			this.emit();
		});
	}
	/** Today's featured edition. Weekly and monthly reports are not built here. */
	dailyEdition(now = Date.now()): NewsEdition {
		return buildDailyEdition({ materials: this.materials().filter(item => !this.isHidden(item.id)), analyses: this.analyses(), events: this.events(), sources: this.sources(), evidence: this.heatEvidence(now), previous: this.data.editions, weights: this.settings().weights, thresholds: this.settings().thresholds, rules: this.settings().editionRules }, now);
	}
	/** Explicit compilation or successful collection/analysis records memory; ordinary reads stay pure. */
	async compileEdition(now = Date.now()): Promise<NewsEdition> {
		await this.ready;
		let edition = this.dailyEdition(now);
		await this.exclusive(async () => {
			if (this.stopped) throw new Error('news.stopped');
			edition = this.dailyEdition(now);
			// Retain the full supported memory horizon so increasing the setting can reuse prior issues.
			const editions = [...editionMemory(this.data.editions, now, 30), edition];
			await this.saveReader({ editions });
			this.data = { ...this.data, editions };
			if (this.settings().writeDailyNote) await this.notebook.saveEdition(edition, this.materials(), this.analyses(), this.sources());
			this.emit();
		});
		return edition;
	}
	private async saveReader(overrides: Partial<ReaderState> = {}): Promise<void> {
		await this.readerFile.save({ version: 1, items: { health: this.data.health, read: this.data.readIds, hidden: this.data.hiddenIds, editions: this.data.editions, ...overrides } });
	}
	views(): readonly NewsView[] {
		return this.settings().views;
	}
	widgets(): readonly NewsWidgetConfig[] { return this.settings().widgets ?? defaultNewsWidgets(); }
	collectionActivity(): { pending: number; lastSuccess?: number; enabled: boolean } {
		const times = this.sources().filter(source => source.enabled).flatMap(source => this.health(source.id)?.lastSuccess ?? []);
		return { pending: this.inFlight.size, ...(times.length ? { lastSuccess: Math.max(...times) } : {}), enabled: this.settings().enabled };
	}
	heat(): readonly NewsHeatSnapshot[] {
		const now = Date.now();
		return repairHeatHours(this.heatEvidence(now), now, this.data.heat.map(item => ({ ...item, eventId: resolveStory(this.data.stories, item.eventId)?.id ?? item.eventId })), this.heatRules());
	}
	heatRules(): HeatRules { return this.settings().heatRules ?? DEFAULT_HEAT_RULES; }
	heatEvidence(now = Date.now()): HeatFact[] {
		return heatFacts(this.materials().filter(item => !this.isHidden(item.id)), this.sources(), this.data.health, this.data.stories, now, this.analyses());
	}
	hot(now = Date.now()): HeatRank[] { return rankHeat(this.heatEvidence(now), now, this.heatRules()); }
	async observeHeat(hour: number): Promise<void> {
		await this.ready;
		await this.exclusive(async () => {
			if (this.stopped || !this.settings().enabled) return;
			const facts = this.heatEvidence(hour);
			const heat = observeHeatHour(facts, hour, repairHeatHours(facts, hour, this.heat(), this.heatRules()), this.heatRules());
			await this.heatFile.save({ version: 1, items: heat });
			this.data = { ...this.data, heat };
			this.emit();
		});
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
		const retention = (this.settings().retentionDays ?? 30) * 86_400_000;
		const kept: NewsMaterial[] = [];
		for (const material of this.data.materials) {
			const at = material.updatedAt ?? material.discoveredAt;
			if (now - at <= retention) kept.push(material);
			else if (this.notebook.has(material.id)) kept.push(identityOf(material));
		}
		const ids = new Set(kept.map((material) => material.id));
		const grouped = groupMaterials(kept, this.data.analyses, this.events());
		this.data = {
			...this.data,
			...grouped,
			materials: kept,
			analyses: this.data.analyses.filter((item) => ids.has(item.materialId) && now - item.createdAt <= retention),
			stories: grouped.stories,
			occurrences: grouped.occurrences,
			heat: this.data.heat.filter(item => now - item.hour < 7 * 86_400_000),
			runs: this.data.runs.filter((item) => now - item.at <= RETENTION_MS),
		};
		this.data.heat = repairHeatHours(this.heatEvidence(now), now, this.heat(), this.heatRules());
		await Promise.all([
			this.materialsFile.save({ version: 1, items: this.data.materials }),
			this.analysesFile.save({ version: 1, items: this.data.analyses }),
			this.eventsFile.save({ version: 1, items: this.events() }),
			this.heatFile.save({ version: 1, items: this.data.heat }),
			this.runsFile.save({ version: 1, items: this.data.runs }),
		]);
		// Commit conditional-request cursors only after every collected record is durable.
		await this.saveReader();
		this.emit();
	}
	async refresh(sourceId?: string): Promise<void> {
		await this.ready;
		if (this.stopped || !this.settings().enabled) return;
		const selected = this.sources().filter((source) => source.enabled && (!sourceId || source.id === sourceId) && (this.inFlight.has(source.id) || sourceDue(this.healthFor(source))));
		await this.collect(selected);
	}
	async refreshDue(now = Date.now()): Promise<void> {
		await this.ready;
		if (this.stopped || !this.settings().enabled || !this.settings().autoRefresh) return;
		await this.collect(this.sources().filter((source) => source.enabled && sourceDue(this.healthFor(source), now)), now);
	}
	async refreshWidget(instanceId: string): Promise<void> {
		const widget = this.widgets().find(item => item.id === instanceId);
		if (widget) await this.refreshFromPolicy('visible', Date.now(), widget.staleMinutes);
	}
	async refreshFromPolicy(trigger: 'startup' | 'visible', now = Date.now(), staleMinutes = this.settings().staleMinutes ?? 60): Promise<void> {
		await this.ready;
		const config = this.settings();
		if (this.stopped || !config.enabled || !(trigger === 'startup' ? config.refreshOnStartup : config.refreshWhenStale)) return;
		const stale = staleMinutes * 60_000;
		await this.collect(this.sources().filter(source => {
			const health = this.healthFor(source);
			return source.enabled && sourceDue(health, now) && (trigger === 'startup' || health.lastSuccess === undefined || now - health.lastSuccess >= stale);
		}), now);
	}
	private collectionSettings(): string {
		return JSON.stringify({ enabled: this.settings().enabled, adaptive: this.settings().adaptiveInterval, sources: this.sources().map(source => ({ id: source.id, enabled: source.enabled, interval: source.intervalMinutes, participation: source.participation, config: configHash(source) })) });
	}
	settingsChanged(): void {
		const next = this.collectionSettings();
		if (next !== this.collectionConfig) {
			this.collectionConfig = next;
			this.collectionGeneration++;
			this.collectionAbort.abort();
			this.collectionAbort = new AbortController();
			this.inFlight.clear();
		}
		this.emit();
	}
	/** An explicit trial uses the same parser and bounded network queue, without advancing a cursor. */
	async previewSource(source: NewsSource): Promise<NewsMaterial[]> {
		const signal = this.collectionAbort.signal;
		return this.queueCollection(async () => {
			if (this.stopped || signal.aborted) throw new Error('news.stopped');
			const response = await this.fetcher.fetch(source, {}, signal);
			if (this.stopped || signal.aborted) throw new Error('news.stopped');
			if (response.status < 200 || response.status >= 300) throw new Error(`news.http.${response.status}`);
			const materials = await Promise.all(this.entriesFor(source, response.text).map(entry => upsertMaterial(undefined, { ...entry, initialImport: true }, Date.now(), source.selectors?.preserveFragment)));
			if (this.stopped || signal.aborted) throw new Error('news.stopped');
			return materials;
		});
	}
	private queueCollection<T>(work: () => Promise<T>): Promise<T> {
		const slot = this.collectionSlot;
		this.collectionSlot = (slot + 1) % this.collectionTails.length;
		const task = this.collectionTails[slot]!.then(work);
		this.collectionTails[slot] = task.then(() => undefined, () => undefined);
		return task;
	}
	private async collect(sources: readonly NewsSource[], now = Date.now()): Promise<void> {
		const generation = this.collectionGeneration;
		const results = await Promise.allSettled(sources.map(source => this.refreshSource(source, now)));
		if (this.stopped || !this.settings().enabled || generation !== this.collectionGeneration) return;
		if (sources.length === 1 && results[0]?.status === 'rejected') throw results[0].reason;
		if (sources.length) await this.compileEdition(now);
	}
	private healthFor(source: NewsSource): NewsSourceHealth {
		const previous = this.data.health[source.id];
		if (previous?.configHash !== configHash(source)) return { failureCount: 0, initializedAt: Date.now(), configHash: configHash(source) };
		const adaptive = this.settings().adaptiveInterval !== false;
		const scheduleKey = `${adaptive}:${source.intervalMinutes}:${source.participation}`;
		if (previous.scheduleKey === scheduleKey) return previous;
		const intervalMinutes = adaptive ? nextAdaptiveIntervalMinutes(source, this.dailyRate(source.id)) : source.intervalMinutes;
		const interval = previous.failureCount ? sourceBackoffMinutes(intervalMinutes, previous.failureCount - 1) : intervalMinutes;
		return { ...previous, scheduleKey, intervalMinutes, ...(previous.lastAttempt === undefined || previous.nextDue === undefined ? {} : { nextDue: previous.lastAttempt + interval * 60_000 }) };
	}
	private currentSource(source: NewsSource, generation: number): boolean {
		return generation === this.collectionGeneration && !this.stopped && this.settings().enabled && this.sources().some(item => item.id === source.id && item.enabled && configHash(item) === configHash(source));
	}
	private dailyRate(sourceId: string, materials = this.data.materials, now = Date.now()): number {
		return materials.filter(item => item.sourceId === sourceId && !item.backfillReason && item.discoveredAt > now - 7 * 86_400_000 && item.discoveredAt <= now).length / 7;
	}
	private async setHealth(sourceId: string, health: NewsSourceHealth): Promise<void> {
		const next = { ...this.data.health, [sourceId]: health };
		await this.saveReader({ health: next });
		this.data = { ...this.data, health: next };
		this.emit();
	}
	private refreshSource(configured: NewsSource, now: number): Promise<void> {
		const source = { ...configured, ...(configured.selectors ? { selectors: { ...configured.selectors } } : {}) };
		const existing = this.inFlight.get(source.id);
		if (existing) return existing;
		const generation = this.collectionGeneration, signal = this.collectionAbort.signal;
		const task = this.queueCollection(async () => {
			if (this.currentSource(source, generation) && sourceDue(this.healthFor(source), now)) await this.fetchOne(source, generation, signal);
		}).finally(() => {
			if (this.inFlight.get(source.id) === task) { this.inFlight.delete(source.id); this.emit(); }
		});
		this.inFlight.set(source.id, task);
		this.emit();
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
	private async fetchOne(source: NewsSource, generation: number, signal: AbortSignal): Promise<void> {
		const previousHealth = this.healthFor(source);
		await this.exclusive(async () => {
			if (!this.currentSource(source, generation)) return;
			const attempted = { ...previousHealth, lastAttempt: Date.now(), configHash: configHash(source) };
			await this.setHealth(source.id, attempted);
		});
		if (!this.currentSource(source, generation)) return;
		try {
			const response = await this.fetcher.fetch(source, {
				...(previousHealth.etag ? { 'If-None-Match': previousHealth.etag } : {}),
				...(previousHealth.lastModified ? { 'If-Modified-Since': previousHealth.lastModified } : {}),
			}, signal);
			await this.exclusive(async () => {
				if (!this.currentSource(source, generation)) return;
				if (response.status === 304) {
					await this.setHealth(source.id, markSourceAttempt(previousHealth, source, Date.now(), true, this.dailyRate(source.id), this.settings().adaptiveInterval !== false));
					return;
				}
				if (response.status < 200 || response.status >= 300) throw new Error(`news.http.${response.status}`);
				const entries = this.entriesFor(source, response.text);
				let materials = this.data.materials.slice();
				for (const entry of entries) {
					const canonical = canonicalNewsUrl(entry.url, source.selectors?.preserveFragment === true);
					const previous = materials.find((item) => item.canonicalKey === canonical || (item.sourceId === source.id && item.sourceItemId === entry.sourceItemId));
					const next = await upsertMaterial(previous, { ...entry, initialImport: previousHealth.lastSuccess === undefined }, Date.now(), source.selectors?.preserveFragment === true);
					if (!this.currentSource(source, generation)) return;
					materials = previous ? materials.map((item) => (item.id === previous.id ? next : item)) : [...materials, next];
				}
				const health = markSourceAttempt(previousHealth, source, Date.now(), true, this.dailyRate(source.id, materials), this.settings().adaptiveInterval !== false);
				const before = this.data;
				this.data = {
					...this.data,
					materials,
					health: { ...this.data.health, [source.id]: { ...health, ...(response.etag ? { etag: response.etag } : {}), ...(response.lastModified ? { lastModified: response.lastModified } : {}) } },
				};
				try { await this.persist(); } catch (error) { this.data = before; throw error; }
			});
		} catch (error) {
			await this.exclusive(async () => {
				if (!this.currentSource(source, generation)) return;
				const message = error instanceof Error ? error.message : '';
				const lastError = /^news\.(?:http\.\d{3}|timeout|tooLarge|list\.(?:no_matches|invalid_selector))$/.test(message) ? message : 'news.source.failed';
				await this.setHealth(source.id, { ...markSourceAttempt(previousHealth, source, Date.now(), false, 0, this.settings().adaptiveInterval !== false), configHash: configHash(source), lastError });
			});
			throw error;
		}
	}
	/** One stable Markdown note. The annotation survives refresh and a cache clear. */
	async saveFavorite(material: NewsMaterial, notes: string): Promise<void> {
		await this.ready;
		if (this.stopped) throw new Error('news.stopped');
		await this.notebook.save(material, notes, this.analyses().find(item => item.materialId === material.id), this.data.stories.find(item => item.materialIds.includes(material.id))?.id);
	}
	async favoriteNotes(id: string): Promise<string> {
		return this.notebook.notes(id);
	}
	/**
	 * One brief from already analyzed reports. A failed write leaves the previous note in place.
	 * The runner call counts against the same budget as analysis.
	 */
	async writeBrief(storyId: string, runner: { run(prompt: string): Promise<AgentPromptResult> }, budget = this.settings().dailyCallLimit ?? 20, retryRunId?: string): Promise<NewsBriefResult> {
		await this.ready;
		const id = this.story(storyId)?.id ?? storyId;
		const active = this.briefTasks.get(id);
		if (active) return active;
		const task = this.writeBriefNow(id, runner, budget, retryRunId).finally(() => this.briefTasks.delete(id));
		this.briefTasks.set(id, task);
		return task;
	}
	async resumeBrief(runId: string): Promise<NewsBriefResult> {
		await this.ready;
		const run = this.run(runId);
		if (this.stopped || run?.receipt?.kind !== 'brief' || run.receipt.state !== 'received') return { status: 'failed', runId, calls: 0 };
		return { ...await this.applyBrief(run), runId, calls: 0 };
	}
	private async writeBriefNow(storyId: string, runner: { run(prompt: string): Promise<AgentPromptResult> }, budget: number, retryRunId?: string): Promise<NewsBriefResult> {
		const skipped = { status: 'failed' as const, runId: '', calls: 0 };
		if (this.stopped || !this.settings().enabled || this.settings().analysisEnabled === false) return skipped;
		const story = this.story(storyId);
		if (!story) return skipped;
		const latest = this.runHistory().find(run => run.receipt?.kind === 'brief' && (this.story(run.storyId ?? '')?.id ?? run.storyId) === story.id);
		if (latest?.receipt?.state === 'received') return this.resumeBrief(latest.id);
		if (latest?.receipt?.state === 'interrupted' && retryRunId !== latest.id) return { status: 'needs-attention', runId: latest.id, calls: 0 };
		const analyses = new Map(this.analyses().map(item => [item.materialId, item]));
		const materials = story.materialIds.flatMap(id => {
			const material = this.data.materials.find(item => item.id === id);
			return material && !material.withdrawn && !this.isHidden(id) && analyses.has(id) && analyses.get(id)!.relevance !== 'BLOCK' ? [material] : [];
		}).sort((a, b) => Number(b.id === story.representativeId) - Number(a.id === story.representativeId) || (b.publishedAt ?? b.discoveredAt) - (a.publishedAt ?? a.discoveredAt));
		if (!materials.length) return skipped;
		const batchId = crypto.randomUUID();
		const plan = briefPlan(story.title, materials.map(material => ({
			id: material.id, title: material.title, url: material.originalUrl,
			summary: materialBody(material),
			source: this.sources().find(item => item.id === material.sourceId)?.name ?? material.sourceId,
		})), this.settings().interest ?? '', this.settings().templates, this.settings().vocabulary);
		if (!plan) return skipped;
		const receipt = await this.journal.call({ kind: 'brief', batchId, sample: 0, attempt: 0, agentId: this.settings().agentId,
			brief: { storyId: story.id, title: story.title, urls: plan.urls, materialId: materials[0]!.id },
		}, budget, () => this.stopped ? Promise.resolve({ status: 'cancelled', text: '' }) : runner.run(plan.prompt));
		if (receipt.result.errorCode === 'newsBudget') return { status: 'budget', runId: '', calls: 0 };
		if (receipt.result.status !== 'succeeded') return { status: 'failed', runId: receipt.runId, calls: receipt.calls };
		const applied = await this.applyBrief(this.run(receipt.runId)!);
		return { ...applied, runId: receipt.runId, calls: receipt.calls };
	}
	private async applyBrief(run: NewsRun): Promise<{ status: 'complete' | 'needs-attention' | 'failed'; path?: string }> {
		const receipt = run.receipt!, brief = receipt.brief!, body = receipt.result?.text ?? '';
		if (!briefDocument(body, brief.urls)) {
			await this.journal.finish(receipt.batchId, 'failed', 'briefInvalid');
			return { status: 'needs-attention' };
		}
		try {
			if (this.stopped) throw new Error('news.stopped');
			const story = this.story(brief.storyId);
			const path = await this.notebook.saveBrief(story?.id ?? brief.storyId, brief.title, body, story?.aliases);
			await this.journal.finish(receipt.batchId, 'applied');
			return { status: 'complete', path };
		} catch {
			// A received answer stays recoverable if its Markdown could not be saved.
			if (!this.stopped) await this.journal.attention(receipt.batchId, 'briefSaveFailed');
			return { status: 'failed' };
		}
	}

	/** Drop collected cache. Favorite notes stay on disk. */
	async clearCache(): Promise<void> {
		await this.ready;
		await this.exclusive(async () => {
			this.data = { ...this.data, ...emptyEvents(), materials: [], health: {}, analyses: [], heat: [] };
			await this.persist();
		});
		await this.journal.retireObsolete([]);
	}
	analyze(runner: AnalysisRunner, budget = this.settings().dailyCallLimit ?? 20, retryIds: ReadonlySet<string> = new Set(), forceIds: ReadonlySet<string> = new Set()): Promise<AnalysisRun> {
		if (this.analysisTask) return this.analysisTask;
		const task = this.analyzeNow(runner, budget, retryIds, forceIds).finally(() => { if (this.analysisTask === task) this.analysisTask = undefined; });
		this.analysisTask = task;
		return task;
	}
	private async applyBatch(fresh: readonly NewsAnalysis[], batchId: string): Promise<void> {
		await this.exclusive(async () => {
			const current = fresh.filter(analysis => this.materials().some(material => material.id === analysis.materialId && material.revision === analysis.revision && material.contentHash === analysis.contentHash));
			const analyses = [...this.data.analyses.filter(item => !current.some(next => next.materialId === item.materialId)), ...current];
			await this.analysesFile.save({ version: 1, items: analyses });
			const events = groupMaterials(this.materials(), current, this.events());
			await this.eventsFile.save({ version: 1, items: events });
			this.data = { ...this.data, ...events, analyses };
			this.emit();
		});
		await this.journal.finish(batchId, 'applied');
	}
	private async analyzeNow(runner: AnalysisRunner, budget: number, retryIds: ReadonlySet<string>, forceIds: ReadonlySet<string>): Promise<AnalysisRun> {
		await this.ready;
		if (this.stopped || !this.settings().enabled || this.settings().analysisEnabled === false) return { status: 'failed', analyses: [...this.analyses()], spent: this.journal.spent(), calls: 0 };
		const materials = forceIds.size ? this.materials().filter(item => forceIds.has(item.id)) : this.materials();
		await this.journal.retireObsolete(this.materials());
		const recovery = this.journal.resume(retryIds, materials, this.analyses());
		recovery.resume = recovery.resume.filter(item => !item.plan.materials.some(material => forceIds.has(material.id)));
		for (const id of forceIds) recovery.blockedIds.delete(id);
		let actualCalls = 0;
		const tracked: AnalysisRunner = {
			close: id => runner.close?.(id) ?? Promise.resolve(),
			run: async (prompt, call) => {
				let answer: AgentPromptResult | undefined;
				try {
					const receipt = await this.journal.call({ kind: 'analysis', batchId: call.batchId, plan: call.plan, sample: call.sample, attempt: call.attempt, agentId: this.settings().agentId }, budget, async () => {
						answer = this.stopped ? { status: 'cancelled', text: '' } : await runner.run(prompt, call);
						return answer;
					});
					actualCalls += receipt.calls;
					return receipt.result;
				} catch (error) { if (answer?.terminalId) await runner.close?.(answer.terminalId); throw error; }
			},
		};
		const settings = this.settings();
		const result = await runMaterialAnalysis(materials, this.analyses(), tracked, Infinity, 0, Date.now(), {
			...settings, ...recovery, forceIds,
			candidatesFor: batch => recallCandidates(batch, this.materials(), this.analyses(), this.events(), Date.now(), settings.groupingRules),
			onBatch: (fresh, id) => this.applyBatch(fresh, id), onFailure: (id, code) => this.journal.finish(id, 'failed', code),
		});
		const grouping = result.status === 'complete' || result.status === 'needs-attention' ? await reviewGroups(this.groupReviewPort(), this.journal, runner, this.settings(), budget, new Set([...retryIds, ...forceIds])) : { status: 'complete' as const, calls: 0 };
		if (!this.stopped) await this.compileEdition();
		return { ...result, ...(grouping.status !== 'complete' ? { status: grouping.status } : {}), analyses: [...this.analyses()], spent: this.journal.spent(), calls: actualCalls + grouping.calls, ...(result.status === 'complete' && recovery.blockedIds.size ? { status: 'needs-attention' as const, errorCode: 'outcomeUnknown' } : {}) };
	}

	async shutdown(): Promise<void> {
		this.stopped = true;
		this.collectionAbort.abort();
		await Promise.allSettled([...this.briefTasks.values(), ...(this.analysisTask ? [this.analysisTask] : [])]);
		await this.journal.flush();
		await this.notebook.dispose();
		this.activities.clear();
		this.listeners.clear();
		await this.tail;
		await Promise.all([this.materialsFile.flush(), this.analysesFile.flush(), this.eventsFile.flush(), this.heatFile.flush(), this.runsFile.flush(), this.readerFile.flush()]);
	}
}
