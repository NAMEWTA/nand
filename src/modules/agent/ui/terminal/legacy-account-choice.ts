import { SuggestModal, type App } from 'obsidian';
import type { LegacyAccountChoice } from '../../platform/desktop/agents/legacy-accounts';
import { t } from '../../../../shared/i18n';

export function chooseLegacyAccount(app: App, options: LegacyAccountChoice, signal: AbortSignal): Promise<string | null> {
	return new Promise((resolve, reject) => {
		let settled = false;
		class Choice extends SuggestModal<string | null> {
			getSuggestions(query: string): Array<string | null> { return [null, ...options.candidates.filter(name => name.toLowerCase().includes(query.toLowerCase()))]; }
			renderSuggestion(item: string | null, element: HTMLElement): void { element.setText(item === null ? t('agent.legacyFresh') : t('agent.legacyUse', { name: item })); }
			onChooseSuggestion(item: string | null): void { settled = true; resolve(item); }
			onClose(): void { signal.removeEventListener('abort', close); queueMicrotask(() => { if (!settled) reject(new Error(t('agent.legacyChoice'))); }); }
		}
		const modal = new Choice(app), close = () => modal.close();
		modal.setPlaceholder(t('agent.legacySelect', { name: options.name || t('agent.defaultAccount') }));
		if (signal.aborted) { reject(new Error(t('agent.legacyChoice'))); return; }
		signal.addEventListener('abort', close, { once: true }); modal.open();
	});
}
