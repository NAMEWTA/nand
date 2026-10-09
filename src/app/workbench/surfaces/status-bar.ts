import { Menu, Platform, setIcon, setTooltip } from 'obsidian';
import type { Plugin } from 'obsidian';
import { onLanguageChanged, t } from '../../../shared/i18n';
import type { AgentUsageSource } from '../../../modules/agent/api';
import { visibleStatuses } from '../status-policy';
import type { WorkbenchStatus, WorkbenchTarget } from '../../contracts/workbench';

export interface StatusContributionHost {
 read: () => readonly WorkbenchStatus[];
 quota: () => { source?: AgentUsageSource; pinned: boolean; chips?: () => string };
 enabled: () => boolean;
 open: (target: WorkbenchTarget, ownerWindow: Window) => Promise<void>;
 report: (error: unknown) => void;
}
/** Native status is a projection of existing services, never another provider poller. */
export function registerWorkbenchStatus(plugin: Plugin, host: StatusContributionHost) {
 if (!Platform.isDesktopApp) return { refresh: () => {}, dispose: () => {} };
 const item = plugin.addStatusBarItem();
 item.addClass('nand-workbench-status'); item.hidden = true;
 let source: AgentUsageSource | undefined, offSource: (() => void) | undefined;
 let disposed = false, queued = false, signature = '';
 const listeners: Array<() => void> = [];
 const clearButtons = () => { for (const off of listeners.splice(0)) off(); item.replaceChildren(); };
 const paint = () => {
  queued = false;
  if (disposed) return;
  const quota = host.quota();
  if (source !== quota.source) { offSource?.(); source = quota.source; offSource = source?.subscribe(refresh); }
  source?.setPinned(quota.pinned && host.enabled());
  const statuses = host.enabled() ? [...host.read()] : [];
  if (host.enabled() && quota.pinned) {
   statuses.push({ id: 'quota', kind: 'info', label: quota.chips?.() || t('agent.usage.chip'), target: { feature: 'terminal', section: 'usage' } });
  }
  const all = visibleStatuses(statuses, true, statuses.length);
  const nextSignature = JSON.stringify(all);
  if (signature === nextSignature) return;
  signature = nextSignature; clearButtons(); item.hidden = all.length === 0;
  const add = (label: string, glyph: string, action: (event: MouseEvent) => void) => {
   const button = item.createEl('button', { cls: 'nand-workbench-status-action', attr: { type: 'button', 'aria-label': label } });
   setIcon(button.createSpan(), glyph); button.createSpan({ text: label }); setTooltip(button, label);
   button.addEventListener('click', action); listeners.push(() => button.removeEventListener('click', action));
  };
  for (const status of all.slice(0, 2)) add(status.label, status.kind === 'error' ? 'circle-alert' : status.kind === 'running' ? 'loader-circle' : 'gauge', () => { void host.open(status.target, item.win).catch(host.report); });
  if (all.length > 2) add(t('workbench.statusMore'), 'ellipsis', (event) => {
   const menu = new Menu();
   for (const status of all.slice(2)) menu.addItem((entry) => entry.setTitle(status.label).onClick(() => { void host.open(status.target, item.win).catch(host.report); }));
   menu.showAtMouseEvent(event);
  });
 };
 function refresh(): void { if (disposed || queued) return; queued = true; queueMicrotask(paint); }
 const offLanguage = onLanguageChanged(refresh);
 refresh();
 const dispose = () => { if (disposed) return; disposed = true; offLanguage(); offSource?.(); clearButtons(); item.remove(); };
 plugin.register(dispose);
 return { refresh, dispose };
}
