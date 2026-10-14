import { expect, test, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore } from 'zustand/vanilla';
import { TestProviders } from '../../../../ui/react/test-providers';
import { t } from '../../../../shared/i18n';
import { emptyWorkspace } from '../../core/workspace/model';
import type { AgentController } from '../../services/controller';
import { Omnibox } from './Omnibox';
function fixture() {
	const workspace = {
		store: createStore(emptyWorkspace),
		browserAvailable: false,
		newTerminal: vi.fn(async () => 'session'),
		newAgent: vi.fn(async () => 'agent-session'),
		newBrowser: vi.fn(() => {
			throw new Error(t('agent.workspace.browserDisabled'));
		}),
		activate: vi.fn(),
	};
	const controller = {
		workspace,
		runtime: { listAgents: () => [{ id: 'claude-code', title: 'Claude Code', installed: true, enabled: true }] },
		settings: { get: () => ({ agents: { agents: { 'claude-code': { cliPath: '' } } } }) },
		agentTitle: () => 'Claude Code',
		shells: () => [{ choice: 'default', title: 'Shell' }],
		open: vi.fn(async () => {}),
	} as unknown as AgentController;
	const done = vi.fn();
	render(
		<TestProviders>
			<Omnibox controller={controller} groupId="group" onDone={done} />
		</TestProviders>,
	);
	return { workspace, done, input: screen.getByRole('combobox') };
}
test('empty Enter opens the default terminal in the current group', async () => {
	const f = fixture(),
		user = userEvent.setup();
	f.input.focus();
	await user.keyboard('{Enter}');
	await waitFor(() => expect(f.workspace.newTerminal).toHaveBeenCalledWith({ groupId: 'group', shell: undefined }));
	expect(f.done).toHaveBeenCalledOnce();
});
test('agent alias Enter launches and browser failure retains input and menu', async () => {
	const f = fixture(),
		user = userEvent.setup();
	await user.type(f.input, 'claude');
	await user.keyboard('{Enter}');
	await waitFor(() => expect(f.workspace.newAgent).toHaveBeenCalledWith('claude-code', { groupId: 'group' }));
	await user.clear(f.input);
	await user.type(f.input, 'example.com');
	await user.keyboard('{Enter}');
	await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(t('agent.workspace.browserDisabled')));
	expect((f.input as HTMLInputElement).value).toBe('example.com');
	expect(f.workspace.newBrowser).toHaveBeenCalledWith('https://example.com/', { groupId: 'group' });
});
test('Arrow keys select static actions; composition Enter never launches', async () => {
	const f = fixture(),
		user = userEvent.setup();
	f.input.focus();
	fireEvent.keyDown(f.input, { key: 'Enter', isComposing: true });
	expect(f.workspace.newTerminal).not.toHaveBeenCalled();
	await user.type(f.input, 'claude');
	await user.keyboard('{ArrowDown}{ArrowUp}{Enter}');
	await waitFor(() => expect(f.workspace.newAgent).toHaveBeenCalledOnce());
});

test('empty input still executes a static action selected with arrow keys', async () => {
	const f = fixture(),
		user = userEvent.setup();
	f.input.focus();
	await user.keyboard('{ArrowDown}{Enter}');
	await waitFor(() => expect(f.workspace.newAgent).toHaveBeenCalledOnce());
	expect(f.workspace.newTerminal).not.toHaveBeenCalled();
});

test('static terminal actions, agents and settings retain Orca groups and separators', () => {
	fixture();
	expect(screen.getByRole('group', { name: t('agent.workspace.menu.actions') }).textContent).toContain(
		t('agent.workspace.newTerminal'),
	);
	expect(screen.getByRole('group', { name: t('agent.workspace.menu.agents') }).textContent).toContain('Claude Code');
	expect(screen.getByRole('group', { name: t('agent.workspace.menu.settings') }).textContent).toContain(
		t('agent.workspace.agentSettings'),
	);
	expect(document.querySelectorAll('[cmdk-separator]')).toHaveLength(2);
});
