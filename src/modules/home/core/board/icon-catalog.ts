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
const isPreferred = (id: string) => preferred.has(id.replace(/^lucide-/, ''));

/** Keep the host's complete authority list so native fuzzy search can rank before limiting. */
export function orderedHostIcons(hostIds: readonly string[]): string[] {
	return [...new Set(hostIds)].sort((a, b) => Number(isPreferred(b)) - Number(isPreferred(a)) || a.localeCompare(b));
}
