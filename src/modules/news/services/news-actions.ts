import type { AgentPromptRunner, AgentSessionsPort } from '../../agent/api';
import type { BrowserOpener } from '../../browser/api';
import type { NotificationInbox } from '../../notifications/api';
import { t } from '../../../shared/i18n';
import type { SettingsHandle } from '../../../shared/settings/store';
import { newsNotificationId } from '../contrib/notifications';
import { buildDailyEdition } from '../core/edition';
import { normalizeNewsSource, type NewsEdition, type NewsMaterial } from '../core/model';
import { importOpml } from '../platform/opml';
import type { NewsSettings } from '../settings';
import type { NewsService } from './news-service';

export interface NewsPorts {
	sessions?: () => AgentSessionsPort | undefined;
	browser?: () => BrowserOpener | undefined;
	inbox?: () => NotificationInbox | undefined;
}

export interface NewsActions {
	enable(): Promise<void>;
	addSource(url: string): Promise<boolean>;
	importOpml(xml: string): Promise<number>;
	favorite(material: NewsMaterial, notes: string): Promise<void>;
	analyze(): Promise<string>;
	edition(): NewsEdition | undefined;
	brief(storyId: string): Promise<{ status: string; runId: string; path?: string; calls: number }>;
	publish(runId: string): Promise<void>;
	openOriginal(url: string): Promise<boolean>;
	attach(sessionId: string, material: NewsMaterial): Promise<void>;
	sessions(): Promise<{ id: string; title: string }[]>;
	hide(id: string): Promise<void>;
	markRead(id: string): Promise<void>;
	isHidden(id: string): boolean;
	isRead(id: string): boolean;
}

function sourceId(url: string): string {
	let hash = 2166136261;
	for (const char of url) {
		hash ^= char.codePointAt(0) ?? 0;
		hash = Math.imul(hash, 16777619);
	}
	return `feed-${(hash >>> 0).toString(16)}`;
}

/** Page and settings actions. Refresh stays on the service after collection is enabled. */
export function newsActions(
	service: NewsService,
	settings: SettingsHandle<NewsSettings>,
	runner: () => AgentPromptRunner | undefined,
	ports: NewsPorts = {},
): NewsActions {
	const publish = async (runId: string): Promise<void> => {
		const run = service.run(runId);
		if (!run || (run.status !== 'complete' && run.status !== 'failed')) return;
		const inbox = ports.inbox?.();
		if (!inbox) return;
		await inbox
			.send({
				id: newsNotificationId(run.id, run.status),
				title: t(run.status === 'complete' ? 'news.briefSaved' : 'news.briefFailed'),
				body: run.status,
				channels: ['in-app'],
			})
			.catch(() => undefined);
	};
	return {
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
			if (current.sources.some((source) => source.url === trimmed)) return false;
			const source = normalizeNewsSource({
				id: sourceId(trimmed),
				name: trimmed,
				url: trimmed,
				type: 'rss',
				enabled: true,
				tier: 'other',
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
			return imported.sources.length;
		},
		favorite(material, notes) {
			return service.saveFavorite(material, notes);
		},
		async analyze() {
			const promptRunner = runner();
			if (!promptRunner || !settings.get().enabled) return 'failed';
			const result = await service.analyze({ run: (prompt) => promptRunner.run({ prompt, purpose: 'news-analysis' }) });
			return result.status;
		},
		edition() {
			if (!settings.get().dailyEditionEnabled) return undefined;
			return buildDailyEdition(service.materials(), service.analyses(), service.stories());
		},
		async brief(storyId) {
			const promptRunner = runner();
			if (!promptRunner) return { status: 'failed', runId: '', calls: 0 };
			const result = await service.writeBrief(storyId, { run: (prompt) => promptRunner.run({ prompt, purpose: 'news-brief' }) });
			await publish(result.runId);
			return result;
		},
		publish,
		async openOriginal(url) {
			const browser = ports.browser?.();
			if (!browser) return false;
			await browser.open({ url });
			return true;
		},
		async attach(sessionId, material) {
			const sessions = ports.sessions?.();
			if (!sessions) return;
			await sessions.attachMaterial(sessionId, {
				title: material.title,
				text: `${material.title}\n${material.originalUrl}\n${material.summary || material.body || ''}`,
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
