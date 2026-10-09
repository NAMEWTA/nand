import type { ViewStateResult } from 'obsidian';
import { BrowserPresentation } from './browser-presentation';
import type { BrowserHost } from '../services/page-host';
import type { WorkbenchContribution } from '../../../app/contracts/workbench-host';
import type { BrowserModule } from '../services';


/** The module remains the only owner of browser guests, sessions, permissions and history. */
export const createBrowserPage = (current: () => BrowserModule): WorkbenchContribution['create'] => async (context, target, state, signal) => {
 if (signal.aborted) throw new Error('Browser page opening was cancelled');
 const module = current();
 const host: BrowserHost = {
  app: module.app, agents: module.agents, enabled: () => module.enabled(), settings: () => module.settings(),
  history: () => module.history(), permissions: () => module.permissions(),
  grantPermission: (origin, permission, allowed) => module.grantPermission(origin, permission, allowed),
  subscribe: (listener) => module.subscribe(listener),
  createPage: (next, element, changed) => module.createPage(next, element, changed),
  releasePage: (id) => module.releasePage(id), activate: (id) => module.activate(id),
  registerPresentation: (id, activate, close, readState) => module.registerPresentation(id, activate, close, readState),
  presentationExists: (id) => module.presentationExists(id),
  open: (request) => module.openInWindow(request, context.contentEl.win),
  copyText: (text) => module.copyText(text), copyImage: (data) => module.copyImage(data),
  saveImage: (data, context) => module.saveImage(data, context),
 };
 const surface = new BrowserPresentation(context, host);
 await surface.setState({ ...state, id: target.resourceId }, {} as ViewStateResult);
 return {
  surface,
  getTarget: () => ({ feature: 'browser', resourceId: surface.state.id }),
  restore: async () => {}, // State was applied before mounting; never recreate a guest on plain navigation.
  navigate: async () => {},
 };
};
