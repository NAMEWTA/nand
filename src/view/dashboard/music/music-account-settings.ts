import { bindLocalizedControl } from '../../primitives/localized-dom';
import { App, Notice, Platform, Setting } from 'obsidian';
import { getMusicService } from '../../../platform/obsidian/music/music-service';
import { t } from '../../../shared/i18n/index';

export function renderMusicAccountSettings(container: HTMLElement, app: App): void {
	const service = getMusicService(app);
	if (!service) return;
	// Sign-in opens an Electron BrowserWindow; phones and tablets have no
	// Electron, so the account rows would only ever show failed notices there.
	if (Platform.isMobile) return;
	const host = container.createDiv();
	let busy = false;
	const render = (): void => {
		host.empty();
		bindLocalizedControl(bindLocalizedControl(new Setting(host)
			.setName(t('music.accountTitle')), "name", 'music.accountTitle')
			.setDesc(t(service.account.loggedIn ? 'music.accountSignedIn' : 'music.accountSignedOut')), "desc", service.account.loggedIn ? 'music.accountSignedIn' : 'music.accountSignedOut')
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
								new Notice(t('music.accountFailed'));
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
