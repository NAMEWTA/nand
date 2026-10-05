import type { ViewStateResult } from 'obsidian';
import { BrowserPresentation } from '../../view/browser/browser-presentation';
import type { BrowserHost } from '../../view/browser/host';
import type { WorkbenchContribution } from '../../view/hosts/obsidian/workbench-host';
import type { BrowserModule } from '../modules/browser';

/** The module remains the only owner of browser guests, sessions, permissions and history. */
export const createBrowserPage = (module: BrowserModule): WorkbenchContribution['create'] => async (context, target, state, signal) => {
 if (signal.aborted) throw new Error('Browser page opening was cancelled');
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
