import type { App } from 'obsidian';
import type {
	BrowserAgentDeliveryPort,
	BrowserHistoryEntry,
	BrowserOpenRequest,
	BrowserPageState,
	BrowserSettings,
} from '../core/model';
import type { BrowserPage } from '../platform/desktop/page';
import type { BrowserProfile } from '../core/profiles';
export interface BrowserHost {
	app: App;
	enabled(): boolean;
	settings(): BrowserSettings;
	history(): BrowserHistoryEntry[];
	profiles(): BrowserProfile[];
	permissions(profileId?: string): Record<string, boolean>;
	grantPermission(origin: string, permission: string, allowed: boolean, profileId?: string): Promise<void>;
	subscribe(listener: () => void): () => void;
	createPage(
		state: BrowserPageState,
		container: HTMLElement,
		changed: (state: BrowserPageState) => void,
	): BrowserPage;
	releasePage(id: string): void;
	open(request: BrowserOpenRequest): Promise<string>;
	activate(id: string): Promise<void>;
	registerPresentation(id: string, activate: () => Promise<void>, close: () => void | Promise<void>, state?: () => BrowserPageState): () => void;
	presentationExists?(id: string): boolean;
	copyText(text: string): void;
	copyImage(data: string): void;
	saveImage(data: string, context?: string): Promise<string[]>;
	agents: BrowserAgentDeliveryPort;
}

/** Composition-only route; it neither owns browser guests nor stores credentials. */
export interface BrowserWorkbenchPort {
 open: (state: BrowserPageState, ownerWindow?: Window) => Promise<void>;
 /** Open the page by itself in a new tab (a focus-mode workbench leaf). */
 openTab: (state: BrowserPageState, ownerWindow?: Window) => Promise<void>;
 list: () => BrowserPageState[];
 activate: (id: string) => Promise<boolean>;
 close: (id: string) => Promise<void>;
}
