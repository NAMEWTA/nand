import type { PageCreate } from '../../../app/contracts/workbench-host';
import type { AutomationViewHost } from './panel-contract';
import { AutomationPresentation } from './automation-presentation';

/** Automations page: tasks and run history. */
export const createAutomationsPage = (host: () => AutomationViewHost | undefined, unavailable: () => Error): PageCreate => async (context) => {
	const panelHost = host();
	if (!panelHost) throw unavailable();
	const surface = new AutomationPresentation(context, panelHost);
	return {
		surface,
		getTarget: () => surface.getTarget(),
		navigate: async (target, signal) => {
			if (signal.aborted) return;
			if (target.focusId === 'edit') surface.startEdit(panelHost.takeEdit?.() ?? {});
			else if (target.resourceId) surface.showRun(target.resourceId);
			else surface.showSection(target.section);
		},
	};
};
