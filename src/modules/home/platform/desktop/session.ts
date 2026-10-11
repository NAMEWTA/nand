import { SuggestModal, type App } from 'obsidian';
import { t } from '../../../../shared/i18n';
import { acquireVaultSession, type VaultSessionLease } from '../../../../host/desktop/browser-session';
import { desktopRemote } from '../../../../host/desktop/electron-main';

async function chooseLegacySession(app: App, win: Window, signal: AbortSignal): Promise<'copy' | 'fresh'> {
	// Modal.open binds native key scopes and history to activeWindow. Focus before opening,
	// rather than moving its DOM after an asynchronous lookup has selected another window.
	desktopRemote(win).getCurrentWindow().focus(); win.focus();
	const deadline = Date.now() + 1000;
	while (activeDocument !== win.document) {
		if (signal.aborted || win.closed || Date.now() >= deadline) throw new Error('browser_session_closed');
		await new Promise<void>(resolve => app.workspace.containerEl.win.setTimeout(resolve, 16));
	}
	return new Promise((resolve, reject) => {
		let settled = false;
		class Choice extends SuggestModal<'copy' | 'fresh'> {
			getSuggestions(): Array<'copy' | 'fresh'> { return ['copy', 'fresh']; }
			renderSuggestion(item: 'copy' | 'fresh', el: HTMLElement): void { el.setText(t(`web.session.${item}`)); }
			onChooseSuggestion(item: 'copy' | 'fresh'): void { settled = true; resolve(item); }
			onClose(): void {
				signal.removeEventListener('abort', close);
				// SuggestModal closes synchronously before invoking onChooseSuggestion.
				queueMicrotask(() => { if (!settled) reject(new Error('browser_session_choice')); });
			}
		}
		const modal = new Choice(app), close = () => modal.close();
		modal.setPlaceholder(t('web.session.choice'));
		if (signal.aborted) { reject(new Error('browser_session_closed')); return; }
		signal.addEventListener('abort', close, { once: true }); modal.open();
	});
}
export function homeSession(app: App, win: Window, surface: 'web' | 'music', signal: AbortSignal, interactive = true): Promise<VaultSessionLease> {
	return acquireVaultSession(app, win, {
		profile: `home-${surface}`,
		legacyPartition: surface === 'web' ? 'persist:nand-dashboard-web' : `persist:nand-dashboard-music-${encodeURIComponent(app.vault.getName())}`,
		ambiguous: true, signal,
		choose: interactive ? () => chooseLegacySession(app, win, signal) : undefined,
	});
}
