import { expect, test, vi } from 'vitest';
import { MarkdownView } from 'obsidian';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { registerMessages, setLanguage } from '../../../shared/i18n';
import { parseDocumentValue } from '../../../shared/storage/document-repository';
import { messages } from '../i18n';
import { upsertMaterial } from '../core/materials';
import { newsNotePort } from '../platform/note-port';
import { briefPath, favoriteMaterial, favoritePath, parseMaterialNote, refreshFavoriteNote, serializeBrief, serializeMaterial } from '../platform/notes';
import { NewsNotebook } from './news-notebook';
import { newsFolder } from '../core/note-folders';
import { buildDailyEdition } from '../core/edition';
import { emptyEvents } from '../core/grouping';

registerMessages(messages);
const material = () => upsertMaterial(undefined, { sourceId: 'alpha', url: 'https://example.com/a?x=1&y=2',
	title: '新闻: "#测试"', summary: 'A short excerpt', body: 'FULL ARTICLE MUST NOT BE COPIED', publishedAt: Date.UTC(2026, 9, 9, 12) }, Date.UTC(2026, 9, 9, 13));

function newsVault(initial: Parameters<typeof memoryVault>[0] = {}) {
	const vault = memoryVault(initial);
	Object.assign(vault.app, { metadataCache: {
		getFileCache: (file: { path: string }) => ({ frontmatter: parseDocumentValue(vault.contents.get(file.path) ?? '').properties }),
		on: () => ({}), offref: () => undefined,
	} });
	return vault;
}

test('custom folders affect new notes while tagged favorites and editions keep identity across moves and restart', async () => {
	const vault = newsVault(), item = await material();
	const folders = { favoriteFolder: 'Reading/Saved', editionFolder: 'Reading/Daily' };
	const notes = new NewsNotebook(newsNotePort(vault.app, () => folders), () => undefined, () => folders);
	await notes.ready; await notes.save(item, 'Reader annotation');
	const saved = notes.path(item.id)!; expect(saved.startsWith('Reading/Saved/')).toBe(true);
	const edition = buildDailyEdition({ materials: [], analyses: [], sources: [], events: emptyEvents(), previous: [], evidence: [] }, Date.UTC(2026, 9, 9, 12));
	await notes.saveEdition(edition, [], [], []);
	const original = `Reading/Daily/${edition.date}.md`, moved = 'Personal/News journal.md';
	await vault.adapter.write(moved, vault.contents.get(original)! + '\nJournal annotation\n'); vault.contents.delete(original); vault.emit('rename', vault.file(moved), original);
	folders.favoriteFolder = 'New/Favorites'; folders.editionFolder = 'New/Daily';
	await notes.save({ ...item, title: 'Updated' }, ''); await notes.saveEdition(edition, [], [], []);
	expect(notes.path(item.id)).toBe(saved); expect(vault.contents.get(saved)).toContain('Reader annotation');
	expect(vault.contents.get(moved)).toContain('Journal annotation'); expect(vault.contents.has(`New/Daily/${edition.date}.md`)).toBe(false);
	await notes.dispose();
	const restarted = new NewsNotebook(newsNotePort(vault.app, () => folders), () => undefined, () => folders); await restarted.ready;
	expect(restarted.path(item.id)).toBe(saved); await restarted.saveEdition(edition, [], [], []);
	expect([...vault.contents.values()].filter(text => text.includes('nand-type: news-edition'))).toHaveLength(1);
	const port = newsNotePort(vault.app, () => folders);
	await expect(port.process('.nand/private.md', () => 'hidden')).rejects.toThrow('news.note.path');
	for (const path of ['../escape', '/absolute', 'C:/outside', 'Visible/.hidden', 'Visible/NUL', 'Visible/trailing.']) expect(newsFolder(path)).toBeUndefined();
	await restarted.dispose();
});

test('renamed brief notes remain authoritative after restart and story merge, preserving reader edits', async () => {
	const renamed = 'NAND/新闻/简报/自定义名称.md';
	const vault = newsVault({ [renamed]: serializeBrief('old-story', 'Old title', 'Old body', 'My annotations') });
	const notes = new NewsNotebook(newsNotePort(vault.app), () => undefined);
	await notes.ready;
	expect(notes.brief(['new-story', 'old-story'])?.path).toBe(renamed);
	expect(await notes.saveBrief('new-story', 'New title', 'New body', ['old-story'])).toBe(renamed);
	expect(vault.contents.has(briefPath('new-story'))).toBe(false);
	expect(vault.contents.get(renamed)).toContain('My annotations');
	expect(notes.brief(['old-story'])?.body).toContain('New body');
	const edited = vault.contents.get(renamed)!.replace('New body', 'My correction');
	await vault.adapter.write(renamed, edited);
	await expect(notes.saveBrief('new-story', 'Again', 'Replacement', ['old-story'])).rejects.toThrow('news.note.edited');
	expect(vault.contents.get(renamed)).toBe(edited);
	await notes.dispose();
	const restarted = new NewsNotebook(newsNotePort(vault.app), () => undefined);
	await restarted.ready;
	expect(restarted.brief(['old-story'])?.body).toContain('My correction');
	await restarted.dispose();
});

test('favorite Markdown safely encodes metadata and preserves all reader-owned regions and properties', async () => {
	setLanguage('zh');
	const item = await material();
	const initial = serializeMaterial(item, '批注一\n\n## Notes\n批注二');
	expect(initial).not.toContain('FULL ARTICLE MUST NOT BE COPIED');
	expect(parseDocumentValue(initial).properties.title).toBe(item.title);
	expect(parseMaterialNote(initial).notes).toBe('批注一\n\n## Notes\n批注二');
	const custom = initial.replace('---\n', '---\ncustom: keep # comment\n') + '\n## Appendix\nMy text\n';
	const next = refreshFavoriteNote(custom, { ...item, title: 'New title', revision: 2 });
	expect(next).toContain('custom: keep # comment');
	expect(next).toContain('批注一\n\n## Notes\n批注二');
	expect(next).toContain('## Appendix\nMy text');
	expect(favoriteMaterial(next)?.id).toBe(item.id);
	expect(() => refreshFavoriteNote(custom.replace('A short excerpt', 'My correction'), item)).toThrow('news.note.edited');
	setLanguage('en');
});

test('the Vault notebook handles filename collisions and renames, and rediscovers favorites without cache', async () => {
	const item = await material(), first = favoritePath(item);
	const vault = newsVault({ [first]: '# An unrelated user note\n' });
	const changed = vi.fn();
	const notes = new NewsNotebook(newsNotePort(vault.app), changed);
	await notes.ready;
	await Promise.all([notes.save(item, 'first annotation'), notes.save(item, '')]);
	const path = notes.path(item.id)!;
	expect(path).not.toBe(first);
	expect(vault.contents.get(first)).toBe('# An unrelated user note\n');
	expect([...vault.contents.values()].filter(text => text.includes('nand-type: news'))).toHaveLength(1);
	const renamed = 'NAND/新闻/收藏/我的文件.md';
	await vault.adapter.write(renamed, vault.contents.get(path)!);
	vault.contents.delete(path);
	vault.emit('rename', vault.file(renamed), path);
	await notes.save({ ...item, title: 'Revised' }, 'second annotation');
	expect(notes.path(item.id)).toBe(renamed);
	expect(vault.contents.has(path)).toBe(false);
	expect(await notes.notes(item.id)).toContain('first annotation');
	expect(await notes.notes(item.id)).toContain('second annotation');
	await notes.dispose();
	const restarted = new NewsNotebook(newsNotePort(vault.app), () => undefined);
	await restarted.ready;
	expect(restarted.list().map(value => value.id)).toEqual([item.id]);
	expect(restarted.path(item.id)).toBe(renamed);
	await restarted.dispose();
	const count = changed.mock.calls.length;
	await vault.adapter.write(renamed, vault.contents.get(renamed)! + '\nAfter dispose\n');
	expect(changed).toHaveBeenCalledTimes(count);
});

test('an unsaved editor or changed generated region prevents overwriting the note and reporting success', async () => {
	const item = await material(), path = favoritePath(item), original = serializeMaterial(item, 'Reader note');
	const vault = newsVault({ [path]: original });
	const notes = new NewsNotebook(newsNotePort(vault.app), () => undefined);
	await notes.ready;
	const view = Object.create(MarkdownView.prototype) as MarkdownView;
	let editor = original;
	Object.assign(view, { file: vault.file(path), editor: { getValue: () => editor } });
	vi.spyOn(vault.app.workspace, 'getLeavesOfType').mockReturnValue([{ view } as never]);
	const process = vault.app.vault.process.bind(vault.app.vault);
	vi.spyOn(vault.app.vault, 'process').mockImplementation((file, update) => {
		// The edit arrives after the save action starts, before Vault applies its atomic update.
		editor = original + ' unsaved';
		return process(file, update);
	});
	await expect(notes.save({ ...item, title: 'Replace' }, '')).rejects.toThrow('news.note.unsaved');
	expect(vault.contents.get(path)).toBe(original);
	vi.restoreAllMocks();
	const edited = original.replace('A short excerpt', 'Reader correction');
	await vault.adapter.write(path, edited);
	await expect(notes.save(item, '')).rejects.toThrow('news.note.edited');
	expect(vault.contents.get(path)).toBe(edited);
	await notes.dispose();
	await expect(notes.save(item, '')).rejects.toThrow('news.stopped');
});
