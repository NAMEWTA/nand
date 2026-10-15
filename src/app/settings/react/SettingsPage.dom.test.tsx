import { useEffect, useState } from 'react';
import { expect, test, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '../../../ui/react/test-providers';
import { SettingsPage } from './SettingsPage';

vi.mock('../nav', () => ({ PRODUCT_MODULES: { browser: 'browser' } }));
vi.mock('../../workbench/settings-categories', () => ({
	settingsCategories: () => [{ id: 'browser', label: 'Browser' }],
}));
vi.mock('./GeneralSettings', () => ({ GeneralSettings: () => null }));

test('React settings keeps component state across updates and releases its own subscriptions', async () => {
	const mount = vi.fn(),
		off = vi.fn();
	function ModulePage() {
		const [revision, setRevision] = useState(0);
		useEffect(() => {
			mount();
			return off;
		}, []);
		return <button onClick={() => setRevision(revision + 1)}>Refresh settings {revision}</button>;
	}
	const load = vi.fn(async () => ModulePage);
	const settings = {};
	const plugin = {
		moduleInstance: () => ({ settingsPage: load }),
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
	await userEvent.setup().click(await screen.findByRole('button', { name: 'Refresh settings 0' }));
	expect(screen.getByRole('button', { name: 'Refresh settings 1' })).toBeTruthy();
	expect(mount).toHaveBeenCalledOnce();
	expect(load).toHaveBeenCalledOnce();
	expect(off).not.toHaveBeenCalled();
	view.unmount();
	expect(off).toHaveBeenCalledOnce();
});

test('module loader failure is visible', async () => {
	const settings = {};
	const load = async () => {
		throw new Error('Unavailable');
	};
	const plugin = {
		moduleInstance: () => ({
			settingsPage: load,
		}),
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
	await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Unavailable'));
	view.unmount();
});

test('replacing a module loader hides the old page and ignores an obsolete async result', async () => {
	const settings = {},
		old = () => <p>Old page</p>,
		fresh = () => <p>New page</p>;
	let finish!: (page: typeof old) => void;
	let loader = async () => old;
	const plugin = {
		moduleInstance: () => ({ settingsPage: loader }),
		onModuleChanged: () => () => {},
		moduleManifests: () => [{ id: 'browser' }],
		moduleState: () => 'active',
		appSettings: { subscribe: () => () => {}, get: () => settings },
	} as unknown as Parameters<typeof SettingsPage>[0]['plugin'];
	const node = () => (
		<TestProviders>
			<SettingsPage plugin={plugin} category="browser" navigate={vi.fn()} />
		</TestProviders>
	);
	const view = render(node());
	await screen.findByText('Old page');
	loader = () =>
		new Promise((resolve) => {
			finish = resolve;
		});
	view.rerender(node());
	expect(screen.queryByText('Old page')).toBeNull();
	loader = async () => fresh;
	view.rerender(node());
	await screen.findByText('New page');
	await act(async () => finish(old));
	expect(screen.queryByText('Old page')).toBeNull();
	expect(screen.getByText('New page')).toBeTruthy();
});
