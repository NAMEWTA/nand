import { SuggestModal, type App } from 'obsidian';
import { afterEach, expect, test, vi } from 'vitest';
import { chooseVaultDevice } from './device-choice';
import type { VaultDevice } from '../shared/storage/vault-identity';
import { promptText } from '../ui/primitives/prompt';

vi.mock('../ui/primitives/prompt', () => ({ promptText: vi.fn() }));

afterEach(() => vi.restoreAllMocks());

function openChoice(): { modal: SuggestModal<VaultDevice | null>; result: Promise<string | { label: string }> } {
	let modal!: SuggestModal<VaultDevice | null>;
	vi.spyOn(SuggestModal.prototype, 'open').mockImplementation(function (this: SuggestModal<VaultDevice | null>) { modal = this; });
	const result = chooseVaultDevice({} as App, [{ id: 'device', label: 'My device' }]);
	return { modal, result };
}

test('native selection closes the modal before delivering the selected device', async () => {
	const { modal, result } = openChoice();
	// This ordering was reproduced through real Obsidian's selectSuggestion.
	modal.onClose();
	modal.onChooseSuggestion({ id: 'device', label: 'My device' }, {} as MouseEvent);
	await expect(result).resolves.toBe('device');
});

test('closing without a choice rejects instead of implicitly sharing a device', async () => {
	const { modal, result } = openChoice();
	modal.onClose();
	await expect(result).rejects.toThrow();
});

test('native close before selecting a new device still awaits its name', async () => {
	vi.mocked(promptText).mockResolvedValueOnce('我的设备');
	const { modal, result } = openChoice();
	modal.onClose(); modal.onChooseSuggestion(null, {} as MouseEvent);
	await expect(result).resolves.toEqual({ label: '我的设备' });
});
