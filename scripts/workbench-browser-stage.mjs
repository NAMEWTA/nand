// Temporary reviewed browser/workbench integration stage; removed before final review.
import { read, put, replace } from './workbench-write.mjs';

replace('src/view/dashboard/view/render.ts', 'getRenderContext(prevRoot!)', 'getRenderContext(prevRoot)');
replace('src/view/dashboard/view/vault-refresh.ts', "root?.querySelector('.dashboard-kanban') as HTMLElement | null", "root.querySelector<HTMLElement>('.dashboard-kanban')");
replace('src/view/hosts/obsidian/workbench-host.ts', 'openSettings(): void;', 'openSettings: () => void;');
replace('src/view/hosts/obsidian/workbench-host.ts', 'openStandalone(target: WorkbenchTarget, state: Record<string, unknown>, ownerWindow: Window): Promise<void>;', 'openStandalone: (target: WorkbenchTarget, state: Record<string, unknown>, ownerWindow: Window) => Promise<void>;');
replace('src/view/hosts/obsidian/workbench-host.ts', 'report(error: unknown): void;', 'report: (error: unknown) => void;');
replace('src/plugin/main.ts', "import type { AutomationUiPort } from '../shared/automation/types';\n", '');
replace('src/view/terminal/terminal-view-lifecycle.test.ts', "if (specifier === './TerminalWorkbench' || specifier === './workbench')", "if (context.parentURL?.endsWith('/terminal-view.ts') && (specifier === './TerminalWorkbench' || specifier === './workbench'))");
replace('scripts/verify-issue-regressions.ts', "const expectedShellIds = ['open-browser'", "const expectedShellIds = ['open-workbench', 'open-browser'");

replace('src/view/hosts/obsidian/native-surface.ts', 'close: () => void;', 'close: () => void | Promise<void>;');
replace('src/view/browser/host.ts', 'registerPresentation(id: string, activate: () => Promise<void>, close: () => void): () => void;', 'registerPresentation(id: string, activate: () => Promise<void>, close: () => void | Promise<void>, state?: () => BrowserPageState): () => void;\n\tpresentationExists?(id: string): boolean;');
const original = read('src/view/browser/browser-view.tsx');
let browser = "import { NativeSurface, nativeSurfaces, type NativeSurfaceContext } from '../hosts/obsidian/native-surface';\n" + original
 .replace('ItemView, Platform, type ViewStateResult, type WorkspaceLeaf', 'Platform, type ViewStateResult')
 .replace('export class BrowserView extends ItemView', 'export class BrowserPresentation extends NativeSurface')
 .replace('leaf: WorkspaceLeaf,', 'context: NativeSurfaceContext,')
 .replace('super(leaf);', 'super(context);');
browser = browser.replace("\t\tif (this.opened) render(null, this.contentEl);", "\t\tif (this.opened) render(null, this.contentEl);\n\t\tthis.unregister?.(); this.unregister = undefined;");
const duplicateStart = browser.indexOf('\t\tif (\n\t\t\tthis.app.workspace');
const duplicateEnd = browser.indexOf('\n\t\tthis.bindPresentation();', duplicateStart);
if (duplicateStart < 0 || duplicateEnd < 0) throw new Error('Browser identity anchor missing');
browser = browser.slice(0, duplicateStart) + String.raw`
		const occupied = this.host.presentationExists?.(this.state.id) || nativeSurfaces(this.app).some((surface) =>
			surface !== this && surface.getViewType() === BROWSER_VIEW_TYPE && surface.getState().id === this.state.id,
		) || this.app.workspace.getLeavesOfType(BROWSER_VIEW_TYPE).some((leaf) =>
			leaf !== this.leaf && leaf.getViewState().state?.id === this.state.id,
		);
		if (occupied) this.state.id = crypto.randomUUID();` + browser.slice(duplicateEnd);
browser = browser.replace('\t\tthis.bindPresentation();\n\t\tthis.paint();\n\t\tawait super.setState', '\t\tif (this.opened) this.bindPresentation();\n\t\tthis.paint();\n\t\tawait super.setState');
browser = browser.replace('await this.app.workspace.revealLeaf(this.leaf);', 'if (this.context.activate) await this.context.activate();\n\t\t\t\telse await this.app.workspace.revealLeaf(this.leaf);');
browser = browser.replace('() => this.leaf.detach(),', '() => this.context.close(),\n\t\t\t() => ({ ...this.state }),');
browser = browser.replace('if (titleChanged) refreshLeafTitle(this.app, this.leaf);', 'if (titleChanged && !this.embedded) refreshLeafTitle(this.app, this.leaf);');
put('src/view/browser/browser-presentation.tsx', browser);
put('src/view/browser/browser-view.tsx', String.raw`
import { ItemView, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import type { BrowserPageState } from '../../core/browser/model';
import type { BrowserHost } from './host';
import { BrowserPresentation } from './browser-presentation';

/** Original native browser type; the same presentation also runs inside a workbench. */
export class BrowserView extends ItemView {
 readonly surface: BrowserPresentation;
 constructor(leaf: WorkspaceLeaf, host: BrowserHost) {
  super(leaf);
  this.surface = this.addChild(new BrowserPresentation({ app: this.app, leaf, contentEl: this.contentEl, containerEl: this.contentEl, close: () => this.leaf.detach() }, host));
 }
 get state(): BrowserPageState { return this.surface.state; }
 getNativeSurfaces(): readonly BrowserPresentation[] { return [this.surface]; }
 getViewType(): string { return this.surface.getViewType(); }
 getDisplayText(): string { return this.surface.getDisplayText(); }
 getIcon(): string { return this.surface.getIcon(); }
 getState(): Record<string, unknown> { return this.surface.getState(); }
 async setState(state: Record<string, unknown>, result: ViewStateResult): Promise<void> {
  await this.surface.setState(state, result); await super.setState(state, result);
 }
 onOpen(): Promise<void> { return this.surface.onOpen(); }
 onClose(): Promise<void> { return this.surface.onClose(); }
 onResize(): void { this.surface.onResize(); }
}
`);
put('src/plugin/modules/browser/workbench-port.ts', String.raw`
import type { BrowserPageState } from '../../../core/browser/model';
/** Composition-only route; it neither owns browser guests nor stores credentials. */
export interface BrowserWorkbenchPort {
 open: (state: BrowserPageState, ownerWindow?: Window) => Promise<void>;
 list: () => BrowserPageState[];
 activate: (id: string) => Promise<boolean>;
}
`);
const modulePath = 'src/plugin/modules/browser/index.ts';
put(modulePath, "import type { BrowserWorkbenchPort } from './workbench-port';\n" + read(modulePath));
replace(modulePath, 'private presentations = new Map<string, { activate: () => Promise<void>; close: () => void }>();', 'private presentations = new Map<string, { activate: () => Promise<void>; close: () => void | Promise<void>; state?: () => BrowserPageState }>();\n\tprivate workbench?: BrowserWorkbenchPort;\n\tsetWorkbench(port: BrowserWorkbenchPort | undefined): void { this.workbench = port; }\n\tpresentationExists(id: string): boolean { return this.presentations.has(id); }');
replace(modulePath, 'void this.open({ url }).catch', 'void this.openInWindow({ url }, container.win).catch');
replace(modulePath, 'registerPresentation(id: string, activate: () => Promise<void>, close: () => void): () => void {\n\t\tconst value = { activate, close };', "registerPresentation(id: string, activate: () => Promise<void>, close: () => void | Promise<void>, state?: () => BrowserPageState): () => void {\n\t\tif (this.presentations.has(id)) throw new BrowserError('browser_duplicate_page');\n\t\tconst value = { activate, close, state };");
replace(modulePath, 'async open(request: BrowserOpenRequest): Promise<string> {', 'open(request: BrowserOpenRequest): Promise<string> { return this.openInWindow(request); }\n\tasync openInWindow(request: BrowserOpenRequest, ownerWindow?: Window): Promise<string> {');
replace(modulePath, "this.app.workspace.containerEl.win.open(url, '_blank')", "(ownerWindow ?? this.app.workspace.containerEl.win).open(url, '_blank')");
replace(modulePath, '\t\t\tmodal.open();\n\t\t} else {', '\t\t\tmodal.open();\n\t\t} else if (this.workbench && request.target !== \'tab\') {\n\t\t\tawait this.workbench.open(state, ownerWindow);\n\t\t} else {');
replace(modulePath, "\t\t\tconst live = [...this.pages.values()].map((page) => ({ ...page.state }));", "\t\t\tconst live = [...this.pages.values()].map((page) => ({ ...page.state }));\n\t\t\tfor (const state of this.workbench?.list() ?? []) if (!live.some((row) => row.id === state.id)) live.push(state);");
replace(modulePath, "\t\tif (!this.presentations.has(id)) {\n\t\t\tconst leaf", "\t\tif (!this.presentations.has(id)) await this.workbench?.activate(id);\n\t\tif (!this.presentations.has(id)) {\n\t\t\tconst leaf");
replace(modulePath, '\t\t\tpresentation.close();', '\t\t\tawait presentation.close();');
replace(modulePath, '\t\tthis.presentations.clear();', '\t\tthis.presentations.clear();\n\t\tthis.workbench = undefined;');
const pagesPath = 'src/view/hosts/obsidian/workbench-pages.ts';
replace(pagesPath, 'interface SavedPage', 'export interface SavedPage');
replace(pagesPath, "close: () => { void this.close(key).catch(this.report); }", "close: () => this.close(next.key)");
replace(pagesPath, '\n    next.binding = binding;', String.raw`
    next.binding = binding;
    const actual = binding.getTarget?.() ?? next.target;
    const actualKey = this.key(actual);
    if (actualKey !== next.key) {
     this.entries.delete(next.key); this.saved.delete(next.key);
     next.key = actualKey; next.target = actual; this.entries.set(actualKey, next);
    }`);
replace(pagesPath, '   if (!entry.alive || this.disposed || signal.aborted) return undefined;\n   await entry.binding?.navigate(target, signal);', '  } catch (error) {\n   await this.closeEntry(entry, true);\n   throw error;\n  }\n  if (!entry.alive || this.disposed || signal.aborted) return undefined;\n  // A target lookup failure must not unmount an existing editor or destroy its draft.\n  await entry.binding?.navigate(target, signal);');
replace(pagesPath, '\n  } catch (error) {\n   await this.closeEntry(entry, true);\n   throw error;\n  }\n }\n show', '\n }\n show');
replace(pagesPath, ' getSurfaces(): NativeSurface[]', ' list(feature?: WorkbenchFeature): SavedPage[] { return this.getState().filter((page) => !feature || page.target.feature === feature); }\n getSurfaces(): NativeSurface[]');
const viewPath = 'src/view/hosts/obsidian/workbench-view.tsx';
replace(viewPath, "import type { WorkbenchTarget }", "import type { WorkbenchFeature, WorkbenchTarget }");
replace(viewPath, "import { WorkbenchPages }", "import { WorkbenchPages, type SavedPage }");
replace(viewPath, ' getNativeSurfaces(): readonly NativeSurface[]', String.raw`
 getSavedPages(feature?: WorkbenchFeature): SavedPage[] { return this.pages?.list(feature) ?? []; }
 async activateResource(feature: WorkbenchFeature, id: string): Promise<boolean> {
  const saved = this.getSavedPages(feature).find((page) => page.target.resourceId === id);
  if (!saved) return false;
  await this.app.workspace.revealLeaf(this.leaf);
  await this.navigate(saved.target); return true;
 }
 getNativeSurfaces(): readonly NativeSurface[]`);
replace(viewPath, 'this.state = { ...this.state, target };', 'this.state = { ...this.state, target: page?.target ?? target };');
replace(viewPath, '  this.opened = false; this.revision++; this.transition.dispose();', '  if (!this.opened) return;\n  this.savedPages = this.pages?.getState() ?? this.savedPages;\n  this.opened = false; this.revision++; this.transition.dispose();');
replace(viewPath, '  const binding = this.pages?.getCurrent();\n  menu.addItem', String.raw`
  const binding = this.pages?.getCurrent();
  if (this.state.target.feature === 'browser') {
   menu.addItem((item) => item.setTitle(t('workbench.newPage')).setIcon('plus').onClick(() => this.open({ feature: 'browser', resourceId: crypto.randomUUID() })));
   for (const page of this.getSavedPages('browser')) {
    const title = typeof page.state.title === 'string' && page.state.title ? page.state.title : typeof page.state.url === 'string' ? page.state.url : t('workbench.browser');
    menu.addItem((item) => item.setTitle(title).setChecked(page.target.resourceId === this.state.target.resourceId).onClick(() => this.open(page.target)));
   }
   if (binding) menu.addItem((item) => item.setTitle(t('workbench.closePage')).setIcon('x').onClick(() => { void Promise.resolve(binding.surface.context.close()).catch(this.host.report); }));
   menu.addSeparator();
  }
  menu.addItem`);
put('src/plugin/workbench/browser-page.ts', String.raw`
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
`);
const composePath = 'src/plugin/workbench/compose-workbench.ts';
put(composePath, "import { newPageState } from '../../core/browser/model';\nimport { createBrowserPage } from './browser-page';\n" + read(composePath));
replace(composePath, "import { Notice }", "import { Notice, Platform }");
replace(composePath, "  { id: 'contacts', navigation:", "  { id: 'browser', navigation: { id: 'browser', labelKey: 'workbench.browser', icon: 'globe', target: { feature: 'browser' } }, availability: () => ({ ...ready(), enabled: plugin.settings.modules.browser, supported: Platform.isDesktopApp }), stateKeys: ['id', 'url', 'title', 'zoom', 'scroll'], resourcePages: true, create: createBrowserPage(plugin.browserHost) },\n  { id: 'contacts', navigation:");
replace(composePath, "automations: 'nand-automation-view'", "automations: 'nand-automation-view', browser: 'nand-browser-view'");
replace(composePath, '   await leaf.setViewState({ type, active: true, state });', "   // A copied browser page is a new resource, not another owner of the same guest.\n   await leaf.setViewState({ type, active: true, state: target.feature === 'browser' ? { ...state, id: crypto.randomUUID() } : state });");
replace(composePath, ' const refresh = (): void =>', String.raw`
 plugin.browserHost.setWorkbench({
  open: (state, ownerWindow) => open({ feature: 'browser', resourceId: state.id }, ownerWindow, { ...state }),
  list: () => plugin.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE).flatMap((leaf) => {
   const raw = leaf.view instanceof WorkbenchView ? leaf.view.getSavedPages('browser') : Array.isArray(leaf.getViewState().state?.pages) ? leaf.getViewState().state?.pages as unknown[] : [];
   return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const entry = item as { target?: { feature?: string; resourceId?: string }; state?: Record<string, unknown> };
    return entry.target?.feature === 'browser' && entry.target.resourceId ? [newPageState(entry.target.resourceId, entry.state)] : [];
   });
  }),
  activate: async (id) => {
   for (const leaf of plugin.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE)) {
    if (leaf.view instanceof WorkbenchView && await leaf.view.activateResource('browser', id)) return true;
    const states: unknown = leaf.getViewState().state?.pages;
    if (!Array.isArray(states) || !states.some((state: unknown) => {
     if (!state || typeof state !== 'object') return false;
     const target = (state as { target?: { feature?: string; resourceId?: string } }).target;
     return target?.feature === 'browser' && target.resourceId === id;
    })) continue;
    await leaf.loadIfDeferred();
    if (leaf.view instanceof WorkbenchView && await leaf.view.activateResource('browser', id)) return true;
   }
   return false;
  },
 });
 const refresh = (): void =>`);
replace(composePath, '  listeners.clear();', '  plugin.browserHost.setWorkbench(undefined);\n  listeners.clear();');
replace(viewPath, '  return this.navigate(this.state.target);\n }\n async navigate', '  return Promise.resolve();\n }\n async navigate');
replace(viewPath, ' getSavedPages(feature?', ' ensureActivePage(): Promise<void> { return this.navigate(this.state.target); }\n getSavedPages(feature?');
replace(composePath, "  let view = workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE).find((leaf) => leaf.view.containerEl.win === win)?.view;", "  const existing = workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE).find((leaf) => leaf.view.containerEl.win === win);\n  if (existing) await existing.loadIfDeferred();\n  let view = existing?.view;");
replace(composePath, 'state: target ? { target } : undefined', 'state: target ? { target, pages: initial ? [{ target, state: initial }] : [] } : undefined');
replace(composePath, '  if (target) await view.navigate(target, initial);', '  if (target) await view.navigate(target, initial);\n  else await view.ensureActivePage();');
replace('src/view/browser/browser-view.tsx', ' get state(): BrowserPageState { return this.surface.state; }', ' get state(): BrowserPageState { return this.surface.state; }\n set state(value: BrowserPageState) { this.surface.state = value; }');
