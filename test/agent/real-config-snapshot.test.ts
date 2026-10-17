import path from 'node:path';
import { mkdir, mkdtemp, realpath, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { captureRealConfig } from '../../scripts/obsidian-acceptance/real-config-snapshot.mjs';

// The guard used by the real-Obsidian acceptance: every location here is inside a throwaway directory.
test('the acceptance snapshot notices a change in a custom provider directory, an existing extension and NAND\'s own directory', async () => {
	const root = await realpath(await mkdtemp(path.join(tmpdir(), 'nand-snapshot-'))), home = path.join(root, 'home');
	try {
		const env = { CODEX_HOME: path.join(root, 'custom-codex'), CLAUDE_CONFIG_DIR: path.join(root, 'custom-claude'), GEMINI_CLI_HOME: path.join(root, 'custom-gemini'), XDG_CONFIG_HOME: path.join(root, 'xdg') };
		const files = {
			codex: path.join(env.CODEX_HOME, 'hooks.json'), claude: path.join(env.CLAUDE_CONFIG_DIR, 'settings.json'), gemini: path.join(env.GEMINI_CLI_HOME, '.gemini', 'settings.json'),
			opencode: path.join(env.XDG_CONFIG_HOME, 'opencode', 'plugins', 'nand-status.mjs'), pi: path.join(home, '.pi', 'agent', 'extensions', 'nand-status.ts'), script: path.join(home, '.nand', 'agent-hooks', 'nand-hook.sh'),
		};
		for (const file of Object.values(files)) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, 'original'); }
		const before = await captureRealConfig(env, home);
		expect(await captureRealConfig(env, home)).toBe(before);
		for (const [name, file] of Object.entries(files)) {
			await writeFile(file, 'changed by something else, same name');
			expect(await captureRealConfig(env, home), name).not.toBe(before);
			await writeFile(file, 'original');
			// Rewriting identical content still changes the file's metadata; restoring the bytes alone is not "untouched".
		}
		await writeFile(path.join(path.dirname(files.codex), 'hooks.json.nand-backup-1'), 'x');
		expect(await captureRealConfig(env, home)).not.toBe(before);
		// Default locations (no exported variables) are covered too.
		const plain = await captureRealConfig({}, home), plainFile = path.join(home, '.codex', 'hooks.json');
		await mkdir(path.dirname(plainFile), { recursive: true }); await writeFile(plainFile, '{}');
		expect(await captureRealConfig({}, home)).not.toBe(plain);
		await symlink(plainFile, path.join(home, '.codex', 'nand-link'));
		expect(await captureRealConfig({}, home)).toContain('nand-link');
	} finally { await rm(root, { recursive: true, force: true }); }
}, 30000);
