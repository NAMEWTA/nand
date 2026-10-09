import type { App } from 'obsidian';
import { t } from '../../../../shared/i18n/index';
import { Button } from '../../../../ui/primitives/Button';
import { openDialog } from '../../../../ui/primitives/dialog';
import { promptText as askText } from '../../../../ui/primitives/prompt';

/** Ask before a destructive action (ending a running session). */
export function confirmAction(app: App, message: string): Promise<boolean> {
	return new Promise((resolve) => {
		let confirmed = false;
		openDialog(app, {
			title: t('agent.confirmTitle'),
			content: () => <p>{message}</p>,
			footer: (close) => (
				<>
					<Button onClick={close}>{t('common.cancel')}</Button>
					<Button variant="danger" onClick={() => { confirmed = true; close(); }}>{t('agent.end')}</Button>
				</>
			),
			onClose: () => resolve(confirmed),
		});
	});
}

/** One line of text (session names); null when cancelled or empty. */
export function promptText(app: App, title: string, value: string): Promise<string | null> {
	return askText(app, { title, value, label: t('agent.renameLabel') }).then((next) => next ?? null);
}
