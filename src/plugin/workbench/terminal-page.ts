import { Platform, type ViewStateResult } from 'obsidian';
import { t } from '../../shared/i18n';
import type { WorkbenchContribution } from '../../view/hosts/obsidian/workbench-host';
import { planTerminalNavigation } from '../../view/workbench/terminal-resource';
import type { TerminalAgentController } from '../modules/terminal/controller';

export const createTerminalPage = (controller: () => TerminalAgentController | undefined): WorkbenchContribution['create'] => async (context, target, state, signal) => {
 const host = controller();
 if (!Platform.isDesktopApp || !host?.isActive() || signal.aborted) throw new Error(t('workbench.unsupported'));
 const { TerminalSurface } = await import('../../view/terminal/terminal-surface');
 const service = await host.getTerminalService();
 if (!host.isActive() || signal.aborted) throw new Error(t('workbench.notReady'));
 const surface = new TerminalSurface(context, service, host);
 const select = async (id: string | undefined, strict: boolean, navigationSignal = signal): Promise<void> => {
  if (!id || signal.aborted || navigationSignal.aborted) return;
  const session = service.getTerminal(id);
  if (!session) { if (strict) throw new Error(t('workbench.missing')); return; }
  await surface.selectPtySession(session, { signal: navigationSignal, focus: false });
 };
 return {
  surface,
  getTarget: () => ({ feature: 'terminal', section: surface.getSection(), resourceId: surface.getTerminalInstance()?.id }),
  restore: async (raw) => { await surface.setState(raw, {} as ViewStateResult); await select(typeof raw.sessionId === 'string' ? raw.sessionId : undefined, false); },
  navigate: async (next, navigationSignal) => {
   const plan = planTerminalNavigation(next.resourceId, !!service.getTerminal(next.resourceId), navigationSignal.aborted);
   if (plan.selectId) await select(plan.selectId, false, navigationSignal);
   if (plan.openSection && !navigationSignal.aborted) surface.showSection(next.section);
  },
 };
};
