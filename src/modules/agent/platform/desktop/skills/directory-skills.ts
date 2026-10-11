import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { readSkillName, type SkillScan } from '../../../core/skills/registry';

/** Only explicitly configured directories. Child symlinks never start another traversal. */
export async function scanDirectorySkills(directories: readonly string[], signal?: AbortSignal): Promise<SkillScan> {
	const result: SkillScan = { entries: [], unavailable: [] };
	let visited = 0;
	const walk = async (folder: string, depth: number): Promise<void> => {
		signal?.throwIfAborted();
		if (++visited > 2000 || depth > 12) { result.unavailable.push(folder); return; }
		try {
			const entries = await readdir(folder, { withFileTypes: true });
			if (entries.some(entry => entry.isFile() && entry.name === 'SKILL.md')) {
				const file = path.join(folder, 'SKILL.md');
				if ((await stat(file)).size > 256_000) result.unavailable.push(file);
				else {
					const name = readSkillName(await readFile(file, { encoding: 'utf8', signal }), path.basename(folder));
					if (name) result.entries.push({ name, sources: [{ kind: 'directory', path: file }] });
					else result.unavailable.push(file);
				}
			}
			for (const entry of entries) if (entry.isDirectory()) await walk(path.join(folder, entry.name), depth + 1);
		} catch (error) { if (signal?.aborted) throw error; result.unavailable.push(folder); }
	};
	for (const configured of directories) {
		const value = configured.trim();
		if (!value) continue;
		const expanded = value === '~' ? homedir() : /^~[/\\]/.test(value) ? path.join(homedir(), value.slice(2)) : value;
		if (!path.isAbsolute(expanded)) { result.unavailable.push(configured); continue; }
		await walk(path.resolve(expanded), 0);
	}
	return result;
}
