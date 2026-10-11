import { expect, test } from 'vitest';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { contentMigrationCandidates, prepareVaultContent, resolveContentCandidate } from './content-migration';
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

test('legacy highlights migrate while unmarked archives require an explicit ownership choice', async () => {
	const high = '---\nsource: weread\nbookId: "book-1"\ntitle: Book\nhighlightCount: 1\n---\nExisting highlight';
	const vault = memoryVault({ '.nand/config/settings.json': JSON.stringify({ version: 1, namespaces: { home: { taskArchivePath: 'Archive/Done.md', taskArchiveTarget: 'file' } } }), 'Weread/Highlights/Book.md': high, 'Archive/Done.md': '- [x] Done', 'NAND Exports/ordinary.md': '# My note', 'NAND/AI Workspace/Exports/ordinary.md': 'Other note', 'Example?.md': '---\nx: [\n---\n```yaml\nnand-type: habit\n```' });
	await prepareVaultContent(vault.app);
	expect(vault.contents.get('.nand/content/Weread/Highlights/Book.md')).toBe(high);
	expect(vault.contents.get('Archive/Done.md')).toBe('- [x] Done');
	expect(await contentMigrationCandidates(vault.app)).toContain('Archive/Done.md');
	await resolveContentCandidate(vault.app, 'Archive/Done.md', true);
	expect(vault.contents.get('.nand/content/Archive/Done.md')).toBe('- [x] Done');
	expect(vault.contents.get('NAND Exports/ordinary.md')).toBe('# My note');
	expect(vault.contents.get('NAND/AI Workspace/Exports/ordinary.md')).toBe('Other note');
	expect(vault.contents.has('Example?.md')).toBe(true);
});

test('an ordinary archive decision survives normalized default settings and restart', async () => {
	const vault = memoryVault({ 'Archive/Done.md': 'ordinary archive' });
	await prepareVaultContent(vault.app);
	await resolveContentCandidate(vault.app, 'Archive/Done.md', false);
	await vault.adapter.write('.nand/config/settings.json', JSON.stringify({ version: 1, namespaces: { home: { taskArchivePath: '.nand/content/Archive/Done.md', taskArchiveTarget: 'file' } } }));
	await prepareVaultContent(vault.app);
	expect(vault.contents.get('Archive/Done.md')).toBe('ordinary archive');
	expect(vault.contents.has('.nand/content/Archive/Done.md')).toBe(false);
	expect(await contentMigrationCandidates(vault.app)).not.toContain('Archive/Done.md');
});

test('the default archive name alone never establishes NAND ownership', async () => {
	const vault = memoryVault({ 'Archive/Done.md': '# Personal completed work' });
	await prepareVaultContent(vault.app);
	expect(vault.contents.get('Archive/Done.md')).toBe('# Personal completed work');
	expect(vault.contents.has('.nand/content/Archive/Done.md')).toBe(false);
	expect(await contentMigrationCandidates(vault.app)).toContain('Archive/Done.md');
});

test('new owned sources arriving during migration or after a completed batch are discovered', async () => {
	const owned = '---\nnand-type: habit\nnand-id: one\n---\n';
	const vault = memoryVault({ 'one.md': owned }), copy = vault.adapter.copy;
	let inject = true;
	vault.adapter.copy = async (source, target) => { await copy(source, target); if (inject) { inject = false; await vault.adapter.write('two.md', owned.replace('one', 'two')); } };
	await prepareVaultContent(vault.app);
	expect(vault.contents.has('.nand/content/two.md')).toBe(true);
	await vault.adapter.write('.nand/content/one.md', 'edited after migration');
	await vault.adapter.write('three.md', owned.replace('one', 'three'));
	await prepareVaultContent(vault.app);
	expect(vault.contents.get('.nand/content/one.md')).toBe('edited after migration');
	expect(vault.contents.has('.nand/content/three.md')).toBe(true);
});

test('ambiguous exports stay ordinary until an explicit ownership choice and retain original bytes when moved', async () => {
	const vault = memoryVault({ 'NAND Exports/unknown.md': 'conversation', 'NAND Exports/personal.md': 'personal' });
	await prepareVaultContent(vault.app);
	expect(await contentMigrationCandidates(vault.app)).toEqual(['NAND Exports/unknown.md', 'NAND Exports/personal.md']);
	await resolveContentCandidate(vault.app, 'NAND Exports/personal.md', false);
	await resolveContentCandidate(vault.app, 'NAND Exports/unknown.md', true);
	await prepareVaultContent(vault.app);
	expect(await contentMigrationCandidates(vault.app)).toEqual([]);
	expect(vault.contents.get('NAND Exports/personal.md')).toBe('personal');
	expect(vault.contents.get('.nand/content/NAND Exports/unknown.md')).toBe('conversation');
	expect(vault.contents.get('.nand/migrations/content/originals/NAND Exports/unknown.md')).toBe('conversation');
});
