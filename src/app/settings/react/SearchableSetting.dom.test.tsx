import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProviders } from '../../../ui/react/test-providers';
import { SearchableSetting, SearchHighlight, SettingsSearchContext } from './SearchableSetting';
import { LegacySettings } from './LegacySettings';
import { VisibilityContext } from '../../../ui/react/contexts';
test('search filters keywords and descriptions and highlights matching labels', async () => {
	function Fixture() {
		const [query, setQuery] = useState('');
		return (
			<>
				<input aria-label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
				<SettingsSearchContext.Provider value={query}>
					<SearchableSetting title="搜索引擎" keywords={['browser', 'engine']}>
						<SearchHighlight text="默认搜索引擎" />
					</SearchableSetting>
					<SearchableSetting title="Font" description="Interface typography">
						<SearchHighlight text="Font" />
					</SearchableSetting>
				</SettingsSearchContext.Provider>
			</>
		);
	}
	const { container } = render(<Fixture />);
	const user = userEvent.setup();
	await user.type(screen.getByLabelText('Search'), '搜索');
	expect(screen.queryByText('Font')).toBeNull();
	expect(container.querySelector('mark')?.textContent).toBe('搜索');
	await user.clear(screen.getByLabelText('Search'));
	await user.type(screen.getByLabelText('Search'), 'engine');
	expect(screen.getByText('默认搜索引擎')).toBeTruthy();
	expect(screen.queryByText('Font')).toBeNull();
	await user.clear(screen.getByLabelText('Search'));
	await user.type(screen.getByLabelText('Search'), 'typography');
	expect(screen.getByText('Font')).toBeTruthy();
});
test('legacy settings release partially registered resources when rendering throws', () => {
	const off = vi.fn();
	const log = vi.spyOn(console, 'error').mockImplementation(() => {});
	try {
		const view = render(
			<TestProviders>
				<LegacySettings
					render={(el, host) => {
						host.keep(off);
						el.append(el.ownerDocument.createElement('input'));
						throw new Error('Legacy partial render failed');
					}}
				/>
			</TestProviders>,
		);
		view.unmount();
		expect(off).toHaveBeenCalledOnce();
	} finally {
		log.mockRestore();
	}
});
test('legacy settings release resources on refresh and hide without double cleanup', () => {
	const off = vi.fn();
	let refresh = () => {};
	const renderer = (_el: HTMLElement, host: { keep: (off: () => void) => void; refresh: () => void }) => {
		host.keep(off);
		refresh = host.refresh;
	};
	const view = render(
		<TestProviders>
			<VisibilityContext.Provider value={true}>
				<button onClick={() => refresh()}>Refresh</button>
				<LegacySettings render={renderer} />
			</VisibilityContext.Provider>
		</TestProviders>,
	);
	fireEvent.click(screen.getByText('Refresh'));
	expect(off).toHaveBeenCalledOnce();
	view.rerender(
		<TestProviders>
			<VisibilityContext.Provider value={false}>
				<LegacySettings render={renderer} />
			</VisibilityContext.Provider>
		</TestProviders>,
	);
	expect(off).toHaveBeenCalledTimes(2);
	view.unmount();
	expect(off).toHaveBeenCalledTimes(2);
});
test('legacy settings are filtered without losing controls and dispose subscriptions', () => {
	const off = vi.fn();
	const renderLegacy = (container: HTMLElement, host: { keep: (off: () => void) => void }) => {
		host.keep(off);
		for (const label of ['搜索引擎', 'Font']) {
			const row = container.ownerDocument.createElement('div');
			row.className = 'setting-item';
			const name = container.ownerDocument.createElement('div');
			name.className = 'setting-item-name';
			name.textContent = label;
			row.append(name);
			container.append(row);
		}
	};
	const { container, unmount, rerender } = render(
		<TestProviders>
			<SettingsSearchContext.Provider value="搜索">
				<LegacySettings render={renderLegacy} />
			</SettingsSearchContext.Provider>
		</TestProviders>,
	);
	expect(container.querySelectorAll('.setting-item:not([hidden])').length).toBe(1);
	expect(container.querySelector('mark')?.textContent).toBe('搜索');
	rerender(
		<TestProviders>
			<SettingsSearchContext.Provider value="引擎">
				<LegacySettings render={renderLegacy} />
			</SettingsSearchContext.Provider>
		</TestProviders>,
	);
	expect(container.querySelector('mark')?.textContent).toBe('引擎');
	unmount();
	expect(off).toHaveBeenCalledOnce();
});
