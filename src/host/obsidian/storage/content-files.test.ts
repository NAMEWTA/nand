import { expect, test } from 'vitest';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { ContentFiles, contentFiles } from './content-files';

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

test('literal percent names open unchanged while encoded links still resolve', async () => {
	const vault = memoryVault({ '.nand/content/100%.md': 'percent', '.nand/content/A%20B.md': 'literal', '.nand/content/A B.md': 'space' });
	const files = contentFiles(vault.app); await files.refresh();
	const opened: string[] = []; files.bindOpen(async path => { opened.push(path); });
	await files.open('.nand/content/100%.md'); await files.open('.nand/content/A%20B.md');
	expect(opened).toEqual(['.nand/content/100%.md', '.nand/content/A%20B.md']);
	expect(files.resolveLink('A%2520B')?.path).toBe('.nand/content/A%20B.md');
});

test('a competing creation is never overwritten by a new managed document', async () => {
	const vault = memoryVault(), files = contentFiles(vault.app), exists = vault.adapter.exists;
	const path = '.nand/content/new.md'; let raced = false;
	vault.adapter.exists = async name => {
		const found = await exists(name);
		if (name === path && !found && !raced) { raced = true; await vault.adapter.write(path, 'external bytes'); }
		return found;
	};
	await expect(files.create(path, 'local export')).rejects.toThrow();
	expect(vault.contents.get(path)).toBe('external bytes');
});

test('refresh waits for a rename and never emits a false deletion to consumers', async () => {
	const vault = memoryVault({ '.nand/content/A.md': 'a' }), files = contentFiles(vault.app);
	await files.refresh();
	const events: string[] = []; const off = files.subscribe(event => events.push(event.kind));
	const rename = vault.adapter.rename;
	let entered!: () => void, release!: () => void;
	const started = new Promise<void>(resolve => { entered = resolve; });
	const waiting = new Promise<void>(resolve => { release = resolve; });
	vault.adapter.rename = async (from, to) => { await rename(from, to); entered(); await waiting; };
	const move = files.rename(files.getFileByPath('.nand/content/A.md')!, '.nand/content/B.md');
	await started; const scan = files.refresh();
	await Promise.resolve(); release(); await Promise.all([move, scan]);
	expect(events).not.toContain('delete'); expect(events).toContain('rename'); off();
});

test('moving content preserves incoming and relative outgoing links across restart', async () => {
	const vault = memoryVault({ '.nand/content/Projects/Sub/Note.md': '![picture](../assets/image.png)', 'Projects/assets/image.png': 'image' });
	let files = contentFiles(vault.app); await files.refresh();
	expect(files.resolveLink('../assets/image.png', '.nand/content/Projects/Sub/Note.md')?.path).toBe('Projects/assets/image.png');
	await files.rename(files.getFileByPath('.nand/content/Projects/Sub/Note.md')!, '.nand/content/Moved/Note.md');
	files = new ContentFiles(vault.app); await files.refresh();
	expect(files.resolveLink('Projects/Sub/Note')?.path).toBe('.nand/content/Moved/Note.md');
	expect(files.resolveLink('../assets/image.png', '.nand/content/Moved/Note.md')?.path).toBe('Projects/assets/image.png');
});
