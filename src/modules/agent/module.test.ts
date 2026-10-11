import { expect, test, vi } from 'vitest';
import type { ModuleContext } from '../../app/contracts/module';
import { normalizeTerminalSettings } from './core/terminal/settings';
import { AGENT_SKILLS, type AgentSkills } from './api';
import createAgentModule from './module';

vi.mock('./services/controller', () => { throw new Error('Mobile must not evaluate the desktop terminal controller'); });
vi.mock('./platform/desktop/skills/directory-skills', () => { throw new Error('Mobile must not evaluate the external-directory reader'); });

test('mobile activation publishes only portable skills, with no terminal/controller or Node reader', async () => {
	let reads = 0;
	const settings = normalizeTerminalSettings({ skillDirectories: ['~/must-not-read'], knownSkills: { codex: ['remembered'] } });
	const instance = createAgentModule({ env: { desktop: false, mobile: true, phone: true }, app: { vault: { adapter: {
		exists: async () => { reads++; return false; }, list: async () => ({ files: [], folders: [] }), read: async () => '',
	} } }, settings: { bind: () => ({ get: () => settings, update: async () => {} }) } } as unknown as ModuleContext);
	await instance.activate?.(new AbortController().signal);
	expect(reads).toBe(0);
	expect(instance.services?.map(([key]) => key)).toEqual([AGENT_SKILLS]);
	const skills = instance.services?.[0]?.[1] as AgentSkills;
	expect(await skills.list('codex')).toEqual({ entries: [{ name: 'remembered', sources: [{ kind: 'remembered', path: 'codex' }] }], unavailable: [] });expect(reads).toBe(3);
	await instance.dispose('disabled');await expect(skills.list('codex')).rejects.toThrow('unavailable');
});
