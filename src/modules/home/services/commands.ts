import { Notice } from 'obsidian';
import type { CommandAccess } from '../../../app/contracts/module';
import { t } from '../../../shared/i18n/index';
import type { HomeHost } from './home-host';

/** Board commands (removed with the module); ids stay stable because Obsidian stores hotkeys by command id. */
export function registerHomeCommands(host: HomeHost, commands: CommandAccess, open: () => Promise<void>): void {
	const report = (error: unknown): void => {
		console.error('[NAND dashboard]', error);
		new Notice(t('storage.unsaved'));
	};
	const onBoard = (action: 'addSection' | 'toggleBannerMode') => () => {
		const surface = host.activeDashboard();
		if (!surface) {
			new Notice(t('main.openDashboard'));
			return;
		}
		void surface[action]().catch(report);
	};
	const cycle = (delta: 1 | -1) => () => {
		const surface = host.activeDashboard();
		const next = host.boards?.adjacent(surface?.plugin.settings.dashboardFile ?? host.settings.dashboardFile, delta);
		if (!next) return;
		void (surface?.plugin.switchWorkspace(next) ?? host.switchWorkspace(next)).catch(report);
	};
	commands.add({ id: 'open-dashboard', nameKey: 'main.openDashboard', name: t('main.openDashboard'), callback: () => { void open().catch(report); } });
	commands.add({ id: 'next-workspace', nameKey: 'main.nextWorkspace', name: t('main.nextWorkspace'), callback: cycle(1) });
	commands.add({ id: 'previous-workspace', nameKey: 'main.prevWorkspace', name: t('main.prevWorkspace'), callback: cycle(-1) });
	commands.add({
		id: 'toggle-note-popover',
		nameKey: 'main.toggleNotePopover',
		name: t('main.toggleNotePopover'),
		callback: () => {
			const value = !host.settings.disableNotePopover;
			host.settings.disableNotePopover = value;
			void host.saveSettings().then(() => new Notice(value ? t('main.notePopoverOff') : t('main.notePopoverOn')), report);
		},
	});
	commands.add({ id: 'add-section', nameKey: 'main.addSection', name: t('main.addSection'), callback: onBoard('addSection') });
	commands.add({ id: 'toggle-banner-mode', nameKey: 'main.toggleBannerMode', name: t('main.toggleBannerMode'), callback: onBoard('toggleBannerMode') });
}
