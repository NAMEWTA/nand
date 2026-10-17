import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TestProviders } from '../../../../ui/react/test-providers';
import { setLanguage, t } from '../../../../shared/i18n';
import type { NavigatorLists, NavigatorListsSnapshot } from '../../../navigator/api';
import type { BoardStore } from '../../services/board-store';
import { NavigatorRecentWidget, NavigatorShortcutsWidget } from './NavigatorListWidget';

beforeEach(() => setLanguage('en'));
afterEach(cleanup);

function fixture(initial: NavigatorListsSnapshot) {
	let snapshot = initial;
	const listeners = new Set<() => void>(),
		watchers = new Set<() => void>(),
		open = vi.fn();
	const lists: NavigatorLists = {
		snapshot: () => snapshot,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		open,
	};
	let current: NavigatorLists | undefined = lists;
	const store = {
		widgets: {
			navigatorLists: () => current,
			watchNavigatorLists: (listener: () => void) => {
				watchers.add(listener);
				return () => watchers.delete(listener);
			},
		},
	} as unknown as BoardStore;
	return {
		store,
		open,
		set(next: NavigatorListsSnapshot) {
			snapshot = next;
			for (const listener of [...listeners]) listener();
		},
		setService(next: NavigatorLists | undefined) {
			current = next;
			for (const listener of [...watchers]) listener();
		},
		subscribers: () => listeners.size,
	};
}
const lists: NavigatorListsSnapshot = {
	recent: [
		{ path: 'Notes/One.md', title: 'One' },
		{ path: 'Notes/Two.md', title: 'Two' },
	],
	shortcuts: [
		{ kind: 'folder', key: 'Projects', title: 'Projects' },
		{ kind: 'tag', key: 'todo', title: '#todo' },
	],
};

test('recent notes open through the navigator', () => {
	const f = fixture(lists);
	render(
		<TestProviders>
			<NavigatorRecentWidget store={f.store} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByText('Two'));
	expect(f.open).toHaveBeenCalledExactlyOnceWith({ kind: 'note', key: 'Notes/Two.md' });
});

test('shortcuts of every kind open as the navigator target they are', () => {
	const f = fixture(lists);
	render(
		<TestProviders>
			<NavigatorShortcutsWidget store={f.store} />
		</TestProviders>,
	);
	fireEvent.click(screen.getByText('#todo'));
	fireEvent.click(screen.getByText('Projects'));
	expect(f.open.mock.calls).toEqual([[{ kind: 'tag', key: 'todo' }], [{ kind: 'folder', key: 'Projects' }]]);
});

test('the widget follows list changes, an empty list and the navigator module going away', async () => {
	const f = fixture(lists);
	const view = render(
		<TestProviders>
			<NavigatorRecentWidget store={f.store} />
		</TestProviders>,
	);
	expect(f.subscribers()).toBe(1);
	act(() => f.set({ recent: [], shortcuts: [] }));
	expect(screen.getByText(t('navWidget.noRecent'))).toBeTruthy();
	act(() => f.set({ ...lists }));
	expect(screen.getByText('One')).toBeTruthy();
	act(() => f.setService(undefined));
	await screen.findByText(t('navWidget.unavailable'));
	expect(f.subscribers()).toBe(0);
	view.unmount();
});
