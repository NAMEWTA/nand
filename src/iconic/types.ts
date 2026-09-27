export type Category =
	'app' | 'tab' | 'file' | 'folder' | 'group' | 'search' | 'graph' | 'url' | 'tag' | 'property' | 'ribbon' | 'rule';
export type AppItemId =
	'help' | 'settings' | 'pin' | 'sidebarLeft' | 'sidebarRight' | 'minimize' | 'maximize' | 'unmaximize' | 'close';

// Plugin tabs that contain a file, but should still display a tab-specific icon
export const PLUGIN_TAB_TYPES = ['backlink', 'file-properties', 'footnotes', 'localgraph', 'outgoing-link', 'outline'];

/**
 * Base interface for all icon objects.
 */
export interface Icon {
	icon: string | null;
	color: string | null;
}
export interface Item extends Icon {
	id: string;
	name: string;
	category: Category;
	iconDefault: string | null;
}
export type AppItem = Item;
export interface TabItem extends Item {
	isActive: boolean;
	isRoot: boolean;
	isStacked: boolean;
	iconEl: HTMLElement | null;
	tabEl: HTMLElement | null;
}
export interface FileItem extends Item {
	items: FileItem[] | null;
}
export interface BookmarkItem extends Item {
	items: BookmarkItem[] | null;
}
export type TagItem = Item;
export interface PropertyItem extends Item {
	type: string | null;
}
export interface RibbonItem extends Item {
	isHidden: boolean;
	iconEl: HTMLElement | null;
}
