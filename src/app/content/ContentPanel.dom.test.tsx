import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { TestProviders } from '../../ui/react/test-providers';
import { ContentEditor } from './ContentPanel';
import type { ContentDraft } from '../../host/obsidian/storage/content-draft';
import { t } from '../../shared/i18n';

test('content editor keeps failed drafts, saves with keyboard, and cancels pending timers on unmount', async () => {
	const listeners = new Set<() => void>(),
		off = vi.fn();
	const draft = {
		value: 'First\nSecond',
		dirty: false,
		error: '',
		path: '.nand/content/test.md',
		subscribe: (fn: () => void) => {
			listeners.add(fn);
			return () => {
				listeners.delete(fn);
				off();
			};
		},
		edit: vi.fn(async (value: string) => {
			draft.value = value;
			draft.dirty = true;
			listeners.forEach((fn) => fn());
		}),
		save: vi.fn(async () => {
			throw new Error('disk-conflict');
		}),
	};
	const setTimer = vi.spyOn(window, 'setTimeout'),
		clearTimer = vi.spyOn(window, 'clearTimeout');
	const view = render(
		<TestProviders>
			<ContentEditor app={{} as never} draft={draft as unknown as ContentDraft} owner={window} focus="#line=1" />
		</TestProviders>,
	);
	const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: t('content.edit') });
	expect(document.activeElement).toBe(input);
	expect(input.selectionStart).toBe(6);
	fireEvent.change(input, { target: { value: 'Unsaved text' } });
	expect(draft.edit).toHaveBeenCalledWith('Unsaved text');
	const timer = setTimer.mock.results.at(-1)?.value;
	fireEvent.keyDown(input, { key: 's', ctrlKey: true });
	await waitFor(() => expect(screen.getByText(/disk-conflict/)).toBeTruthy());
	expect(input.value).toBe('Unsaved text');
	view.unmount();
	expect(off).toHaveBeenCalledOnce();
	expect(clearTimer).toHaveBeenCalledWith(timer);
	setTimer.mockRestore();
	clearTimer.mockRestore();
	await act(async () => {});
});
