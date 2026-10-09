/** Only UI preferences live in plugin settings. All archive data lives in Markdown. */
export interface ContactsSettings {
	rootFolder: string;
	maxColumns: 5 | 6;
	/** The layout last chosen for each kind. Absent until the user picks one; new pages start from it. */
	layouts: Partial<Record<'person' | 'company', 'list' | 'card'>>;
}
export const DEFAULT_CONTACTS_SETTINGS: ContactsSettings = { rootFolder: '档案', maxColumns: 6, layouts: {} };

export function validContactsFolder(value: string): boolean {
	return (
		!!value.trim() &&
		!/^[\\/]|^[a-z]:/i.test(value) &&
		!value.split(/[\\/]/).some((part) => !part || part.startsWith('.') || /[:*?"<>|]/.test(part))
	);
}
export function normalizeContactsSettings(raw: unknown): ContactsSettings {
	const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const root =
		typeof value.rootFolder === 'string' ? value.rootFolder.trim().replace(/\\/g, '/').replace(/\/$/, '') : '';
	const given = value.layouts && typeof value.layouts === 'object' ? (value.layouts as Record<string, unknown>) : {};
	const layouts: ContactsSettings['layouts'] = {};
	for (const kind of ['person', 'company'] as const)
		if (given[kind] === 'list' || given[kind] === 'card') layouts[kind] = given[kind];
	return {
		rootFolder: validContactsFolder(root) ? root : DEFAULT_CONTACTS_SETTINGS.rootFolder,
		maxColumns: value.maxColumns === 5 ? 5 : 6,
		layouts,
	};
}
