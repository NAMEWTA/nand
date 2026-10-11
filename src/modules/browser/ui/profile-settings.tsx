import { Setting } from 'obsidian';
import type { SettingsPageHost } from '../../../app/contracts/module';
import { t } from '../../../shared/i18n';
import { bindLocalizedControl, setLocalizedText, setLocalizedAttribute } from '../../../ui/primitives/localized-dom';
import { openDialog } from '../../../ui/primitives/dialog';
import type { BrowserModule } from '../services';
import { BrowserError } from '../core/model';
import { browserError } from '../core/text';
import type { BrowserProfile } from '../core/profiles';

export function profileSettings(container: HTMLElement, host: BrowserModule, page: SettingsPageHost): void {
	let alive = true, closeDialog: (() => void) | undefined;
	page.keep(() => { alive = false; closeDialog?.(); });
	const root = container.createDiv({ cls: 'nand-browser-profile-settings' });
	setLocalizedText(new Setting(root).setHeading().nameEl, 'browser.profile.title');
	setLocalizedText(root.createEl('p'), 'browser.profile.description');
	const status = root.createEl('p', { attr: { role: 'status' } });
	const rows = root.createDiv();
	const run = async (action: () => Promise<unknown>, saved = true, failureKey = 'browser.profile.saveFailed') => {
		if (alive) status.empty();
		try {
			await action();
			if (alive && saved) { paint(); setLocalizedText(status, 'browser.profile.saved'); }
		} catch (error) {
			if (alive) status.setText(error instanceof BrowserError ? browserError(error) : t(failureKey));
		}
	};
	const remove = (profile: BrowserProfile) => {
		const affected = host.profilePages(profile.id);
		closeDialog = openDialog(host.app, {
			title: t('browser.profile.confirmDelete', { name: profile.label }),
			content: () => <><p>{t('browser.profile.deleteDetail', { count: affected.length })}</p><ul>{affected.map(item => <li key={item.id}>{item.title || item.url}</li>)}</ul></>,
			footer: close => <><button type="button" class="nand-ui-btn" onClick={close}>{t('browser.profile.cancel')}</button><button type="button" class="nand-ui-btn mod-warning" onClick={event => {
				event.currentTarget.disabled = true;
				close();
				void run(() => host.removeProfile(profile.id, affected.map(item => item.id)), true, 'browser.profile.deleteFailed').then(() => { if (alive) paint(); });
			}}>{t('browser.profile.delete')}</button></>,
		});
	};
	const paint = () => {
		rows.empty();
		for (const profile of host.profiles()) {
			const label = profile.kind === 'default' ? t('browser.profile.default') : profile.label;
			const row = new Setting(rows).setName(label);
			if (profile.kind === 'default') bindLocalizedControl(row, 'name', 'browser.profile.default');
			row.settingEl.dataset.profileId = profile.id;
			let draft = label;
			if (profile.kind === 'isolated') row.addText(text => {
				text.setValue(label).setDisabled(profile.state !== 'ready').onChange(value => { draft = value; });
				setLocalizedAttribute(text.inputEl, 'aria-label', 'browser.profile.label');
			})
				.addButton(button => bindLocalizedControl(button.setButtonText(t('browser.profile.rename')), 'buttonText', 'browser.profile.rename').setDisabled(profile.state !== 'ready').onClick(() => run(() => host.renameProfile(profile.id, draft))));
			row.addButton(button => bindLocalizedControl(button.setButtonText(t('browser.profile.open')), 'buttonText', 'browser.profile.open').setDisabled(profile.state !== 'ready').onClick(() => run(() => host.openInWindow({ profileId: profile.id }, container.win), false, 'browser.browser_failed')));
			if (profile.kind === 'isolated') row.addButton(button => {
				const key = profile.state === 'deleting' ? 'browser.profile.retryDelete' : 'browser.profile.delete';
				bindLocalizedControl(button.setButtonText(t(key)), 'buttonText', key).setDestructive().onClick(() => remove(profile));
			});
		}
	};
	paint();
	let name = '';
	const add = bindLocalizedControl(new Setting(root).setName(t('browser.profile.new')), 'name', 'browser.profile.new');
	let input: HTMLInputElement;
	add.addText(text => { input = text.inputEl; setLocalizedAttribute(input, 'aria-label', 'browser.profile.new'); text.onChange(value => { name = value; }); });
	add.addButton(button => bindLocalizedControl(button.setButtonText(t('browser.profile.create')), 'buttonText', 'browser.profile.create').onClick(() => run(async () => {
		await host.createProfile(name);
		if (alive) { name = ''; input.value = ''; }
	})));
}
