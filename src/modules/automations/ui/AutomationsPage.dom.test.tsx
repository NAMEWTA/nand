import { fireEvent, render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { TestProviders } from '../../../ui/react/test-providers';
import { setLanguage, t } from '../../../shared/i18n';
import { EditorDialog } from './editor/EditorDialog';
import { newDraft, draftError } from './editor/draft';
import { AUTOMATION_TEMPLATES } from '../core/templates';

beforeEach(() => setLanguage('en'));
import { definition, fixture } from './test-fixture';
test('search arrows select visible rows, Enter opens detail, modifiers and IME do not activate rows', async () => {
	const f = fixture();
	const { container } = render(<f.Page />);
	const search = screen.getByRole('textbox', { name: t('automation.searchAll') });
	fireEvent.keyDown(search, { key: 'ArrowDown' });
	expect(container.querySelector('[data-current=true]')?.getAttribute('data-automation-row-id')).toBe('Alpha');
	fireEvent.keyDown(search, { key: 'ArrowDown' });
	expect(container.querySelector('[data-current=true]')?.getAttribute('data-automation-row-id')).toBe('Beta');
	fireEvent.keyDown(search, { key: 'ArrowUp' });
	expect(container.querySelector('[data-current=true]')?.getAttribute('data-automation-row-id')).toBe('Alpha');
	fireEvent.keyDown(search, { key: 'Enter', isComposing: true });
	fireEvent.keyDown(search, { key: 'Enter', ctrlKey: true });
	expect(f.navigate).not.toHaveBeenCalled();
	fireEvent.change(search, { target: { value: 'body Beta' } });
	fireEvent.keyDown(search, { key: 'ArrowDown' });
	fireEvent.keyDown(search, { key: 'Enter' });
	expect(f.navigate).toHaveBeenLastCalledWith({ feature: 'automations', section: 'tasks', resourceId: 'Beta' });
	expect(await screen.findByRole('tab', { name: t('automation.overview') })).toBeTruthy();
	f.view.dispose();
});
test('row controls and portaled menu actions never open detail; status filter and pills can be removed', async () => {
	const user = userEvent.setup(),
		f = fixture();
	render(<f.Page />);
	await user.click(screen.getByRole('switch', { name: 'Pause Alpha' }));
	expect(f.service.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'Alpha', enabled: false }));
	expect(f.navigate).not.toHaveBeenCalled();
	await user.click(screen.getByRole('button', { name: 'Actions for Alpha' }));
	await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
	expect(await screen.findByRole('dialog')).toBeTruthy();
	expect(f.navigate).not.toHaveBeenCalled();
	await user.click(screen.getByRole('button', { name: 'Cancel' }));
	await user.click(screen.getByRole('button', { name: 'Filter' }));
	await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Paused' }));
	expect(screen.queryByRole('button', { name: 'Alpha' })).toBeNull();
	await user.click(screen.getByRole('button', { name: 'Clear all' }));
	expect(screen.getByRole('button', { name: 'Alpha' })).toBeTruthy();
	f.view.dispose();
});
test('template opens a prefilled reminder, validates name, saves and runs with the saved revision', async () => {
	const f = fixture([]),
		user = userEvent.setup();
	render(<f.Page />);
	await user.click(screen.getByRole('button', { name: /Drink water/ }));
	const dialog = await screen.findByRole('dialog');
	expect((within(dialog).getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('Drink water');
	fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), { target: { value: '' } });
	expect((within(dialog).getByRole('button', { name: 'Create' }) as HTMLButtonElement).disabled).toBe(true);
	fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), { target: { value: 'Hydrate' } });
	await user.click(within(dialog).getByRole('button', { name: 'Save and run' }));
	await waitFor(() =>
		expect(f.service.save).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Hydrate',
				templateId: 'water',
				action: { kind: 'notify', body: 'Time for a glass of water.' },
			}),
		),
	);
	expect(f.service.run).toHaveBeenCalledTimes(1);
	f.view.dispose();
});
test('source reminder keeps task identity and source-provided title through save', async () => {
	const f = fixture(),
		close = vi.fn();
	const source = { kind: 'dashboard' as const, path: 'Board.md', id: 'task-id' };
	render(
		<TestProviders>
			<EditorDialog host={f.host} request={{ source, title: 'Follow up' }} onClose={close} />
		</TestProviders>,
	);
	await userEvent.click(screen.getByRole('button', { name: 'Create' }));
	await waitFor(() =>
		expect(f.service.save).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Follow up', source, action: { kind: 'notify', body: 'Follow up' } }),
		),
	);
	f.view.dispose();
});
test('agent availability is rechecked and stale choices/user content are never replaced', () => {
	const agents = [
		{ id: 'claude-code', title: 'Claude Code', enabled: true, installed: false },
		{ id: 'codex', title: 'Codex', enabled: true, installed: true },
	];
	const draft = newDraft({}, 'device', '/vault', agents);
	expect(draft.action).toMatchObject({ kind: 'agent', agentId: 'codex' });
	draft.name = 'Original';
	if (draft.action.kind !== 'agent') throw Error('Expected agent');
	draft.action.prompt = 'Original prompt';
	expect(draftError(draft, agents, '/vault')).toBeUndefined();
	agents[1]!.installed = false;
	expect(draftError(draft, agents, '/vault')).toBe(t('automation.agentSelectionUnavailable'));
	expect(newDraft({ existing: draft }, 'device', '/vault', agents)).toEqual(draft);
	expect(AUTOMATION_TEMPLATES).toHaveLength(5);
});
test('forbidden extras remain visible in the editor and prevent saving; draft is localized without replacing text', async () => {
	const f = fixture(),
		close = vi.fn();
	f.service.agent = () => ({
		listAgents: () => [{ id: 'claude-code', title: 'Claude Code', enabled: true }],
		listSessions: async () => [],
		start: vi.fn(),
		stop: vi.fn(),
		open: vi.fn(),
	});
	const d = definition('User title');
	d.action = {
		kind: 'agent',
		agentId: 'claude-code',
		prompt: 'User prompt',
		cwd: '/vault',
		sessionMode: 'fresh',
		extraArgs: '--dangerously-skip-permissions',
	};
	const { rerender } = render(
		<TestProviders>
			<EditorDialog host={f.host} request={{ existing: d }} onClose={close} />
		</TestProviders>,
	);
	expect(screen.getAllByText(/Rejected extra argument/).length).toBeGreaterThan(0);
	expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
	fireEvent.change(screen.getByRole('textbox', { name: 'Extra arguments' }), { target: { value: '--model opus' } });
	expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
	setLanguage('zh');
	rerender(
		<TestProviders>
			<EditorDialog host={f.host} request={{ existing: d }} onClose={close} />
		</TestProviders>,
	);
	expect((screen.getByRole('textbox', { name: '名称' }) as HTMLInputElement).value).toBe('User title');
	expect((screen.getByRole('textbox', { name: '提示词 / 内容' }) as HTMLTextAreaElement).value).toBe('User prompt');
	cleanup();
	f.view.dispose();
	expect(f.listeners.size).toBe(0);
});

test('disabled execution blocks every mutation while preserving readable definitions and history', async () => {
	const f = fixture();
	Object.defineProperty(f.service, 'executionEnabled', { value: false });
	f.listeners.forEach((listener) => listener());
	const user = userEvent.setup();
	render(<f.Page />);
	expect(screen.getByRole('alert').textContent).toContain(t('automation.moduleOff'));
	expect((screen.getByRole('switch', { name: 'Pause Alpha' }) as HTMLButtonElement).disabled).toBe(true);
	expect((screen.getByRole('button', { name: t('automation.new') }) as HTMLButtonElement).disabled).toBe(true);
	await user.click(screen.getByRole('button', { name: 'Actions for Alpha' }));
	for (const item of screen.getAllByRole('menuitem')) expect(item.getAttribute('aria-disabled')).toBe('true');
	await user.keyboard('{Escape}');
	await user.click(screen.getByRole('button', { name: 'Alpha' }));
	expect(await screen.findByRole('tab', { name: t('automation.overview') })).toBeTruthy();
	expect((screen.getByRole('button', { name: t('automation.run') }) as HTMLButtonElement).disabled).toBe(true);
	expect(f.service.save).not.toHaveBeenCalled();
	expect(f.service.run).not.toHaveBeenCalled();
	f.view.dispose();
});

test('delete confirmation preference survives a page remount and deletion preserves the service history', async () => {
	const f = fixture(),
		user = userEvent.setup();
	let skip = false;
	f.host.skipDeleteConfirmation = () => skip;
	f.host.setSkipDeleteConfirmation = vi.fn(async (value) => {
		skip = value;
	});
	const page = render(<f.Page />);
	await user.click(screen.getByRole('button', { name: 'Actions for Alpha' }));
	await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
	const dialog = await screen.findByRole('alertdialog');
	await user.click(within(dialog).getByRole('checkbox'));
	await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
	await waitFor(() => expect(f.host.setSkipDeleteConfirmation).toHaveBeenCalledWith(true));
	expect(f.service.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'Alpha' }));
	page.unmount();
	render(<f.Page />);
	await user.click(screen.getByRole('button', { name: 'Actions for Beta' }));
	await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
	await waitFor(() => expect(f.service.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'Beta' })));
	expect(screen.queryByRole('alertdialog')).toBeNull();
	f.view.dispose();
});

test.each(['Filter', 'Actions for Alpha'])(
	'hiding a leaf closes %s, releases locks, and retains page state',
	async (label) => {
		const f = fixture(),
			user = userEvent.setup();
		const page = render(<f.Page />);
		fireEvent.change(screen.getByRole('textbox', { name: t('automation.searchAll') }), {
			target: { value: 'Alpha' },
		});
		await user.click(screen.getByRole('button', { name: label }));
		expect(await screen.findByRole('menu')).toBeTruthy();
		page.rerender(<f.Page visible={false} />);
		await waitFor(() => {
			expect(screen.queryByRole('menu')).toBeNull();
			expect(document.body.style.pointerEvents).not.toBe('none');
			expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
		});
		page.rerender(<f.Page />);
		expect((screen.getByRole('textbox', { name: t('automation.searchAll') }) as HTMLInputElement).value).toBe(
			'Alpha',
		);
		expect(screen.queryByRole('menu')).toBeNull();
		await user.click(screen.getByRole('button', { name: 'Alpha' }));
		expect(await screen.findByRole('tab', { name: t('automation.overview') })).toBeTruthy();
		f.view.dispose();
	},
);
test('hiding an editor with a nested picker releases both portal layers without recreating them on show', async () => {
	const f = fixture(),
		user = userEvent.setup();
	const page = render(<f.Page />);
	await user.click(screen.getByRole('button', { name: 'Actions for Alpha' }));
	await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
	await screen.findByRole('dialog');
	await user.click(screen.getAllByRole('combobox')[0]!);
	page.rerender(<f.Page visible={false} />);
	await waitFor(() => {
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(screen.queryByRole('listbox')).toBeNull();
		expect(document.body.style.pointerEvents).not.toBe('none');
		expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
	});
	page.rerender(<f.Page />);
	expect(screen.queryByRole('dialog')).toBeNull();
	f.view.dispose();
});
