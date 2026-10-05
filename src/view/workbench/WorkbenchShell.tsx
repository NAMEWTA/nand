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
