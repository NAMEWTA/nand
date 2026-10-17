// A fingerprint of the developer's real provider configuration, taken from the ORIGINAL environment before any
// variable is cleared, so an acceptance run can prove it left those files alone.
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/** Locations exactly as the providers resolve them: an exported variable wins, otherwise the conventional place under `home`. */
export function realConfigPaths(env, home) {
	const pick = (key, fallback) => path.isAbsolute(env[key] ?? '') ? env[key] : fallback;
	const claude = pick('CLAUDE_CONFIG_DIR', path.join(home, '.claude')), codex = pick('CODEX_HOME', path.join(home, '.codex')), grok = pick('GROK_HOME', path.join(home, '.grok'));
	const gemini = path.join(pick('GEMINI_CLI_HOME', home), '.gemini'), pi = pick('PI_CODING_AGENT_DIR', path.join(home, '.pi', 'agent'));
	const opencode = pick('OPENCODE_CONFIG_DIR', path.join(pick('XDG_CONFIG_HOME', path.join(home, '.config')), 'opencode'));
	return {
		files: [path.join(claude, 'settings.json'), path.join(codex, 'hooks.json'), path.join(gemini, 'settings.json'), path.join(grok, 'hooks', 'nand-status.json'), path.join(pi, 'extensions', 'nand-status.ts'), path.join(opencode, 'plugins', 'nand-status.mjs')],
		directories: [claude, codex, gemini, grok, path.join(grok, 'hooks'), path.join(pi, 'extensions'), path.join(opencode, 'plugins'), path.join(home, '.nand'), path.join(home, '.nand', 'agent-hooks'), path.join(home, '.nand', 'agent-hooks', 'backups')],
	};
}

async function fingerprint(file) {
	try {
		const stat = await fs.lstat(file);
		const base = { link: stat.isSymbolicLink(), mode: stat.mode & 0o777, size: stat.size, mtime: stat.mtimeMs, ino: stat.ino };
		if (stat.isSymbolicLink()) return { ...base, target: await fs.readlink(file) };
		if (stat.isFile()) return { ...base, sha: createHash('sha256').update(await fs.readFile(file)).digest('hex') };
		return base;
	} catch (error) { return error.code === 'ENOENT' ? null : { error: error.code }; }
}

/** Files by content and metadata, plus every NAND-named entry beside them (other entries belong to live applications). */
export async function captureRealConfig(env, home) {
	const { files, directories } = realConfigPaths(env, home), entries = new Set(files);
	for (const directory of directories) {
		let names = [];
		try { names = await fs.readdir(directory); } catch { continue; }
		for (const name of names) if (/nand/i.test(name) || directory.includes(`${path.sep}.nand`)) entries.add(path.join(directory, name));
	}
	const listing = {};
	for (const entry of [...entries].sort()) listing[entry] = await fingerprint(entry);
	return JSON.stringify(listing);
}
