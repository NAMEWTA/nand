import { expect, test } from 'vitest';
import { memoryVault } from '../../../../../scripts/fixtures/memory-vault';
import { buildPages } from './page-builder';

test('DQL includes managed properties, tasks and links to an ordinary note', async () => {
	const vault = memoryVault({ '.nand/content/Projects/One.md': '---\nproject: Alpha\n---\n- [ ] Review\n[[Other.md]]', 'Other.md': 'Ordinary note' });
	const pages = await buildPages(vault.app), managed = pages.find(page => page.file.path.startsWith('.nand/'))!;
	expect(managed.fields.project).toBe('Alpha');
	expect(managed.fields['file.tasks']).toHaveLength(1);
	expect(managed.fields['file.outlinks']).toHaveLength(1);
	expect(pages.find(page => page.file.path === 'Other.md')!.fields['file.inlinks']).toHaveLength(1);
});
