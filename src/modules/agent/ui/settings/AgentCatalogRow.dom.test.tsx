import { expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore } from 'zustand/vanilla';
import { TestProviders } from '../../../../ui/react/test-providers';
import type { SettingsHandle } from '../../../../shared/settings/store';
import { t } from '../../../../shared/i18n';
import { normalizeTerminalSettings, type TerminalSettings } from '../../core/terminal/settings';
import { launchSettings } from '../../core/detection/merge';
import { launchArgs } from '../../core/launch/flags';
import { AgentsStore } from '../../services/agents-store';
import type { AgentController } from '../../services/controller';
import { AgentsSettings } from './AgentsSettings';

vi.mock('../../platform/desktop/detection/shell-path', () => ({ loginShellPath: async () => '/bin' }));
vi.mock('../../platform/desktop/detection/probe', () => ({ probeAgents: () => ({ 'claude-code': '/bin/claude' }) }));

async function fixture(mode: 'yolo' | 'manual') {
	const state = createStore(() => normalizeTerminalSettings({ permissionMode: mode }));
	const settings = {
		get: state.getState,
		subscribe: state.subscribe,
		update: async (recipe: (draft: TerminalSettings) => void) => {
			const draft = structuredClone(state.getState());
			recipe(draft);
			state.setState(draft, true);
		},
	} as unknown as SettingsHandle<TerminalSettings>;
	const agents = new AgentsStore(settings);
	await agents.refresh();
	const controller = { settings, agents, workspace: { report: vi.fn() } } as unknown as AgentController;
	const view = render(
		<TestProviders>
			<AgentsSettings controller={controller} />
		</TestProviders>,
	);
	const row = () => within(view.container.querySelector('[data-agent-catalog="claude-code"]')! as HTMLElement);
	const user = userEvent.setup();
	await user.click(row().getByRole('button', { name: t('agent.manage.override') }));
	const input = () => row().getByRole('textbox', { name: new RegExp(t('agent.manage.args')) }) as HTMLInputElement;
	return {
		settings,
		agents,
		row,
		user,
		input,
		args: () => launchArgs(launchSettings(settings.get()), 'claude-code'),
	};
}

test('focus and blur inherited args never persist an override; permission changes update actual launch args', async () => {
	const f = await fixture('yolo');
	expect(f.input().value).toBe('--dangerously-skip-permissions');
	await f.user.click(f.input());
	await f.user.tab();
	expect(f.settings.get().overrides['claude-code']?.args).toBeUndefined();
	// Clicking Manual itself blurs the input before changing the permission mode.
	await f.user.click(f.input());
	await f.user.click(screen.getByRole('radio', { name: t('agent.manage.manual') }));
	expect(f.input().value).toBe('');
	expect(f.args()).toEqual([]);
	expect(f.settings.get().overrides['claude-code']?.args).toBeUndefined();
	await f.user.click(f.input());
	await f.user.click(screen.getByRole('radio', { name: t('agent.manage.yolo') }));
	expect(f.args()).toEqual(['--dangerously-skip-permissions']);
	expect(f.settings.get().overrides['claude-code']?.args).toBeUndefined();
	f.agents.dispose();
});

test('explicit empty and custom args persist across permission changes; reset restores inheritance', async () => {
	const f = await fixture('yolo');
	await f.user.clear(f.input());
	await f.user.tab();
	expect(f.settings.get().overrides['claude-code']?.args).toBe('');
	expect(f.args()).toEqual([]);
	await f.user.click(screen.getByRole('radio', { name: t('agent.manage.manual') }));
	await f.user.click(screen.getByRole('radio', { name: t('agent.manage.yolo') }));
	expect(f.args()).toEqual([]);
	await f.user.type(f.input(), '--model sonnet');
	await f.user.tab();
	expect(f.args()).toEqual(['--model', 'sonnet']);
	await f.user.click(f.row().getByRole('button', { name: t('agent.manage.reset') }));
	expect(f.settings.get().overrides['claude-code']?.args).toBeUndefined();
	expect(f.input().value).toBe('--dangerously-skip-permissions');
	expect(f.args()).toEqual(['--dangerously-skip-permissions']);
	await f.user.click(screen.getByRole('radio', { name: t('agent.manage.manual') }));
	expect(f.args()).toEqual([]);
	f.agents.dispose();
});
