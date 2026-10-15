import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { TestProviders } from '../../../ui/react/test-providers';
import { SyncPage } from './sync-presentation';
import { parseStatus } from '../core/status';
import { EMPTY_DEVICE_STATE } from '../core/ports';
import type { SyncService, SyncSnapshot } from '../services/sync-service';
import { askText, confirmAction } from './dialogs';
import { t } from '../../../shared/i18n';

test('sync preserves failed commit messages, suppresses IME submit, and offers staged commit actions', async () => {
	const snapshot: SyncSnapshot = {
		phase: 'ready',
		gitVersion: 'test',
		operation: null,
		locked: false,
		remotes: ['origin'],
		identity: { name: 'Test', email: 'test@example.com' },
		device: { ...EMPTY_DEVICE_STATE },
		status: parseStatus('# branch.head main\0? New.md\0'),
	};
	const commitAndSync = vi.fn(async () => {
			throw new Error('offline');
		}),
		commit = vi.fn(async () => {}),
		report = vi.fn(),
		setMessage = vi.fn();
	const service = { commitAndSync, commit } as unknown as SyncService;
	const props = {
		app: {} as never,
		snapshot,
		service,
		section: 'changes' as const,
		message: 'Draft',
		setMessage,
		host: { service: () => service, repoFolder: () => '', openSettings: vi.fn(), report },
	};
	const view = render(
			<TestProviders>
				<SyncPage {...props} />
			</TestProviders>,
		),
		user = userEvent.setup();
	const input = screen.getByRole<HTMLTextAreaElement>('textbox', { name: t('sync.message') });
	fireEvent.compositionStart(input);
	fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true, isComposing: true });
	expect(commitAndSync).not.toHaveBeenCalled();
	fireEvent.compositionEnd(input);
	fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
	await waitFor(() => expect(report).toHaveBeenCalled());
	expect(input.value).toBe('Draft');
	await user.click(screen.getByRole('button', { name: t('sync.moreCommit') }));
	await user.click(screen.getByRole('menuitem', { name: t('sync.commitStaged') }));
	expect(commit).toHaveBeenCalledWith('staged', { message: 'Draft' });
	await waitFor(() => expect(input.value).toBe(''));
	view.rerender(
		<TestProviders>
			<SyncPage {...props} snapshot={{ ...snapshot, operation: 'merge' }} />
		</TestProviders>,
	);
	expect(screen.getByRole<HTMLButtonElement>('button', { name: t('sync.commitAndSync') }).disabled).toBe(true);
});

test('sync dialogs scope portals, trim prompts, restore focus, and cancel without side effects', async () => {
	const owner = document.createElement('section'),
		button = document.createElement('button');
	owner.append(button);
	document.body.append(owner);
	button.focus();
	const app = { workspace: { containerEl: owner } } as never;
	let result!: Promise<string | null>;
	act(() => {
		result = askText(app, 'Title', 'Name', '  value  ');
	});
	await screen.findByRole('dialog');
	expect(screen.getByRole('dialog').closest('.nand-portal-root')).toBeTruthy();
	const input = screen.getByRole('textbox', { name: 'Name' });
	fireEvent.compositionStart(input);
	fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
	expect(screen.getByRole('dialog')).toBeTruthy();
	fireEvent.compositionEnd(input);
	await userEvent.setup().click(screen.getByRole('button', { name: t('common.confirm') }));
	expect(await result).toBe('value');
	expect(document.activeElement).toBe(button);
	let confirmed!: Promise<boolean>;
	act(() => {
		confirmed = confirmAction(app, { title: 'Discard', message: 'Unsaved draft', action: 'Discard' });
	});
	const dialog = await screen.findByRole('dialog');
	expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
	await userEvent.setup().keyboard('{Escape}');
	expect(await confirmed).toBe(false);
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	act(() => {
		confirmed = confirmAction(app, { title: 'Close owner', message: 'Owned dialog', action: 'Confirm' });
	});
	await screen.findByRole('dialog');
	act(() => owner.remove());
	expect(await confirmed).toBe(false);
	await waitFor(() => expect(document.querySelector('.nand-portal-root')).toBeNull());
});
