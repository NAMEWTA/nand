import { expect, test, vi } from 'vitest';
import { normalizeTerminalSettings } from '../core/terminal/settings';
import type { SettingsHandle } from '../../../shared/settings/store';
import { AgentsStore } from './agents-store';
const mocks = vi.hoisted(() => ({ path: vi.fn(), probe: vi.fn() }));
vi.mock('../platform/desktop/detection/shell-path', () => ({ loginShellPath: mocks.path }));
vi.mock('../platform/desktop/detection/probe', () => ({ probeAgents: mocks.probe }));
test('failed login-shell detection retries, caches PATH and cancels late publication after disposal', async () => {
	const settings = normalizeTerminalSettings(undefined);
	const handle = {
		get: () => settings,
		update: async (fn: (value: typeof settings) => void) => {
			fn(settings);
		},
	} as SettingsHandle<typeof settings>;
	mocks.path.mockRejectedValueOnce(new Error('shell timeout')).mockResolvedValue('/login/bin');
	mocks.probe.mockReturnValue({ 'claude-code': '/login/bin/claude', codex: '/login/bin/codex' });
	const store = new AgentsStore(handle);
	await store.refresh();
	expect(store.store.getState().failed).toBe(true);
	await store.refresh(true);
	expect(store.list().map((a) => a.id)).toEqual(['claude-code', 'codex']);
	await store.setEnabled('claude-code', false);
	expect(settings.defaultAgent).toBe('codex');
	await store.saveOverride('codex', { args: '' });
	expect(mocks.path).toHaveBeenCalledTimes(2);
	let done!: (path: string) => void;
	mocks.path.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				done = resolve;
			}),
	);
	const refresh = store.refresh(true);
	await Promise.resolve();
	store.dispose();
	const before = store.store.getState();
	done('/late/bin');
	await refresh;
	expect(store.store.getState()).toBe(before);
});
