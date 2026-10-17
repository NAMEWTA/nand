// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { expect, test, vi } from 'vitest';
import type { Command } from 'obsidian';
import type { ModuleContext } from '../../../app/contracts/module';
import { setLanguage } from '../../../shared/i18n';
import { FakeVault, createTestService, note } from '../services/test-support';
import type { ProductivityActions } from './actions';
import { registerNavigatorCommands } from './commands';
import type { NavigatorEnv } from './env';

vi.mock('obsidian', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), Platform: { isMacOS: false, isPhone: false, isMobile: false } }));

async function fixture() {
	setLanguage('en');
	const t = await createTestService(new FakeVault([note('a.md')], ['/']));
	const commands = new Map<string, Command>();
	const removed: string[] = [];
	const cleanups: Array<() => void> = [];
	const context = {
		app: { workspace: { containerEl: { ownerDocument: { activeElement: null } }, getActiveFile: () => null, onLayoutReady: (callback: () => void) => callback(), ensureSideLeaf: () => Promise.resolve() } },
		commands: {
			add: (command: Command) => { commands.set(command.id, command); return command; },
			remove: (id: string) => { removed.push(id); commands.delete(id); },
		},
		lifetime: { register: (cleanup: () => void) => cleanups.push(cleanup) },
	} as unknown as ModuleContext;
	const ran: string[] = [];
	const periodic = { openRelative: (delta: number) => { ran.push(`relative(${delta})`); return Promise.resolve(true); }, openParent: () => { ran.push('parent'); return Promise.resolve(true); } };
	const actions = new Proxy({}, {
		get: (_target, name) => (name === 'periodic' ? periodic : (...args: unknown[]) => { ran.push(`${String(name)}(${args.map(String).join(',')})`); return Promise.resolve(true); }),
	}) as unknown as ProductivityActions;
	const env = { report: (error: unknown) => { throw error; } } as unknown as NavigatorEnv;
	registerNavigatorCommands({ context, env, service: t.service, rebuildCache: () => Promise.resolve(), actions });
	return { ...t, commands, removed, ran, cleanups };
}

test('calendar, periodic, template, merge, tag and profile commands are registered', async () => {
	const t = await fixture();
	for (const id of [
		'toggle-calendar', 'open-day', 'open-week', 'open-month', 'open-quarter', 'open-year',
		'open-next-period', 'open-previous-period', 'open-parent-period',
		'new-note-from-template', 'merge-notes', 'add-tag', 'remove-tag', 'clear-tags', 'undo-tag-edit',
		'select-profile', 'select-profile-1', 'select-profile-2', 'select-profile-3',
	]) expect(t.commands.has(`navigator-${id}`), id).toBe(true);
});

test('period commands open the period; next, previous and parent follow the open note', async () => {
	const t = await fixture();
	await t.commands.get('navigator-open-quarter')!.callback!();
	await t.commands.get('navigator-open-next-period')!.callback!();
	await t.commands.get('navigator-open-previous-period')!.callback!();
	await t.commands.get('navigator-open-parent-period')!.callback!();
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(t.ran).toEqual(['openPeriod(quarter)', 'relative(1)', 'relative(-1)', 'parent']);
});

test('profile commands pick by position', async () => {
	const t = await fixture();
	await t.commands.get('navigator-select-profile-2')!.callback!();
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(t.ran).toEqual(['selectProfileAt(2)']);
});

test('user-defined create-note commands follow the settings while the module runs', async () => {
	const t = await fixture();
	const add = (id: string, name: string) => t.settings.update((draft) => { draft.createCommands = [...draft.createCommands, { id, name, template: '', fileName: 'x', location: 'selected', folder: '' }]; });
	await add('m1', 'Meeting note');
	expect(t.commands.get('navigator-create-m1')?.name).toBe('Meeting note');
	await t.commands.get('navigator-create-m1')!.callback!();
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(t.ran).toEqual(['runCreateCommand(m1)']);

	await t.settings.update((draft) => { draft.createCommands = draft.createCommands.map((command) => ({ ...command, name: 'Standup' })); });
	expect(t.removed).toEqual(['navigator-create-m1']);
	expect(t.commands.get('navigator-create-m1')?.name).toBe('Standup');

	await t.settings.update((draft) => { draft.createCommands = []; });
	expect(t.commands.has('navigator-create-m1')).toBe(false);
	expect(t.removed).toEqual(['navigator-create-m1', 'navigator-create-m1']);
});
