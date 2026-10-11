import { expect, test } from 'vitest';
import { scanVaultSkills } from './vault-skills';
import { mergeSkills } from '../../core/skills/registry';

test('actual DataAdapter full paths are consumed once and only SKILL frontmatter becomes metadata', async () => {
	const files: Record<string, string> = {
		'.agents/skills/fallback/SKILL.md': '# Skill\nname: fake-body-name\n',
		'.claude/skills/a/SKILL.md': '---\nname: review\n---\n',
		'.codex/skills/b/SKILL.md': '---\nname: review\n---\n',
		'.codex/skills/b/helper.md': 'name: not-a-skill',
	};
	const reads: string[] = [];
	const result = await scanVaultSkills({ exists: async folder => Object.keys(files).some(file => file.startsWith(`${folder}/`)),
		list: async folder => { const paths = Object.keys(files).filter(file => file.startsWith(`${folder}/`)); return {
			files: paths.filter(file => !file.slice(folder.length + 1).includes('/')),
			folders: [...new Set(paths.filter(file => file.slice(folder.length + 1).includes('/')).map(file => `${folder}/${file.slice(folder.length + 1).split('/')[0]}`))],
		}; },
		read: async file => { reads.push(file); if (!(file in files)) throw new Error(file); return files[file]!; },
	});
	expect(result.unavailable).toEqual([]); expect(reads).toHaveLength(3);
	expect(mergeSkills(result.entries)).toEqual([{ name: 'fallback', sources: [{ kind: 'vault', path: '.agents/skills/fallback/SKILL.md' }] }, { name: 'review', sources: [{ kind: 'vault', path: '.claude/skills/a/SKILL.md' }, { kind: 'vault', path: '.codex/skills/b/SKILL.md' }] }]);
});

test('absent roots do no list/read work and cancellation stops before scanning', async () => {
	let exists = 0;
	const adapter = { exists: async () => { exists++; return false; }, list: async () => { throw new Error('no list'); }, read: async () => { throw new Error('no read'); } };
	expect(await scanVaultSkills(adapter)).toEqual({ entries: [], unavailable: [] });expect(exists).toBe(3);
	const abort = new AbortController();abort.abort();await expect(scanVaultSkills(adapter, abort.signal)).rejects.toThrow();expect(exists).toBe(3);
});
