import { ContactsError, type RecordKind } from './model';

export const archiveEntryName = '基本信息.md';
export const archiveCategories: Record<RecordKind, string> = { person: '个人档案', company: '企业档案' };
export function archiveLocation(root: string, path: string): { kind: RecordKind; folderPath: string } | null {
	if (!path.startsWith(root + '/')) return null;
	const parts = path.slice(root.length + 1).split('/');
	if (parts.length !== 3 || !parts[1] || parts[2] !== archiveEntryName) return null;
	const kind = (Object.keys(archiveCategories) as RecordKind[]).find((key) => archiveCategories[key] === parts[0]);
	return kind ? { kind, folderPath: path.slice(0, -archiveEntryName.length - 1) } : null;
}
/** A single visible, portable path segment, including Windows device-name protection. */
export function safeArchiveName(input: string): string {
	let name = [...input.trim()]
		.map((char) => (char.charCodeAt(0) < 32 ? '-' : char))
		.join('')
		.replace(/[\\/:*?"<>|#^[\]]/g, '-')
		.replace(/^[. ]+|[. ]+$/g, '');
	if (!name) throw new ContactsError('invalidName');
	if (/^(con|prn|aux|nul|conin\$|conout\$|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i.test(name)) name = '_' + name;
	return [...name]
		.slice(0, 120)
		.join('')
		.replace(/[. ]+$/g, '');
}
export interface ArchiveResource {
	path: string;
	relativePath: string;
	name: string;
	extension: string;
	size: number;
	modified: number;
}
export interface ArchiveFolderEntry {
	path: string;
	folder: boolean;
	size: number;
	modified: number;
}
export interface ArchiveDeletion {
	id: string;
	path: string;
	folderPath: string;
	raw: string;
	fingerprint: string;
	resources: number;
}
export interface ArchiveImport {
	name: string;
	read(): Promise<ArrayBuffer>;
}
export interface ArchiveImportResult {
	name: string;
	path?: string;
	error?: string;
}
export function folderFingerprint(entries: ArchiveFolderEntry[]): string {
	return JSON.stringify(
		entries
			.map((entry) => [entry.path, entry.folder, entry.size, entry.modified])
			.sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
	);
}
export function queryResources(
	resources: ArchiveResource[],
	search: string,
	sort: 'modified' | 'name',
): ArchiveResource[] {
	const term = search.trim().toLocaleLowerCase();
	return resources
		.filter((resource) => resource.relativePath.toLocaleLowerCase().includes(term))
		.sort(
			(a, b) =>
				(sort === 'modified'
					? b.modified - a.modified
					: a.name.localeCompare(b.name, undefined, { numeric: true })) ||
				a.relativePath.localeCompare(b.relativePath),
		);
}
export function normalizeValues(values: string[]): string[] {
	return [
		...new Set(
			values
				.flatMap((value) => value.split(/\r?\n/))
				.map((value) => value.trim())
				.filter(Boolean),
		),
	];
}
