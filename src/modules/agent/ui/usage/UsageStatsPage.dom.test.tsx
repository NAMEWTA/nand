import { expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createStore } from 'zustand/vanilla';
import { TestProviders } from '../../../../ui/react/test-providers';
import { t } from '../../../../shared/i18n';
import { aggregate, emptyStats } from '../../core/stats/aggregate';
import { normalizeTerminalSettings } from '../../core/terminal/settings';
import type { AgentController } from '../../services/controller';
import type { HistoryRow } from '../../services/history-store';
import { UsageStatsPage } from './UsageStatsPage';
vi.mock('./DailyChart', () => ({ DailyChart: () => null }));

test('recent session cells and overview use the same native input-inclusive cache total', () => {
	const rows: HistoryRow[] = Array.from({ length: 3 }, (_, i) => ({
		key: String(i),
		sessionId: String(i),
		accountKey: '{}',
		agentId: 'claude-code',
		cwd: '/vault',
		transcriptPath: '/vault/log',
		modifiedAtMs: Date.now(),
		title: `Session ${i}`,
		inVault: true,
		model: 'sonnet',
		createdAt: null,
		firstPrompt: 'Prompt',
		turns: [],
		messageCount: 2,
		metadata: {},
		// Helper adds the original input (1200) and caches (200 + 100) once.
		usage: { input: 1500, output: 300, cacheRead: 200, cacheWrite: 100, cost: null, known: true },
	}));
	const settings = normalizeTerminalSettings(undefined);
	const controller = {
		stats: { store: createStore(emptyStats) },
		historyStore: {
			store: createStore(() => ({ rows, loading: false, error: '', warnings: [] })),
			refresh: vi.fn(async () => {}),
		},
		settings: { get: () => settings, subscribe: () => () => {} },
	} as unknown as AgentController;
	render(
		<TestProviders>
			<UsageStatsPage controller={controller} />
		</TestProviders>,
	);
	const tableRows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
	expect(tableRows).toHaveLength(3);
	const format = (v: number) =>
		new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(v);
	for (const row of tableRows) expect(within(row).getAllByRole('cell')[5]?.textContent).toBe(format(1800));
	const total = screen.getAllByText(t('agent.stats.total')).find((el) => el.tagName === 'P')!.parentElement!;
	expect(total.textContent).toContain(format(5400));
	expect(aggregate(rows).totals.total).toBe(3 * 1800);
});
