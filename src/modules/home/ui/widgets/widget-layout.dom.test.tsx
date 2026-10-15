import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { createStore } from 'zustand/vanilla';
import { DndContext } from '@dnd-kit/core';
import { WidgetDeck, WIDGETS } from './WidgetDeck';
import { DEFAULT_DASHBOARD_SETTINGS } from '../../core/board/types';
import type { BoardStore } from '../../services/board-store';
import { TestProviders } from '../../../../ui/react/test-providers';
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});
test('stacked packing applies spans, preserves member DOM on resize and changes order by stable identity', () => {
	const settings = {
		...structuredClone(DEFAULT_DASHBOARD_SETTINGS),
		widgetOrder: ['quickActions', 'habit', 'reading'],
	};
	for (const entry of Object.values(WIDGETS)) Object.assign(settings, { [entry.enabled]: false });
	Object.assign(settings, { widgetQuickActionsEnabled: true, widgetHabitEnabled: true, readingEnabled: true });
	const state = createStore(() => ({ settings }));
	const store = { state, image: async () => '', host: { app: {} } } as unknown as BoardStore;
	const original = ['quickActions', 'habit', 'reading'].map((key) => [key, WIDGETS[key]!.component] as const);
	try {
		for (const [key] of original) WIDGETS[key]!.component = () => <span>{key}</span>;
		const view = render(
			<TestProviders>
				<DndContext>
					<WidgetDeck store={store} stacked />
				</DndContext>
			</TestProviders>,
		);
		const nodes = () => [...view.container.querySelectorAll<HTMLElement>('[data-widget]')];
		expect(nodes().map((el) => el.dataset.widget)).toEqual(['quickActions', 'habit', 'reading']);
		expect(nodes().map((el) => el.style.gridRow)).toEqual(['span 6', 'span 4', 'span 2']);
		const first = nodes()[0];
		act(() => state.setState({ settings: { ...settings, sidebarWidth: 400, widgetUnitHeight: 500 } }));
		expect(nodes()[0]).toBe(first);
		act(() => state.setState({ settings: { ...settings, widgetOrder: ['reading', 'habit', 'quickActions'] } }));
		expect(nodes().map((el) => el.dataset.widget)).toEqual(['reading', 'habit', 'quickActions']);
		expect(nodes()[2]).toBe(first);
	} finally {
		for (const [key, component] of original) WIDGETS[key]!.component = component;
	}
});
