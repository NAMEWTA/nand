import type { PageCreate } from '../../../app/contracts/workbench-host';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import { SyncPresentation, type SyncPageHost, type SyncSection } from './sync-presentation';

const sectionOf = (target: WorkbenchTarget): SyncSection => (target.section === 'history' ? 'history' : 'changes');

/** Git sync page (sections `changes` and `history`). */
export const createSyncPage = (host: SyncPageHost): PageCreate => async (context, target) => {
	const surface = new SyncPresentation(context, host, sectionOf(target));
	return {
		surface,
		getTarget: () => target,
		navigate: async (next) => {
			target = next;
			surface.setSection(sectionOf(next));
		},
	};
};
