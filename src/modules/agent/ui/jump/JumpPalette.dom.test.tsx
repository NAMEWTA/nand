import { expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore } from 'zustand/vanilla';
import { TestProviders } from '../../../../ui/react/test-providers';
import { emptyWorkspace, type TerminalTabData } from '../../core/workspace/model';
import type { HistoryRow } from '../../services/history-store';
import type { AgentController } from '../../services/controller';
import { JumpPalette } from './JumpPalette';

function fixture() {
	const tab: TerminalTabData = {
		id: 'open',
		title: 'Open terminal',
		kind: 'terminal',
		createdAt: 1,
		updatedAt: 1,
		state: 'idle',
		unread: false,
		sessionIds: ['session'],
		focusedSessionId: 'session',
		panes: { session: { cwd: '/vault' } },
		paneLayout: { kind: 'pane', session: 'session' },
	};
	const state = {
		...emptyWorkspace(),
		tabs: { open: tab },
		groups: [{ id: 'group', tabIds: ['open'], activeTabId: 'open', recentTabIds: [] }],
		activeGroupId: 'group',
		closedTabs: [{ ...tab, id: 'closed', title: 'Closed terminal' }],
	};
	const row: HistoryRow = {
		key: 'history',
		title: 'Native history',
		agentId: 'codex',
		accountKey: '{}',
		sessionId: 'native',
		cwd: '/vault',
		transcriptPath: '/vault/log',
		modifiedAtMs: 1,
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: null, known: false },
		inVault: true,
		metadata: {},
		model: null,
		createdAt: null,
		firstPrompt: '',
		turns: [],
		messageCount: 0,
	};
	const workspace = { store: createStore(() => state), move: vi.fn(), reopen: vi.fn(), report: vi.fn() };
	const resume = vi.fn(async () => {}),
		resumeAt = vi.fn(async () => {}),
		close = vi.fn(),
		select = vi.fn();
	const controller = {
		workspace,
		resume,
		resumeAt,
		historyStore: { store: createStore(() => ({ rows: [row] })) },
	} as unknown as AgentController;
	render(
		<TestProviders>
			<JumpPalette controller={controller} close={close} select={select} />
		</TestProviders>,
	);
	return { workspace, resume, resumeAt, close, select, row, user: userEvent.setup() };
}
test.each([false, true])('history Enter restores with split=%s exactly once', async (split) => {
	const f = fixture();
	await f.user.type(screen.getByRole('combobox'), 'Native history');
	await waitFor(() =>
		expect(document.querySelector('[cmdk-item][data-selected="true"]')?.getAttribute('data-history-key')).toBe(
			'history',
		),
	);
	await f.user.keyboard(split ? '{Shift>}{Enter}{/Shift}' : '{Enter}');
	if (split) {
		expect(f.resumeAt).toHaveBeenCalledExactlyOnceWith(f.row, 'group', 'right');
		expect(f.resume).not.toHaveBeenCalled();
	} else {
		expect(f.resume).toHaveBeenCalledExactlyOnceWith(f.row);
		expect(f.resumeAt).not.toHaveBeenCalled();
	}
	expect(f.close).toHaveBeenCalledOnce();
});
test.each([false, true])('closed tab Enter reopens with split=%s exactly once', async (split) => {
	const f = fixture();
	await f.user.click(screen.getByRole('combobox'));
	await f.user.keyboard('{ArrowDown}');
	await waitFor(() =>
		expect(document.querySelector('[cmdk-item][data-selected="true"]')?.getAttribute('data-closed-id')).toBe(
			'closed',
		),
	);
	await f.user.keyboard(split ? '{Shift>}{Enter}{/Shift}' : '{Enter}');
	expect(f.workspace.reopen).toHaveBeenCalledExactlyOnceWith('closed');
	expect(f.select).toHaveBeenCalledExactlyOnceWith('closed');
	if (split)
		expect(f.workspace.move).toHaveBeenCalledExactlyOnceWith('closed', { split: 'right', ofGroupId: 'group' });
	else expect(f.workspace.move).not.toHaveBeenCalled();
	expect(f.close).toHaveBeenCalledOnce();
});
test('open tab Shift+Enter still splits right', async () => {
	const f = fixture();
	await f.user.click(screen.getByRole('combobox'));
	await f.user.keyboard('{Shift>}{Enter}{/Shift}');
	expect(f.workspace.move).toHaveBeenCalledExactlyOnceWith('open', { split: 'right', ofGroupId: 'group' });
	expect(f.select).toHaveBeenCalledExactlyOnceWith('open');
});
