import type { BrowserPageState } from '../core/model';
/** Composition-only route; it neither owns browser guests nor stores credentials. */
export interface BrowserWorkbenchPort {
 open: (state: BrowserPageState, ownerWindow?: Window) => Promise<void>;
 /** Open the page by itself in a new tab (a focus-mode workbench leaf). */
 openTab: (state: BrowserPageState, ownerWindow?: Window) => Promise<void>;
 openTask: (taskId: string | undefined, ownerWindow?: Window) => Promise<void>;
 openAssistant: (taskId: string | undefined, ownerWindow?: Window) => Promise<void>;
 openWorkflows?: (id: string | undefined, ownerWindow?: Window) => Promise<void>;
 openAccess?: (ownerWindow?: Window) => Promise<void>;
 list: () => BrowserPageState[];
 activate: (id: string) => Promise<boolean>;
 close: (id: string) => Promise<void>;
}
