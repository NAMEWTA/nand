import { t } from '../../shared/i18n';
import type { ItemView, ViewStateResult } from 'obsidian';
import type { WorkbenchFeature, WorkbenchTarget } from '../../app/contracts/workbench';
import { cleanPageState, normalizeTarget } from '../navigation-state';
import type { NativeSurface } from '../../ui/native-surface';
import type { WorkbenchContribution, WorkbenchPageBinding } from '../../app/contracts/workbench-host';

export type { SavedPage } from '../../app/contracts/workbench';
import type { SavedPage } from '../../app/contracts/workbench';
interface PageEntry {
 key: string; target: WorkbenchTarget; element: HTMLElement; navigationElement?: HTMLElement; alive: boolean;
 controller: AbortController; initialized?: boolean; visited?: number; binding?: WorkbenchPageBinding; ready: Promise<void>; closing?: Promise<void>;
}
/** The native owner controls DOM lifetimes; modules continue owning data and background work. */
export class WorkbenchPages {
 private readonly entries = new Map<string, PageEntry>();
 private readonly saved = new Map<string, SavedPage>();
 private readonly last = new Map<WorkbenchFeature, string>();
 private disposed = false;
 private visits = 0;
 private active?: PageEntry;
 constructor(private readonly owner: ItemView, private readonly root: HTMLElement, private readonly contributions: readonly WorkbenchContribution[], private readonly navigate: (target: WorkbenchTarget) => Promise<void>, private readonly report: (error: unknown) => void, private readonly changed: () => void = () => {}, private readonly navigationRoot?: HTMLElement, private readonly openNavigation?: () => void) {}
 contribution(feature: WorkbenchFeature): WorkbenchContribution | undefined { return this.contributions.find((item) => item.id === feature); }
 resolve(raw: WorkbenchTarget): WorkbenchTarget {
  const target = normalizeTarget(raw), contribution = this.contribution(target.feature);
  if (!contribution?.resourcePages) return target;
  if (target.resourceId) return target;
  const key = this.last.get(target.feature);
  const previous = key ? this.entries.get(key)?.target ?? this.saved.get(key)?.target : undefined;
  return previous ?? { ...target, resourceId: crypto.randomUUID() };
 }
 private key(target: WorkbenchTarget): string { return JSON.stringify([target.feature, this.contribution(target.feature)?.resourcePages ? target.resourceId ?? '' : '']); }
 private cleanState(contribution: WorkbenchContribution, raw: unknown): Record<string, unknown> {
  return cleanPageState(raw, contribution.stateKeys);
 }
 restore(raw: unknown): void {
  if (!Array.isArray(raw)) return;
  for (const item of raw.slice(0, 100)) {
   if (!item || typeof item !== 'object') continue;
   const value = item as Record<string, unknown>, target = normalizeTarget(value.target), contribution = this.contribution(target.feature);
   if (!contribution || !value.target || typeof value.target !== 'object' || (value.target as Record<string, unknown>).feature !== target.feature || (contribution.resourcePages && !target.resourceId)) continue;
   const key = this.key(target);
   this.saved.set(key, { target, state: this.cleanState(contribution, value.state) });
   this.last.set(target.feature, key);
  }
 }
 getState(): SavedPage[] {
  const result = new Map(this.saved);
  for (const entry of this.entries.values()) {
   if (!entry.binding || !entry.alive) continue;
   result.set(entry.key, { target: entry.binding.getTarget?.() ?? entry.target, state: this.cleanState(this.contribution(entry.target.feature)!, entry.binding.getState?.() ?? entry.binding.surface.getState()) });
  }
  return [...result.values()];
 }
 list(feature?: WorkbenchFeature): SavedPage[] { return this.getState().filter((page) => !feature || page.target.feature === feature); }
 getSurfaces(): NativeSurface[] { return [...this.entries.values()].flatMap((entry) => entry.alive && entry.binding ? [entry.binding.surface] : []); }
 getCurrent(): WorkbenchPageBinding | undefined { return this.active?.binding; }
 async prepare(target: WorkbenchTarget, signal: AbortSignal, initial?: Record<string, unknown>): Promise<PageEntry | undefined> {
  if (this.disposed || signal.aborted) return undefined;
  const contribution = this.contribution(target.feature);
  if (!contribution) return undefined;
  const key = this.key(target);
  let entry = this.entries.get(key);
  const created = !entry;
  if (!entry) {
   if (contribution.resourcePages && !this.saved.has(key) && this.list(target.feature).length >= 50) throw new Error(t('workbench.pageLimit'));
   const element = this.root.createDiv({ cls: 'nand-workbench-page' }); element.hidden = true; element.inert = true;
   const navigationElement = contribution.navigationContext ? this.navigationRoot?.createDiv({ cls: 'nand-workbench-context-page' }) : undefined;
   if (navigationElement) { navigationElement.hidden = true; navigationElement.inert = true; }
   const controller = new AbortController();
   const next: PageEntry = { key, target, element, navigationElement, alive: true, controller, ready: Promise.resolve() };
   this.entries.set(key, next); entry = next;
   const state = this.cleanState(contribution, initial ?? this.saved.get(key)?.state);
   next.ready = Promise.resolve().then(async () => {
    const binding = await contribution.create({ app: this.owner.app, leaf: this.owner.leaf, contentEl: element, containerEl: element, embedded: true, navigationEl: navigationElement, openNavigation: this.openNavigation, changed: () => { if (next.alive) this.changed(); }, close: () => this.close(next.key), activate: () => this.navigate(binding.getTarget?.() ?? next.target) }, target, state, controller.signal);
    next.binding = binding;
    const actual = binding.getTarget?.() ?? next.target;
    const actualKey = this.key(actual);
    if (next.alive && !this.disposed && actualKey !== next.key) {
     if (this.entries.has(actualKey)) throw new Error(t('workbench.missing'));
     this.entries.delete(next.key); this.saved.delete(next.key);
     next.key = actualKey; next.target = actual; this.entries.set(actualKey, next);
    }
    this.owner.addChild(binding.surface);
    if (!next.alive || this.disposed || controller.signal.aborted) return;
    await binding.surface.onOpen();
    if (!next.alive || this.disposed || controller.signal.aborted) return;
    if (binding.restore) await binding.restore(state);
    else if (Object.keys(state).length) await binding.surface.setState(state, {} as ViewStateResult);
    next.initialized = true;
   });
  }
  const prepared = entry;
  const cancelOpening = (): void => {
   // A navigation owns only the presentation it just allocated. Cancelling a lookup
   // on an existing editor must never discard that editor's draft or running session.
   if (created && !prepared.visited) void this.closeEntry(prepared, this.saved.has(prepared.key)).catch(this.report);
  };
  signal.addEventListener('abort', cancelOpening, { once: true });
  try {
   if (signal.aborted) cancelOpening();
   await prepared.ready;
   if (!prepared.alive || this.disposed || signal.aborted) return undefined;
   await prepared.binding?.navigate(target, signal);
   if (!prepared.alive || this.disposed || signal.aborted) return undefined;
   prepared.target = prepared.binding?.getTarget?.() ?? target;
   return prepared;
  } catch (error) {
   if (created) await this.closeEntry(prepared, this.saved.has(prepared.key));
   if (signal.aborted) return undefined;
   throw error;
  } finally {
   signal.removeEventListener('abort', cancelOpening);
  }
 }
 show(entry: PageEntry | undefined): void {
  if (this.active && this.active !== entry) {
   const previous = this.active;
   previous.element.hidden = true; previous.element.inert = true; previous.binding?.surface.setVisible(false);
   if (previous.navigationElement) { previous.navigationElement.hidden = true; previous.navigationElement.inert = true; }
   if (this.contribution(previous.target.feature)?.releaseWhenHidden) void this.closeEntry(previous, true).catch(this.report);
  }
  this.active = entry;
  if (this.navigationRoot) this.navigationRoot.hidden = !entry?.navigationElement;
  if (!entry || !entry.alive) return;
  this.last.set(entry.target.feature, entry.key);
  entry.visited = ++this.visits;
  entry.element.hidden = false; entry.element.inert = false;
  if (entry.navigationElement) { entry.navigationElement.hidden = false; entry.navigationElement.inert = false; }
  entry.binding?.surface.setVisible(true);
  // A browser guest may own a form, download or collection operation. Never silently
  // evict it based only on visibility; explicit page close owns that destructive action.
  // Stateless inbox projections opt in to releaseWhenHidden instead.

 }
 async close(key: string): Promise<void> {
  const entry = this.entries.get(key);
  if (!entry) return;
  const wasActive = this.active === entry;
  await this.closeEntry(entry, false);
  if (!wasActive || this.disposed) return;
  // A closed tab shows its neighbour of the same feature; any other page returns to the most recently visited one.
  const recent = [...this.entries.values()].filter((item) => item.alive && item.visited).sort((a, b) => (b.visited ?? 0) - (a.visited ?? 0));
  const targetOf = (item: PageEntry | undefined) => item && (item.binding?.getTarget?.() ?? item.target);
  const sibling = this.contribution(entry.target.feature)?.resourcePages
   ? targetOf(recent.find((item) => item.target.feature === entry.target.feature)) ?? [...this.saved.values()].find((page) => page.target.feature === entry.target.feature)?.target
   : undefined;
  await this.navigate(sibling ?? targetOf(recent[0]) ?? { feature: entry.target.feature === 'dashboard' ? 'settings' : 'dashboard' });
 }
 /** Close one resource page (a browser tab). */
 closeResource(feature: WorkbenchFeature, resourceId: string): Promise<void> {
  const entry = [...this.entries.values()].find((item) => item.target.feature === feature && item.target.resourceId === resourceId);
  if (entry) return this.close(entry.key);
  const key = JSON.stringify([feature, resourceId]);
  this.saved.delete(key);
  if (this.last.get(feature) === key) this.last.delete(feature);
  this.changed();
  return Promise.resolve();
 }
 async refreshAvailability(disabled?: ReadonlySet<WorkbenchFeature>): Promise<boolean> {
  let changed = false;
  for (const entry of [...this.entries.values()]) {
   const available = this.contribution(entry.target.feature)?.availability();
   if (!disabled?.has(entry.target.feature) && available?.enabled && available.supported && available.ready) continue;
   changed ||= this.active === entry;
   await this.closeEntry(entry, true);
  }
  return changed;
 }
 private closeEntry(entry: PageEntry, retain: boolean): Promise<void> {
  if (entry.closing) return entry.closing;
  entry.alive = false; entry.controller.abort();
  if (entry.navigationElement) { entry.navigationElement.hidden = true; entry.navigationElement.inert = true; }
  if (this.active === entry) this.active = undefined;
  this.entries.delete(entry.key);
  entry.closing = (async () => {
   if (!entry.initialized) { try { await entry.ready; } catch { /* The opening caller receives the original error. */ } }
   if (entry.binding) {
    if (retain && entry.initialized) this.saved.set(entry.key, { target: entry.binding.getTarget?.() ?? entry.target, state: this.cleanState(this.contribution(entry.target.feature)!, entry.binding.getState?.() ?? entry.binding.surface.getState()) });
    else if (!retain) this.saved.delete(entry.key);
    try { await entry.binding.surface.onClose(); } finally { this.owner.removeChild(entry.binding.surface); entry.element.remove(); entry.navigationElement?.remove(); }
   } else { entry.element.remove(); entry.navigationElement?.remove(); }
   if (!retain && this.last.get(entry.target.feature) === entry.key) this.last.delete(entry.target.feature);
  })();
  return entry.closing;
 }
 async dispose(): Promise<void> {
  if (this.disposed) return;
  this.disposed = true;
  const results = await Promise.allSettled([...this.entries.values()].map((entry) => this.closeEntry(entry, false)));
  this.saved.clear(); this.last.clear();
  for (const result of results) if (result.status === 'rejected') this.report(result.reason);
 }
}
