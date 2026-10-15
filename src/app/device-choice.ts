import { SuggestModal, type App } from 'obsidian';
import type { VaultDevice } from '../shared/storage/vault-identity';
import { registerMessages, t } from '../shared/i18n';
import { messages } from '../shared/i18n/lazy/common';
import { promptText } from '../ui/react/prompt';

registerMessages(messages);

/** Without a host identity, sharing a device's automation state requires an explicit choice. */
export function chooseVaultDevice(app: App, devices: readonly VaultDevice[]): Promise<string | { label: string }> {
	return new Promise((resolve, reject) => {
		class DeviceChoice extends SuggestModal<VaultDevice | null> {
			private chosen = false;
			getSuggestions(query: string): Array<VaultDevice | null> { return [null, ...devices.filter(device => device.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()))]; }
			renderSuggestion(device: VaultDevice | null, element: HTMLElement): void { element.setText(device ? `${device.label} · ${device.id.slice(0, 8)}` : t('storage.newDevice')); }
			onChooseSuggestion(device: VaultDevice | null): void {
				this.chosen = true;
				if (device) resolve(device.id);
				else void promptText(app, { title: t('storage.deviceName'), label: t('storage.deviceName'), value: '' }).then(label => {
					if (label?.trim()) resolve({ label }); else reject(new Error(t('storage.deviceCancelled')));
				}, reject);
			}
			onClose(): void {
				// SuggestModal closes before delivering onChooseSuggestion in the same call.
				queueMicrotask(() => { if (!this.chosen) reject(new Error(t('storage.deviceCancelled'))); });
			}
		}
		const modal = new DeviceChoice(app);
		modal.setPlaceholder(t('storage.chooseDevice'));
		modal.open();
	});
}
