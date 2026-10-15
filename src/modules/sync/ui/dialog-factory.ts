import type { App } from 'obsidian';
import { t } from '../../../shared/i18n';
import type { SyncDialogs } from '../services/sync-service';

/** Keep React and Radix deferred until a service operation actually needs confirmation. */
export function syncDialogs(app: App): SyncDialogs {
	return {
		confirmUpstream: async (remote, branch) =>
			(await import('./dialogs')).confirmAction(app, {
				title: t('sync.upstreamTitle'),
				message: t('sync.upstreamConfirm', { remote, branch }),
				action: t('sync.action.push'),
			}),
	};
}
