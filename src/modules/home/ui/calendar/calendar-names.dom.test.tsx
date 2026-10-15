import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TestProviders } from '../../../../ui/react/test-providers';
import { setLanguage, t } from '../../../../shared/i18n';
import { CalendarModalPanel } from './CalendarModalPanel';
import { MonthGrid, WeekTimeGrid } from './CalendarGrids';
import { CalendarPanel } from './CalendarPanel';
import { DashboardRenderContext } from '../renderer/render-context';
import { DEFAULT_DASHBOARD_SETTINGS } from '../../core/board/types/model';
import { memoryVault } from '../../../../../scripts/fixtures/memory-vault';
afterEach(cleanup);
test.each(['widget', 'fullscreen'])('%s calendar month/week navigation has accessible names', (kind) => {
	setLanguage('en');
	const { app } = memoryVault({}, window),
		root = document.createElement('div'),
		context = new DashboardRenderContext(root);
	render(
		<TestProviders>
			{kind === 'widget' ? (
				<CalendarPanel
					root={root}
					context={context}
					app={app}
					settings={DEFAULT_DASHBOARD_SETTINGS}
					widget
					openDay={vi.fn()}
				/>
			) : (
				<CalendarModalPanel
					app={app}
					context={context}
					actions={{ onToggle: vi.fn() }}
					byDay={new Map()}
					initialView="month"
					openDay={vi.fn()}
				/>
			)}
		</TestProviders>,
	);
	expect(screen.getByRole('button', { name: t('calendar.previousMonth') })).toBeTruthy();
	expect(screen.getByRole('button', { name: t('calendar.nextMonth') })).toBeTruthy();
	const toggle =
		kind === 'widget'
			? screen.getByRole('button', { name: t('calendar.switchToWeek') })
			: screen.getByRole('button', { name: t('calendar.viewWeek') });
	fireEvent.click(toggle);
	expect(screen.getByRole('button', { name: t('calendar.previousWeek') })).toBeTruthy();
	expect(screen.getByRole('button', { name: t('calendar.nextWeek') })).toBeTruthy();
});

// Migrated day-number regressions: actual month/week React grids, including keyboard routes.

test('month numbers route boundary dates and keyboard activation while compact cells own the action', () => {
	const { app } = memoryVault(),
		context = new DashboardRenderContext(document.createElement('div')),
		open = vi.fn();
	const scene = (compact: boolean, dotMode = false) => (
		<TestProviders>
			<MonthGrid
				year={2026}
				month={7}
				byDay={new Map()}
				context={context}
				opts={{ app, compact, dotMode, onDayNumClick: open, onDayClick: open }}
			/>
		</TestProviders>
	);
	const view = render(scene(false)),
		nums = view.container.querySelectorAll('.dashboard-calendar-cell-num');
	expect(nums).toHaveLength(42);
	for (const n of nums) expect(n.getAttribute('aria-label')).toBeTruthy();
	fireEvent.click(nums[0]!);
	fireEvent.click(nums[41]!);
	fireEvent.keyDown(nums[5]!, { key: 'Enter' });
	fireEvent.keyDown(nums[6]!, { key: ' ' });
	expect(open.mock.calls.map((c) => c[0])).toEqual(['2026-07-27', '2026-09-06', '2026-08-01', '2026-08-02']);
	for (const dots of [false, true]) {
		view.rerender(scene(true, dots));
		expect(view.container.querySelector('.dashboard-calendar-cell-num[role="button"]')).toBeNull();
	}
	fireEvent.click(view.container.querySelector('.dashboard-calendar-cell')!);
	expect(open.mock.calls.at(-1)?.[0]).toBe('2026-07-27');
});
test('week headers cover Monday through Sunday and become inert without an action', () => {
	const { app } = memoryVault(),
		context = new DashboardRenderContext(document.createElement('div')),
		open = vi.fn();
	const scene = (enabled: boolean) => (
		<TestProviders>
			<WeekTimeGrid
				weekStart={new Date(2026, 7, 24)}
				byDay={new Map()}
				context={context}
				opts={{ app, compact: false, onDayNumClick: enabled ? open : undefined }}
			/>
		</TestProviders>
	);
	const view = render(scene(true)),
		headers = view.container.querySelectorAll('.dashboard-calgrid-dayhead');
	expect(headers).toHaveLength(7);
	for (const head of headers) fireEvent.click(head);
	expect(open.mock.calls.map((c) => c[0])).toEqual([
		'2026-08-24',
		'2026-08-25',
		'2026-08-26',
		'2026-08-27',
		'2026-08-28',
		'2026-08-29',
		'2026-08-30',
	]);
	view.rerender(scene(false));
	expect(view.container.querySelector('.dashboard-calgrid-dayhead[role="button"]')).toBeNull();
});
