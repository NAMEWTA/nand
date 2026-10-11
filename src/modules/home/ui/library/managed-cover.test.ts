import { expect, test } from 'vitest';
import { memoryVault } from '../../../../../scripts/fixtures/memory-vault';
import { ContentFiles, contentFiles } from '../../../../host/obsidian/storage/content-files';
import { extractCoverValue, resolveLibraryCover } from './library-presentation';

test('managed and ordinary library covers preserve their bytes across a property-link move', async () => {
	for (const owned of [false, true]) for (const reference of ['[[pic.png]]', '![[pic.png]]', '![cover](pic.png)', 'pic.png', '<img src="pic.png" width="2">']) {
		const prefix = owned ? '.nand/content/' : '';
		const before = '---\n# Keep this comment\ntitle: "Unrelated title"\ncover: '+JSON.stringify(reference)+' # Keep inline comment\nlinks: ["[[../Ref]]"]\n---\n# Body';
		const vault = memoryVault({ '.nand/content/Old/Note.md': before, [prefix+'Old/pic.png']: 'old image bytes', [prefix+'New/pic.png']: 'different image bytes', '.nand/content/Ref.md': '---\nrelated: "[[Old/Note]]"\n---\n' });
		const files = contentFiles(vault.app); await files.prepareMetadata();
		const cover = async (filePath: string) => {
			await files.prepareMetadata(); const file = files.getFileByPath(filePath)!;
			const candidate = extractCoverValue(files.getMetadata(file)!.frontmatter!)!;
			const url = await resolveLibraryCover(candidate.value, file, vault.app); expect(url).toMatch(/^blob:/);
			try { return await (await fetch(url)).text(); } finally { URL.revokeObjectURL(url); }
		};
		expect(await cover('.nand/content/Old/Note.md')).toBe('old image bytes');
		await files.rename(files.getFileByPath('.nand/content/Old/Note.md')!, '.nand/content/New/Note.md');
		expect(await cover('.nand/content/New/Note.md')).toBe('old image bytes');
		const moved = await files.read('.nand/content/New/Note.md');
		expect(moved).toContain('# Keep this comment\ntitle: "Unrelated title"'); expect(moved).toContain('# Keep inline comment');
		await files.create('.nand/content/Old/Note.md', 'new identity');
		const reopened = new ContentFiles(vault.app); await reopened.prepareMetadata();
		expect(reopened.getMetadata(reopened.getFileByPath('.nand/content/Ref.md')!)!.frontmatter!.related).toBe('[[/.nand/content/New/Note.md]]');
	}
});
