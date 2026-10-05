import type { ItemView, ViewStateResult } from 'obsidian';
import type { WorkbenchFeature, WorkbenchTarget } from '../../contracts/workbench';
import { normalizeTarget } from '../../workbench/navigation-state';
import type { NativeSurface } from './native-surface';
import type { WorkbenchContribution, WorkbenchPageBinding } from './workbench-host';

interface SavedPage { target: WorkbenchTarget; state: Record<string, unknown>; }
interface PageEntry {
 key: string; target: WorkbenchTarget; element: HTMLElement; alive: boolean;
 controller: AbortController; binding?: WorkbenchPageBinding; ready: Promise<void>; closing?: Promise<void>;
}
/** The native owner controls DOM lifetimes; modules continue owning data and background work. */
export class WorkbenchPages {
 private readonly entries = new Map<string, PageEntry>();
 private readonly saved = new Map<string, SavedPage>();
 private readonly last = new Map<WorkbenchFeature, string>();
 private disposed = false;
 private active?: PageEntry;
 constructor(private readonly owner: ItemView, private readonly root: HTMLElement, private readonly contributions: readonly WorkbenchContribution[], private readonly navigate: (target: WorkbenchTarget) => Promise<void>, private readonly report: (error: unknown) => void) {}
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
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return Object.fromEntries(contribution.stateKeys.filter((key) => Object.prototype.hasOwnProperty.call(value, key)).map((key) => [key, value[key]]));
 }
 restore(raw: unknown): void {
  if (!Array.isArray(raw)) return;
  for (const item of raw.slice(0, 100)) {
   if (!item || typeof item !== 'object') continue;
   const value = item as Record<string, unknown>, target = normalizeTarget(value.target), contribution = this.contribution(target.feature);
   if (!contribution || (contribution.resourcePages && !target.resourceId)) continue;
   const key = this.key(target);
   this.saved.set(key, { target, state: this.cleanState(contribution, value.state) });
   this.last.set(target.feature, key);
  }
 }
 getState(): SavedPage[] {
  const result = new Map(this.saved);
  for (const entry of this.entries.values()) {
   if (!entry.binding || !entry.alive) continue;
   result.set(entry.key, { target: entry.binding.getTarget?.() ?? entry.target, state: entry.binding.getState?.() ?? entry.binding.surface.getState() });
  }
  return [...result.values()];
 }
 getSurfaces(): NativeSurface[] { return [...this.entries.values()].flatMap((entry) => entry.alive && entry.binding ? [entry.binding.surface] : []); }
 getCurrent(): WorkbenchPageBinding | undefined { return this.active?.binding; }
 async prepare(target: WorkbenchTarget, signal: AbortSignal, initial?: Record<string, unknown>): Promise<PageEntry | undefined> {
  if (this.disposed || signal.aborted) return undefined;
  const contribution = this.contribution(target.feature);
  if (!contribution) return undefined;
  const key = this.key(target);
  let entry = this.entries.get(key);
  if (!entry) {
   const element = this.root.createDiv({ cls: 'nand-workbench-page' }); element.hidden = true; element.inert = true;
   const controller = new AbortController();
   const next: PageEntry = { key, target, element, alive: true, controller, ready: Promise.resolve() };
   this.entries.set(key, next); entry = next;
   const state = this.cleanState(contribution, initial ?? this.saved.get(key)?.state);
   next.ready = Promise.resolve().then(async () => {
    const binding = await contribution.create({ app: this.owner.app, leaf: this.owner.leaf, contentEl: element, containerEl: element, embedded: true, close: () => { void this.close(key).catch(this.report); }, activate: () => this.navigate(binding.getTarget?.() ?? next.target) }, target, state, controller.signal);
    next.binding = binding;
    this.owner.addChild(binding.surface);
    if (!next.alive || this.disposed) return;
    await binding.surface.onOpen();
    if (!next.alive || this.disposed) return;
    if (binding.restore) await binding.restore(state);
    else if (Object.keys(state).length) await binding.surface.setState(state, {} as ViewStateResult);
   });
  }
  try {
   await entry.ready;
   if (!entry.alive || this.disposed || signal.aborted) return undefined;
   await entry.binding?.navigate(target, signal);
   if (!entry.alive || this.disposed || signal.aborted) return undefined;
   entry.target = entry.binding?.getTarget?.() ?? target;
   return entry;
  } catch (error) {
   await this.closeEntry(entry, true);
   throw error;
  }
 }
 show(entry: PageEntry | undefined): void {
  if (this.active && this.active !== entry) {
   this.active.element.hidden = true; this.active.element.inert = true; this.active.binding?.surface.setVisible(false);
  }
  this.active = entry;
  if (!entry || !entry.alive) return;
  this.last.set(entry.target.feature, entry.key);
  entry.element.hidden = false; entry.element.inert = false; entry.binding?.surface.setVisible(true);
 }
 async close(key: string): Promise<void> {
  const entry = this.entries.get(key);
  if (!entry) return;
  const wasActive = this.active === entry;
  await this.closeEntry(entry, false);
  if (wasActive && !this.disposed) await this.navigate({ feature: 'dashboard' });
 }
 async refreshAvailability(): Promise<boolean> {
  let changed = false;
  for (const entry of [...this.entries.values()]) {
   const available = this.contribution(entry.target.feature)?.availability();
   if (available?.enabled && available.supported && available.ready) continue;
   changed ||= this.active === entry;
   await this.closeEntry(entry, true);
  }
  return changed;
 }
 private closeEntry(entry: PageEntry, retain: boolean): Promise<void> {
  if (entry.closing) return entry.closing;
  entry.alive = false; entry.controller.abort();
  if (this.active === entry) this.active = undefined;
  this.entries.delete(entry.key);
  entry.closing = (async () => {
   try { await entry.ready; } catch { /* The opening caller receives the original error. */ }
   if (entry.binding) {
    if (retain) this.saved.set(entry.key, { target: entry.binding.getTarget?.() ?? entry.target, state: entry.binding.getState?.() ?? entry.binding.surface.getState() });
    else this.saved.delete(entry.key);
    try { await entry.binding.surface.onClose(); } finally { this.owner.removeChild(entry.binding.surface); entry.element.remove(); }
   } else entry.element.remove();
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
