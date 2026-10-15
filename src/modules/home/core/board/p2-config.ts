// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/parser.ts
import type { RssConfig, RssFeedSource, TickTickConfig } from './types';
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
export function parseRssConfig(raw: Record<string, unknown>): RssConfig {
	const feeds: RssFeedSource[] = [];
	if (Array.isArray(raw.feeds)) {
		for (const entry of raw.feeds) {
			if (typeof entry !== 'object' || entry === null) continue;
			const rec = entry as Record<string, unknown>;
			const url = str(rec.url ?? '').trim();
			if (!url) continue;
			const name = str(rec.name ?? '').trim();
			const group = str(rec.group ?? '').trim();
			feeds.push({
				...(name ? { name } : {}),
				url,
				...(group ? { group } : {}),
			});
		}
	}
	const downloadFolder = str(raw.downloadFolder ?? '')
		.trim()
		.replace(/^\/+|\/+$/g, '');
	const groups = (Array.isArray(raw.groups) ? raw.groups : [])
		.map((g: unknown) => str(g).trim())
		.filter((g: string) => g.length > 0);
	const groupByRaw = str(raw.groupBy ?? '');
	const groupBy = groupByRaw === 'none' || groupByRaw === 'feed' ? groupByRaw : undefined;
	const pageSizeRaw = typeof raw.pageSize === 'number' ? raw.pageSize : undefined;
	const pageSize =
		pageSizeRaw != null && [10, 20, 50, 100].includes(pageSizeRaw) && pageSizeRaw !== 20 ? pageSizeRaw : undefined;
	return {
		feeds,
		downloadFolder,
		...(groups.length > 0 ? { groups } : {}),
		...(groupBy ? { groupBy } : {}),
		...(pageSize ? { pageSize } : {}),
	};
}

export function parseTickTickConfig(raw: Record<string, unknown>): TickTickConfig {
	const view: TickTickConfig['view'] = raw['view'] === 'lists' ? 'lists' : 'today';
	const hiddenProjects = Array.isArray(raw['hiddenProjects'])
		? (raw['hiddenProjects'] as Array<unknown>)
				.map((v) => String(v as string | number | boolean))
				.filter((v) => v.length > 0)
		: undefined;
	const widths = raw.projectWidths && typeof raw.projectWidths === 'object' ? raw.projectWidths : {};
	const projectWidths = Object.fromEntries(
		Object.entries(widths)
			.filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]))
			.map(([id, width]) => [id, Math.max(200, Math.min(500, width))]),
	);
	return {
		view,
		hiddenProjects: hiddenProjects?.length ? hiddenProjects : undefined,
		...(Object.keys(projectWidths).length ? { projectWidths } : {}),
	};
}
