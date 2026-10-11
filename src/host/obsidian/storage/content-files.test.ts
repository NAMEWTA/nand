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
	const moved = await files.read('.nand/content/Moved/Note.md');
	expect(moved).toBe('![picture](</Projects/assets/image.png>)');
	expect(files.resolveLink('/Projects/assets/image.png', '.nand/content/Moved/Note.md')?.path).toBe('Projects/assets/image.png');
});

test('relative links prefer the source directory and renamed links survive path reuse', async () => {
	const vault = memoryVault({ '.nand/content/A/Note.md': '![old](pic.png)', '.nand/content/A/pic.png': 'old', '.nand/content/B/pic.png': 'new', 'Note.md': 'ordinary root', 'pic.png': 'root image' });
	let files = contentFiles(vault.app); await files.refresh();
	expect(files.resolveLink('pic.png', '.nand/content/A/Note.md')?.path).toBe('.nand/content/A/pic.png');
	await files.rename(files.getFileByPath('.nand/content/A/Note.md')!, '.nand/content/B/Note.md');
	await files.process('.nand/content/B/Note.md', text => text + '\n![new](./pic.png)');
	expect(files.resolveLink('./pic.png', '.nand/content/B/Note.md')?.path).toBe('.nand/content/B/pic.png');
	expect(await files.read('.nand/content/B/Note.md')).toContain('/.nand/content/A/pic.png');
	await files.rename(files.getFileByPath('.nand/content/B/Note.md')!, '.nand/content/C/Note.md');
	await files.create('.nand/content/B/Note.md', 'new file');
	files = new ContentFiles(vault.app); await files.refresh();
	expect(files.resolveLink('A/Note')?.path).toBe('.nand/content/C/Note.md');
	expect(files.resolveLink('pic.png', '.nand/content/B/Note.md')?.path).toBe('.nand/content/B/pic.png');
});

test('a failed rename cannot lend its source directory to an unrelated new destination', async () => {
	const vault = memoryVault({ '.nand/content/A/Note.md': '![old](pic.png)', '.nand/content/A/pic.png': 'old', '.nand/content/B/pic.png': 'new' });
	const files = contentFiles(vault.app); await files.refresh();
	vault.adapter.rename = async () => { throw new Error('rename denied'); };
	await expect(files.rename(files.getFileByPath('.nand/content/A/Note.md')!, '.nand/content/B/Note.md')).rejects.toThrow('rename denied');
	await files.create('.nand/content/B/Note.md', 'new file');
	expect(files.resolveLink('pic.png', '.nand/content/B/Note.md')?.path).toBe('.nand/content/B/pic.png');
});

test('relative literal percent names take precedence over URL decoding', async () => {
	const vault = memoryVault({ '.nand/content/Folder/A%20B.md': 'literal', '.nand/content/Folder/A B.md': 'space' });
	const files = contentFiles(vault.app); await files.refresh();
	for (const link of ['A%20B', 'A%20B.md', 'A%2520B']) expect(files.resolveLink(link, '.nand/content/Folder/Ref.md')?.path).toBe('.nand/content/Folder/A%20B.md');
});

test('existing incoming references keep their target when the old path is reused', async () => {
	const vault = memoryVault({ '.nand/content/Old/B.md': '# Target', '.nand/content/A.md': '[[Old/B#Target|label]]', 'Ordinary.md': '[target](Old/B.md#Target)\n`[[Old/B]]`\n```md\n[[Old/B]]\n```' });
	let files = contentFiles(vault.app); await files.refresh();
	await files.rename(files.getFileByPath('.nand/content/Old/B.md')!, '.nand/content/New/B.md');
	await files.create('.nand/content/Old/B.md', 'unrelated new content');
	files = new ContentFiles(vault.app); await files.refresh();
	expect(await files.read('.nand/content/A.md')).toBe('[[/.nand/content/New/B.md#Target|label]]');
	expect(await files.read('Ordinary.md')).toBe('[target](</.nand/content/New/B.md#Target>)\n`[[Old/B]]`\n```md\n[[Old/B]]\n```');
	expect(files.resolveLink('/.nand/content/New/B.md#Target', '.nand/content/A.md')?.path).toBe('.nand/content/New/B.md');
	expect(files.getFileByPath('.nand/content/Old/B.md')?.path).toBe('.nand/content/Old/B.md');
});

test('failed moves restore reference edits and retain a replayable receipt until rollback succeeds', async () => {
	const vault = memoryVault({ '.nand/content/Old/B.md': '![old](image.png)', '.nand/content/Old/image.png': 'image', 'Ref.md': '[[Old/B]]' });
	const files = contentFiles(vault.app); await files.refresh();
	const rename = vault.adapter.rename;
	vault.adapter.rename = async () => { throw new Error('move denied'); };
	await expect(files.rename(files.getFileByPath('.nand/content/Old/B.md')!, '.nand/content/New/B.md')).rejects.toThrow('move denied');
	expect(vault.contents.get('Ref.md')).toBe('[[Old/B]]');
	expect(vault.contents.get('.nand/content/Old/B.md')).toBe('![old](image.png)');
	vault.adapter.rename = rename;
	await files.rename(files.getFileByPath('.nand/content/Old/B.md')!, '.nand/content/New/B.md');
	expect(vault.contents.get('Ref.md')).toBe('[[/.nand/content/New/B.md]]');
});

test('a destination arriving during rename is retained alongside the moved source and receipt', async () => {
	const vault = memoryVault({ '.nand/content/Old.md': 'local original' }), files = contentFiles(vault.app);
	await files.refresh(); const rename = vault.adapter.rename;
	vault.adapter.rename = async (from, to) => { await vault.adapter.write('.nand/content/New.md', 'external destination'); await rename(from, to); };
	await expect(files.rename(files.getFileByPath('.nand/content/Old.md')!, '.nand/content/New.md')).rejects.toThrow('move-target-changed');
	expect(vault.contents.get('.nand/content/New.md')).toBe('external destination');
	expect([...vault.contents].some(([path, text]) => path.startsWith('.nand/recovery/renames/') && text === 'local original')).toBe(true);
	expect(JSON.parse(vault.contents.get('.nand/content-moves/manifest.json')!).pending).toBeTruthy();
});

test('every interrupted rename persistence step recovers consistent references without losing content', async () => {
	const initial = { '.nand/content/Old.md': '# Original', 'Ref.md': '[[Old]]' };
	const run = async (failAt = 0, after = false) => {
		const vault = memoryVault(initial); let files = new ContentFiles(vault.app); await files.refresh();
		let calls = 0;
		for (const method of ['write', 'rename', 'copy'] as const) {
			const original = vault.adapter[method];
			vault.adapter[method] = async (first: string, second: string) => {
				const fail = ++calls === failAt;
				if (fail && !after) throw new Error('injected move failure');
				await original(first, second);
				if (fail && after) throw new Error('injected move failure');
			};
		}
		try { await files.rename(files.getFileByPath('.nand/content/Old.md')!, '.nand/content/New.md'); } catch { /* Restart is the recovery boundary under test. */ }
		const count = calls;
		files = new ContentFiles(vault.app); await files.refresh();
		const destination = vault.contents.has('.nand/content/New.md') ? '.nand/content/New.md' : '.nand/content/Old.md';
		expect(vault.contents.get(destination)).toBe('# Original');
		const reference = vault.contents.get('Ref.md')!.slice(2, -2);
		expect(files.resolveLink(reference, 'Ref.md')?.path).toBe(destination);
		expect(JSON.parse(vault.contents.get('.nand/content-moves/manifest.json') ?? '{"pending":null}').pending).toBeFalsy();
		return count;
	};
	const count = await run();
	for (let point = 1; point <= count; point++) for (const after of [false, true]) await run(point, after);
});
