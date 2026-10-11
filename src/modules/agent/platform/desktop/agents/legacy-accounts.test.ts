import path from 'node:path';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { test, expect } from 'vitest';
import { prepareLegacyAccounts } from './legacy-accounts';
import { accountEnv } from './accounts';
import { getAgent } from '../../../core/launch/catalog';
import { t } from '../../../../../shared/i18n';

test('legacy accounts require a cold restart and an explicit binding, preserving the archived original', async () => {
	const vault = await mkdtemp(path.join(tmpdir(), 'nand-legacy-account-')), plugin = path.join(vault, '.obsidian/plugins/nand');
	const source = path.join(plugin, 'accounts/claude/ab/home');
	await mkdir(source, { recursive: true }); await writeFile(path.join(source, '.credentials.json'), '{"fixture":"retained"}');
	await mkdir(path.join(plugin, 'binaries')); await writeFile(path.join(plugin, 'binaries/nand-pty.exe'), 'old helper');
	let dispose: (() => void) | undefined;
	try {
		await expect(prepareLegacyAccounts({ vault, device: 'device', plugin, boot: 'one' })).rejects.toThrow(t('agent.legacyRestart'));
		await expect(prepareLegacyAccounts({ vault, device: 'device', plugin, boot: 'one' })).rejects.toThrow(t('agent.legacyRestart'));
		expect(await readFile(path.join(source, '.credentials.json'), 'utf8')).toContain('retained');
		dispose = await prepareLegacyAccounts({ vault, device: 'device', plugin, boot: 'two', choose: async options => { expect(options.candidates).toEqual(['ab']); expect(options.name).toBe('a.b'); return 'ab'; } });
		await expect(access(source)).rejects.toMatchObject({ code: 'ENOENT' });
		expect(await readFile(path.join(vault, '.nand/helpers/device/legacy-plugin/files/nand-pty.exe'), 'utf8')).toBe('old helper');
		await expect(access(path.join(plugin, 'binaries'))).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(accountEnv(getAgent('claude-code'), 'a.b', vault, 'device')).rejects.toThrow(t('agent.legacyChoice'));
		const env = await accountEnv(getAgent('claude-code'), 'a.b', vault, 'device', true);
		expect(env.CLAUDE_CONFIG_DIR).toContain(path.join('.nand', 'agents', 'device', 'accounts', 'claude-code'));
		expect(await readFile(path.join(env.CLAUDE_CONFIG_DIR!, '.credentials.json'), 'utf8')).toContain('retained');
		await writeFile(path.join(env.CLAUDE_CONFIG_DIR!, '.credentials.json'), '{"fixture":"renewed"}');
		expect((await accountEnv(getAgent('claude-code'), 'a.b', vault, 'device')).CLAUDE_CONFIG_DIR).toBe(env.CLAUDE_CONFIG_DIR);
		expect(await readFile(path.join(vault, '.nand/agents/device/legacy-accounts/files/claude/ab/home/.credentials.json'), 'utf8')).toContain('retained');
		await expect(accountEnv(getAgent('claude-code'), 'ab', vault, 'device')).rejects.toThrow(t('agent.legacyChoice'));
	} finally { dispose?.(); await rm(vault, { recursive: true, force: true }); }
}, 30000);
