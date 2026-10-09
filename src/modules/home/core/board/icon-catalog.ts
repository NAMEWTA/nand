/** Icons offered first. The picker still lists every host id the caller passes. */
export const PREFERRED_ICONS: readonly string[] = [
	'file-plus', 'file-text', 'notebook', 'notebook-pen', 'sticky-note', 'folder', 'folder-plus', 'bookmark', 'pin', 'tag', 'hash',
	'calendar', 'calendar-days', 'calendar-plus', 'clock', 'alarm-clock', 'sun', 'moon', 'cloud-sun',
	'pencil', 'edit', 'pen-line', 'feather', 'lightbulb', 'brain', 'sparkles', 'quote', 'zap', 'rocket',
	'book-open', 'book-plus', 'camera', 'image', 'mic', 'music', 'film', 'link',
	'list', 'list-checks', 'check-square', 'checkbox', 'target', 'flag', 'flame', 'award', 'trophy', 'star', 'heart',
	'coffee', 'utensils', 'dumbbell', 'briefcase', 'shopping-cart', 'map-pin', 'compass', 'plane', 'gift', 'leaf', 'droplet', 'palette',
	'user', 'users', 'mail', 'message-circle', 'phone', 'bell', 'eye',
	'home', 'search', 'plus', 'plus-circle', 'settings', 'settings-2',
];

const preferred = new Set(PREFERRED_ICONS);

/**
 * Host icon names, preferred ones first, at most `limit` rows.
 * An empty host list still offers the preferred names, so the picker works with the icons module off.
 */
export function iconPickerRows(hostIds: readonly string[], query: string, limit = 400): string[] {
	const needle = query.trim().toLowerCase();
	const available = hostIds.length ? hostIds : PREFERRED_ICONS;
	const matched: string[] = [];
	const seen = new Set<string>();
	for (const id of available) {
		if (seen.has(id)) continue;
		if (needle && !id.toLowerCase().includes(needle)) continue;
		seen.add(id);
		matched.push(id);
	}
	matched.sort((a, b) => Number(preferred.has(b)) - Number(preferred.has(a)) || a.localeCompare(b));
	return matched.slice(0, Math.max(0, limit));
}
