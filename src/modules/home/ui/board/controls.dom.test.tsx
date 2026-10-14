import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../ui/react/test-providers';
import { RenameTitle } from './RenameTitle';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { setLanguage, t } from '../../../../shared/i18n';
afterEach(cleanup);
test('double-click rename cancels on Escape and Enter plus blur writes once', async () => {
	setLanguage('en');
	const save = vi.fn(async () => {});
	render(
		<TestProviders>
			<RenameTitle value="Before" onRename={save} />
		</TestProviders>,
	);
	fireEvent.doubleClick(screen.getByText('Before'));
	fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Cancelled' } });
	fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
	expect(save).not.toHaveBeenCalled();
	fireEvent.doubleClick(screen.getByText('Before'));
	const input = screen.getByRole('textbox');
	fireEvent.change(input, { target: { value: 'After' } });
	fireEvent.keyDown(input, { key: 'Enter' });
	fireEvent.blur(input);
	await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith('After'));
});
test('destructive confirmation defaults to cancel and retains portal ownership', async () => {
	render(
		<TestProviders>
			<DashboardDialog title="Delete" onClose={() => {}}>
				<button>Delete item</button>
			</DashboardDialog>
		</TestProviders>,
	);
	await waitFor(() => expect(screen.getByRole('button', { name: t('common.cancel') })).toBe(document.activeElement));
	expect(screen.getByRole('dialog').closest('.nand-portal-root')).not.toBeNull();
});
