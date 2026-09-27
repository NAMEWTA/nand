import type { App, Editor, Hotkey, MarkdownView, Menu, MenuItem, WorkspaceLeaf } from 'obsidian';
import type { EditorView } from '@codemirror/view';

/** Only the private API shapes used by the upstream Iconic implementation. */
export type IconicApp = App & {
	customCss?: { theme?: string };
	plugins?: { plugins?: Record<string, unknown> };
	internalPlugins?: { plugins?: { bookmarks?: { instance?: { items?: unknown; getBookmarks?: () => unknown } } } };
	metadataTypeManager?: {
		getAllProperties?: () => unknown;
		getWidget?: (widget: string) => { icon?: unknown } | undefined;
	};
	metadataCache: App['metadataCache'] & { getTags?: () => unknown };
	hotkeyManager?: { customKeys?: Record<string, Hotkey[]> };
	setting: { close: () => void };
	openWithDefaultApp: (path: string) => void;
	mobileNavbar: { ribbonMenuItemEl?: HTMLElement };
	vault: App['vault'] & { getConfig: (key: 'mobileQuickRibbonItem') => string | undefined };
	workspace: App['workspace'] & {
		leftRibbon: { items: unknown; ribbonItemsEl: HTMLElement };
		leftSplit: {
			tabsContainerEl?: HTMLElement;
			activeTabContentEl?: HTMLElement;
			activeTabIconEl: HTMLElement | null;
		};
		rightSplit: {
			tabsContainerEl?: HTMLElement;
			activeTabContentEl?: HTMLElement;
			activeTabIconEl: HTMLElement | null;
		};
	};
};
export function internalApp(app: App): IconicApp {
	return app as IconicApp;
}
export function internalLeaf(leaf: WorkspaceLeaf): WorkspaceLeaf & {
	containerEl: HTMLElement;
	tabHeaderInnerIconEl: HTMLElement | null;
	tabHeaderEl?: HTMLElement;
	parent?: { isStacked?: boolean };
} {
	return leaf as ReturnType<typeof internalLeaf>;
}
export function internalMarkdownView(view: MarkdownView): MarkdownView & {
	metadataEditor?: { propertyListEl: HTMLElement };
	inlineTitleEl?: HTMLElement;
} {
	return view;
}
export function internalEditor(editor: Editor): Editor & { cm: EditorView } {
	return editor as ReturnType<typeof internalEditor>;
}
export type IconicMenuItem = MenuItem & { section: string; iconEl: HTMLElement; dom?: HTMLElement };
export function internalMenuItem(item: MenuItem): IconicMenuItem {
	return item as IconicMenuItem;
}
export function internalMenu(menu: Menu): Menu & { sections: string[]; items: IconicMenuItem[] } {
	return menu as ReturnType<typeof internalMenu>;
}
export function isHtmlElement(value: unknown): value is HTMLElement {
	return (
		!!value &&
		typeof (value as HTMLElement).instanceOf === 'function' &&
		(value as HTMLElement).instanceOf(HTMLElement)
	);
}
export type SuggestionMethod = (this: unknown, ...args: unknown[]) => unknown;
export function internalSuggest<T extends object>(suggest: T): T & { showSuggestions: SuggestionMethod } {
	return suggest as T & { showSuggestions: SuggestionMethod };
}
export function internalWindow(win: Window): Window & {
	electron: { remote: { getCurrentWindow: () => { isMaximized: () => boolean } } };
} {
	return win as ReturnType<typeof internalWindow>;
}

/** Read an unbound method only when the caller explicitly supplies its original receiver. */
export function getMethod<T, K extends keyof T>(object: T, key: K): T[K] {
	return object[key];
}
