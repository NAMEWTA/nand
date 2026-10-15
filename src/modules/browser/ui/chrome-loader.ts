import type { BrowserPageHandle } from '../api';
import type { BrowserEngine } from '../services/host';
/** Keep React chrome behind first-page use rather than module activation. */
export async function browserChrome(host: BrowserEngine, page: BrowserPageHandle) {
 return (await import('./BrowserChrome')).renderBrowserChrome(host,page);
}
