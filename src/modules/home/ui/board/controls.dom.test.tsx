import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../ui/react/test-providers';
import { RenameTitle } from './RenameTitle';
import { DashboardDialog } from '../dialogs/DashboardDialog';
import { CountdownEditor } from '../widgets/CountdownWidget';
import { DashboardAppearanceProvider, useDashboardAppearance } from '../theme/ThemeBridge';
import { DEFAULT_DASHBOARD_SETTINGS } from '../../core/board/types/model';
import type { HomeHost } from '../../services/home-host';
import { setLanguage, t } from '../../../../shared/i18n';
afterEach(cleanup);
test('an open portal follows changed board appearance tokens and disconnects when unmounted', async () => {
	const source = document.createElement('div');
	source.className = 'nand-dashboard-root';
	source.dataset.layout = 'stacked';
	source.style.setProperty('--db-bg-modal', '#fefdf9');
	vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({ width: 400 } as DOMRect);
	document.body.append(source);
	const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
	function Portal() {
		return <div data-testid="theme-portal" ref={useDashboardAppearance(true)} />;
	}
	const view = render(
		<DashboardAppearanceProvider
			host={{ app: {} } as HomeHost}
			settings={structuredClone(DEFAULT_DASHBOARD_SETTINGS)}
		>
			<Portal />
		</DashboardAppearanceProvider>,
	);
	try {
		expect(screen.getByTestId('theme-portal').style.getPropertyValue('--db-bg-modal')).toBe('#fefdf9');
		source.style.setProperty('--db-bg-modal', '#171b1f');
		await waitFor(() =>
			expect(screen.getByTestId('theme-portal').style.getPropertyValue('--db-bg-modal')).toBe('#171b1f'),
		);
		view.unmount();
		expect(disconnect).toHaveBeenCalled();
	} finally {
		source.remove();
		disconnect.mockRestore();
	}
});
test('countdown editor displays an existing date-only target and preserves it when saving other fields', () => {
	const save = vi.fn();
	render(
		<TestProviders>
			<CountdownEditor
				initial={{
					id: 'existing',
					label: 'Existing',
					targetDate: '2030-01-01',
					displayMode: 'hours',
					reminderDays: 2,
				}}
				onClose={() => {}}
				onSave={save}
			/>
		</TestProviders>,
	);
	expect((screen.getByLabelText(t('home.dashboard.date')) as HTMLInputElement).value).toBe('2030-01-01T00:00');
	fireEvent.change(screen.getByLabelText(t('home.dashboard.name')), { target: { value: 'Renamed' } });
	fireEvent.click(screen.getByRole('button', { name: t('common.save') }));
	expect(save).toHaveBeenCalledWith(
		expect.objectContaining({ label: 'Renamed', targetDate: '2030-01-01', displayMode: 'hours' }),
	);
});
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
test('immersive title is the keyboard move handle; Enter does not rename and F2 still does', () => {
	const save = vi.fn(async () => {});
	render(
		<TestProviders>
			<RenameTitle immersive value="Data" onRename={save} />
		</TestProviders>,
	);
	const title = screen.getByRole('button', { name: 'Data' });
	expect(title.dataset.gridAction).toBe('move');
	fireEvent.keyDown(title, { key: 'Enter' });
	expect(screen.queryByRole('textbox')).toBeNull();
	fireEvent.keyDown(title, { key: 'F2' });
	expect(screen.getByRole('textbox')).toBeTruthy();
});
