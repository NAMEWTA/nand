import type { BrowserPageTarget } from './control';
import type { ScopedBrowserOperation } from './scoped-grant';
import type { AssistantStep } from './assistant/model';

export const EXTERNAL_BROWSER_OPERATIONS: readonly ScopedBrowserOperation[] = ['snapshot', 'get', 'screenshot', 'tab.switch', 'goto', 'reload', 'back', 'forward', 'stop', 'fill', 'click', 'keypress'];
export interface ExternalAccessRequest {
	purpose: string;
	targets: BrowserPageTarget[];
	operations: ScopedBrowserOperation[];
	minutes: number;
	maxOperations: number;
}
export interface ExternalAccessGrant {
	id: string;
	taskId: string;
	purpose: string;
	pages: Array<{ target: BrowserPageTarget; title: string; url: string; accountLabel: string }>;
	operations: ScopedBrowserOperation[];
	createdAt: number;
	expiresAt: number;
	maxOperations: number;
	used: number;
	state: 'active' | 'revoked' | 'expired' | 'exhausted' | 'failed';
	/** Runtime-only symbolic facts. DOM evidence and credentials are never retained here. */
	events: AssistantStep[];
}
