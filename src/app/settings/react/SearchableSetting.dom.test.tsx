import { useState } from 'react';
import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchableSetting, SearchHighlight, SettingsSearchContext } from './SearchableSetting';
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
