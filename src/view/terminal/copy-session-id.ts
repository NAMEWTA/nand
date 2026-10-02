import { Notice } from 'obsidian';
import { t } from '../../shared/i18n/terminal-accessor';

export async function copySessionId(id: string, clipboard: Pick<Clipboard, 'writeText'> | undefined): Promise<void> {
	if (!clipboard) { new Notice(t('workbench.copyUnavailable')); return; }
	try {
		await clipboard.writeText(id);
		new Notice(t('workbench.sessionIdCopied'));
	} catch {
		new Notice(t('workbench.copyFailed'));
	}
}
