import { expect, test } from 'vitest';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { ContentDraft } from './content-draft';
import { contentFiles } from './content-files';

test('an external edit cannot be overwritten by a hidden editor save', async () => {
	const path = '.nand/content/note.md', vault = memoryVault({ [path]: 'base' });
	const editor = new ContentDraft(contentFiles(vault.app), path, { storage: vault.adapter, path: '.nand/recovery/content/test.json' }); await editor.load();
	editor.edit('my draft'); await vault.adapter.write(path, 'their edit');
	await expect(editor.save()).rejects.toThrow('conflict');
	expect(editor.value).toBe('my draft'); expect(vault.contents.get(path)).toBe('their edit');
	editor.dispose();
});

test('rapid saves use execution order and retain edits made during persistence', async () => {
	const path = '.nand/content/note.md', vault = memoryVault({ [path]: 'base' });
	const editor = new ContentDraft(contentFiles(vault.app), path, { storage: vault.adapter, path: '.nand/recovery/content/test.json' }); await editor.load();
	const write = vault.adapter.write;
	let entered!: () => void, release!: () => void;
	const started = new Promise<void>(resolve => { entered = resolve; });
	const waiting = new Promise<void>(resolve => { release = resolve; });
	vault.adapter.write = async (file, text) => { if (file === path && text === 'one') { entered(); await waiting; } await write(file, text); };
	editor.edit('one'); const first = editor.save(); await started;
	editor.edit('two'); const second = editor.save();
	editor.edit('three'); release(); await Promise.all([first, second]);
	expect(editor.value).toBe('three'); expect(editor.dirty).toBe(true);
	await editor.save(); expect(vault.contents.get(path)).toBe('three'); expect(editor.dirty).toBe(false);
	editor.dispose();
});

test('an unsaved draft survives a runtime restart and still protects the external edit', async () => {
	const path = '.nand/content/note.md', vault = memoryVault({ [path]: 'base' });
	const recovery = { storage: vault.adapter, path: '.nand/recovery/content/test.json' };
	const first = new ContentDraft(contentFiles(vault.app), path, recovery); await first.load();
	await first.edit('unsaved draft'); first.dispose();
	await vault.adapter.write(path, 'external');
	const restarted = new ContentDraft(contentFiles(vault.app), path, recovery); await restarted.load();
	expect(restarted.value).toBe('unsaved draft'); expect(restarted.dirty).toBe(true);
	await expect(restarted.save()).rejects.toThrow('conflict'); expect(vault.contents.get(path)).toBe('external');
	restarted.dispose();
});

test('accepting the exact external text resolves a conflict without rewriting it with a stale draft', async () => {
	const path = '.nand/content/note.md', vault = memoryVault({ [path]: 'base' });
	const editor = new ContentDraft(contentFiles(vault.app), path, { storage: vault.adapter, path: '.nand/recovery/content/test.json' }); await editor.load();
	await editor.edit('mine'); await vault.adapter.write(path, 'theirs'); await expect(editor.save()).rejects.toThrow('conflict');
	await editor.edit('theirs'); await editor.save();
	expect(editor.dirty).toBe(false); expect(vault.contents.get(path)).toBe('theirs'); editor.dispose();
});

test('the next edit can recover after the first draft primary write fails', async () => {
	const path = '.nand/content/note.md', recoveryPath = '.nand/recovery/content/test.json';
	const vault = memoryVault({ [path]: 'base' }), write = vault.adapter.write;
	let fail = true;
	vault.adapter.write = async (file, text) => {
		if (file === recoveryPath && fail) { fail = false; throw new Error('disk temporarily unavailable'); }
		await write(file, text);
	};
	const editor = new ContentDraft(contentFiles(vault.app), path, { storage: vault.adapter, path: recoveryPath }); await editor.load();
	await expect(editor.edit('first')).rejects.toThrow('temporarily');
	await editor.edit('second'); await editor.save();
	expect(vault.contents.get(path)).toBe('second');
	editor.dispose();
});
