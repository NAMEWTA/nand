import { sessionStatusClass, sessionStatusI18nKey, type SessionStatusSnapshot } from '../../core/pty/session-status';
import { t } from '../../shared/i18n/terminal-accessor';

export function statusLabel(snapshot: SessionStatusSnapshot): { text: string; className: string } {
	return { text: t(sessionStatusI18nKey(snapshot)), className: sessionStatusClass(snapshot) };
}
