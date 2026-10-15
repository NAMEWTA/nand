import type { BrowserEngine } from '../services/host';
/** The settings route loads its React implementation on demand. */
export async function browserSettingsPage(host: BrowserEngine) {
 return (await import('./settings/BrowserSettings')).browserSettingsPage(host);
}
