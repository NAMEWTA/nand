import { afterEach, expect, test, vi } from 'vitest';
import { MarkdownView, type WorkspaceLeaf } from 'obsidian';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { readMarkdownDocument, readYaml } from '../../../shared/storage/markdown-document';
import { ContentFiles, contentFiles } from './content-files';
import { useStorageTimers, type StorageTimers } from '../../../shared/storage/timers';

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

test.each([
	{ yaml: 'cover: "[[image.png]]" # Keep', expected: { cover: '[[/.nand/content/image.png]]' } },
	{ yaml: 'asset: &img image.png\ncover: *img\ntitle: *img', expected: { asset: 'image.png', cover: '/.nand/content/image.png', title: 'image.png' } },
	{ yaml: 'cover: &img image.png\ntitle: *img', expected: { cover: '/.nand/content/image.png', title: 'image.png' } },
	{ yaml: 'asset: &img [image.png]\ncover: *img\ntitle: *img', expected: { asset: ['image.png'], cover: ['/.nand/content/image.png'], title: ['image.png'] } },
	{ yaml: 'cover: &img [image.png]\ntitle: *img', expected: { cover: ['/.nand/content/image.png'], title: ['image.png'] } },
])('every interrupted rename persistence step recovers references without losing content (%#)', async ({ yaml, expected }) => {
	const initial = { '.nand/content/Old.md': '---\n'+yaml+'\n---\n# Original\n![image](image.png)', '.nand/content/image.png': 'image', 'Ref.md': '---\nrelated: "[[Old]]"\n---\n[[Old]]' };
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
		if (destination.endsWith('/New.md')) {
			const result = readMarkdownDocument(vault.contents.get(destination)!);
			expect(result.body).toBe('# Original\n![image](</.nand/content/image.png>)');
			expect(readYaml(result.yaml).toJSON()).toEqual(expected);
		} else expect(vault.contents.get(destination)).toBe(initial['.nand/content/Old.md']);
		const reference = vault.contents.get('Ref.md')!.split('\n').at(-1)!.slice(2, -2);
		expect(files.resolveLink(reference, 'Ref.md')?.path).toBe(destination);
		const related = String(readYaml(readMarkdownDocument(vault.contents.get('Ref.md')!).yaml).get('related')).slice(2, -2);
		expect(files.resolveLink(related, 'Ref.md')?.path).toBe(destination);
		expect(JSON.parse(vault.contents.get('.nand/content-moves/manifest.json') ?? '{"pending":null}').pending).toBeFalsy();
		return count;
	};
	const count = await run();
	for (let point = 1; point <= count; point++) for (const after of [false, true]) await run(point, after);
});

test('moving links preserves their parsed targets, syntax and code examples', async () => {
	const code = '    [[Old/Note]]\n\n> ```md\n> [[Old/Note]]\n> ```\n\n- example\n\n      [[Old/Note]]\n\n``a ` [[Old/Note]]``\n\\[[Old/Note]]';
	const vault = memoryVault({ '.nand/content/Old/Note.md': '[[A B]]\n[[A%20B]]\n[space](A%20B.md)\n[literal](A%2520B.md)\n![picture](image(1).png)', '.nand/content/Old/A B.md': 'space', '.nand/content/Old/A%20B.md': 'literal', '.nand/content/Old/image(1).png': 'old picture', '.nand/content/New/image(1).png': 'new picture', '.nand/content/Ref.md': '[note](Old/Note.md)', 'Ordinary.md': code + '\n\n[[Old/Note]]' });
	let files = new ContentFiles(vault.app); await files.prepareMetadata();
	const outgoing = files.resolvedLinks()['.nand/content/Old/Note.md'];
	expect(outgoing).toEqual({ '.nand/content/Old/A B.md': 2, '.nand/content/Old/A%20B.md': 2, '.nand/content/Old/image(1).png': 1 });
	await files.rename(files.getFileByPath('.nand/content/Old/Note.md')!, '.nand/content/New/Note.md');
	files = new ContentFiles(vault.app); await files.prepareMetadata();
	expect(files.resolvedLinks()['.nand/content/New/Note.md']).toEqual(outgoing);
	expect(files.resolvedLinks()['.nand/content/Ref.md']).toEqual({ '.nand/content/New/Note.md': 1 });
	expect(vault.contents.get('Ordinary.md')).toBe(code + '\n\n[[/.nand/content/New/Note.md]]');
	expect(await files.read('.nand/content/New/Note.md')).toContain('[[/.nand/content/Old/A B.md]]');
});

test('clean native editors can follow transaction writes and rollbacks while true dirty editors block them', async () => {
	for (const rollback of [false, true]) {
		const vault = memoryVault({ '.nand/content/Old.md': 'original', 'Ref.md': '[[Old]]' });
		const files = new ContentFiles(vault.app); await files.refresh();
		const leaf = {} as WorkspaceLeaf;
		const view = Object.assign(new MarkdownView(leaf), { file: vault.file('Ref.md'), editor: { getValue: () => vault.contents.get('Ref.md')! } });
		leaf.view = view; vault.app.workspace.getLeavesOfType = () => [leaf];
		if (rollback) vault.adapter.rename = async () => { throw new Error('move denied'); };
		const moving = files.rename(files.getFileByPath('.nand/content/Old.md')!, '.nand/content/New.md');
		if (rollback) await expect(moving).rejects.toThrow('move denied'); else await moving;
		await files.refresh();
		expect(vault.contents.get('Ref.md')).toBe(rollback ? '[[Old]]' : '[[/.nand/content/New.md]]');
	}
});

test('completed moves emit one rename even when target publication or receipt completion reports failure', async () => {
	for (const failure of ['copy', 'finish']) {
		const vault = memoryVault({ '.nand/content/Old.md': 'original', 'Ref.md': '[[Old]]' });
		const files = new ContentFiles(vault.app); await files.refresh();
		const events: string[] = []; files.subscribe(event => { if (event.path.startsWith('.nand/content/')) events.push(event.kind); });
		let failed = false;
		const copy = vault.adapter.copy, write = vault.adapter.write;
		vault.adapter.copy = async (from, to) => { await copy(from, to); if (failure === 'copy' && !failed && to === '.nand/content/New.md') { failed = true; throw new Error('copy completed'); } };
		vault.adapter.write = async (path, text) => { if (failure === 'finish' && !failed && path === '.nand/content-moves/manifest.json' && text.includes('"entries"') && !text.includes('"pending"')) { failed = true; throw new Error('finish denied'); } await write(path, text); };
		try { await files.rename(files.getFileByPath('.nand/content/Old.md')!, '.nand/content/New.md'); } catch { /* The recovered identity must still reach consumers. */ }
		await files.refresh();
		expect(failed).toBe(true);
		expect(events).not.toContain('delete'); expect(events).not.toContain('create'); expect(events.filter(event => event === 'rename')).toHaveLength(1);
	}
});

test('native reference filenames outside the portable owned namespace remain usable', async () => {
	const vault = memoryVault({ '.nand/content/Old.md': 'target', 'Why?.md': '[[Old]]' }), files = new ContentFiles(vault.app); await files.refresh();
	await files.rename(files.getFileByPath('.nand/content/Old.md')!, '.nand/content/New.md');
	await new ContentFiles(vault.app).refresh();
	expect(vault.contents.get('Why?.md')).toBe('[[/.nand/content/New.md]]');
});

test('property links preserve YAML comments, aliases, scalar values and CRLF while following moves', async () => {
	const raw = '---\r\n# Header\r\ncover: >- # block comment\r\n  [[image.png]]\r\nrelated: &ref "[[../Peer]]"\r\ncopy: *ref\r\nexamples: "`[[image.png]]`"\r\nnumber: 2026\r\n---\r\nBody';
	const vault = memoryVault({ '.nand/content/Old/Note.md': raw, '.nand/content/Old/image.png': 'image', '.nand/content/Peer.md': 'peer' }), files = new ContentFiles(vault.app); await files.refresh();
	await files.rename(files.getFileByPath('.nand/content/Old/Note.md')!, '.nand/content/New/Note.md');
	await files.prepareMetadata(); const result = await files.read('.nand/content/New/Note.md');
	expect(result).toContain('# Header\r\n'); expect(result).toContain('# block comment\r\n');
	expect(result).toContain('related: &ref "[[/.nand/content/Peer.md]]"\r\ncopy: *ref');
	expect(result).toContain('examples: "`[[image.png]]`"\r\nnumber: 2026');
	expect(files.getMetadata(files.getFileByPath('.nand/content/New/Note.md')!)!.frontmatter).toMatchObject({ cover: '[[/.nand/content/Old/image.png]]', copy: '[[/.nand/content/Peer.md]]', number: 2026 });
});

test('moving an HTML block preserves every actual image and ignores text inside unrelated attributes', async () => {
	const html = '<div title="<img src=ignore.png>">\n<img src="a.png">\n<img alt="src=fake.png" src=\'b.png\'>\n<img src=c.png>\n<!-- <img src="a.png"> -->\n<script>const example = \'<img src="a.png">\';</script>\n</div>';
	const vault = memoryVault({ '.nand/content/Old/Note.md': html, ...Object.fromEntries(['a','b','c'].flatMap(name => [['.nand/content/Old/'+name+'.png', 'original'], ['.nand/content/New/'+name+'.png', 'different']])) });
	const files = new ContentFiles(vault.app); await files.refresh();
	await files.rename(files.getFileByPath('.nand/content/Old/Note.md')!, '.nand/content/New/Note.md');
	const text = await files.read('.nand/content/New/Note.md');
	expect(text).toContain('<img src="/.nand/content/Old/a.png">');
	expect(text).toContain("<img alt=\"src=fake.png\" src='/.nand/content/Old/b.png'>");
	expect(text).toContain('<img src="/.nand/content/Old/c.png">');
	expect(text).toContain('<div title="<img src=ignore.png>">');
	expect(text).toContain('<!-- <img src="a.png"> -->');
	expect(text).toContain('<script>const example = \'<img src="a.png">\';</script>');
});

test('raw HTML text across inline parser nodes remains literal when an attachment moves', async () => {
	const raw = ['textarea','script','style','title','xmp','iframe','noembed','noframes'].map(tag => `Example: <${tag}><img src="Old.png">[[Old.png]]</${tag}>`).join('\n\n');
	const vault = memoryVault({ '.nand/content/Old.png': 'image', 'Ref.md': raw+'\n\n<img src="Old.png">' });
	const files = new ContentFiles(vault.app); await files.refresh();
	await files.rename(files.getFileByPath('.nand/content/Old.png')!, '.nand/content/New.png');
	expect(vault.contents.get('Ref.md')).toBe(raw+'\n\n<img src="/.nand/content/New.png">');
});

test('cyclic YAML stays editable and does not block library metadata or unrelated moves', async () => {
	for (const yaml of ['list: &self [*self]', 'loop: &self {self: *self}']) {
		const prefix = '---\n'+yaml+'\n---\n';
		const vault = memoryVault({ '.nand/content/Old.md': prefix+'Body', '.nand/content/Good.md': '---\ntitle: Good\n---\n# Good', 'Ref.md': prefix+'[[Old]]' });
		const files = new ContentFiles(vault.app); await files.prepareMetadata();
		expect(files.getMetadata(files.getFileByPath('.nand/content/Good.md')!)!.frontmatter).toEqual({ title: 'Good' });
		expect(await files.read('.nand/content/Old.md')).toBe(prefix+'Body');
		await files.rename(files.getFileByPath('.nand/content/Old.md')!, '.nand/content/New.md');
		expect(await files.read('.nand/content/New.md')).toBe(prefix+'Body');
		expect(vault.contents.get('Ref.md')).toBe(prefix+'[[/.nand/content/New.md]]');
		await new ContentFiles(vault.app).prepareMetadata();
	}
});

afterEach(() => { vi.useRealTimers(); useStorageTimers(undefined); vi.restoreAllMocks(); });

test('a dropped adapter request during a scan cannot block the mutation queue forever', async () => {
	vi.useFakeTimers();
	useStorageTimers(globalThis as unknown as StorageTimers);
	vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	const vault = memoryVault({ '.nand/content/A.md': 'a' }), files = contentFiles(vault.app), stat = vault.adapter.stat;
	let dropped = 0;
	// The platform answers the first stat of the scan never; later requests are answered normally.
	vault.adapter.stat = async path => (dropped++ === 0 ? new Promise<never>(() => undefined) : stat(path));
	let created = false;
	const refresh = files.refresh();
	const queued = files.create('.nand/content/B.md', 'b').then(() => { created = true; });
	await vi.advanceTimersByTimeAsync(10000);
	await refresh; await queued;
	expect(created).toBe(true);
	expect(files.getFileByPath('.nand/content/A.md')).toBeTruthy();
	expect(vault.contents.get('.nand/content/B.md')).toBe('b');
});
