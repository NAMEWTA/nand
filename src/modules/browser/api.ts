import { serviceKey } from '../../app/contracts/module';
import type { BrowserOpenRequest, BrowserSettings } from './core/model';
import type { BrowserProfile, ProfilePage } from './core/profiles';

export type { BrowserOpenRequest, BrowserSettings };
export type { BrowserProfile, ProfilePage };

export interface BrowserProfiles {
	list(): BrowserProfile[];
	create(label: string): Promise<BrowserProfile>;
	rename(id: string, label: string): Promise<void>;
	/** Review these pages before deletion; a changed set requires a fresh confirmation. */
	affectedPages(id: string): ProfilePage[];
	remove(id: string, confirmedPageIds: readonly string[]): Promise<void>;
	subscribe(listener: () => void): () => void;
}

/** Open a web page in NAND's browser (service `browser.open`). */
export interface BrowserOpener {
	/** Resolves with the page id; rejects with a localized message when the page cannot open. */
	open(request: BrowserOpenRequest): Promise<string>;
	/** For commands and buttons: like `open`, but reports failures as a notice. */
	show(request: BrowserOpenRequest): Promise<void>;
}

export const BROWSER_OPEN = serviceKey<BrowserOpener>('browser', 'open');
export const BROWSER_PROFILES = serviceKey<BrowserProfiles>('browser', 'profiles');
