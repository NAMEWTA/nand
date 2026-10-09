import type { PageCreate } from '../../../app/contracts/workbench-host';
import type { WorkbenchTarget } from '../../../app/contracts/workbench';
import type { NotificationService } from '../core/service';
import { NotificationPresentation } from './notification-presentation';

const filterOf = (target: WorkbenchTarget) => (target.section === 'unread' ? 'unread' : 'all');

/** Notification inbox page (sections `unread` and `all`). */
export const createInboxPage = (service: NotificationService, report: (error: unknown) => void): PageCreate => async (context, target) => {
	const surface = new NotificationPresentation(context, service, report, filterOf(target));
	return { surface, getTarget: () => target, navigate: async (next) => { target = next; surface.setFilter(filterOf(next)); } };
};
