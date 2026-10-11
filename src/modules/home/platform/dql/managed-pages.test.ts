import { expect, test } from 'vitest';
import { memoryVault } from '../../../../../scripts/fixtures/memory-vault';
import { buildPages } from './page-builder';
import { makeLink } from '../../core/dql/values';
import { contentFiles } from '../../../../host/obsidian/storage/content-files';

test('DQL includes managed properties, tasks and links to an ordinary note', async () => {
	const vault = memoryVault({ '.nand/content/Projects/One.md': '---\nproject: Alpha\n---\n- [ ] Review\n[[Other.md]]', 'Other.md': 'Ordinary note' });
	const pages = await buildPages(vault.app), managed = pages.find(page => page.file.path.startsWith('.nand/'))!;
	expect(managed.fields.project).toBe('Alpha');
	expect(managed.fields['file.tasks']).toHaveLength(1);
	expect(managed.fields['file.outlinks']).toHaveLength(1);
	expect(pages.find(page => page.file.path === 'Other.md')!.fields['file.inlinks']).toHaveLength(1);
});

test('DQL preserves Markdown URL identities and already-resolved native paths', async () => {
	const vault = memoryVault({ '.nand/content/Folder/A B.md': 'space', '.nand/content/Folder/A%20B.md': 'literal', '.nand/content/Folder/Note.md': '[space](A%20B.md)', 'A.md': 'root', 'Folder/A.md': 'relative', 'Folder/Native.md': 'link chosen by Obsidian' });
	vault.app.metadataCache.resolvedLinks = { 'Folder/Native.md': { 'A.md': 1 } };
	let pages = await buildPages(vault.app);
	expect(pages.find(page => page.file.path === '.nand/content/Folder/Note.md')?.fields['file.outlinks']).toEqual([makeLink('.nand/content/Folder/A B.md')]);
	expect(pages.find(page => page.file.path === 'Folder/Native.md')?.fields['file.outlinks']).toEqual([makeLink('A.md')]);
	const files = contentFiles(vault.app);
	await files.rename(files.getFileByPath('.nand/content/Folder/Note.md')!, '.nand/content/Moved.md');
	pages = await buildPages(vault.app);
	expect(pages.find(page => page.file.path === '.nand/content/Moved.md')?.fields['file.outlinks']).toEqual([makeLink('.nand/content/Folder/A B.md')]);
	expect(pages.find(page => page.file.path === '.nand/content/Folder/A B.md')?.fields['file.inlinks']).toEqual([makeLink('.nand/content/Moved.md')]);
});
