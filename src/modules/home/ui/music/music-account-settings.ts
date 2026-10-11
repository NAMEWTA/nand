import { bindLocalizedControl } from '../../../../ui/primitives/localized-dom';
import { App, Notice, Platform, Setting } from 'obsidian';
import { t } from '../../../../shared/i18n/index';
import { homeServices } from '../../services/instances';

export function renderMusicAccountSettings(container: HTMLElement, app: App): void {
	const service = (homeServices.music ?? null);
	if (!service) return;
	// Sign-in opens an Electron BrowserWindow; phones and tablets have no
	// Electron, so the account rows would only ever show failed notices there.
	if (Platform.isMobile) return;
	const host = container.createDiv();
	let busy = false;
	const render = (): void => {
		host.empty();
		const status = service.account.error ? `web.${service.account.error.startsWith('browser_session_') ? service.account.error : 'browser_session_unavailable'}` : service.account.loggedIn ? 'music.accountSignedIn' : 'music.accountSignedOut';
		bindLocalizedControl(bindLocalizedControl(new Setting(host)
			.setName(t('music.accountTitle')), "name", 'music.accountTitle')
			.setDesc(t(status)), "desc", status)
			.addButton((button) =>
				bindLocalizedControl(button
					.setButtonText(t('music.accountLogin')), "buttonText", 'music.accountLogin')
					.setDisabled(busy)
					.onClick(async () => {
						if (busy) return;
						busy = true;
						render();
						try {
							await service.login();
							new Notice(t('music.accountSuccess'));
						} catch (error) {
							if (!(error instanceof Error && error.message === 'CANCELLED'))
								new Notice(t(error instanceof Error && error.message.startsWith('browser_session_') ? `web.${error.message}` : 'music.accountFailed'));
						} finally {
							busy = false;
							render();
						}
					}),
			)
			.addButton((button) =>
				bindLocalizedControl(button
					.setButtonText(t('music.accountLogout')), "buttonText", 'music.accountLogout')
					.setDisabled(busy)
					.onClick(async () => {
						if (busy) return;
						busy = true;
						render();
						try {
							await service.logout();
						} catch {
							new Notice(t('music.accountLogoutFailed'));
						} finally {
							busy = false;
							render();
						}
					}),
			);
	};
	render();
}
