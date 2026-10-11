import path from 'node:path';
import { mkdtemp, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
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

test('a provider update arriving at the replacement boundary is preserved and reported', async () => {
	const vault = await mkdtemp(path.join(tmpdir(), 'nand-hooks-race-'));
	const requireNode = createRequire(import.meta.url), fs = requireNode('node:fs/promises') as typeof import('node:fs/promises');
	const env = await accountEnv(AGENT_CATALOG[0]!, '', vault, 'fixture-device');
	const file = path.join(env.CLAUDE_CONFIG_DIR!, 'settings.json');
	await writeFile(file, '{"before":true}');
	let injected = false;
	const wrapped = { ...fs, rename: async (from: string, to: string) => {
		if (!injected && (from === file || to === file)) { injected = true; await writeFile(file, '{"external":true}'); }
		return fs.rename(from, to);
	} };
	const win = { require: (name: string) => name === 'node:fs/promises' ? wrapped : requireNode(name), setInterval: () => 1, clearInterval: () => {} } as unknown as Window;
	vi.stubGlobal('window', win);
	const hooks = new AutomationHooks(win, () => ({ vault, device: 'fixture-device' }));
	try {
		await expect(hooks.prepare('claude-code', env, () => {})).rejects.toThrow();
		expect(injected).toBe(true);
		expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ external: true });
		const handle = await hooks.prepare('claude-code', env, () => {});
		expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ external: true, hooks: expect.any(Object) });
		handle.close();
	} finally { hooks.dispose(); vi.unstubAllGlobals(); await rm(vault, { recursive: true, force: true }); }
}, 30000);
