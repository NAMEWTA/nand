import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { TestProviders } from '../../../../ui/react/test-providers';
import { DEFAULT_DASHBOARD_SETTINGS } from '../../core/board/types/model';
import { MediaServiceSettings, ReadingServiceSettings } from './ServiceSettings';
import { homeServices } from '../../services/instances';
import { t } from '../../../../shared/i18n';
vi.mock('obsidian', async (original) => ({
	...(await original<typeof import('obsidian')>()),
	Platform: { isDesktopApp: true },
}));
afterEach(() => {
	cleanup();
	homeServices.music = undefined;
});
test('React music settings preserve pause, login, logout and album creation fields', async () => {
	const pause = vi.fn(),
		login = vi.fn(async () => {}),
		logout = vi.fn(async () => {});
	homeServices.music = {
		account: { loggedIn: false },
		subscribe: () => () => {},
		pause,
		login,
		logout,
	} as unknown as NonNullable<typeof homeServices.music>;
	let current = structuredClone(DEFAULT_DASHBOARD_SETTINGS);
	function Harness() {
		const [settings, set] = useState(current);
		return (
			<TestProviders>
				<MediaServiceSettings
					settings={settings}
					update={async (change) => {
						const next = structuredClone(current);
						change(next);
						current = next;
						set(next);
					}}
				/>
			</TestProviders>
		);
	}
	render(<Harness />);
	fireEvent.click(screen.getByRole('button', { name: t('music.accountLogin') }));
	await waitFor(() => expect(login).toHaveBeenCalledOnce());
	await waitFor(() =>
		expect((screen.getByRole('button', { name: t('music.accountLogout') }) as HTMLButtonElement).disabled).toBe(
			false,
		),
	);
	fireEvent.click(screen.getByRole('button', { name: t('music.accountLogout') }));
	await waitFor(() => expect(logout).toHaveBeenCalledOnce());
	fireEvent.click(screen.getByRole('button', { name: t('album.add') }));
	fireEvent.change(screen.getByLabelText(t('settings.widgetAlbumFolder')), { target: { value: 'Assets' } });
	fireEvent.change(screen.getByLabelText(t('settings.widgetAlbumInterval')), { target: { value: '15' } });
	fireEvent.click(screen.getByRole('button', { name: t('common.save') }));
	await waitFor(() => expect(current.albums).toHaveLength(1));
	expect(current.albums[0]).toMatchObject({
		folder: 'Assets',
		intervalSec: 15,
		recursive: true,
		transition: 'fade',
		heightRatio: 'full',
	});
});
test('WeRead controls preserve API key, key acquisition link and normalized import path', () => {
	const settings = structuredClone(DEFAULT_DASHBOARD_SETTINGS),
		update = vi.fn(async (change: (s: typeof settings) => void) => change(settings));
	const view = render(
		<TestProviders>
			<ReadingServiceSettings settings={settings} update={update} />
		</TestProviders>,
	);
	const fields = view.container.querySelectorAll('input');
	fireEvent.change(fields[0]!, { target: { value: 'test-key' } });
	fireEvent.change(fields[1]!, { target: { value: '/Books/Highlights/' } });
	expect(settings.wereadApiKey).toBe('test-key');
	expect(settings.wereadImportPath).toBe('Books/Highlights');
	expect(screen.getByRole('link').getAttribute('href')).toBe('https://weread.qq.com/r/weread-skills');
});
