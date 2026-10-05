import type { BrowserPageState } from '../../../core/browser/model';
/** Composition-only route; it neither owns browser guests nor stores credentials. */
export interface BrowserWorkbenchPort {
 open: (state: BrowserPageState, ownerWindow?: Window) => Promise<void>;
 list: () => BrowserPageState[];
 activate: (id: string) => Promise<boolean>;
}
