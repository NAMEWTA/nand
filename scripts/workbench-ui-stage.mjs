// Temporary reviewed implementation stage 2b; removed before final review.
import { read, put, replace, walk } from './workbench-write.mjs';
for (const path of walk('src/view/dashboard/view')) {
 if (!/\.tsx?$/.test(path)) continue;
 put(path, read(path).replace(/this\.contentEl as HTMLElement(?: \| undefined)?/g, 'this.contentEl'));
}
replace('scripts/verify-dashboard-isolation.ts', 'containerEl: habitShell,', 'containerEl: habitShell,\n\tcontentEl: habitRoot,');
const statusPath = 'speculo/.speculo/specdev/status.json';
const status = JSON.parse(read(statusPath));
if (!status.active.some((entry) => entry.change === '2026-10-05-unified-workbench')) status.active.push({ change: '2026-10-05-unified-workbench' });
put(statusPath, JSON.stringify(status, null, 2) + '\n');
replace('src/view/hosts/obsidian/native-surface.ts', 'close: () => void;', 'close: () => void;\n\tactivate?: () => Promise<void>;');
replace('src/view/hosts/obsidian/native-surface.ts', '\tonResize(): void', '\tsetVisible(visible: boolean): void { if (visible) this.onResize(); }\n\tonResize(): void');

put('src/shared/i18n/workbench.ts', String.raw`
export const messages = {
 en: {
  'workbench.title': 'NAND', 'workbench.open': 'Open workbench', 'workbench.home': 'Home',
  'workbench.navigation': 'Workbench navigation', 'workbench.search': 'Find a feature',
  'workbench.toggleNavigation': 'Toggle navigation', 'workbench.closeNavigation': 'Close navigation',
  'workbench.resizeNavigation': 'Resize navigation', 'workbench.expand': 'Expand section', 'workbench.collapse': 'Collapse section',
  'workbench.agent': 'AI Agent', 'workbench.running': 'Sessions', 'workbench.history': 'History', 'workbench.usage': 'Usage',
  'workbench.browser': 'Browser', 'workbench.contacts': 'Archives', 'workbench.people': 'People', 'workbench.companies': 'Companies',
  'workbench.automations': 'Automations', 'workbench.tasks': 'Tasks', 'workbench.runs': 'Run history', 'workbench.notifications': 'Notifications',
  'workbench.settings': 'Settings', 'workbench.manage': 'Manage features', 'workbench.more': 'Page actions',
  'workbench.openStandalone': 'Open in a native tab', 'workbench.loading': 'Opening…', 'workbench.failed': 'Unable to open this page',
  'workbench.retry': 'Retry', 'workbench.disabled': 'This feature is turned off. Your data has not been removed.',
  'workbench.unsupported': 'This feature is not supported on this device.', 'workbench.notReady': 'This feature is not ready.',
  'workbench.missing': 'The selected resource is no longer available.', 'workbench.noResults': 'No matching features',
  'workbench.closePage': 'Close this page', 'workbench.pages': 'Open pages', 'workbench.newPage': 'New page',
 },
 zh: {
  'workbench.title': 'NAND', 'workbench.open': '打开工作台', 'workbench.home': '首页',
  'workbench.navigation': '工作台导航', 'workbench.search': '查找功能',
  'workbench.toggleNavigation': '切换导航栏', 'workbench.closeNavigation': '关闭导航栏',
  'workbench.resizeNavigation': '调整导航栏宽度', 'workbench.expand': '展开分组', 'workbench.collapse': '收起分组',
  'workbench.agent': 'AI Agent', 'workbench.running': '会话', 'workbench.history': '历史', 'workbench.usage': '用量',
  'workbench.browser': '浏览器', 'workbench.contacts': '档案', 'workbench.people': '个人', 'workbench.companies': '企业',
  'workbench.automations': '自动化', 'workbench.tasks': '任务', 'workbench.runs': '运行记录', 'workbench.notifications': '通知',
  'workbench.settings': '设置', 'workbench.manage': '功能管理', 'workbench.more': '页面操作',
  'workbench.openStandalone': '在原生标签页中打开', 'workbench.loading': '正在打开…', 'workbench.failed': '无法打开此页面',
  'workbench.retry': '重试', 'workbench.disabled': '此功能已关闭，原有数据仍然保留。',
  'workbench.unsupported': '当前设备不支持此功能。', 'workbench.notReady': '此功能尚未就绪。',
  'workbench.missing': '所选资源已不可用。', 'workbench.noResults': '没有匹配的功能',
  'workbench.closePage': '关闭当前页面', 'workbench.pages': '已打开的页面', 'workbench.newPage': '新建页面',
 },
};
`);
put('src/shared/i18n/runtime.ts', "import { messages as workbench } from './workbench';\n" + read('src/shared/i18n/runtime.ts'));
replace('src/shared/i18n/runtime.ts', 'en: mergeDicts(', 'en: mergeDicts(\n\t\tworkbench.en,');
replace('src/shared/i18n/runtime.ts', 'zh: mergeDicts(', 'zh: mergeDicts(\n\t\tworkbench.zh,');

put('src/view/workbench/FeatureNavigator.tsx', String.raw`
import { useState } from 'preact/hooks';
import { t } from '../../shared/i18n';
import { Icon } from '../primitives/Icon';
import type { NavigationItem, WorkbenchTarget } from '../contracts/workbench';

export interface FeatureNavigatorProps {
 items: readonly NavigationItem[];
 current: WorkbenchTarget;
 expanded: readonly string[];
 toggle: (id: string) => void;
 open: (target: WorkbenchTarget) => void;
}
/** Ordinary disclosure navigation: focusing or expanding never launches a feature. */
export function FeatureNavigator(props: FeatureNavigatorProps) {
 const [query, setQuery] = useState('');
 const needle = query.trim().toLocaleLowerCase();
 const matches = (item: NavigationItem) => t(item.labelKey).toLocaleLowerCase().includes(needle);
 const rows = props.items.filter((item) => !needle || matches(item) || item.children?.some(matches));
 return <nav aria-label={t('workbench.navigation')} className="nand-workbench-navigation">
  <label className="nand-ui-field nand-workbench-search">
   <span>{t('workbench.search')}</span>
   <input type="search" value={query} onInput={(event) => setQuery(event.currentTarget.value)} placeholder={t('workbench.search')} />
  </label>
  <ul className="nand-workbench-nav-list">
   {rows.map((item) => {
    const active = item.target?.feature === props.current.feature;
    const expanded = !!needle || props.expanded.includes(item.id);
    return <li key={item.id}>
     <div className={'nand-workbench-nav-row' + (active ? ' is-active' : '')}>
      <button type="button" className="nand-workbench-nav-link" aria-current={active && !props.current.section ? 'page' : undefined} onClick={() => { if (item.target) props.open(item.target); }}>
       <Icon name={item.icon} /><span>{t(item.labelKey)}</span>
       {!!item.badge && <span className="nand-ui-badge">{item.badge}</span>}
      </button>
      {!!item.children?.length && <button type="button" className="nand-ui-icon-btn" aria-label={t(expanded ? 'workbench.collapse' : 'workbench.expand')} aria-expanded={expanded} onClick={() => props.toggle(item.id)}><Icon name={expanded ? 'chevron-down' : 'chevron-right'} /></button>}
     </div>
     {!!item.children?.length && <ul className="nand-workbench-nav-children" hidden={!expanded}>
      {item.children.filter((child) => !needle || matches(item) || matches(child)).map((child) => <li key={child.id}>
       <button type="button" className="nand-workbench-nav-link" aria-current={active && child.target?.section === props.current.section ? 'page' : undefined} onClick={() => { if (child.target) props.open(child.target); }}>{t(child.labelKey)}</button>
      </li>)}
     </ul>}
    </li>;
   })}
  </ul>
  {rows.length === 0 && <p className="nand-workbench-nav-empty">{t('workbench.noResults')}</p>}
 </nav>;
}
`);
put('src/view/workbench/FeaturePageFrame.tsx', String.raw`
import type { ComponentChildren, Ref } from 'preact';
import { t } from '../../shared/i18n';
import { Icon } from '../primitives/Icon';

export interface FeaturePageFrameProps {
 title: string;
 busy: boolean;
 error?: string;
 unavailable?: string;
 toggleNavigation: () => void;
 more: (event: MouseEvent) => void;
 retry: () => void;
 settings: () => void;
 contentRef: Ref<HTMLDivElement>;
 inert?: boolean;
 actions?: ComponentChildren;
}
export function FeaturePageFrame(props: FeaturePageFrameProps) {
 return <main className="nand-workbench-main" inert={props.inert}>
  <header className="nand-workbench-header">
   <button type="button" className="nand-ui-icon-btn" aria-label={t('workbench.toggleNavigation')} onClick={props.toggleNavigation}><Icon name="panel-left" /></button>
   <h2>{props.title}</h2><span className="nand-ui-spacer" />
   {props.busy && <span role="status" className="nand-workbench-progress">{t('workbench.loading')}</span>}
   {props.actions}
   <button type="button" className="nand-ui-icon-btn" aria-label={t('workbench.more')} onClick={props.more}><Icon name="ellipsis" /></button>
  </header>
  {props.error && <div role="alert" className="nand-workbench-error"><strong>{t('workbench.failed')}</strong><span>{props.error}</span><button type="button" className="nand-ui-btn" onClick={props.retry}>{t('workbench.retry')}</button></div>}
  {props.unavailable && <section className="nand-workbench-unavailable"><p>{props.unavailable}</p><button type="button" className="nand-ui-btn" onClick={props.settings}>{t('workbench.manage')}</button></section>}
  <div className="nand-workbench-pages" ref={props.contentRef} aria-busy={props.busy} />
 </main>;
}
`);
put('src/view/workbench/WorkbenchShell.tsx', String.raw`
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Ref } from 'preact';
import { t } from '../../shared/i18n';
import { Icon } from '../primitives/Icon';
import type { NavigationItem, WorkbenchTarget } from '../contracts/workbench';
import { navigationWidth, type WorkbenchState } from './navigation-state';
import { FeatureNavigator } from './FeatureNavigator';
import { FeaturePageFrame } from './FeaturePageFrame';

export interface WorkbenchShellProps {
 state: WorkbenchState;
 items: readonly NavigationItem[];
 title: string;
 busy: boolean;
 error?: string;
 unavailable?: string;
 ownerWindow: Window;
 change: (patch: Partial<WorkbenchState>) => void;
 navigate: (target: WorkbenchTarget) => void;
 settings: () => void;
 more: (event: MouseEvent) => void;
 retry: () => void;
 contentRef: Ref<HTMLDivElement>;
}
export function WorkbenchShell(props: WorkbenchShellProps) {
 const root = useRef<HTMLDivElement>(null), sidebar = useRef<HTMLElement>(null);
 const drag = useRef<{ x: number; width: number } | null>(null);
 const [compact, setCompact] = useState(false), [drawerOpen, setDrawerOpen] = useState(false);
 const visible = compact ? drawerOpen : props.state.sidebarOpen;
 useEffect(() => {
  const element = root.current;
  const Observer = (props.ownerWindow as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  if (!element || !Observer) return;
  const measure = () => setCompact(element.getBoundingClientRect().width < 760);
  const observer = new Observer(measure); observer.observe(element); measure();
  return () => observer.disconnect();
 }, [props.ownerWindow]);
 useEffect(() => {
  if (!compact || !drawerOpen) return;
  const previous = root.current?.ownerDocument.activeElement as HTMLElement | null;
  sidebar.current?.querySelector<HTMLElement>('input,button')?.focus();
  return () => { if (previous?.isConnected) previous.focus(); };
 }, [compact, drawerOpen, props.ownerWindow]);
 const open = (target: WorkbenchTarget) => { props.navigate(target); setDrawerOpen(false); };
 return <div ref={root} className={'nand-workbench' + (compact ? ' is-compact' : '') + (visible ? ' is-navigation-open' : '')} style={{ '--nand-workbench-nav-width': navigationWidth(props.state.sidebarWidth) + 'px' }} onKeyDown={(event) => {
  if (!compact || !drawerOpen || event.isComposing) return;
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDrawerOpen(false); }
  if (event.key !== 'Tab') return;
  const controls = Array.from(sidebar.current?.querySelectorAll<HTMLElement>('input,button:not(:disabled)') ?? []).filter((element) => !element.closest('[hidden]'));
  const first = controls[0], last = controls[controls.length - 1], focused = event.currentTarget.ownerDocument.activeElement;
  if (event.shiftKey && focused === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && focused === last) { event.preventDefault(); first?.focus(); }
 }}>
  {compact && drawerOpen && <button type="button" className="nand-workbench-backdrop" tabIndex={-1} aria-label={t('workbench.closeNavigation')} onClick={() => setDrawerOpen(false)} />}
  <aside ref={sidebar} className="nand-workbench-nav" hidden={!visible} role={compact && drawerOpen ? 'dialog' : undefined} aria-modal={compact && drawerOpen ? true : undefined} aria-label={t('workbench.navigation')}>
   <div className="nand-workbench-brand"><Icon name="panels-top-left" /><strong>{t('workbench.title')}</strong><span className="nand-ui-spacer" />{compact && <button type="button" className="nand-ui-icon-btn" aria-label={t('workbench.closeNavigation')} onClick={() => setDrawerOpen(false)}><Icon name="x" /></button>}</div>
   <FeatureNavigator items={props.items} current={props.state.target} expanded={props.state.expanded} open={open} toggle={(id) => props.change({ expanded: props.state.expanded.includes(id) ? props.state.expanded.filter((value) => value !== id) : [...props.state.expanded, id] })} />
   <footer className="nand-workbench-nav-footer"><button type="button" className="nand-workbench-nav-link" onClick={props.settings}><Icon name="settings" /><span>{t('workbench.settings')}</span></button></footer>
  </aside>
  {!compact && visible && <button type="button" className="nand-workbench-resizer" role="separator" aria-label={t('workbench.resizeNavigation')} aria-orientation="vertical" aria-valuemin={208} aria-valuemax={280} aria-valuenow={navigationWidth(props.state.sidebarWidth)} onKeyDown={(event) => {
   const width = event.key === 'Home' ? 208 : event.key === 'End' ? 280 : event.key === 'ArrowLeft' ? props.state.sidebarWidth - 8 : event.key === 'ArrowRight' ? props.state.sidebarWidth + 8 : undefined;
   if (width !== undefined) { event.preventDefault(); event.stopPropagation(); props.change({ sidebarWidth: navigationWidth(width) }); }
  }} onPointerDown={(event) => { if (event.button !== 0) return; drag.current = { x: event.clientX, width: props.state.sidebarWidth }; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); }} onPointerMove={(event) => { if (drag.current) props.change({ sidebarWidth: navigationWidth(drag.current.width + event.clientX - drag.current.x) }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} />}
  <FeaturePageFrame title={props.title} busy={props.busy} error={props.error} unavailable={props.unavailable} inert={compact && drawerOpen} contentRef={props.contentRef} more={props.more} retry={props.retry} settings={props.settings} toggleNavigation={() => { if (compact) setDrawerOpen(!drawerOpen); else props.change({ sidebarOpen: !props.state.sidebarOpen }); }} />
 </div>;
}
`);

put('src/view/hosts/obsidian/workbench-host.ts', String.raw`
import type { FeatureAvailability, NavigationItem, WorkbenchFeature, WorkbenchTarget } from '../../contracts/workbench';
import type { NativeSurface, NativeSurfaceContext } from './native-surface';

export interface WorkbenchPageBinding {
 surface: NativeSurface;
 navigate(target: WorkbenchTarget, signal: AbortSignal): Promise<void>;
 getState?: () => Record<string, unknown>;
 getTarget?: () => WorkbenchTarget;
 restore?: (state: Record<string, unknown>) => Promise<void>;
}
export interface WorkbenchContribution {
 id: WorkbenchFeature;
 navigation: NavigationItem;
 availability(): FeatureAvailability;
 stateKeys: readonly string[];
 resourcePages?: boolean;
 create(context: NativeSurfaceContext, target: WorkbenchTarget, state: Record<string, unknown>, signal: AbortSignal): Promise<WorkbenchPageBinding>;
}
export interface WorkbenchHost {
 contributions: readonly WorkbenchContribution[];
 subscribe(listener: () => void): () => void;
 openSettings(): void;
 openStandalone(target: WorkbenchTarget, state: Record<string, unknown>, ownerWindow: Window): Promise<void>;
 report(error: unknown): void;
}
`);
put('src/view/hosts/obsidian/workbench-pages.ts', String.raw`
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
`);

put('src/view/hosts/obsidian/workbench-view.tsx', String.raw`
import { ItemView, Menu, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { render } from 'preact';
import { onLanguageChanged, t } from '../../../shared/i18n';
import type { WorkbenchTarget } from '../../contracts/workbench';
import { WorkbenchShell } from '../../workbench/WorkbenchShell';
import { normalizeWorkbenchState, type WorkbenchState } from '../../workbench/navigation-state';
import { NavigationTransition } from '../../workbench/navigation-transition';
import { WORKBENCH_VIEW_TYPE } from '../../workbench/view-type';
import type { WorkbenchHost } from './workbench-host';
import type { NativeSurface } from './native-surface';
import { WorkbenchPages } from './workbench-pages';

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
  return this.navigate(this.state.target);
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
    this.state = { ...this.state, target };
    this.app.workspace.requestSaveLayout();
   });
  } catch (error) {
   if (revision === this.revision) this.error = error instanceof Error ? error.message : String(error);
   throw error;
  } finally {
   if (revision === this.revision) { this.busy = false; this.draw(); }
  }
 }
 private async refreshAvailability(): Promise<void> {
  if (!this.opened) return;
  const changed = await this.pages?.refreshAvailability();
  if (changed || this.unavailable) { this.transition.invalidate(); await this.navigate(this.state.target); }
  else this.draw();
 }
 async disposeSurface(): Promise<void> {
  this.opened = false; this.revision++; this.transition.dispose();
  await this.pages?.dispose(); this.pages = undefined;
  render(null, this.contentEl);
 }
 onClose(): Promise<void> { return this.disposeSurface(); }
 onResize(): void { this.pages?.getCurrent()?.surface.onResize(); }
 onPaneMenu(menu: Menu, source: string): void {
  const binding = this.pages?.getCurrent();
  menu.addItem((item) => item.setTitle(t('workbench.openStandalone')).setIcon('external-link').onClick(() => {
   void this.host.openStandalone(binding?.getTarget?.() ?? this.state.target, binding?.getState?.() ?? binding?.surface.getState() ?? {}, this.contentEl.win).catch(this.host.report);
  }));
  binding?.surface.onPaneMenu(menu, source);
 }
 private more = (event: MouseEvent): void => { const menu = new Menu(); this.onPaneMenu(menu, 'workbench'); menu.showAtMouseEvent(event); };
 private change = (patch: Partial<WorkbenchState>): void => {
  this.state = normalizeWorkbenchState({ ...this.state, ...patch }); this.draw(); this.app.workspace.requestSaveLayout();
 };
 private open = (target: WorkbenchTarget): void => { void this.navigate(target).catch(this.host.report); };
 private retry = (): void => { this.transition.invalidate(); this.open(this.pending); };
 private content = (element: HTMLDivElement | null): void => {
  if (element && !this.pages) this.pages = new WorkbenchPages(this, element, this.host.contributions, (target) => this.navigate(target), this.host.report);
 };
 private draw(): void {
  if (!this.opened) return;
  const contributions = this.host.contributions;
  const items = contributions.filter((item) => item.id === 'dashboard' || (item.availability().enabled && item.availability().supported)).map((item) => item.navigation);
  const current = contributions.find((item) => item.id === this.state.target.feature);
  render(<WorkbenchShell state={this.state} items={items} title={t(current?.navigation.labelKey ?? 'workbench.title')} busy={this.busy} error={this.error} unavailable={this.unavailable} ownerWindow={this.contentEl.win} change={this.change} navigate={this.open} settings={this.host.openSettings} more={this.more} retry={this.retry} contentRef={this.content} />, this.contentEl);
 }
}
`);

put('src/view/notifications/notification-presentation.tsx', String.raw`
import { render } from 'preact';
import { t, onLanguageChanged } from '../../shared/i18n';
import type { NotificationService } from '../../core/notifications/service';
import { NativeSurface, type NativeSurfaceContext } from '../hosts/obsidian/native-surface';
import { InboxPanel } from './InboxPanel';

export class NotificationPresentation extends NativeSurface {
 constructor(context: NativeSurfaceContext, private readonly service: NotificationService, private readonly report: (error: unknown) => void) { super(context); }
 getViewType(): string { return 'nand-notification-surface'; }
 getDisplayText(): string { return t('workbench.notifications'); }
 getIcon(): string { return 'bell'; }
 onOpen(): Promise<void> {
  this.contentEl.addClass('nand-inbox');
  this.register(this.service.subscribe(() => this.draw()));
  this.register(onLanguageChanged(() => this.draw()));
  this.draw(); return Promise.resolve();
 }
 private draw(): void {
  render(<InboxPanel records={this.service.records} unread={this.service.unread} markRead={(record) => { void this.service.markRead(record.id).catch(this.report); }} clearRead={() => { void this.service.clearRead().catch(this.report); }} open={(record) => { void this.service.open(record).catch(this.report); }} />, this.contentEl);
 }
 onClose(): Promise<void> { render(null, this.contentEl); return Promise.resolve(); }
}
`);

put('src/plugin/workbench/dashboard-page.ts', String.raw`
import { normalizeWorkspacePath } from '../../core/workspace/workspace-registry';
import type { DashboardHost } from '../../view/dashboard/host';
import { DashboardSurface } from '../../view/dashboard/view/dashboard-surface';
import type { NativeSurfaceContext } from '../../view/hosts/obsidian/native-surface';
import type { WorkbenchPageBinding } from '../../view/hosts/obsidian/workbench-host';
import type { WorkbenchTarget } from '../../view/contracts/workbench';
import { t } from '../../shared/i18n';
import type DashboardPlugin from '../main';

/** Each workbench keeps its own board pointer; the global registry remains authoritative. */
export function createDashboardPage(plugin: DashboardPlugin, context: NativeSurfaceContext, target: WorkbenchTarget, state: Record<string, unknown>): WorkbenchPageBinding {
 let path = normalizeWorkspacePath(target.resourceId ?? (typeof state.dashboardFile === 'string' ? state.dashboardFile : plugin.settings.dashboardFile));
 let switching: Promise<void> = Promise.resolve();
 let surface: DashboardSurface;
 const switchPath = (requested: string): Promise<void> => {
  const next = normalizeWorkspacePath(requested);
  const operation = switching.then(async () => {
   if (!next || next === path) return;
   if (!plugin.app.vault.getFileByPath(next + '.md')) throw new Error(t('workbench.missing'));
   const previous = path;
   path = next;
   try { await surface.applyWorkspaceSwitch(); } catch (error) { path = previous; throw error; }
   plugin.app.workspace.requestSaveLayout();
  });
  switching = operation.catch(() => {});
  return operation;
 };
 const host: DashboardHost = {
  app: plugin.app, manifest: plugin.manifest,
  get settings() { return { ...plugin.settings, dashboardFile: path }; },
  set settings(value) { const { dashboardFile, modules, ...rest } = value; path = normalizeWorkspacePath(dashboardFile); void modules; plugin.settings = { ...plugin.settings, ...rest }; },
  get automationHost() { return plugin.automationHost; },
  saveSettings: () => plugin.saveSettings(), refreshAllDashboards: () => plugin.refreshAllDashboards(),
  openHome: () => plugin.openHome(), openBrowser: (request) => plugin.openBrowser(request),
  switchWorkspace: switchPath,
  createWorkspace: async (name) => { await plugin.createWorkspace(name); await switchPath(plugin.settings.dashboardFile); },
  renameWorkspace: (file, name) => plugin.renameWorkspace(file, name),
  removeWorkspace: async (file) => { await plugin.removeWorkspace(file); if (!plugin.settings.workspaceFiles.includes(path)) await switchPath(plugin.settings.dashboardFile); },
 };
 surface = new DashboardSurface(context, host);
 surface.registerEvent(plugin.app.vault.on('rename', (file, oldPath) => {
  if (normalizeWorkspacePath(oldPath) === path) { path = normalizeWorkspacePath(file.path); void surface.applyWorkspaceSwitch().catch((error: unknown) => console.error('[NAND workbench]', error)); }
 }));
 return {
  surface, getState: () => ({ dashboardFile: path }), getTarget: () => ({ feature: 'dashboard', resourceId: path }),
  navigate: async (next, signal) => {
   if (signal.aborted) return;
   if (next.resourceId) await switchPath(next.resourceId);
   if (!signal.aborted && next.focusId && !(await surface.focusWidget(next.focusId))) throw new Error(t('workbench.missing'));
  },
 };
}
`);
put('src/plugin/workbench/compose-workbench.ts', String.raw`
import { Notice, type Window as NeverWindow } from 'obsidian';
import type DashboardPlugin from '../main';
import { t } from '../../shared/i18n';
import { WorkbenchView } from '../../view/hosts/obsidian/workbench-view';
import type { WorkbenchContribution, WorkbenchHost } from '../../view/hosts/obsidian/workbench-host';
import type { WorkbenchTarget } from '../../view/contracts/workbench';
import { WORKBENCH_VIEW_TYPE } from '../../view/workbench/view-type';
import { ContactsPresentation } from '../../view/contacts/contacts-presentation';
import { AutomationPresentation } from '../../view/automations/automation-presentation';
import { NotificationPresentation } from '../../view/notifications/notification-presentation';
import { createDashboardPage } from './dashboard-page';

export function composeWorkbench(plugin: DashboardPlugin) {
 const listeners = new Set<() => void>();
 const pending = new WeakMap<Window, Promise<WorkbenchView>>();
 const report = (error: unknown): void => { console.error('[NAND workbench]', error); new Notice(error instanceof Error ? error.message : String(error)); };
 const ready = () => ({ enabled: true, supported: true, ready: true });
 const contributions: WorkbenchContribution[] = [
  { id: 'dashboard', navigation: { id: 'dashboard', labelKey: 'workbench.home', icon: 'home', target: { feature: 'dashboard' } }, availability: () => ({ ...ready(), enabled: plugin.settings.modules.dashboard }), stateKeys: ['dashboardFile'], create: async (context, target, state) => createDashboardPage(plugin, context, target, state) },
  { id: 'contacts', navigation: { id: 'contacts', labelKey: 'workbench.contacts', icon: 'contact-round', target: { feature: 'contacts' }, children: [
   { id: 'contacts-person', labelKey: 'workbench.people', icon: 'user', target: { feature: 'contacts', section: 'person' } },
   { id: 'contacts-company', labelKey: 'workbench.companies', icon: 'building-2', target: { feature: 'contacts', section: 'company' } },
  ] }, availability: () => ({ ...ready(), enabled: plugin.settings.modules.contacts, ready: !!plugin.contactsHost }), stateKeys: ['query', 'page', 'selectedPath', 'selectedId', 'scroll'], create: async (context) => {
   const surface = new ContactsPresentation(context, plugin);
   return { surface, navigate: async (target, signal) => {
    if (signal.aborted) return;
    if (target.section === 'person' || target.section === 'company') surface.changeKind(target.section);
    if (target.resourceId) {
     await surface.controller?.ensureLoaded(); if (signal.aborted) return;
     const record = surface.controller?.index.get(target.resourceId) ?? surface.controller?.index.byPath.get(target.resourceId);
     if (!record) throw new Error(t('workbench.missing'));
     surface.select(record.path);
    }
   } };
  } },
  { id: 'automations', navigation: { id: 'automations', labelKey: 'workbench.automations', icon: 'workflow', target: { feature: 'automations' } }, availability: () => ({ ...ready(), ready: !!plugin.automationHost }), stateKeys: ['selected', 'search', 'filter', 'agentFilter'], create: async (context) => {
   if (!plugin.automationHost) throw new Error(t('automation.failedLoad'));
   const surface = new AutomationPresentation(context, plugin.automationHost.panelHost);
   return { surface, navigate: async (target, signal) => { if (!signal.aborted && target.resourceId) surface.showRun(target.resourceId); } };
  } },
  { id: 'notifications', navigation: { id: 'notifications', labelKey: 'workbench.notifications', icon: 'bell', target: { feature: 'notifications' } }, availability: () => ({ ...ready(), ready: !!plugin.automationHost }), stateKeys: [], create: async (context) => {
   if (!plugin.automationHost) throw new Error(t('automation.failedLoad'));
   return { surface: new NotificationPresentation(context, plugin.automationHost.notifications, report), navigate: async () => {} };
  } },
 ];
 const host: WorkbenchHost = {
  contributions, subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  openSettings: () => plugin.openHome(), report,
  openStandalone: async (target, state, ownerWindow) => {
   const anchor = plugin.app.workspace.getMostRecentLeaf();
   if (anchor && anchor.view.contentEl.win === ownerWindow) plugin.app.workspace.setActiveLeaf(anchor, { focus: false });
   const types = { dashboard: 'nand-dashboard-view', contacts: 'nand-contacts-view', automations: 'nand-automation-view' };
   const type = types[target.feature as keyof typeof types];
   if (!type) { if (target.feature === 'notifications') plugin.automationHost?.inbox(); return; }
   const leaf = plugin.app.workspace.getLeaf('tab');
   await leaf.setViewState({ type, active: true, state }); await plugin.app.workspace.revealLeaf(leaf);
  },
 };
 plugin.registerView(WORKBENCH_VIEW_TYPE, (leaf) => new WorkbenchView(leaf, host));
 const open = async (target?: WorkbenchTarget, ownerWindow?: Window, initial?: Record<string, unknown>): Promise<void> => {
  const workspace = plugin.app.workspace;
  const win = ownerWindow ?? workspace.getMostRecentLeaf()?.view.contentEl.win ?? workspace.containerEl.win;
  let view = workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE).find((leaf) => leaf.view.contentEl.win === win)?.view;
  if (!(view instanceof WorkbenchView)) {
   let opening = pending.get(win);
   if (!opening) {
    opening = (async () => {
     let anchor = workspace.getMostRecentLeaf();
     if (anchor?.view.contentEl.win !== win) { workspace.iterateAllLeaves((leaf) => { if (leaf.view.contentEl.win === win) anchor = leaf; }); }
     if (anchor?.view.contentEl.win === win) workspace.setActiveLeaf(anchor, { focus: false });
     const leaf = workspace.getLeaf('tab');
     await leaf.setViewState({ type: WORKBENCH_VIEW_TYPE, active: true, state: target ? { target } : undefined });
     if (!(leaf.view instanceof WorkbenchView)) throw new Error(t('workbench.notReady'));
     return leaf.view;
    })();
    pending.set(win, opening);
   }
   try { view = await opening; } finally { if (pending.get(win) === opening) pending.delete(win); }
  }
  if (!(view instanceof WorkbenchView)) throw new Error(t('workbench.notReady'));
  await workspace.revealLeaf(view.leaf);
  if (target) await view.navigate(target, initial);
 };
 const refresh = (): void => { for (const listener of listeners) listener(); };
 return { open, refresh, dispose: () => {
  for (const leaf of plugin.app.workspace.getLeavesOfType(WORKBENCH_VIEW_TYPE)) if (leaf.view instanceof WorkbenchView) void leaf.view.disposeSurface().catch(report);
  listeners.clear();
 } };
}
`);
// No application Window export is needed; all windows come from their owning DOM element.
replace('src/plugin/workbench/compose-workbench.ts', "import { Notice, type Window as NeverWindow } from 'obsidian';", "import { Notice } from 'obsidian';");

// The existing scheduler and notification service are shared, never recreated for the new page.
put('src/plugin/workflows/automation-host.ts', "import type { AutomationViewHost } from '../../view/automations/panel-contract';\n" + read('src/plugin/workflows/automation-host.ts'));
replace('src/plugin/workflows/automation-host.ts', 'service: AutomationService; setExecutionEnabled', 'service: AutomationService; panelHost: AutomationViewHost; notifications: NotificationService; setExecutionEnabled');
replace('src/plugin/workflows/automation-host.ts', '\tplugin.registerView(\n\t\tAUTOMATION_VIEW_TYPE,\n\t\t(leaf) => new AutomationView(leaf, { service, retry, edit: (d) => edit(d?.source, d?.name, d), inbox, pin }),\n\t);', '\tconst panelHost: AutomationViewHost = { service, retry, edit: (d) => edit(d?.source, d?.name, d), inbox, pin };\n\tplugin.registerView(AUTOMATION_VIEW_TYPE, (leaf) => new AutomationView(leaf, panelHost));');
replace('src/plugin/workflows/automation-host.ts', '\treturn {\n\t\tservice,', '\treturn {\n\t\tservice, panelHost, notifications,');
put('src/plugin/main.ts', "import { composeWorkbench } from './workbench/compose-workbench';\nimport type { WorkbenchTarget } from '../view/contracts/workbench';\nimport { nativeSurfaces } from '../view/hosts/obsidian/native-surface';\nimport { DashboardSurface } from '../view/dashboard/view/dashboard-surface';\n" + read('src/plugin/main.ts'));
replace('src/plugin/main.ts', 'automationHost?: AutomationUiPort & { dispose(): void; inbox(): void; setExecutionEnabled(enabled: boolean): Promise<void> };', 'automationHost?: Awaited<ReturnType<typeof createAutomationHost>>;\n\tprivate workbench?: ReturnType<typeof composeWorkbench>;');
replace('src/plugin/main.ts', '\t\tthis.addSettingTab(this.settingsTab);', '\t\tthis.addSettingTab(this.settingsTab);\n\t\tthis.workbench = composeWorkbench(this);\n\t\tthis.register(() => this.workbench?.dispose());');
replace('src/plugin/main.ts', '\topenHome(): void {', '\topenWorkbench(target?: WorkbenchTarget, ownerWindow?: Window, state?: Record<string, unknown>): Promise<void> {\n\t\treturn this.workbench?.open(target, ownerWindow, state) ?? Promise.reject(new Error(t(\'workbench.notReady\')));\n\t}\n\n\topenHome(): void {');
replace('src/plugin/main.ts', '\t\t\tawait this.settingsStore.save({ ...this.settings, terminalAgent: null });\n\t\t});', '\t\t\tawait this.settingsStore.save({ ...this.settings, terminalAgent: null });\n\t\t});\n\t\tthis.workbench?.refresh();');
replace('src/plugin/main.ts', '\trefreshAllDashboards(): void {', '\trefreshAllDashboards(): void {\n\t\tfor (const surface of nativeSurfaces(this.app)) if (surface instanceof DashboardSurface && surface.embedded) void surface.refresh();');
replace('src/plugin/commands.ts', 'export function registerShellCommands(plugin: DashboardPlugin): void {', "export function registerShellCommands(plugin: DashboardPlugin): void {\n\tplugin.addCommand({ id: 'open-workbench', nameKey: 'workbench.open', name: t('workbench.open'), callback: () => { void plugin.openWorkbench().catch(console.error); } });");

put('styles.css', read('styles.css') + String.raw`

/* NAND unified workbench: neutral shell, isolated from dashboard palettes. */
.nand-workbench-view { padding: 0; overflow: hidden; }
.nand-workbench { display: flex; position: relative; width: 100%; height: 100%; min-width: 0; min-height: 0; color: var(--text-normal); background: var(--nand-surface); }
.nand-workbench-nav { width: var(--nand-workbench-nav-width, 232px); flex: 0 0 var(--nand-workbench-nav-width, 232px); min-height: 0; display: flex; flex-direction: column; background: var(--nand-surface-muted); }
.nand-workbench-nav[hidden], .nand-workbench-page[hidden], .nand-workbench-nav-children[hidden] { display: none; }
.nand-workbench-brand { display: flex; align-items: center; gap: var(--size-4-2); padding: var(--size-4-4); min-height: var(--nand-touch-target); }
.nand-workbench-brand strong { font-weight: 600; }
.nand-workbench-navigation { flex: 1; min-height: 0; overflow: auto; padding: 0 var(--size-4-2); }
.nand-workbench-search { margin: 0 var(--size-4-1) var(--size-4-4); }
.nand-workbench-search input { width: 100%; }
.nand-workbench-nav-list, .nand-workbench-nav-children { list-style: none; padding: 0; margin: 0; }
.nand-workbench-nav-children { margin-inline-start: var(--size-4-6); padding-block: var(--size-4-1); }
.nand-workbench-nav-row { display: flex; align-items: center; border-radius: var(--nand-radius-sm); margin-block: var(--size-4-1); }
.nand-workbench-nav-link { display: flex; align-items: center; gap: var(--size-4-2); width: 100%; min-height: 36px; padding: var(--size-4-2) var(--size-4-3); border: 0; border-radius: var(--nand-radius-sm); background: transparent; box-shadow: none; color: var(--text-normal); text-align: start; justify-content: flex-start; cursor: pointer; }
.nand-workbench-nav-link > span:not(.nand-ui-badge) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nand-workbench-nav-link .nand-ui-badge { margin-inline-start: auto; }
.nand-workbench-nav-link:hover, .nand-workbench-nav-row:hover { background: var(--nand-surface-hover); }
.nand-workbench-nav-row.is-active, .nand-workbench-nav-link[aria-current="page"] { background: var(--nand-accent-soft); color: var(--text-accent); }
.nand-workbench-nav-link:focus-visible, .nand-workbench-resizer:focus-visible { outline: 2px solid var(--interactive-accent); outline-offset: -2px; }
.nand-workbench-nav-footer { padding: var(--size-4-3) var(--size-4-2); border-top: 1px solid var(--nand-border); }
.nand-workbench-nav-empty { padding: var(--size-4-3); color: var(--text-muted); }
.nand-workbench-resizer { width: 4px; flex: 0 0 4px; padding: 0; margin: 0; border: 0; border-radius: 0; box-shadow: none; background: var(--nand-border); cursor: col-resize; touch-action: none; }
.nand-workbench-main { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; overflow: hidden; }
.nand-workbench-header { display: flex; align-items: center; flex: 0 0 auto; gap: var(--size-4-2); padding: var(--size-4-2) var(--size-4-3); border-bottom: 1px solid var(--nand-border); min-height: var(--nand-touch-target); }
.nand-workbench-header h2 { font-size: var(--nand-text-body); font-weight: 600; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nand-workbench-progress { font-size: var(--nand-text-caption); color: var(--text-muted); }
.nand-workbench-pages { flex: 1; position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.nand-workbench-page { width: 100%; height: 100%; min-height: 0; min-width: 0; overflow: auto; }
.nand-workbench-error { display: flex; align-items: center; gap: var(--size-4-2); flex-wrap: wrap; padding: var(--size-4-3); color: var(--text-normal); border-bottom: 1px solid var(--nand-tone-error); }
.nand-workbench-error span { overflow-wrap: anywhere; }
.nand-workbench-unavailable { padding: var(--size-4-8); text-align: center; }
.nand-workbench-backdrop { position: absolute; inset: 0; z-index: 9; width: 100%; height: 100%; border: 0; border-radius: 0; background: var(--background-modifier-cover); box-shadow: none; }
.nand-workbench.is-compact > .nand-workbench-nav { position: absolute; inset-block: 0; inset-inline-start: 0; max-width: 85%; z-index: 10; box-shadow: var(--nand-shadow-lg); }
.nand-workbench.is-compact .nand-workbench-nav-link, .nand-workbench.is-compact .nand-ui-icon-btn { min-height: var(--nand-touch-target); }
.nand-workbench.is-compact .nand-workbench-progress { display: none; }
@media (prefers-reduced-motion: reduce) { .nand-workbench * { scroll-behavior: auto; transition-duration: 0s; animation-duration: 0s; } }
`);
