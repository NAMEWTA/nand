import { useEffect } from 'react';
import { expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SettingsPageHost } from '../../contracts/module';
import { TestProviders } from '../../../ui/react/test-providers';
import { SettingsPage } from './SettingsPage';

vi.mock('../nav', () => ({ PRODUCT_MODULES: { browser: 'browser' } }));
vi.mock('../../workbench/settings-categories', () => ({
	settingsCategories: () => [{ id: 'browser', label: 'Browser' }],
}));
vi.mock('../settings-tab', () => ({ DashboardSettingTab: class {} }));
vi.mock('../home', () => ({ renderAppearanceSection: vi.fn() }));
vi.mock('../about', () => ({ renderAbout: vi.fn() }));
vi.mock('./GeneralSettings', () => ({ GeneralSettings: () => null }));

test('React settings loader refreshes without remounting and releases host subscriptions', async () => {
	const mount = vi.fn(),
		off = vi.fn();
	function ModulePage(host: SettingsPageHost) {
		useEffect(() => {
			mount();
			host.keep(off);
		}, [host.keep]);
		return <button onClick={host.refresh}>Refresh settings</button>;
	}
	const load = vi.fn(async () => ModulePage);
	const settings = {};
	const plugin = {
		moduleInstance: () => ({ settingsPage: load, settingsPageKind: 'react' }),
		onModuleChanged: () => () => {},
		moduleManifests: () => [{ id: 'browser' }],
		moduleState: () => 'active',
		appSettings: { subscribe: () => () => {}, get: () => settings },
	} as unknown as Parameters<typeof SettingsPage>[0]['plugin'];
	const view = render(
		<TestProviders>
			<SettingsPage plugin={plugin} category="browser" navigate={vi.fn()} />
		</TestProviders>,
	);
	await userEvent.setup().click(await screen.findByRole('button', { name: 'Refresh settings' }));
	expect(mount).toHaveBeenCalledOnce();
	expect(load).toHaveBeenCalledOnce();
	expect(off).not.toHaveBeenCalled();
	view.unmount();
	expect(off).toHaveBeenCalledOnce();
});

test('unmarked one-argument legacy loaders still render inside the bridge', async () => {
	const renderer = vi.fn((container: HTMLElement) => {
		const row = container.ownerDocument.createElement('div');
		row.className = 'setting-item';
		row.textContent = 'Legacy settings';
		container.append(row);
	});
	const settings = {};
	const plugin = {
		moduleInstance: () => ({ settingsPage: async () => renderer }),
		onModuleChanged: () => () => {},
		moduleManifests: () => [{ id: 'browser' }],
		moduleState: () => 'active',
		appSettings: { subscribe: () => () => {}, get: () => settings },
	} as unknown as Parameters<typeof SettingsPage>[0]['plugin'];
	const view = render(
		<TestProviders>
			<SettingsPage plugin={plugin} category="browser" navigate={vi.fn()} />
		</TestProviders>,
	);
	await waitFor(() => expect(screen.getByText('Legacy settings').closest('.nand-native')).toBeTruthy());
	expect(renderer).toHaveBeenCalledOnce();
	view.unmount();
});
