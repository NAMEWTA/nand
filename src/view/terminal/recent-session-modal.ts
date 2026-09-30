import { SuggestModal, type App } from 'obsidian';
import type { PtySession } from '../../platform/desktop/terminal/pty-session';
import { t } from '../../shared/i18n/terminal-accessor';

/** The ordered snapshot stays fixed while the user types or moves through results. */
export class RecentSessionModal extends SuggestModal<PtySession> {
	constructor(app: App, private readonly sessions: readonly PtySession[], private readonly select: (session: PtySession) => void) {
		super(app);
		this.setPlaceholder(t('workbench.searchSessions'));
	}
	getSuggestions(query: string): PtySession[] {
		const needle = query.trim().toLocaleLowerCase();
		return this.sessions.filter((session) => !session.isDisposed && `${session.getTitle()} ${session.getCwd()} ${session.shellType}`.toLocaleLowerCase().includes(needle));
	}
	renderSuggestion(session: PtySession, element: HTMLElement): void {
		element.createDiv({ cls: 'nand-ui-list-item-title', text: session.getTitle() });
		element.createDiv({ cls: 'nand-ui-list-item-meta', text: `${t(`workbench.status.${session.nativeStatus}`)} · ${session.getCwd()}` });
	}
	onChooseSuggestion(session: PtySession): void {
		this.select(session);
	}
}
