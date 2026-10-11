import type { App } from 'obsidian';
import type {
	BrowserAgentDeliveryPort,
	BrowserHistoryEntry,
	BrowserOpenRequest,
	BrowserPageState,
	BrowserSettings,
	BrowserGrab,
} from '../core/model';
import type { BrowserPageTarget } from '../core/control';
import type { BrowserPage } from '../platform/desktop/page';
import type { BrowserProfile } from '../core/profiles';
import type { WebAssistant } from './assistant';
import type { UserAdapters } from './user-adapters';
import type { BrowserWorkflows } from './workflows';
import type { BrowserGrants } from './grants';
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
	registerPresentation(id: string, activate: (admit?: () => void) => Promise<void>, close: () => void | Promise<void>, state?: () => BrowserPageState): () => void;
	presentationExists?(id: string): boolean;
	copyText(text: string): void;
	copyImage(data: string): void;
	saveImage(data: string, context?: string): Promise<string[]>;
	agents: BrowserAgentDeliveryPort;
	peekAssistant?(): WebAssistant | undefined;
	openAssistant?(taskId: string, ownerWindow?: Window): Promise<void>;
	guidanceChoices?(target: BrowserPageTarget): Promise<Array<{ id: string; label: string }>>;
	saveGuidance?(target: BrowserPageTarget, grab: BrowserGrab, exchangeId: string): Promise<void>;
	getUserAdapters?(): Promise<UserAdapters>;
	peekWorkflows?(): BrowserWorkflows | undefined;
	openWorkflows?(id: string, ownerWindow?: Window): Promise<void>;
	peekGrants?(): BrowserGrants | undefined;
	openAccess?(ownerWindow?: Window): Promise<void>;
}
