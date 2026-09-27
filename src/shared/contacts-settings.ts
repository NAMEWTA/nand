/** Only UI preferences live in plugin settings. All archive data lives in Markdown. */
export interface ContactsSettings {
	rootFolder: string;
	maxColumns: 5 | 6;
}
export const DEFAULT_CONTACTS_SETTINGS: ContactsSettings = { rootFolder: '档案', maxColumns: 6 };

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
	return {
		rootFolder: validContactsFolder(root) ? root : DEFAULT_CONTACTS_SETTINGS.rootFolder,
		maxColumns: value.maxColumns === 5 ? 5 : 6,
	};
}
