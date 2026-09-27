import { FuzzySuggestModal, type App } from 'obsidian';
import type { AgentSessionRef } from '../shared/automation/types';
import { t } from '../shared/i18n';

export class AutomationSessionPicker extends FuzzySuggestModal<AgentSessionRef> {
	constructor(
		app: App,
		private sessions: AgentSessionRef[],
		private choose: (session: AgentSessionRef) => void,
	) {
		super(app);
		this.setPlaceholder(t('automation.sessions'));
	}
	getItems(): AgentSessionRef[] {
		return this.sessions;
	}
	getItemText(session: AgentSessionRef): string {
		return `${session.title} · ${session.cwd} · ${new Date(session.modifiedAtMs).toLocaleString()}`;
	}
	onChooseItem(session: AgentSessionRef): void {
		this.choose(session);
	}
}
