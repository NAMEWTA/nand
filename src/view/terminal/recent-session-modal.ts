import { bindLocalizedControl } from '../primitives/localized-dom';
import { SuggestModal, type App } from 'obsidian';
import type { PtySession } from '../../platform/desktop/terminal/pty-session';
import { t } from '../../shared/i18n/terminal-accessor';
import { sessionLabel } from './session-label';

/** The ordered snapshot stays fixed while the user types or moves through results. */
export class RecentSessionModal extends SuggestModal<PtySession> {
	constructor(app: App, private readonly sessions: readonly PtySession[], private readonly select: (session: PtySession) => void) {
		super(app);
		// SuggestModal.setPlaceholder returns void, unlike SearchComponent.
		this.setPlaceholder(t('workbench.searchSessions'));
		bindLocalizedControl(this, 'placeholder', 'terminalAgent.workbench.searchSessions');
	}
	getSuggestions(query: string): PtySession[] {
		const needle = query.trim().toLocaleLowerCase();
		return this.sessions.filter((session) => !session.isDisposed && `${session.getTitle()} ${session.getCwd()} ${session.shellType} ${session.id} ${sessionLabel(session, this.sessions)}`.toLocaleLowerCase().includes(needle));
	}
	renderSuggestion(session: PtySession, element: HTMLElement): void {
		const title = element.createDiv({ cls: 'nand-session-title-row' });
		title.createSpan({ cls: 'nand-ui-list-item-title', text: session.getTitle() });
		title.createEl('small', { cls: 'nand-session-short-id', text: sessionLabel(session, this.sessions) });
		element.createDiv({ cls: 'nand-ui-list-item-meta', text: `${t(`workbench.status.${session.nativeStatus}`)} · ${session.getCwd()}` });
	}
	onChooseSuggestion(session: PtySession): void {
		this.select(session);
	}
}
