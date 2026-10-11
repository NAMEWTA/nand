import type { AgentDirectory, AgentDirectoryEntry, AgentPromptRequest, AgentPromptRunner, AgentSessionsPort } from '../../agent/api';
import type { BrowserOpener } from '../../browser/api';
import type { NotificationInbox } from '../../notifications/api';
import { t } from '../../../shared/i18n';
import type { SettingsHandle } from '../../../shared/settings/store';
import { newsNotificationId } from '../contrib/notifications';
import { normalizeNewsSource, type NewsBriefResult, type NewsEdition, type NewsFilter, type NewsMaterial, type NewsSource, type NewsSourceHealth } from '../core/model';
import { normalizeNewsView } from '../core/views';
import { exportOpml, feedId, importOpml, sourceUrlKey, type OpmlImport } from '../platform/opml';
import type { NewsSettings } from '../settings';
import type { NewsService } from './news-service';

export interface NewsPorts {
	currentRunner?: () => AgentPromptRunner | undefined;
	watchRunner?: (listener: () => void) => () => void;
	directory?: () => AgentDirectory | undefined;
	sessions?: () => AgentSessionsPort | undefined;
	browser?: () => BrowserOpener | undefined;
	inbox?: () => NotificationInbox | undefined;
	openNote?: (path: string) => Promise<void>;
}

export interface NewsActions {
	agents(): readonly AgentDirectoryEntry[];
	cancelAnalysis(): void;
	openAnalysisTerminal(id: string): Promise<void>;
	isTerminalRetained(id: string): boolean;
	retryAnalysis(runId: string): Promise<string>;
	reanalyze(materialId: string): Promise<string>;
	dispose(): Promise<void>;
	enable(): Promise<void>;
	addSource(url: string): Promise<boolean>;
	importOpml(xml: string): Promise<Pick<OpmlImport, 'added' | 'skipped' | 'invalid'>>;
	exportOpml(): string;
	saveSource(source: NewsSource): Promise<void>;
	removeSource(id: string): Promise<void>;
	previewSource(source: NewsSource): Promise<NewsMaterial[]>;
	refreshSource(id: string): Promise<void>;
	health(id: string): NewsSourceHealth | undefined;
	subscribe(listener: () => void): () => void;
	favorite(material: NewsMaterial, notes: string): Promise<void>;
	analyze(): Promise<string>;
	edition(): NewsEdition;
	compileEdition(): Promise<NewsEdition>;
	saveView(id: string | undefined, name: string, filter: NewsFilter): Promise<string>;
	removeView(id: string): Promise<void>;
	brief(storyId: string, retryRunId?: string): Promise<NewsBriefResult>;
	resumeBrief(runId: string): Promise<NewsBriefResult>;
	openNote(path: string): Promise<void>;
	publish(runId: string): Promise<void>;
	openOriginal(url: string): Promise<boolean>;
	attach(sessionId: string, material: NewsMaterial): Promise<void>;
	sessions(): Promise<{ id: string; title: string }[]>;
	hide(id: string): Promise<void>;
	markRead(id: string): Promise<void>;
	isHidden(id: string): boolean;
	isRead(id: string): boolean;
}

/** Page and settings actions. Refresh stays on the service after collection is enabled. */
export function newsActions(
	service: NewsService,
	settings: SettingsHandle<NewsSettings>,
	runner: () => AgentPromptRunner | undefined | Promise<AgentPromptRunner | undefined>,
	ports: NewsPorts = {},
): NewsActions {
	let disposed = false;
	const aborts = new Set<AbortController>();
	const running = new Set<Promise<unknown>>();
	const retained = new Map<string, AgentPromptRunner>();
	const runPrompt = async (promptRunner: AgentPromptRunner, request: AgentPromptRequest, keep: boolean) => {
		const result = await promptRunner.run(request);
		if (result.terminalId) {
			retained.delete(result.terminalId);
			if (keep && result.status === 'succeeded') {
				if (disposed || request.signal?.aborted) await promptRunner.close?.(result.terminalId);
				else retained.set(result.terminalId, promptRunner);
			}
		}
		return result;
	};
	const owned = <T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> => {
		const abort = new AbortController();
		aborts.add(abort);
		const task = Promise.resolve().then(() => work(abort.signal)).finally(() => { aborts.delete(abort); running.delete(task); });
		running.add(task);
		return task;
	};
	const publish = async (runId: string): Promise<void> => {
		const run = service.run(runId);
		if (!run || !['complete', 'failed', 'cancelled', 'interrupted', 'timeout', 'needs-attention'].includes(run.status)) return;
		const outcome = run.status === 'complete' ? 'complete' : 'failed', config = settings.get();
		if (config.notifyOn === 'never' || outcome === 'complete' && config.notifyOn !== 'always') return;
		const inbox = ports.inbox?.();
		if (!inbox) return;
		const channels = (config.notificationChannels ?? ['in-app']).filter(channel => inbox.available(channel));
		if (!channels.length) return;
		await inbox
			.send({
				id: newsNotificationId(run.id, outcome),
				title: t(run.receipt?.kind === 'brief' ? outcome === 'complete' ? 'news.briefSaved' : 'news.briefFailed' : outcome === 'complete' ? 'news.notification.complete' : 'news.notification.failed'),
				body: t(`news.run.${run.status}`),
				channels,
			})
			.catch(() => undefined);
	};
	const analyze = (retryIds: ReadonlySet<string> = new Set(), forceIds: ReadonlySet<string> = new Set()): Promise<string> => {
		if (disposed || !settings.get().enabled) return Promise.resolve('failed');
		return owned(async signal => {
			if (signal.aborted) return 'failed';
			const promptRunner = await runner();
			if (!promptRunner || signal.aborted) return 'failed';
			const config = settings.get(), activityId = crypto.randomUUID();
			const deadlines = new Map<string, number>();
			const previousRuns = new Set(service.runHistory().map(run => run.id));
			try {
				const result = await service.analyze({
					run: async (prompt, call) => {
						const now = performance.now(), deadline = deadlines.get(call.batchId) ?? now + (config.batchTimeoutMinutes ?? 10) * 60_000;
						deadlines.set(call.batchId, deadline);
						const timeoutMs = Math.ceil(deadline - now);
						if (timeoutMs <= 0) {
							if (call.continueTerminalId) { retained.delete(call.continueTerminalId); await promptRunner.close?.(call.continueTerminalId); }
							return { status: 'timeout', text: '', errorCode: 'newsBatchTimeout' };
						}
						return runPrompt(promptRunner, { prompt, purpose: 'news-analysis', signal, agentId: config.agentId || undefined, cwd: config.cwd || undefined, timeoutMs, keepTerminal: call.keepTerminal, continueTerminalId: call.continueTerminalId, onState: state => service.setRunActivity(activityId, state) }, config.keepTerminal === true);
					},
					close: async id => { if (!retained.has(id) || signal.aborted || disposed) { retained.delete(id); await promptRunner.close?.(id); } },
				}, config.dailyCallLimit ?? 20, retryIds, forceIds);
				const lastRun = service.runHistory().find(run => !previousRuns.has(run.id) && (result.status === 'complete' || run.status !== 'complete'));
				if (lastRun && !signal.aborted) await publish(lastRun.id);
				return result.status;
			} finally { service.setRunActivity(activityId); }
		});
	};
	return {
		agents: () => ports.directory?.()?.list() ?? [],
		reanalyze: id => analyze(new Set(), new Set([id])),
		cancelAnalysis: () => { for (const abort of aborts) abort.abort(); },
		isTerminalRetained: id => { const owner = retained.get(id); return !!owner && (!ports.currentRunner || ports.currentRunner() === owner); },
		async openAnalysisTerminal(id) {
			if (disposed) return;
			const current = await runner(), owner = retained.get(id);
			if (owner && owner !== current) { retained.delete(id); throw new Error(t('news.terminalUnavailable')); }
			await current?.open?.(id);
		},
		retryAnalysis(runId) {
			const receipt = service.run(runId)?.receipt;
			return receipt && (receipt.kind === 'analysis' || receipt.kind === 'grouping') && receipt.state === 'interrupted' ? analyze(new Set([...(receipt.plan?.materials.map(item => item.id) ?? []), ...(receipt.merge ? [receipt.merge.bridgeId] : [])])) : Promise.resolve('failed');
		},
		async dispose() {
			disposed = true;
			for (const abort of aborts) abort.abort();
			await Promise.allSettled([...running]);
			const terminals = [...retained];
			retained.clear();
			await Promise.all(terminals.map(async ([id, owner]) => { await owner.close?.(id); }));
		},
		async enable() {
			if (settings.get().enabled) return;
			await settings.update((draft) => {
				draft.enabled = true;
			});
		},
		async addSource(url) {
			const trimmed = url.trim();
			if (!trimmed) return false;
			const current = settings.get();
			if (current.sources.some((source) => sourceUrlKey(source.url) === sourceUrlKey(trimmed))) return false;
			const source = normalizeNewsSource({
				id: feedId(sourceUrlKey(trimmed)),
				name: trimmed,
				url: trimmed,
				type: 'rss',
				enabled: true,
				tier: 'unlisted',
				participation: 'editorial',
				intervalMinutes: 30,
			});
			if (!source) return false;
			await settings.update((draft) => {
				draft.enabled = true;
				draft.sources = [...draft.sources, source];
			});
			return true;
		},
		async importOpml(xml) {
			const imported = importOpml(xml, settings.get().sources);
			await settings.update((draft) => {
				draft.enabled = true;
				draft.sources = imported.sources;
			});
			return { added: imported.added, skipped: imported.skipped, invalid: imported.invalid };
		},
		exportOpml: () => exportOpml(settings.get().sources),
		async saveSource(value) {
			const source = normalizeNewsSource(value);
			if (!source) throw new Error('news.source.invalid');
			if (settings.get().sources.some(item => item.id !== source.id && sourceUrlKey(item.url) === sourceUrlKey(source.url))) throw new Error('news.source.duplicate');
			await settings.update(draft => { draft.sources = [...draft.sources.filter(item => item.id !== source.id), source]; });
		},
		async removeSource(id) { await settings.update(draft => { draft.sources = draft.sources.filter(item => item.id !== id); }); },
		previewSource: source => service.previewSource(source),
		refreshSource: id => service.refresh(id),
		health: id => service.health(id),
		subscribe: listener => {
			const stopService = service.subscribe(listener), stopRunner = ports.watchRunner?.(listener);
			return () => { stopService(); stopRunner?.(); };
		},
		favorite(material, notes) {
			return service.saveFavorite(material, notes);
		},
		analyze: () => analyze(),
		edition: () => service.dailyEdition(),
		compileEdition: () => service.compileEdition(),
		async saveView(id, name, filter) {
			const view = normalizeNewsView({ ...filter, id: id ?? crypto.randomUUID(), name });
			if (!view) throw new Error('news.view.invalid');
			await settings.update(draft => {
				if (draft.views.length >= 100 && !draft.views.some(item => item.id === view.id)) throw new Error('news.view.limit');
				draft.views = [...draft.views.filter(item => item.id !== view.id), view];
			});
			return view.id;
		},
		async removeView(id) { await settings.update(draft => { draft.views = draft.views.filter(item => item.id !== id); }); },
		async resumeBrief(runId) {
			if (disposed) return { status: 'failed', runId, calls: 0 };
			return owned(async signal => {
				if (signal.aborted) return { status: 'failed', runId, calls: 0 };
				const result = await service.resumeBrief(runId);
				if (!signal.aborted) await publish(result.runId);
				return result;
			});
		},
		async openNote(path) { if (!disposed) await ports.openNote?.(path); },
		async brief(storyId, retryRunId) {
			if (disposed) return { status: 'failed', runId: '', calls: 0 };
			return owned(async signal => {
				if (signal.aborted) return { status: 'failed', runId: '', calls: 0 };
				const promptRunner = await runner();
				if (!promptRunner || signal.aborted) return { status: 'failed', runId: '', calls: 0 };
				const config = settings.get(), activityId = crypto.randomUUID();
				try {
					const result = await service.writeBrief(storyId, { run: prompt => runPrompt(promptRunner, { prompt, purpose: 'news-brief', signal, agentId: config.agentId || undefined, cwd: config.cwd || undefined, timeoutMs: (config.batchTimeoutMinutes ?? 10) * 60_000, keepTerminal: config.keepTerminal === true, onState: state => service.setRunActivity(activityId, state) }, config.keepTerminal === true) }, config.dailyCallLimit ?? 20, retryRunId);
					if (!signal.aborted) await publish(result.runId);
					return result;
				} finally { service.setRunActivity(activityId); }
			});
		},
		publish,
		async openOriginal(url) {
			const browser = ports.browser?.();
			if (!browser) return false;
			try { await browser.open({ url }); return true; } catch { return false; }
		},
		async attach(sessionId, material) {
			const sessions = ports.sessions?.();
			if (!sessions) throw new Error('news.agentUnavailable');
			const analysis = service.analyses().find(item => item.materialId === material.id);
			await sessions.attachMaterial(sessionId, {
				title: analysis?.titleZh || material.title,
				text: `${analysis?.titleZh || material.title}\n${material.originalUrl}\n${(analysis?.summaryZh || material.summary || material.bodyExcerpt).slice(0, 1500)}`,
				files: [],
			});
		},
		async sessions() {
			return (await ports.sessions?.()?.list()) ?? [];
		},
		hide(id) {
			return service.setReaderChoice(id, 'hidden');
		},
		markRead(id) {
			return service.setReaderChoice(id, 'read');
		},
		isHidden(id) {
			return service.isHidden(id);
		},
		isRead(id) {
			return service.isRead(id);
		},
	};
}
