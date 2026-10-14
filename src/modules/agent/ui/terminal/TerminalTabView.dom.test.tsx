import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestProviders } from '../../../../ui/react/test-providers';
import { OwnerDocumentContext } from '../../../../ui/react/contexts';
import { WorkspaceUIContext } from '../workspace/workspace-context';
import type { AgentController } from '../../services/controller';
import type { TerminalTabData } from '../../core/workspace/model';
import { HiddenRendererRetention } from './hidden-renderer-retention';
import { TerminalHost } from './TerminalTabView';
import { normalizeTerminalSettings } from '../../core/terminal/settings';
const terminalSettings = normalizeTerminalSettings(undefined);
import { t } from '../../../../shared/i18n';
vi.mock('../../platform/desktop/files', () => ({ openPath: vi.fn() }));
vi.mock('./material-picker', () => ({ pickMaterial: vi.fn() }));
const created = vi.hoisted(
	() => [] as Array<{ setVisible: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }>,
);
vi.mock('./terminal-view', () => ({
	TerminalView: class {
		applySettings = vi.fn();
		setVisible = vi.fn();
		focus = vi.fn();
		dispose = vi.fn();
		constructor() {
			created.push(this);
		}
	},
}));
test('adopting a live terminal into another document disposes the old renderer and mounts the new visible renderer', () => {
	const session = { id: 'session', running: true },
		off = vi.fn();
	const controller = {
		app: { workspace: { on: vi.fn(() => ({})), offref: vi.fn() } },
		sessions: { get: () => session },
		settings: { get: () => terminalSettings, subscribe: () => off },
		workspace: { focusSession: vi.fn() },
	} as unknown as AgentController;
	const tab: TerminalTabData = {
		kind: 'terminal',
		id: 'tab',
		title: 'Shell',
		createdAt: 0,
		updatedAt: 0,
		sessionIds: ['session'],
		focusedSessionId: 'session',
		paneLayout: { kind: 'pane', session: 'session' },
		panes: { session: { cwd: '/vault' } },
		state: 'idle',
		unread: false,
	};
	const retention = new HiddenRendererRetention();
	const content = (doc: Document) => (
		<TestProviders>
			<OwnerDocumentContext value={doc}>
				<WorkspaceUIContext value={{ controller, confirm: async () => false, close: () => {} }}>
					<TerminalHost tab={tab} sessionId="session" active focused retention={retention} />
				</WorkspaceUIContext>
			</OwnerDocumentContext>
		</TestProviders>
	);
	const view = render(content(document));
	expect(created[0]?.setVisible).toHaveBeenCalledWith(true);
	view.rerender(content(document.implementation.createHTMLDocument('popout')));
	expect(created[0]?.dispose).toHaveBeenCalledOnce();
	expect(created[1]?.setVisible).toHaveBeenCalledWith(true);
	expect(off).toHaveBeenCalledOnce();
	view.unmount();
	expect(created[1]?.dispose).toHaveBeenCalledOnce();
	expect(off).toHaveBeenCalledTimes(3);
});

test.each([
	{ live: true, agent: true },
	{ live: true, agent: false },
	{ live: false, agent: true },
	{ live: false, agent: false },
])('pane status follows its own session or recovery metadata: live=$live agent=$agent', ({ live, agent }) => {
	const agentId = agent ? ('claude-code' as const) : undefined;
	const controller = {
		app: { workspace: { on: vi.fn(() => ({})), offref: vi.fn() } },
		sessions: {
			get: () =>
				live ? { id: 'pane', running: true, agentId, connection: 'connected', activity: 'idle' } : undefined,
		},
		settings: { get: () => terminalSettings, subscribe: () => () => {} },
		workspace: { focusSession: vi.fn() },
	} as unknown as AgentController;
	const tab: TerminalTabData = {
		kind: 'terminal',
		id: 'tab',
		title: 'Claude',
		agentId: 'claude-code',
		createdAt: 0,
		updatedAt: 0,
		sessionIds: ['primary-agent', 'pane'],
		focusedSessionId: 'pane',
		paneLayout: {
			kind: 'split',
			direction: 'row',
			ratio: 0.5,
			first: { kind: 'pane', session: 'primary-agent' },
			second: { kind: 'pane', session: 'pane' },
		},
		panes: { pane: { cwd: '/vault', agentId } },
		resume: { cwd: '/vault', agentId: 'claude-code' },
		state: 'idle',
		unread: false,
	};
	render(
		<TestProviders>
			<WorkspaceUIContext value={{ controller, confirm: async () => false, close: () => {} }}>
				<TerminalHost tab={tab} sessionId="pane" active focused retention={new HiddenRendererRetention()} />
			</WorkspaceUIContext>
		</TestProviders>,
	);
	if (agent) expect(screen.getByRole('img', { name: t(live ? 'ui.idle' : 'ui.unknown') })).toBeTruthy();
	else expect(screen.queryByRole('img')).toBeNull();
});
