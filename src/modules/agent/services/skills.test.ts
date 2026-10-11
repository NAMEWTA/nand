import { expect, test } from 'vitest';
import { AgentSkillDirectory } from './skills';
import { normalizeTerminalSettings, type TerminalSettings } from '../core/terminal/settings';

function setup(desktop: boolean, directories: string[] = []) {
	const value = normalizeTerminalSettings({ skillDirectories: directories });
	let scans = 0, reads = 0, writes = 0;
	const service = new AgentSkillDirectory({ exists: async () => { reads++; return false; }, list: async () => ({ files: [], folders: [] }), read: async () => '' }, {
		get: () => value, update: async (recipe: (draft: TerminalSettings) => void) => { writes++;recipe(value); },
	}, desktop, async () => { scans++; return { entries: [{ name: 'external', sources: [{ kind: 'directory', path: '/explicit/external/SKILL.md' }] }], unavailable: [] }; });
	return { service, value, counts: () => ({ scans, reads, writes }) };
}

test('construction and capabilities never scan; empty desktop config and all mobile config skip outside IO', async () => {
	for (const [desktop, paths] of [[true, []], [false, ['~/skills']]] as const) {
		const state = setup(desktop, [...paths]);
		expect(state.service.targets()).toHaveLength(6);expect(state.service.capability('pi')).toEqual({ prefix: '/skill:' });expect(state.counts()).toEqual({ scans: 0, reads: 0, writes: 0 });
		expect(await state.service.list('codex')).toEqual({ entries: [], unavailable: [] });expect(state.counts()).toEqual({ scans: 0, reads: 3, writes: 0 });
	}
	const state = setup(true, ['/explicit']);expect((await state.service.list('codex')).entries[0]?.name).toBe('external');expect(state.counts().scans).toBe(1);
	state.value.skillDirectories = [];await state.service.list('codex');expect(state.counts().scans).toBe(1);
});

test('only explicit valid saved names enter per-agent memory and can be removed', async () => {
	const state = setup(false);
	await state.service.list('codex');expect(state.counts().writes).toBe(0);
	await state.service.remember('codex', 'review');await state.service.remember('codex', 'review');expect(state.counts().writes).toBe(1);
	expect((await state.service.list('codex')).entries).toEqual([{ name: 'review', sources: [{ kind: 'remembered', path: 'codex' }] }]);expect((await state.service.list('pi')).entries).toEqual([]);
	await expect(state.service.remember('codex', 'bad name')).rejects.toThrow();await expect(state.service.remember('gemini', 'review')).rejects.toThrow();expect(state.counts().writes).toBe(1);
	await state.service.forget('codex', 'review');expect((await state.service.list('codex')).entries).toEqual([]);
	state.service.dispose();await expect(state.service.list('codex')).rejects.toThrow('unavailable');
});

test('module disposal cancels an ongoing scan before any additional directory is read', async () => {
	let finish: ((value: boolean) => void) | undefined, outside = 0;
	const state = normalizeTerminalSettings({ skillDirectories: ['/explicit'] });
	const service = new AgentSkillDirectory({ exists: () => new Promise(resolve => { finish = resolve; }), list: async () => ({ files: [], folders: [] }), read: async () => '' }, { get: () => state, update: async () => {} }, true, async () => { outside++; return { entries: [], unavailable: [] }; });
	const pending = service.list('codex');service.dispose();finish?.(false);await expect(pending).rejects.toThrow();expect(outside).toBe(0);
});
