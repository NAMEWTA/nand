import { domainSettings } from '../../shared/settings/schema';
import { normalizeBrowserSettings, type BrowserSettings } from './core/model';

export type { BrowserSettings } from './core/model';

/** Settings namespace `browser`. */
export const browserSettings = domainSettings<BrowserSettings>({
	defaults: () => ({ searchEngine: 'google', agentAccess: false }),
	normalize: normalizeBrowserSettings,
});
