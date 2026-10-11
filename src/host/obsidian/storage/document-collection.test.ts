import { expect, test } from 'vitest';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { MarkdownCollectionStorage } from './document-collection';
import type { DocumentCollectionCodec } from '../../../shared/storage/document-collection';
import { habitDocuments } from '../../../modules/home/core/habit/documents';
import { HabitApplication } from '../../../modules/home/core/habit/application';
import { contentFiles } from './content-files';

test('hidden documents reload and save through the adapter without a native TFile', async () => {
	const path = '.nand/content/records/one.md';
	const vault = memoryVault({ [path]: '---\nnand-type: fixture\nnand-id: one\nname: first\n---\nAuthor text.\n' });
	expect(vault.app.vault.getFileByPath(path)).toBeNull();
	const codec: DocumentCollectionCodec<Array<{ id: string; name: string }>> = {
		root: '.nand/content/records', ownedTypes: ['fixture'], empty: () => [],
		decode: docs => docs.map(doc => ({ id: doc.id, name: String(doc.properties.name) })),
		encode: rows => rows.map(row => ({ id: row.id, path, properties: { 'nand-type': 'fixture', 'nand-id': row.id, name: row.name } })),
	};
	const first = new MarkdownCollectionStorage(vault.app, codec, 'records');
	expect(JSON.parse(await first.read('records'))).toEqual([{ id: 'one', name: 'first' }]);
	await first.write('records', JSON.stringify([{ id: 'one', name: 'second' }]));
	expect(vault.contents.get(path)).toContain('Author text.');
	first.dispose();
	const reopened = new MarkdownCollectionStorage(vault.app, codec, 'records');
	expect(JSON.parse(await reopened.read('records'))).toEqual([{ id: 'one', name: 'second' }]);
	reopened.dispose();
});

test('a hidden editor draft blocks a domain save and preserves the disk document', async () => {
	const path = '.nand/content/note.md', vault = memoryVault({ [path]: 'original' });
	const files = contentFiles(vault.app), draft = files.claimDraft(path, () => 'unsaved author draft');
	await expect(files.process(path, () => 'domain update')).rejects.toThrow('Unsaved editor');
	expect(vault.contents.get(path)).toBe('original');
	draft.release();
	expect(await files.process(path, () => 'domain update')).toBe('domain update');
});

test('the production habit writer creates only vault-owned hidden content and reloads it', async () => {
	const vault = memoryVault();
	const storage = new MarkdownCollectionStorage(vault.app, habitDocuments, 'data/habits.json');
	const habits = new HabitApplication(storage, 'data');
	await habits.load(); habits.addHabit('库内记录'); await habits.flush();
	const paths = [...vault.contents.keys()].filter(path => path.endsWith('.md'));
	expect(paths.length).toBeGreaterThan(0);
	expect(paths.every(path => path.startsWith('.nand/content/'))).toBe(true);
	expect(vault.app.vault.getMarkdownFiles()).toEqual([]);
	const reopened = new HabitApplication(new MarkdownCollectionStorage(vault.app, habitDocuments, 'data/habits.json'), 'data');
	await reopened.load(); expect(reopened.getHabits().map(habit => habit.name)).toEqual(['库内记录']);
	storage.dispose();
});
