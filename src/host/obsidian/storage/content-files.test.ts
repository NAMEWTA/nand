import { expect, test } from 'vitest';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { contentFiles } from './content-files';

test('malformed frontmatter does not hide other searchable documents and remains editable', async () => {
	const vault = memoryVault({ '.nand/content/bad.md': '---\na: [\n---\n# Keep me', '.nand/content/good.md': '---\ntag: useful\n---\n#body-tag' });
	const files = contentFiles(vault.app); await files.prepareMetadata();
	expect(files.getMetadata(files.getFileByPath('.nand/content/good.md')!)?.frontmatter).toEqual({ tag: 'useful' });
	expect(files.getMetadata(files.getFileByPath('.nand/content/bad.md')!)?.frontmatter).toBeUndefined();
	expect(await files.read('.nand/content/bad.md')).toContain('a: [');
	await expect(files.processFrontMatter(files.getFileByPath('.nand/content/bad.md')!, properties => { properties.tag = 'x'; })).rejects.toThrow();
});

test('managed folders and binary attachments stay indexed and deletion retains a recoverable copy', async () => {
	const vault = memoryVault(), files = contentFiles(vault.app);
	await files.mkdir('.nand/content/档案/人/附件');
	await files.create('.nand/content/档案/人/基本信息.md', 'record');
	await files.createBinary('.nand/content/档案/人/附件/image.png', new TextEncoder().encode('image bytes').buffer as ArrayBuffer);
	expect(files.getAbstractFileByPath('.nand/content/档案/人/附件')).toBeTruthy();
	expect(files.listFolder('.nand/content/档案/人').filter(item => !item.folder).map(item => item.path).sort()).toEqual(['.nand/content/档案/人/基本信息.md', '.nand/content/档案/人/附件/image.png']);
	await expect(files.createBinary('.nand/content/档案/人/附件/image.png', new ArrayBuffer(0))).rejects.toThrow();
	const draft = files.claimDraft('.nand/content/档案/人/基本信息.md', () => 'unsaved');
	await expect(files.trashFolder('.nand/content/档案/人')).rejects.toThrow('Unsaved editor');
	draft.release();
	await files.trashFolder('.nand/content/档案/人');
	expect(files.getFileByPath('.nand/content/档案/人/基本信息.md')).toBeNull();
	expect([...vault.contents].some(([path, text]) => path.startsWith('.nand/recovery/trash/') && path.endsWith('/基本信息.md') && text === 'record')).toBe(true);
});

test('legacy and relative links resolve to managed files and retain heading targets when opened', async () => {
	const vault = memoryVault({ '.nand/content/Records/A.md': '# Section', '.nand/content/Records/B.md': '[[A#Section]]' });
	const files = contentFiles(vault.app); await files.refresh();
	expect(files.resolveLink('Records/A')?.path).toBe('.nand/content/Records/A.md');
	expect(files.resolveLink('A#Section', '.nand/content/Records/B.md')?.path).toBe('.nand/content/Records/A.md');
	const opened: unknown[] = [];
	files.bindOpen(async (path, _owner, fragment) => { opened.push({ path, fragment }); });
	await files.open('Records/A#Section');
	expect(opened).toEqual([{ path: '.nand/content/Records/A.md', fragment: '#Section' }]);
});
