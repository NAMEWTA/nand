import type { DashboardSettings } from './types/model';
/** Instance identities are durable; an empty family opens its configuration. */
export function widgetChoices(
	settings: DashboardSettings,
	keys: readonly string[],
): { key: string; kind: string; instanceId?: string; label?: string }[] {
	return keys.flatMap((key) => {
		const kind = key === 'quickActions' ? 'quick-actions' : key === 'yearProgress' ? 'year-progress' : key;
		const entries =
			key === 'countdown' ? settings.countdowns : key === 'anniversary' ? settings.anniversaries : undefined;
		return entries
			? entries.length
				? entries.map((entry) => ({ key, kind, instanceId: entry.id, label: entry.label }))
				: [{ key, kind }]
			: [{ key, kind, instanceId: 'default' }];
	});
}
