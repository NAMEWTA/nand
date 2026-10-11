import type { WorkbenchContribution } from '../../../app/contracts/workbench-host';
import type { NewsActions } from '../services/news-actions';
import type { NewsService } from '../services/news-service';
import { NewsPresentation } from './NewsPresentation';
export const createNewsPage = (service: NewsService, actions: NewsActions): WorkbenchContribution['create'] => async (context, _target, _state, signal) => {
	if (signal.aborted) throw new Error('News page opening cancelled');
	const surface = new NewsPresentation(context, service, actions);
	return { surface, getTarget: () => surface.getTarget(), navigate: async (target, navigation) => { if (!navigation.aborted) surface.navigate(target); } };
};
