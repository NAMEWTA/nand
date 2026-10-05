import type { App } from 'obsidian';
import type {
	BrowserAgentDeliveryPort,
	BrowserHistoryEntry,
	BrowserOpenRequest,
	BrowserPageState,
	BrowserSettings,
} from '../../core/browser/model';
import type { BrowserPage } from '../../platform/desktop/browser/page';
export interface BrowserHost {
	app: App;
	enabled(): boolean;
	settings(): BrowserSettings;
	history(): BrowserHistoryEntry[];
	permissions(): Record<string, boolean>;
	grantPermission(origin: string, permission: string, allowed: boolean): Promise<void>;
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
