import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createStore } from 'zustand/vanilla';
import { TestProviders } from '../../../../ui/react/test-providers';
import type { BoardStore } from '../../services/board-store';
import { DEFAULT_DASHBOARD_SETTINGS } from '../../core/board/types/model';
import { Banner } from './Banner';
afterEach(cleanup);
function fixture(quoteFont?: string, entryId?: string) {
	const store = {
		state: createStore(() => ({
			path: 'dashboard',
			settings: structuredClone(DEFAULT_DASHBOARD_SETTINGS),
			data: {
				banner: { quote: 'A quote', author: 'An author', image: '', quoteFont },
				banners: { second: { quote: 'Second quote', author: 'Other', image: '' } },
			},
		})),
	} as unknown as BoardStore;
	render(
		<TestProviders>
			<Banner store={store} entryId={entryId} mobile={false} />
		</TestProviders>,
	);
}
test('the React poster applies the configured font to both quote and author', () => {
	fixture('Georgia');
	expect(screen.getByText('A quote').style.fontFamily).toBe('Georgia');
	expect(screen.getByText('An author').style.fontFamily).toBe('Georgia');
});
test('the React poster inherits its theme font when no quote font is configured', () => {
	fixture();
	expect(screen.getByText('A quote').style.fontFamily).toBe('');
	expect(screen.getByText('An author').style.fontFamily).toBe('');
});

test('an extra banner instance shows its own quote while the default one keeps the board banner', () => {
	fixture(undefined, 'second');
	expect(screen.getByText('Second quote')).toBeTruthy();
	expect(screen.queryByText('A quote')).toBeNull();
});
