import { serviceKey } from '../../app/contracts/module';
import type { BrowserOpenRequest, BrowserSettings } from './core/model';

export type { BrowserOpenRequest, BrowserSettings };

/** Open a web page in NAND's browser (service `browser.open`). */
export interface BrowserOpener {
	/** Resolves with the page id; rejects with a localized message when the page cannot open. */
	open(request: BrowserOpenRequest): Promise<string>;
	/** For commands and buttons: like `open`, but reports failures as a notice. */
	show(request: BrowserOpenRequest): Promise<void>;
}

/**
 * The local browser bridge for agent sessions (service `browser.agent-bridge`). `environment()` is empty
 * unless "Let agent sessions use the browser" is on, so ordinary terminals never start the bridge.
 */
export interface BrowserAgentBridge {
	environment(): Promise<Record<string, string>>;
}

export const BROWSER_OPEN = serviceKey<BrowserOpener>('browser', 'open');
export const BROWSER_AGENT_BRIDGE = serviceKey<BrowserAgentBridge>('browser', 'agent-bridge');
