import { expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore } from 'zustand/vanilla';
import { NandProviders } from '../../../ui/react/providers';
import type { NativeSurfaceContext } from '../../../ui/native-surface';
import type { AgentController } from '../services/controller';
import { emptyWorkspace } from '../core/workspace/model';
import { t } from '../../../shared/i18n';
import { useWorkspaceUI } from './workspace/workspace-context';
import { AgentWorkspace } from './AgentWorkspacePage';
vi.mock('./workspace/WorkspaceLayout', () => ({
	WorkspaceLayout: () => {
		const { close } = useWorkspaceUI();
		return <button onClick={() => close('tab')}>Close fixture</button>;
	},
}));
vi.mock('./sidebar/AgentSidebar', () => ({ AgentSidebar: () => null }));
vi.mock('./create/NewTabMenu', () => ({ NewTabMenu: () => null }));
function fixture() {
	const choices: boolean[] = [];
	const workspace = {
		store: createStore(emptyWorkspace),
		setVisible: vi.fn(),
		onMenu: () => () => {},
		report: vi.fn(),
		close: vi.fn(async (_id: string, confirm: (s: string) => Promise<boolean>) => {
			choices.push(await confirm('End fixture?'));
		}),
	};
	const controller = {
		workspace,
  usageStore:{observeWindow:()=>()=>{}},
		app: { keymap: { pushScope: vi.fn(), popScope: vi.fn() } },
	} as unknown as AgentController;
	const content = (visible: boolean) => (
		<NandProviders ownerDocument={document} visible={visible}>
			<AgentWorkspace controller={controller} context={{} as NativeSurfaceContext} />
		</NandProviders>
	);
	const rendered = render(content(true));
	return { choices, ...rendered, content };
}
test('running tab close presents a real AlertDialog; cancel and accept settle the queued request', async () => {
	const f = fixture(),
		user = userEvent.setup();
	await user.click(screen.getByText('Close fixture'));
	await screen.findByRole('alertdialog');
	await user.click(screen.getByRole('button', { name: t('common.cancel') }));
	await waitFor(() => expect(f.choices).toEqual([false]));
	await user.click(screen.getByText('Close fixture'));
	await screen.findByRole('alertdialog');
	await user.click(screen.getByRole('button', { name: t('agent.end') }));
	await waitFor(() => expect(f.choices).toEqual([false, true]));
});
test('hiding and closing a page dismisses and cancels its pending confirmation without reopening it', async () => {
	const f = fixture(),
		user = userEvent.setup();
	await user.click(screen.getByText('Close fixture'));
	await screen.findByRole('alertdialog');
	f.rerender(f.content(false));
	await waitFor(() => expect(f.choices).toEqual([false]));
	expect(screen.queryByRole('alertdialog')).toBeNull();
	f.rerender(f.content(true));
	expect(screen.queryByRole('alertdialog')).toBeNull();
	await user.click(screen.getByText('Close fixture'));
	await screen.findByRole('alertdialog');
	f.unmount();
	await waitFor(() => expect(f.choices).toEqual([false, false]));
});
