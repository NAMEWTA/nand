import { domainSettings } from '../../shared/settings/schema';
import { normalizeBrowserSettings, type BrowserSettings } from './core/model';
import { DEFAULT_WORKSPACE_FOLDER } from './core/workspace/location';

export type { BrowserSettings } from './core/model';

/** Settings namespace `browser`. */
export const browserSettings = domainSettings<BrowserSettings>({
	defaults: () => ({ searchEngine: 'google', agentAccess: false, workspaceFolder: DEFAULT_WORKSPACE_FOLDER }),
	normalize: normalizeBrowserSettings,
});
