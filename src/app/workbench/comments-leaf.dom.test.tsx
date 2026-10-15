import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { WorkspaceLeaf } from 'obsidian';
import { CommentsLeaf } from './comments-leaf';
import { setLanguage, t } from '../../shared/i18n';
import type { ServiceAccess } from '../contracts/module';
vi.mock('../../host/obsidian/workspace-title', () => ({ onLeafLanguageChanged: () => () => {} }));
vi.mock('obsidian', async importOriginal => {
	const actual = await importOriginal<Record<string, unknown>>();
	return { ...actual, ItemView: class {
		app = {}; contentEl = document.createElement('div');
		constructor() { this.contentEl.empty = () => this.contentEl.replaceChildren(); document.body.append(this.contentEl); }
		register() {}
	} };
});
function fixture() {
	let changed = () => {};
	let panel: { mount: (parent: HTMLElement) => () => void } | undefined;
	const host = { services: { peek: () => panel, watch: (_key: unknown, listener: () => void) => { changed = listener; return () => {}; } } as unknown as ServiceAccess, openWorkbenchSettings: vi.fn(async () => {}) };
	const leaf = new CommentsLeaf({} as WorkspaceLeaf, host);
	return { leaf, host, setPanel: (next: typeof panel) => { panel = next; changed(); } };
}

test('disabled comments leaf opens General settings and swaps to the module panel without leaking React roots', async () => {
	setLanguage('en'); const f = fixture();
	await act(() => f.leaf.onOpen());
	fireEvent.click(await screen.findByRole('button', { name: t('workbench.enableModule') }));
	expect(f.host.openWorkbenchSettings).toHaveBeenCalledWith('general');
	const unmount = vi.fn();
	act(() => f.setPanel({ mount: parent => { parent.textContent = 'Active comments'; return unmount; } }));
	expect(f.leaf.contentEl.textContent).toBe('Active comments');
	expect(document.querySelector('.nand-portal-root')).toBeNull();
	await act(async () => f.setPanel(undefined));
	await screen.findByRole('button', { name: t('workbench.enableModule') });
	expect(unmount).toHaveBeenCalledOnce();
	await act(() => f.leaf.onClose());
	expect(f.leaf.contentEl.childElementCount).toBe(0); f.leaf.contentEl.remove();
});

test('closing a leaf before its deferred empty state resolves does not mount a root', async () => {
	const f = fixture();
	await act(async () => { void f.leaf.onOpen(); void f.leaf.onClose(); });
	await waitFor(() => expect(f.leaf.contentEl.childElementCount).toBe(0));
	expect(document.querySelector('.nand-portal-root')).toBeNull(); f.leaf.contentEl.remove();
});
