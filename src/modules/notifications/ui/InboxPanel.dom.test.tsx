import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '../../../ui/react/test-providers';
import { t } from '../../../shared/i18n';
import type { NotificationRecord } from '../api';
import { InboxPanel } from './InboxPanel';
test('inbox preserves filtering, opener availability and read/clear actions', async () => {
	const records: NotificationRecord[] = [
		{
			id: '1',
			title: 'Older',
			body: 'Body',
			channels: ['in-app'],
			deliveries: { 'in-app': 'sent' },
			createdAt: 1,
			read: true,
		},
		{
			id: '2',
			title: 'Latest',
			body: 'Latest detail',
			channels: ['in-app'],
			deliveries: { 'in-app': 'failed' },
			createdAt: 2,
			read: false,
		},
	];
	const markRead = vi.fn(),
		clearRead = vi.fn(),
		open = vi.fn(),
		user = userEvent.setup();
	const props = { records, markRead, clearRead, open, openable: new Set(['2']) };
	const mounted = render(
		<TestProviders>
			<InboxPanel {...props} filter="all" />
		</TestProviders>,
	);
	expect(screen.getAllByRole('listitem').map((e) => e.textContent)).toEqual([
		expect.stringContaining('Latest'),
		expect.stringContaining('Older'),
	]);
	await user.click(screen.getByRole('button', { name: t('automation.open') }));
	expect(open).toHaveBeenCalledWith(records[1]);
	await user.click(screen.getByRole('button', { name: t('automation.read') }));
	expect(markRead).toHaveBeenCalledWith('2');
	await user.click(screen.getByRole('button', { name: t('automation.readAll') }));
	expect(markRead).toHaveBeenCalledWith();
	await user.click(screen.getByRole('button', { name: t('automation.clearRead') }));
	expect(clearRead).toHaveBeenCalledOnce();
	mounted.rerender(
		<TestProviders>
			<InboxPanel {...props} filter="unread" />
		</TestProviders>,
	);
	expect(screen.queryByText('Older')).toBeNull();
	mounted.rerender(
		<TestProviders>
			<InboxPanel {...props} records={records.map((r) => ({ ...r, read: true }))} filter="unread" />
		</TestProviders>,
	);
	expect(screen.getByText(t('workbench.noUnread'))).toBeTruthy();
});
