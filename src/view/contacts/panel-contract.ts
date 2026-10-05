import type { ContactsIndex, ContactsQuery } from '../../core/contacts/index-store';
import type { ArchiveRecord, RecordKind } from '../../core/contacts/model';
import type { EditScope } from './forms';
import type { ArchiveResource } from '../../core/contacts/resources';

export type ContactsLayoutMode = 'list' | 'card';
export interface ContactsPanelState {
	query: ContactsQuery;
	page: number;
	selectedPath: string;
	selectedId: string;
	scroll: number;
	/** Section to open after following a search hit. Empty opens the detail as usual. */
	focus: string;
	layout: { person: ContactsLayoutMode; company: ContactsLayoutMode };
	anchors: Record<'person' | 'company', Record<ContactsLayoutMode, string>>;
}
/** A panel can be composed in any workbench without constructing an ItemView. */
export interface ContactsPanelHost {
	state: ContactsPanelState;
	enabled: boolean;
	columns: number;
	controller?: {
		index: ContactsIndex;
		error: string;
		loading: boolean;
		reload(): Promise<void>;
	};
	mountMarkdown(target: HTMLElement, text: string, path: string): () => void;
	select(path: string, focus?: string): void;
	back(): void;
	changeKind(kind: RecordKind): void;
	layout(mode: ContactsLayoutMode): void;
	setScope(value: ContactsQuery['scope']): void;
	search(value: string): void;
	sort(): void;
	page(value: number): void;
	clearFilters(): void;
	filters(): void;
	add(kind: RecordKind): void;
	edit(record: ArchiveRecord, scope: EditScope, id?: string): void;
	deleteRow(record: ArchiveRecord, scope: 'employment' | 'relation', id: string): void;
	more(record: ArchiveRecord): void;
	resources(record: ArchiveRecord): ArchiveResource[];
	newNote(record: ArchiveRecord): void;
	addResources(record: ArchiveRecord, files?: File[]): void;
	openResource(path: string): void;
	revealFolder(record: ArchiveRecord): void;
}
