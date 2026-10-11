export type NewsWidgetMode = 'featured' | 'hot' | 'view';

export interface NewsWidgetConfig {
	id: string;
	mode: NewsWidgetMode;
	name: string;
	count: number;
	showSummary: boolean;
	staleMinutes: number;
	viewId?: string;
}

export function defaultNewsWidgets(): NewsWidgetConfig[] {
	return (['featured', 'hot'] as const).map(mode => ({ id: mode, mode, name: '', count: 8, showSummary: true, staleMinutes: 60 }));
}

export function normalizeNewsWidgets(raw: unknown): NewsWidgetConfig[] {
	if (!Array.isArray(raw)) return defaultNewsWidgets();
	const seen = new Set<string>();
	return raw.flatMap((value: unknown) => {
		if (!value || typeof value !== 'object') return [];
		const item = value as Partial<NewsWidgetConfig>;
		if (typeof item.id !== 'string' || !item.id || seen.has(item.id) || !['featured', 'hot', 'view'].includes(item.mode ?? '')) return [];
		seen.add(item.id);
		const integer = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.max(min, Math.min(max, value))) : fallback;
		return [{ id: item.id, mode: item.mode as NewsWidgetMode, name: typeof item.name === 'string' ? item.name.trim() : '',
			count: integer(item.count, 8, 1, 50), showSummary: item.showSummary !== false, staleMinutes: integer(item.staleMinutes, 60, 15, 1440),
			...(item.mode === 'view' && typeof item.viewId === 'string' ? { viewId: item.viewId } : {}),
		}];
	});
}
