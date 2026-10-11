import path from 'node:path';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { checkAccountTranscript } from './transcript';

test('vault aliases resolve account transcripts while inner junctions remain forbidden', async () => {
	const root = await mkdtemp(path.join(tmpdir(), 'nand-transcript-alias-'));
	const vault = path.join(root, 'vault'), alias = path.join(root, 'alias');
	const owner = path.join(vault, '.nand/agents/device/accounts/codex/default');
	await mkdir(owner, { recursive: true }); await symlink(vault, alias, 'junction');
	await writeFile(path.join(owner, 'session.jsonl'), '{}');
	const env = { NAND_ACCOUNT_ROOT: owner };
	try {
		await expect(checkAccountTranscript(alias, env, path.join(owner, 'session.jsonl'))).resolves.toBeUndefined();
		await expect(checkAccountTranscript(alias, env, path.join(alias, path.relative(vault, owner), 'session.jsonl'))).resolves.toBeUndefined();
		await symlink(owner, path.join(owner, 'linked'), 'junction');
		await expect(checkAccountTranscript(alias, env, path.join(owner, 'linked/session.jsonl'))).rejects.toThrow();
	} finally { await rm(root, { recursive: true, force: true }); }
});
