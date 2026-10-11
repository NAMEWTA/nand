import { expect, test } from 'vitest';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { prepareVaultContent } from './content-migration';
import { contentFiles } from './content-files';

test('startup discovers owned records and registered boards while preserving ordinary neighbours', async () => {
	const vault = memoryVault({
		'.nand/config/settings.json': JSON.stringify({ version: 1, namespaces: { home: { dashboardFile: 'Boards/work' } } }),
		'Boards/work.md': 'My registered board',
		'NAND/习惯/Read/习惯.md': '---\nnand-type: habit\nnand-id: read\nname: Read\n---\nMy annotations',
		'NAND/习惯/ordinary.md': 'An ordinary neighbouring note',
		'档案/个人档案/Someone/基本信息.md': '---\nnand-type: person\nnand-id: person-1\n---\n',
		'档案/个人档案/Someone/资料.md': 'Record attachment',
		'Ordinary.md': '[[NAND/习惯/Read/习惯]]',
	});
	await prepareVaultContent(vault.app);
	expect(contentFiles(vault.app).getMarkdownFiles().map(file => file.path)).toContain('.nand/content/Boards/work.md');
	expect(vault.contents.get('.nand/content/档案/个人档案/Someone/资料.md')).toBe('Record attachment');
	expect(vault.contents.has('NAND/习惯/Read/习惯.md')).toBe(false);
	expect(vault.contents.get('NAND/习惯/ordinary.md')).toBe('An ordinary neighbouring note');
	expect(vault.contents.get('Ordinary.md')).toBe('[[NAND/习惯/Read/习惯]]');
	await prepareVaultContent(vault.app);
});
