import type { App } from 'obsidian';
import { t } from '../../../shared/i18n/index';
import { Button } from '../../../ui/primitives/Button';
import { openDialog } from '../../../ui/primitives/dialog';
import { promptText } from '../../../ui/primitives/prompt';
import type { SyncDialogs } from '../services/sync-service';

/** Ask before an action; resolves true only when the action button was pressed. */
export function confirmAction(app: App, options: { title: string; message: string; action: string; danger?: boolean }): Promise<boolean> {
	return new Promise((resolve) => {
		let confirmed = false;
		openDialog(app, {
			title: options.title,
			content: () => <p class="nand-sync-dialog-text">{options.message}</p>,
			footer: (close) => (
				<>
					<Button onClick={close}>{t('common.cancel')}</Button>
					<Button variant={options.danger ? 'danger' : 'primary'} onClick={() => { confirmed = true; close(); }}>{options.action}</Button>
				</>
			),
			onClose: () => resolve(confirmed),
		});
	});
}

export function askText(app: App, title: string, label: string, value = '', placeholder = ''): Promise<string | null> {
	return promptText(app, { title, label, value, placeholder });
}

/** Dialogs the sync service needs while it runs. */
export function syncDialogs(app: App): SyncDialogs {
	return {
		confirmUpstream: (remote, branch) =>
			confirmAction(app, { title: t('sync.upstreamTitle'), message: t('sync.upstreamConfirm', { remote, branch }), action: t('sync.action.push') }),
	};
}
