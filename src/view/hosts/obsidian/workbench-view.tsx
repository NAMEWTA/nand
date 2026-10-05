import { ItemView, Menu, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { render } from 'preact';
import { onLanguageChanged, t } from '../../../shared/i18n';
import type { WorkbenchFeature, WorkbenchTarget } from '../../contracts/workbench';
import { WorkbenchShell } from '../../workbench/WorkbenchShell';
import { normalizeWorkbenchState, type WorkbenchState } from '../../workbench/navigation-state';
import { NavigationTransition } from '../../workbench/navigation-transition';
import { WORKBENCH_VIEW_TYPE } from '../../workbench/view-type';
import type { WorkbenchHost } from './workbench-host';
import type { NativeSurface } from './native-surface';
import { WorkbenchPages, type SavedPage } from './workbench-pages';

export class WorkbenchView extends ItemView {
 private state = normalizeWorkbenchState({});
 private readonly transition = new NavigationTransition();
 private pages?: WorkbenchPages;
 private opened = false;
 private pending: WorkbenchTarget = { feature: 'dashboard' };
 private busy = false;
 private error?: string;
 private unavailable?: string;
 private savedPages: unknown;
 private revision = 0;
 constructor(leaf: WorkspaceLeaf, private readonly host: WorkbenchHost) { super(leaf); }
 getViewType(): string { return WORKBENCH_VIEW_TYPE; }
 getDisplayText(): string { return t('workbench.title'); }
 getIcon(): string { return 'panels-top-left'; }

 ensureActivePage(): Promise<void> { return this.navigate(this.state.target); }
 getSavedPages(feature?: WorkbenchFeature): SavedPage[] { return this.pages?.list(feature) ?? []; }
 async activateResource(feature: WorkbenchFeature, id: string): Promise<boolean> {
  const saved = this.getSavedPages(feature).find((page) => page.target.resourceId === id);
  if (!saved) return false;
  await this.app.workspace.revealLeaf(this.leaf);
  await this.navigate(saved.target); return true;
 }
 getNativeSurfaces(): readonly NativeSurface[] { return this.pages?.getSurfaces() ?? []; }
 getState(): Record<string, unknown> { return { ...this.state, pages: this.pages?.getState() ?? this.savedPages }; }
 async setState(raw: Record<string, unknown>, result: ViewStateResult): Promise<void> {
  this.state = normalizeWorkbenchState(raw); this.savedPages = raw.pages;
  this.pages?.restore(raw.pages);
  if (this.opened) { this.transition.invalidate(); await this.navigate(this.state.target); }
  await super.setState(raw, result);
 }
 onOpen(): Promise<void> {
  this.opened = true; this.contentEl.addClass('nand-workbench-view');
  this.draw(); this.pages?.restore(this.savedPages);
  this.register(onLanguageChanged(() => this.draw()));
  this.register(this.host.subscribe(() => { void this.refreshAvailability().catch(this.host.report); }));
  this.register(this.contentEl.onWindowMigrated(() => this.draw()));
  return Promise.resolve();
 }
 async navigate(raw: WorkbenchTarget, initial?: Record<string, unknown>): Promise<void> {
  if (!this.opened || !this.pages) return;
  const target = this.pages.resolve(raw), revision = ++this.revision;
  this.pending = target; this.busy = true; this.error = undefined; this.draw();
  if (initial) this.transition.invalidate();
  let page: Awaited<ReturnType<WorkbenchPages['prepare']>>;
  let unavailable: string | undefined;
  try {
   await this.transition.navigate(target, async (signal) => {
    const availability = this.pages?.contribution(target.feature)?.availability();
    if (!availability) unavailable = t('workbench.missing');
    else if (!availability.enabled) unavailable = t('workbench.disabled');
    else if (!availability.supported) unavailable = t('workbench.unsupported');
    else if (!availability.ready) unavailable = availability.reason ?? t('workbench.notReady');
    else page = await this.pages?.prepare(target, signal, initial);
   }, () => {
    this.pages?.show(page); this.unavailable = unavailable;
    this.state = { ...this.state, target: page?.target ?? target };
    this.app.workspace.requestSaveLayout();
   });
  } catch (error) {
   if (revision === this.revision) this.error = error instanceof Error ? error.message : String(error);
   throw error;
  } finally {
   if (revision === this.revision) { this.busy = false; this.draw(); }
  }
 }
 async prepareModuleChanges(disabled: ReadonlySet<WorkbenchFeature>): Promise<void> {
  if (!this.opened) return;
  this.transition.invalidate(); this.revision++; this.busy = false;
  const closed = await this.pages?.refreshAvailability(disabled);
  if (closed) this.unavailable = t('workbench.disabled');
  this.draw();
 }
 async refreshAvailability(): Promise<void> {
  if (!this.opened) return;
  const changed = await this.pages?.refreshAvailability();
  if (changed || this.unavailable) { this.transition.invalidate(); await this.navigate(this.state.target); }
  else this.draw();
 }
 async disposeSurface(): Promise<void> {
  if (!this.opened) return;
  this.savedPages = this.pages?.getState() ?? this.savedPages;
  this.opened = false; this.revision++; this.transition.dispose();
  await this.pages?.dispose(); this.pages = undefined;
  render(null, this.contentEl);
 }
 onClose(): Promise<void> { return this.disposeSurface(); }
 onResize(): void { this.pages?.getCurrent()?.surface.onResize(); }
 onPaneMenu(menu: Menu, source: string): void {

  const binding = this.pages?.getCurrent();
  if (this.state.target.feature === 'browser') {
   menu.addItem((item) => item.setTitle(t('workbench.newPage')).setIcon('plus').onClick(() => this.requestNavigation({ feature: 'browser', resourceId: crypto.randomUUID() })));
   for (const page of this.getSavedPages('browser')) {
    const title = typeof page.state.title === 'string' && page.state.title ? page.state.title : typeof page.state.url === 'string' ? page.state.url : t('workbench.browser');
    menu.addItem((item) => item.setTitle(title).setChecked(page.target.resourceId === this.state.target.resourceId).onClick(() => this.requestNavigation(page.target)));
   }
   if (binding) menu.addItem((item) => item.setTitle(t('workbench.closePage')).setIcon('x').onClick(() => { void Promise.resolve(binding.surface.context.close()).catch(this.host.report); }));
   menu.addSeparator();
  }
  menu.addItem((item) => item.setTitle(t('workbench.openStandalone')).setIcon('external-link').onClick(() => {
   void this.host.openStandalone(binding?.getTarget?.() ?? this.state.target, binding?.getState?.() ?? binding?.surface.getState() ?? {}, this.contentEl.win).catch(this.host.report);
  }));
  binding?.surface.onPaneMenu(menu, source);
 }
 private more = (event: MouseEvent): void => { const menu = new Menu(); this.onPaneMenu(menu, 'workbench'); menu.showAtMouseEvent(event); };
 private change = (patch: Partial<WorkbenchState>): void => {
  this.state = normalizeWorkbenchState({ ...this.state, ...patch }); this.draw(); this.app.workspace.requestSaveLayout();
 };
 private requestNavigation = (target: WorkbenchTarget): void => { void this.navigate(target).catch(this.host.report); };
 private retry = (): void => { this.transition.invalidate(); this.requestNavigation(this.pending); };
 private content = (element: HTMLDivElement | null): void => {
  if (element && !this.pages) this.pages = new WorkbenchPages(this, element, this.host.contributions, (target) => this.navigate(target), this.host.report, () => { this.state = { ...this.state, target: this.pages?.getCurrent()?.getTarget?.() ?? this.state.target }; this.draw(); this.app.workspace.requestSaveLayout(); });
 };
 private draw(): void {
  if (!this.opened) return;
  const contributions = this.host.contributions;
  const items = contributions.filter((item) => item.id === 'dashboard' || (item.availability().enabled && item.availability().supported)).map((item) => item.navigation);
  const current = contributions.find((item) => item.id === this.state.target.feature);
  render(<WorkbenchShell state={this.state} items={items} title={t(current?.navigation.labelKey ?? 'workbench.title')} busy={this.busy} error={this.error} unavailable={this.unavailable} ownerWindow={this.contentEl.win} change={this.change} navigate={this.requestNavigation} settings={this.host.openSettings} more={this.more} retry={this.retry} contentRef={this.content} />, this.contentEl);
 }
}
