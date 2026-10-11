import type { DataAdapter } from 'obsidian';
import { readSkillName, type SkillScan } from '../../core/skills/registry';

export const VAULT_SKILL_ROOTS = ['.agents/skills', '.claude/skills', '.codex/skills'] as const;

/** Explicit discovery only. Adapter.list returns full vault-relative paths, never basenames. */
export async function scanVaultSkills(adapter: Pick<DataAdapter, 'exists' | 'list' | 'read'>, signal?: AbortSignal): Promise<SkillScan> {
	const result: SkillScan = { entries: [], unavailable: [] };
	let visited = 0;
	const walk = async (folder: string, root: string, depth: number): Promise<void> => {
		signal?.throwIfAborted();
		if (++visited > 2000 || depth > 12) { result.unavailable.push(folder); return; }
		try {
			const listed = await adapter.list(folder);
			const skill = listed.files.find(file => file === `${folder}/SKILL.md`);
			if (skill) {
				const content = await adapter.read(skill);
				if (content.length > 256_000) { result.unavailable.push(skill); return; }
				const name = readSkillName(content, folder.slice(folder.lastIndexOf('/') + 1));
				if (name) result.entries.push({ name, sources: [{ kind: 'vault', path: skill }] });
				else result.unavailable.push(skill);
			}
			for (const child of listed.folders) {
				if (child.startsWith(`${root}/`) && child.startsWith(`${folder}/`) && !child.slice(folder.length + 1).includes('/') && !child.split('/').includes('..')) await walk(child, root, depth + 1);
			}
		} catch (error) { if (signal?.aborted) throw error; result.unavailable.push(folder); }
	};
	for (const root of VAULT_SKILL_ROOTS) {
		signal?.throwIfAborted();
		try { if (await adapter.exists(root)) await walk(root, root, 0); }
		catch (error) { if (signal?.aborted) throw error; result.unavailable.push(root); }
	}
	return result;
}
