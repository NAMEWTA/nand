import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NandProviders } from '../../../ui/react/providers';
import { setLanguage } from '../../../shared/i18n';
import { Composer } from './popover/Composer';
import { CommentPopover } from './popover/CommentPopover';
import { CommentsPanel } from './panel/CommentsPanel';
import { createOverlayChannel } from '../services/overlay';
import { createCommentsService } from '../services/comments';
import { createAnchor } from '../core/anchor';
import { CommentStore, type CommentFs } from '../core/store';
import { DEFAULT_COMMENTS_SETTINGS } from '../settings';
import type { CommentsEnv } from './env';
vi.mock('obsidian', async importOriginal => {
	const actual = await importOriginal<Record<string, unknown>>();
	return { ...actual, Component: class { load() {} unload() {} }, MarkdownRenderer: { render: async (_app: unknown, text: string, el: HTMLElement) => { el.textContent = text; } }, Platform: { isPhone: false, isMobile: false } };
});
beforeAll(() => {
	Object.assign(HTMLElement.prototype, { empty() { (this as HTMLElement).replaceChildren(); }, setText(value: string) { (this as HTMLElement).textContent = value; } });
});
afterEach(() => { vi.useRealTimers(); });
function fixture() {
	setLanguage('en');
	const files = new Map<string, string>();
	const fs: CommentFs = { exists: async p => files.has(p), read: async p => files.get(p)!, write: async (p, v) => { files.set(p, v); }, remove: async p => { files.delete(p); } };
	const store = new CommentStore(fs, { timers: { set: cb => window.setTimeout(cb, 1e6), clear: h => window.clearTimeout(h as number) } });
	const service = createCommentsService(store, () => DEFAULT_COMMENTS_SETTINGS);
	const channel = createOverlayChannel();
	const env = { app: { workspace: { containerEl: document.body }, vault: { getFileByPath: (path: string) => ({ path }) } }, service, editors: new Set(), alive: () => true, overlay: () => channel, open: (request: Parameters<typeof channel.open>[0]) => channel.open(request), openSettings: () => {} } as unknown as CommentsEnv;
	return { store, service, channel, env, dispose: async () => { service.dispose(); channel.dispose(); await store.close(); } };
}
test('composer: whitespace, IME, Ctrl+Enter, pending duplicate, failed save retains draft and retries', async () => {
	setLanguage('en'); let finish!: () => void;
	const save = vi.fn().mockRejectedValueOnce(new Error('EIO')).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
	const cancel = vi.fn();
	const view = render(<NandProviders ownerDocument={document}><Composer onSubmit={save} onCancel={cancel} /></NandProviders>);
	const input = await screen.findByRole('textbox');
	fireEvent.change(input, { target: { value: 'draft' } }); fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true, isComposing: true }); expect(save).not.toHaveBeenCalled();
	fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true }); await screen.findByRole('alert'); expect((input as HTMLTextAreaElement).value).toBe('draft');
	fireEvent.click(screen.getByRole('button', { name: 'Retry' })); fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true }); expect(save).toHaveBeenCalledTimes(2);
	await act(async () => finish()); fireEvent.keyDown(input, { key: 'Escape' }); expect(cancel).toHaveBeenCalledOnce(); view.unmount();
});
test('overlay open, submit, reply, inline edit, Escape twice, resolve/reopen and delete confirmation', async () => {
	const f = fixture();
	const request = { path: 'a.md', ownerDocument: document, rect: () => new DOMRect(30, 30, 80, 20), mode: 'compose' as const, anchor: createAnchor('alpha', 0, 5), pinned: true };
	f.channel.open(request);
	const view = render(<NandProviders ownerDocument={document}><CommentPopover env={f.env} channel={f.channel} /></NandProviders>);
	fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'first' } }); fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
	await waitFor(() => expect(f.channel.state.getState().request).toBeNull());
	const thread = f.store.threadsFor('a.md')[0]!;
	act(() => f.channel.open({ ...request, mode: 'threads', threadIds: [thread.id] }));
	await screen.findByText('first'); fireEvent.click(screen.getByRole('button', { name: 'Reply…' }));
	fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'reply' } }); fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', ctrlKey: true });
	await waitFor(() => expect(thread.messages).toHaveLength(2)); await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
	fireEvent.click(screen.getByRole('button', { name: 'Edit comment' })); fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'edited' } }); fireEvent.click(screen.getByRole('button', { name: 'Save' }));
	await screen.findByText('edited'); await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull()); expect(thread.messages[0]?.editedAt).toBeTruthy();
	fireEvent.click(screen.getByRole('button', { name: 'Edit comment' })); await screen.findByRole('textbox');
	fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' }); await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull()); expect(f.channel.state.getState().request).not.toBeNull();
	fireEvent.click(screen.getByRole('button', { name: 'Resolve' })); await screen.findByText('Resolved'); expect(f.channel.state.getState().request).not.toBeNull();
	fireEvent.click(screen.getByRole('button', { name: 'Reopen' })); await screen.findByText('edited');
	fireEvent.click(screen.getByRole('button', { name: 'Delete' })); await screen.findByText('Delete this comment and its 1 replies?'); fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
	await waitFor(() => expect(f.store.threadsFor('a.md')).toHaveLength(0)); view.unmount(); await f.dispose();
});
test('300ms close is cancelled on entry and suppressed while pinned or editing', () => {
	vi.useFakeTimers(); const channel = createOverlayChannel(); const request = { path: 'a.md', ownerDocument: document, rect: () => new DOMRect(), mode: 'threads' as const, pinned: false };
	channel.open(request); channel.scheduleClose(); vi.advanceTimersByTime(299); expect(channel.state.getState().request).not.toBeNull(); channel.cancelClose(); vi.advanceTimersByTime(500); expect(channel.state.getState().request).not.toBeNull();
	channel.setDraft(true); channel.scheduleClose(); vi.advanceTimersByTime(500); expect(channel.state.getState().request).not.toBeNull(); channel.setDraft(false); channel.pin(); channel.scheduleClose(); vi.advanceTimersByTime(500); expect(channel.state.getState().request).not.toBeNull();
	channel.close(false); channel.open(request); channel.scheduleClose(); vi.advanceTimersByTime(300); expect(channel.state.getState().request).toBeNull(); channel.dispose();
});
test('panel follows note and vault sections are lazy, filter hides resolved threads', async () => {
	const f = fixture(); const a = await f.store.add('a.md', { anchor: createAnchor('alpha', 0, 5), text: 'alpha-comment' });
	await f.store.add('b.md', { anchor: createAnchor('beta', 0, 4), text: 'beta-comment' }); await f.store.resolve(a.id); await f.store.flush(); await f.service.refresh(); f.service.setPath('a.md');
	const view = render(<NandProviders ownerDocument={document}><CommentsPanel env={f.env} /></NandProviders>);
	await screen.findByRole('button', { name: 'Resolved (1)' }); expect(screen.queryByText('alpha-comment')).toBeNull(); fireEvent.click(screen.getByRole('radio', { name: 'Vault' })); expect(screen.queryByText('beta-comment')).toBeNull();
	fireEvent.click(screen.getByRole('button', { name: /b.md/ })); await screen.findByText('beta-comment');
	fireEvent.click(screen.getByRole('radio', { name: 'Current note' })); fireEvent.click(screen.getByRole('radio', { name: /Unresolved/ })); await waitFor(() => expect(screen.queryByRole('button', { name: 'Resolved (1)' })).toBeNull()); view.unmount(); await f.dispose();
});

test('panel menu exposes sorting, settings and the resolve-all confirmation request', async () => {
	const f = fixture(); f.service.setPath('a.md'); f.env.openSettings = vi.fn();
	const view = render(<NandProviders ownerDocument={document}><CommentsPanel env={f.env} /></NandProviders>);
	const openMenu = () => fireEvent.pointerDown(screen.getByRole('button', { name: 'More comment actions' }), { button: 0, ctrlKey: false, pointerType: 'mouse' });
	openMenu(); await screen.findByRole('menuitemradio', { name: 'Position in note' });
	fireEvent.click(screen.getByRole('menuitemradio', { name: 'Recent activity' }));
	openMenu(); expect((await screen.findByRole('menuitemradio', { name: 'Recent activity' })).getAttribute('aria-checked')).toBe('true');
	fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' })); expect(f.env.openSettings).toHaveBeenCalledOnce();
	openMenu(); fireEvent.click(await screen.findByRole('menuitem', { name: 'Resolve all comments in this note' }));
	expect(f.channel.state.getState().request).toMatchObject({ mode: 'resolve-all', path: 'a.md' });
	view.unmount(); await f.dispose();
});

test('editor hover waits 350ms, carries overlapping ids, and destroy removes listeners/timers', async () => {
	const { HoverTracker } = await import('./editor/hover');
	const { EditorState } = await import('@codemirror/state');
	const { editorInfoField } = await import('obsidian');
	const f = fixture(); const thread = await f.store.add('a.md', { anchor: createAnchor('alpha', 0, 5), text: 'one' });
	const second = await f.store.add('a.md', { anchor: createAnchor('alpha', 0, 5), text: 'two' });
	const dom = document.createElement('div'); dom.innerHTML = `<span class="nand-comment-hl" data-comment-ids="${thread.id} ${second.id}">alpha</span>`; document.body.appendChild(dom);
	const state = EditorState.create({ doc: 'alpha', extensions: [editorInfoField.init(() => ({ file: { path: 'a.md' } }) as never)] });
	const view = { dom, scrollDOM: dom, state, focus() {} } as unknown as import('@codemirror/view').EditorView;
	const tracker = new HoverTracker(view, f.env);
	vi.useFakeTimers();
	fireEvent.mouseOver(dom.firstElementChild!); vi.advanceTimersByTime(349); expect(f.channel.state.getState().request).toBeNull(); vi.advanceTimersByTime(1); expect(f.channel.state.getState().request?.threadIds).toEqual([thread.id, second.id]);
	fireEvent.mouseOut(dom.firstElementChild!); f.channel.setHovered(true); vi.advanceTimersByTime(400); expect(f.channel.state.getState().request).not.toBeNull();
	f.channel.close(false); fireEvent.mouseOver(dom.firstElementChild!); tracker.destroy(); vi.advanceTimersByTime(400); expect(f.channel.state.getState().request).toBeNull();
	fireEvent.mouseOver(dom.firstElementChild!); vi.advanceTimersByTime(400); expect(f.channel.state.getState().request).toBeNull(); dom.remove(); vi.useRealTimers(); await f.dispose();
});

test('overlay host mounts at most one React root per document and removes it on dispose', async () => {
	const { CommentsOverlays } = await import('./popover/overlay-host');
	const f = fixture(); const hosts = new CommentsOverlays(f.env);
	const channel = hosts.get(document); expect(hosts.get(document)).toBe(channel);
	act(() => channel.open({ path: 'a.md', ownerDocument: document, rect: () => new DOMRect(), mode: 'compose', anchor: createAnchor('alpha', 0, 5), pinned: true }));
	await waitFor(() => expect(document.querySelectorAll('.nand-comments-overlay-root')).toHaveLength(1));
	await screen.findByRole('textbox'); act(() => hosts.dispose()); expect(document.querySelector('.nand-comments-overlay-root')).toBeNull(); await f.dispose();
});

test('editor reconfiguration retains its scoped class and removes it when disabled', async () => {
	const { EditorView } = await import('@codemirror/view');
	const { StateEffect } = await import('@codemirror/state');
	const { commentsCmExtension } = await import('./editor/extension');
	const f = fixture(), parent = document.createElement('div'); document.body.appendChild(parent);
	const view = new EditorView({ doc: 'alpha', parent, extensions: commentsCmExtension(f.env) });
	expect(view.dom.classList.contains('nand-comments-editor')).toBe(true);
	view.dispatch({ effects: StateEffect.reconfigure.of(commentsCmExtension(f.env)) });
	expect(view.dom.classList.contains('nand-comments-editor')).toBe(true);
	view.dispatch({ effects: StateEffect.reconfigure.of([]) });
	expect(view.dom.classList.contains('nand-comments-editor')).toBe(false);
	expect(f.env.editors.size).toBe(0); view.destroy(); parent.remove(); await f.dispose();
});
