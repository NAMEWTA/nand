import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { createContentPage } from './page';
import type { NativeSurfaceContext } from '../../ui/native-surface';
import { acquireContentDraft } from '../../host/obsidian/storage/content-draft';
import { t } from '../../shared/i18n';

vi.mock('../../host/obsidian/storage/content-draft', () => ({ acquireContentDraft: vi.fn() }));
vi.mock('../../host/obsidian/storage/content-files', () => ({
	contentFiles: () => ({
		getFileByPath: (path: string) => ({ path, extension: 'md' }),
		subscribe: () => () => {},
	}),
}));
vi.mock('../../host/obsidian/storage/content-links', () => ({
	handleContentLink: vi.fn(),
	renderContentLinks: async () => {},
}));
vi.mock('obsidian', async (original) => ({
	...(await original<object>()),
	Component: class {
		register() {}
		registerDomEvent() {}
		load() {}
		unload() {}
	},
	MarkdownRenderer: {
		render: async (_app: unknown, text: string, target: HTMLElement) => {
			target.textContent = text;
			const heading = target.ownerDocument.createElement('h2');
			heading.textContent = 'Anchor';
			heading.dataset.heading = 'Anchor';
			target.append(heading);
		},
	},
}));
afterEach(() => vi.restoreAllMocks());

test('same-file heading and line navigation remounts the editor mode while keeping its draft lease', async () => {
	const listeners = new Set<() => void>(),
		off = vi.fn(),
		release = vi.fn(async () => {});
	const draft = {
		path: '.nand/content/anchor.md',
		value: 'First\nSecond',
		dirty: false,
		error: '',
		subscribe: (listener: () => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
				off();
			};
		},
		edit: vi.fn(async (value: string) => {
			draft.value = value;
			draft.dirty = true;
			listeners.forEach((fn) => fn());
		}),
		save: vi.fn(async () => {}),
	};
	vi.mocked(acquireContentDraft).mockResolvedValue({ draft, release } as unknown as Awaited<
		ReturnType<typeof acquireContentDraft>
	>);
	const el = document.createElement('div');
	Object.assign(el, {
		addClass: (...names: string[]) => el.classList.add(...names),
		removeClass: (...names: string[]) => el.classList.remove(...names),
	});
	Object.defineProperty(el, 'win', { value: window });
	document.body.append(el);
	const empty = Object.defineProperty(HTMLElement.prototype, 'empty', {
		configurable: true,
		value(this: HTMLElement) {
			this.replaceChildren();
		},
	});
	const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
	const context = {
		app: {},
		leaf: {},
		contentEl: el,
		containerEl: el,
		close: async () => {},
	} as unknown as NativeSurfaceContext;
	const target = { feature: 'content', resourceId: draft.path } as const;
	const page = await createContentPage(context, target, {}, new AbortController().signal);
	const setTimer = vi.spyOn(window, 'setTimeout'),
		clearTimer = vi.spyOn(window, 'clearTimeout');
	try {
		await act(async () => {
			await page.surface.onOpen();
		});
		const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: t('content.edit') });
		fireEvent.change(input, { target: { value: 'Unsaved\n## Anchor\nFinal line' } });
		const timer = setTimer.mock.results.at(-1)?.value;
		await act(async () => {
			await page.navigate({ ...target, focusId: '#Anchor' }, new AbortController().signal);
		});
		await waitFor(() => expect(el.querySelector('.markdown-rendered')?.textContent).toContain('Unsaved'));
		expect(screen.queryByRole('textbox')).toBeNull();
		expect(scroll).toHaveBeenCalledWith({ block: 'start' });
		expect(clearTimer).toHaveBeenCalledWith(timer);
		expect(off).toHaveBeenCalledTimes(1);
		await act(async () => {
			await page.navigate({ ...target, focusId: '#line=2' }, new AbortController().signal);
		});
		const editor = screen.getByRole<HTMLTextAreaElement>('textbox', { name: t('content.edit') });
		expect(editor.value).toBe('Unsaved\n## Anchor\nFinal line');
		expect(editor.selectionStart).toBe(18);
		expect(document.activeElement).toBe(editor);
		expect(draft.dirty).toBe(true);
		expect(draft.save).not.toHaveBeenCalled();
		expect(acquireContentDraft).toHaveBeenCalledOnce();
		expect(release).not.toHaveBeenCalled();
		expect(listeners.size).toBe(1);
	} finally {
		await act(async () => {
			await page.surface.onClose();
		});
		el.remove();
		Reflect.deleteProperty(empty, 'empty');
	}
	expect(off).toHaveBeenCalledTimes(3);
	expect(listeners.size).toBe(0);
	expect(release).toHaveBeenCalledOnce();
});
