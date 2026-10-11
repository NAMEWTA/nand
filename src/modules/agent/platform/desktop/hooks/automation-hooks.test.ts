import path from 'node:path';
import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { expect, test, vi } from 'vitest';
import { AutomationHooks } from './automation-hooks';
import { accountEnv } from '../agents/accounts';
import { AGENT_CATALOG } from '../../../core/launch/catalog';

test('native hooks and per-terminal event spools use only the selected vault account for every provider', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'nand-hooks-owned-')), vault = path.join(root, 'vault'), host = path.join(root, 'host');
	await mkdir(vault); await mkdir(host);
	const requireNode = createRequire(import.meta.url);
	const win = { require: (name: string) => name === 'node:os' ? { homedir: () => host, tmpdir: () => host } : requireNode(name), setInterval: () => 1, clearInterval: () => {} } as unknown as Window;
	vi.stubGlobal('window', win);
	const hooks = new AutomationHooks(win, () => ({ vault, device: 'fixture-device' }));
	try {
		for (const agent of AGENT_CATALOG) {
			const env = await accountEnv(agent, '', vault, 'fixture-device');
			const other = new AutomationHooks(win, () => ({ vault, device: 'fixture-device' }));
			const [handle, concurrent] = await Promise.all([hooks.prepare(agent.id, env, () => {}), other.prepare(agent.id, env, () => {})]);
			expect(handle.env.NAND_HOOK_DIR!.startsWith(env.NAND_ACCOUNT_ROOT! + path.sep)).toBe(true);
			expect(await readdir(host)).toEqual([]);
			handle.close();
			concurrent.close(); other.dispose();
		}
	} finally { hooks.dispose(); vi.unstubAllGlobals(); await rm(root, { recursive: true, force: true }); }
}, 30000);
