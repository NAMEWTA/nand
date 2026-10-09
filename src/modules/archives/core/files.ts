import type { ArchiveFolderEntry } from './resources';
/** File identity is stable during a rename; the adapter owns the actual file objects. */
export interface ContactsFile {
	readonly path: string;
	readonly extension: string;
	readonly stat: { mtime: number; size: number };
}
export interface ContactsFiles {
	readonly formatGuide: string;
	ready(): Promise<void>;
	getMarkdownFiles(): ContactsFile[];
	getFileByPath(path: string): ContactsFile | null;
	getAbstractFileByPath(path: string): unknown;
	read(file: ContactsFile): Promise<string>;
	cachedRead(file: ContactsFile): Promise<string>;
	process(file: ContactsFile, update: (latest: string) => string): Promise<string>;
	create(path: string, content: string): Promise<ContactsFile>;
	createBinary(path: string, content: ArrayBuffer): Promise<ContactsFile>;
	listFolder(path: string): ArchiveFolderEntry[];
	trashFolder(path: string): Promise<void>;
	checkFolderEditors(path: string): Promise<void>;
	createFolder(path: string): Promise<void>;
	mkdir(path: string): Promise<void>;
	checkEditor(file: ContactsFile, disk: string): void;
}
