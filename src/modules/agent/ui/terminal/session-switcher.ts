import { SuggestModal } from 'obsidian';
import { t } from '../../../../shared/i18n/index';
import type { AgentController } from '../../services/controller';
import type { TerminalSession } from '../../services/terminal/session';
import { statusLabel } from '../../services/terminal/status';

/** Pick an open session (most recently created first) and show it. */
class SessionSwitcher extends SuggestModal<TerminalSession> {
	constructor(private readonly controller: AgentController) {
		super(controller.app);
		this.setPlaceholder(t('agent.switchPlaceholder'));
		this.emptyStateText = t('agent.noSessions');
	}
	getSuggestions(query: string): TerminalSession[] {
		const needle = query.trim().toLowerCase();
		return this.controller.sessions
			.list()
			.filter((session) => !session.automated)
			.reverse()
			.filter((session) => !needle || session.title.toLowerCase().includes(needle) || session.cwd.toLowerCase().includes(needle));
	}
	renderSuggestion(session: TerminalSession, el: HTMLElement): void {
		el.createDiv({ text: session.title });
		el.createEl('small', { cls: 'nand-agent-switch-meta', text: `${statusLabel(session)} · ${session.cwd}` });
	}
	onChooseSuggestion(session: TerminalSession): void {
		this.controller.show(session.id);
		void this.controller.open({ feature: 'terminal', section: 'running', resourceId: session.id });
	}
}

export function openSessionSwitcher(controller: AgentController): void {
	new SessionSwitcher(controller).open();
}
