import type { ViewStateResult } from 'obsidian';
import { BrowserPresentation } from './browser-presentation';
import { browserHost } from './browser-host';
import type { WorkbenchContribution } from '../../../app/contracts/workbench-host';
import type { BrowserModule } from '../services';


/** The module remains the only owner of browser guests, sessions, permissions and history. */
export const createBrowserPage = (current: () => BrowserModule): WorkbenchContribution['create'] => async (context, target, state, signal) => {
 if (signal.aborted) throw new Error('Browser page opening was cancelled');
 const module = current();
 if (target.section === 'multi-ai') return (await import('./workspace-page')).createWorkspacePage(module)(context, target, state, signal);
 if (target.section === 'assistant') return (await import('./assistant-page')).createAssistantPage(module)(context, target, state, signal);
 if (target.section === 'workflows') return (await import('./workflow-page')).createWorkflowPage(module)(context, target, state, signal);
 if (target.section === 'access') return (await import('./access-page')).createAccessPage(module)(context, target, state, signal);
 const host = browserHost(module, () => context.contentEl.win);
 const surface = new BrowserPresentation(context, host);
 await surface.setState({ ...state, id: target.resourceId }, {} as ViewStateResult);
 return {
  surface,
  getTarget: () => ({ feature: 'browser', resourceId: surface.state.id }),
  restore: async () => {}, // State was applied before mounting; never recreate a guest on plain navigation.
  navigate: async () => {},
 };
};
