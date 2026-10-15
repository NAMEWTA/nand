import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import type { App } from 'obsidian';
import { promptText } from './prompt';
import { setLanguage } from '../../shared/i18n';

function open(value = '') {
	setLanguage('en');
	const owner = document.createElement('div'); document.body.append(owner);
	const app = { workspace: { containerEl: owner } } as unknown as App;
	let result!: Promise<string | null>;
	act(() => { result = promptText(app, { title: 'Device', label: 'Name', value }); });
	return { owner, result };
}

test('prompt preserves drafts through IME Enter, confirms latest trimmed input and releases its root', async () => {
	const { owner, result } = open('before');
	const input = await screen.findByRole('textbox', { name: 'Name' });
	fireEvent.change(input, { target: { value: '  设备名称  ' } });
	fireEvent.compositionStart(input); fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
	expect(screen.getByRole('dialog')).toBeTruthy();
	fireEvent.compositionEnd(input);
	await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
	await expect(result).resolves.toBe('设备名称');
	expect(screen.queryByRole('dialog')).toBeNull();
	await waitFor(() => expect(document.querySelector('.nand-portal-root')).toBeNull()); owner.remove();
});

test.each(['empty', 'escape', 'owner removed'])('prompt resolves null on %s', async mode => {
	const { owner, result } = open(mode === 'empty' ? '   ' : 'draft');
	const input = await screen.findByRole('textbox');
	if (mode === 'empty') await userEvent.type(input, '{Enter}');
	else if (mode === 'escape') fireEvent.keyDown(input, { key: 'Escape' });
	else await act(async () => owner.remove());
	await expect(result).resolves.toBeNull();
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); owner.remove();
});
