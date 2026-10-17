import path from 'node:path';
import { tmpdir } from 'node:os';
import { realpath, mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { expect, test, vi } from 'vitest';
import { normalizeAgentSettings } from '../../../core/launch/defaults';
import { readUsageSnapshots } from './usage';
import { accountEnv } from './accounts';
import { getAgent } from '../../../core/launch/catalog';

const observed = vi.hoisted(() => ({ reads: [] as string[], active: false }));
vi.mock('node:fs', async original => {
	const actual = await original<typeof import('node:fs')>();
	return { ...actual, readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
		if (observed.active) { observed.reads.push(String(args[0])); throw Object.assign(new Error('fixture-no-credentials'), { code: 'ENOENT' }); }
		return actual.readFileSync(...args);
	} };
});

test('usage readers only consult the selected account: a managed one stays in the vault, the system account reads the real home', async () => {
	const vault = await realpath(await mkdtemp(path.join(tmpdir(), 'nand-usage-scope-'))), home = await realpath(await mkdtemp(path.join(tmpdir(), 'nand-usage-home-')));
	const variables = ['CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'GROK_HOME', 'GEMINI_CLI_HOME', 'XDG_DATA_HOME'];
	vi.stubEnv('HOME', home); vi.stubEnv('USERPROFILE', home); for (const key of variables) vi.stubEnv(key, '');
	try {
		observed.active = true; observed.reads = [];
		const agents = ['claude-code', 'codex', 'grok', 'gemini', 'opencode'] as const;
		const managed = normalizeAgentSettings(null);
		for (const id of agents) managed.agents[id].accountId = 'a.b';
		const snapshots = await readUsageSnapshots(agents, { settings: managed, vault, device: 'fixture-device' });
		expect(snapshots.map(row => row.statusKey)).toEqual(Array(5).fill('notSignedIn'));
		expect(observed.reads).toHaveLength(5);
		for (const file of observed.reads) expect(path.relative(vault, file).split(path.sep).slice(0, 3)).toEqual(['.nand', 'agents', 'fixture-device']);
		observed.reads = [];
		const system = await readUsageSnapshots(agents, { settings: normalizeAgentSettings(null), vault, device: 'fixture-device' });
		expect(system.map(row => row.statusKey)).toEqual(Array(5).fill('notSignedIn'));
		expect(observed.reads).toHaveLength(5);
		for (const file of observed.reads) expect(path.relative(home, file).startsWith('..')).toBe(false);
	} finally { observed.active = false; vi.unstubAllEnvs(); await rm(vault, { recursive: true, force: true }); await rm(home, { recursive: true, force: true }); }
}, 30000);

test('a linked provider credential directory is a visible failure and never reads another account', async () => {
	const root = await realpath(await mkdtemp(path.join(tmpdir(), 'nand-usage-link-'))), vault = path.join(root, 'vault'), outside = path.join(root, 'outside');
	await mkdir(vault); await mkdir(outside); await writeFile(path.join(outside, 'oauth_creds.json'), JSON.stringify({ access_token: 'fixture-token', expiry_date: 1 }));
	try {
		const env = await accountEnv(getAgent('gemini'), 'a.b', vault, 'fixture-device');
		const provider = path.join(env.GEMINI_CLI_HOME!, '.gemini');
		await rm(provider, { recursive: true, force: true }); await symlink(outside, provider, 'junction');
		const settings = normalizeAgentSettings(null); settings.agents.gemini.accountId = 'a.b';
		const [result] = await readUsageSnapshots(['gemini'], { settings, vault, device: 'fixture-device' });
		expect(result?.failed).toBe(true);
		expect(result?.status).toMatch(/symlink|链接/);
	} finally { await rm(root, { recursive: true, force: true }); }
}, 30000);
