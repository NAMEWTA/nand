import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TFile, TFolder, MarkdownView, type App } from 'obsidian';
import { cloneRecord, newRecord, emptyRef, ContactsError, type ArchiveRecord } from '../src/contacts/model';
import { createMarkdown, parseRecord, patchMarkdown, relativeLink } from '../src/contacts/persist/markdown';
import { ContactsIndex, emptyQuery } from '../src/contacts/index-store';
import { ContactsController, WriteQueue } from '../src/contacts/controller';
import { normalizeContactsSettings, validContactsFolder } from '../src/shared/contacts-settings';

function fixture(kind: 'person' | 'company' = 'person', name = '张三'): ArchiveRecord {
	const record = newRecord(kind);
	record.fields.name = name;
	record.path = `档案/${kind === 'person' ? '联系人' : '企业'}/${name}.md`;
	return record;
}
function round(record: ArchiveRecord): ArchiveRecord {
	const parsed = parseRecord(createMarkdown(record), record.path)!;
	assert.deepEqual(parsed.errors, []);
	return parsed;
}
function job(company: ArchiveRecord, status: 'current' | 'past' = 'current') {
	return {
		id: crypto.randomUUID(),
		company: {
			id: company.id,
			label: company.fields.name,
			link: relativeLink('档案/联系人/张三.md', company.path),
		},
		department: '业务部',
		title: '经理',
		start: '2020-01',
		end: '',
		status,
		keyRole: '' as const,
		notes: '',
	};
}

test('portable Markdown round trip preserves strings, Unicode, links, table escapes and free prose', () => {
	const person = fixture();
	const company = fixture('company', '企业 (中国)');
	person.fields.mobiles = ['+8613800000000', '001234'];
	person.fields.aliases = ['张三三'];
	person.prose.notes = '自由备注\n\n- [ ] 明天见面\n\n```js\nhello()\n```';
	person.employments = [{ ...job(company), notes: 'a | b \\ c\n<br> &amp; <!-- 自由内容 -->', title: '[专家]' }];
	const other = fixture('person', '李四 [顾问]');
	person.relations = [
		{
			id: crypto.randomUUID(),
			person: { id: other.id, label: other.fields.name, link: relativeLink(person.path, other.path) },
			kind: 'leader',
			company: emptyRef(),
			notes: '备注|其他\n一行',
		},
	];
	const result = round(person);
	assert.deepEqual(result.fields, person.fields);
	assert.deepEqual(result.prose, person.prose);
	assert.deepEqual(result.employments, person.employments);
	assert.deepEqual(result.relations, person.relations);
	assert.ok(result.raw.includes('| company |'));
	assert.ok(!result.raw.includes('data.json'));
});

test('field-level merge preserves unrelated external edits, unknown properties and untouched body bytes', () => {
	const base = round(fixture());
	const external =
		base.raw
			.replace('region: ""', 'region: 上海')
			.replace('nand-type: person', 'nand-type: person\ncustom: [keep, this] # keep comment') +
		'\n## 自由章节\n独立文字  \n';
	const next = cloneRecord(base);
	next.fields.mobiles = ['+123'];
	const result = patchMarkdown(external, base, next);
	assert.equal(parseRecord(result, base.path)!.fields.region, '上海');
	assert.match(result, /custom: \[ keep, this \]|custom: \[keep, this\]/);
	assert.ok(result.includes('# keep comment'));
	assert.equal(result.slice(result.indexOf('\n# ')), external.slice(external.indexOf('\n# ')));
});

test('same-field and same-section conflicts retain the external contents', () => {
	const base = round(fixture());
	const external = cloneRecord(base);
	external.fields.name = '外部编辑';
	const next = cloneRecord(base);
	next.fields.name = '面板编辑';
	assert.throws(
		() => patchMarkdown(createMarkdown(external), base, next),
		(e) => e instanceof ContactsError && e.code === 'conflict',
	);
	const a = cloneRecord(base);
	const b = cloneRecord(base);
	a.prose.notes = '来自笔记';
	b.prose.notes = '来自面板';
	assert.throws(() => patchMarkdown(createMarkdown(a), base, b), /conflict/);
	assert.equal(patchMarkdown(base.raw, base, base), base.raw);
});

test('malformed YAML, duplicate identity and table boundaries never silently truncate a note', () => {
	const base = round(fixture());
	for (const raw of [
		base.raw.replace('name: 张三', 'name: [broken'),
		base.raw.replace('<!-- /nand:notes -->', ''),
		base.raw.replace('| company |', '| changed |'),
		base.raw.replace('nand-id:', 'nand-id: duplicate\nnand-id:'),
	]) {
		assert.ok(parseRecord(raw, base.path)!.errors.length);
		assert.throws(() => patchMarkdown(raw, base, base));
	}
	assert.equal(parseRecord('# ordinary note\nnotes here', '档案/普通.md'), null);
});

test('manual rows resolve as ordinary Markdown and receive persistent row IDs on save', () => {
	const person = fixture();
	person.employments = [job(fixture('company', '甲公司'))];
	const base = round(person);
	const manual = base.raw.replace(/ <!-- nand:row [\w-]+ -->/g, '');
	const parsed = parseRecord(manual, base.path)!;
	assert.equal(parsed.employments[0]!.id, 'manual-0');
	const next = cloneRecord(parsed);
	next.employments[0]!.title = '总经理';
	assert.ok(!parseRecord(patchMarkdown(manual, parsed, next), parsed.path)!.employments[0]!.id.startsWith('manual-'));
});

test('dates allow month precision and unknown former employment without treating it as current', () => {
	const person = fixture();
	person.employments = [{ ...job(fixture('company')), status: 'past', start: '', end: '' }];
	assert.equal(round(person).employments[0]!.status, 'past');
	person.fields.birthday = '2023-02-29';
	assert.throws(() => createMarkdown(person), /invalidDate/);
	person.fields.birthday = '2024-02-29';
	person.employments[0]!.start = '2021-13';
	assert.throws(() => createMarkdown(person), /invalidDate/);
});

test('employment index deduplicates people, supports concurrent jobs and preserves former jobs', () => {
	const index = new ContactsIndex();
	const company = fixture('company', '甲公司'),
		second = fixture('company', '乙公司'),
		a = fixture(),
		b = fixture('person', '李四');
	a.employments = [job(company), job(company), job(second), job(company, 'past')];
	b.employments = [job(company, 'past')];
	for (const r of [company, second, a, b]) index.set(round(r));
	assert.equal(index.members(company.id, 'current').length, 1);
	assert.equal(index.members(company.id, 'past').length, 2);
	assert.equal(index.members(second.id, 'current').length, 1);
	index.remove(a.path);
	assert.equal(index.members(company.id, 'current').length, 0);
	assert.equal(index.members(company.id, 'past').length, 1);
});

test('direct relationships have computed inverses, no duplicate writes and no inferred friendships', () => {
	const index = new ContactsIndex(),
		a = fixture(),
		b = fixture('person', '李四');
	a.relations = [
		{
			id: crypto.randomUUID(),
			person: { id: b.id, label: b.fields.name, link: '李四.md' },
			company: emptyRef(),
			kind: 'leader',
			notes: '汇报',
		},
	];
	index.set(round(a));
	index.set(round(b));
	assert.equal(index.relationsFor(a.id)[0]!.inverse, false);
	assert.equal(index.relationsFor(b.id)[0]!.inverse, true);
	assert.deepEqual(index.get(b.id)!.relations, []);
	assert.equal(index.query({ ...emptyQuery(), relations: ['report'] })[0]!.id, b.id);
	index.remove(b.path);
	assert.equal(index.relationsFor(a.id)[0]!.other, undefined);
	assert.equal(index.get(a.id)!.relations[0]!.person.label, '李四');
});

test('renames preserve identity; duplicate IDs and conflicting visible links block mutation', () => {
	const index = new ContactsIndex(),
		a = fixture(),
		company = fixture('company', '甲公司');
	a.employments = [job(company)];
	index.set(round(a));
	index.set(round(company));
	index.remove(company.path);
	company.path = '档案/企业/新名字.md';
	index.set(round(company));
	assert.equal(index.resolve(a.employments[0]!.company, a)?.id, company.id);
	const duplicate = { ...company, path: '档案/企业/副本.md' };
	index.set(duplicate);
	assert.ok(index.issues(company).includes('duplicateId'));
	assert.equal(index.get(company.id), undefined);
	index.remove(duplicate.path);
	const different = fixture('company', '甲公司');
	index.set(round(different));
	assert.ok(index.issues(a).includes('referenceConflict'));
});

test('filters are OR within a dimension and AND across dimensions; 5,000 records paginate from the index', () => {
	const index = new ContactsIndex();
	const company = fixture('company', '甲公司');
	index.set(company);
	for (let i = 0; i < 5000; i++) {
		const p = fixture('person', `联系人${i}`);
		p.fields.region = i % 2 ? '北京' : '上海';
		p.fields.tags = i % 3 ? ['伙伴'] : ['朋友'];
		p.employments = [job(company)];
		index.set(p);
	}
	assert.equal(index.query({ ...emptyQuery(), regions: ['北京', '上海'] }).length, 5000);
	assert.equal(
		index.query({ ...emptyQuery(), regions: ['北京'], tags: ['朋友'], current: [company.id] }).length,
		833,
	);
	assert.equal(index.query({ ...emptyQuery(), search: '联系人4999' }).length, 1);
});

test('folder preferences reject hidden/external/traversal paths and retain defaults', () => {
	for (const path of [
		'/tmp/contacts',
		'../contacts',
		'.obsidian/contacts',
		'档案/../其他',
		'C:\\contacts',
		'档案//联系人',
	])
		assert.equal(validContactsFolder(path), false);
	assert.deepEqual(normalizeContactsSettings({ rootFolder: '../bad', maxColumns: 10 }), {
		rootFolder: '档案',
		maxColumns: 6,
	});
});

test('write queue recovers after failures and keeps saves to the same identity ordered', async () => {
	const queue = new WriteQueue(),
		events: number[] = [];
	const first = queue.run('id', () => {
		events.push(1);
		throw new Error('disk');
	});
	const second = queue.run('id', () => {
		events.push(2);
		return Promise.resolve(2);
	});
	await assert.rejects(first);
	assert.equal(await second, 2);
	await queue.settled();
	assert.deepEqual(events, [1, 2]);
});

function memoryVault() {
	const files = new Map<string, TFile | TFolder>(),
		text = new Map<string, string>();
	const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
	const emit = (event: string, ...args: unknown[]) => {
		for (const listener of listeners.get(event) ?? []) listener(...args);
	};
	let fail = false;
	const vault = {
		on: (event: string, callback: (...args: unknown[]) => void) => {
			const list = listeners.get(event) ?? [];
			list.push(callback);
			listeners.set(event, list);
			return { event, callback };
		},
		getMarkdownFiles: () => [...files.values()].filter((f): f is TFile => f instanceof TFile),
		getFileByPath: (path: string) => {
			const f = files.get(path);
			return f instanceof TFile ? f : null;
		},
		getAbstractFileByPath: (path: string) => files.get(path),
		cachedRead: async (file: TFile) => text.get(file.path)!,
		read: async (file: TFile) => text.get(file.path)!,
		createFolder: async (path: string) => {
			files.set(path, Object.assign(new TFolder(), { path }));
		},
		create: async (path: string, value: string) => {
			if (files.has(path)) throw new Error('exists');
			const f = Object.assign(new TFile(), { path, extension: 'md', stat: { mtime: Date.now() } });
			files.set(path, f);
			text.set(path, value);
			emit('create', f);
			return f;
		},
		process: async (file: TFile, fn: (raw: string) => string) => {
			if (fail) throw new Error('disk full');
			const updated = fn(text.get(file.path)!);
			text.set(file.path, updated);
			emit('modify', file);
			return updated;
		},
	};
	const app = {
		vault,
		workspace: { getLeavesOfType: () => [], layoutReady: true },
		fileManager: {
			trashFile: async (file: TFile) => {
				files.delete(file.path);
				emit('delete', file);
			},
		},
	} as unknown as App;
	const settings = { rootFolder: '档案', maxColumns: 6 as const };
	const controller = new ContactsController(app, () => settings);
	Object.assign(controller, { registerEvent: () => {} });
	controller.onload();
	return {
		controller,
		app,
		settings,
		text,
		vault,
		setFailure: (value: boolean) => {
			fail = value;
		},
	};
}

test('vault integration: duplicate names, real files, disk failure, external edits, deletion and rebuilding', async () => {
	const f = memoryVault();
	await f.controller.ensureLoaded();
	const a = await f.controller.create(newNamed('person', '张三')),
		b = await f.controller.create(newNamed('person', '张三'));
	assert.notEqual(a.path, b.path);
	assert.notEqual(a.id, b.id);
	assert.ok(f.text.has('档案/档案格式说明.md'));
	const base = await f.controller.snapshot(a.path),
		draft = cloneRecord(base);
	draft.fields.phones = ['00123'];
	f.setFailure(true);
	await assert.rejects(f.controller.save(base, draft));
	assert.equal(f.text.get(a.path), base.raw);
	f.setFailure(false);
	f.text.set(a.path, base.raw + '\n外部追加备注\n');
	await f.controller.save(base, draft);
	assert.ok(f.text.get(a.path)!.endsWith('外部追加备注\n'));
	await f.controller.reload();
	assert.equal(f.controller.index.byPath.size, 2);
	const snapshot = await f.controller.snapshot(a.path);
	await f.controller.remove(snapshot);
	assert.equal(f.controller.index.byPath.size, 1);
	assert.ok(f.text.has(b.path));
	f.controller.onunload();
	assert.ok(f.text.has(b.path));
});
function newNamed(kind: 'person' | 'company', name: string): ArchiveRecord {
	const r = newRecord(kind);
	r.fields.name = name;
	return r;
}

test('folder switching rejects stale forms and preserves old files', async () => {
	const f = memoryVault();
	await f.controller.ensureLoaded();
	const a = await f.controller.create(newNamed('person', '旧档案'));
	f.settings.rootFolder = '其他档案';
	await f.controller.reload();
	assert.equal(f.controller.index.byPath.size, 0);
	const next = cloneRecord(a);
	next.fields.name = '新姓名';
	await assert.rejects(f.controller.save(a, next), /folderChanged/);
	assert.ok(f.text.has(a.path));
});

test('two windows merge independent fields but reject overlapping edits', async () => {
	const f = memoryVault();
	await f.controller.ensureLoaded();
	const original = await f.controller.create(newNamed('person', '同时编辑'));
	const first = cloneRecord(original),
		second = cloneRecord(original);
	first.fields.region = '北京';
	second.fields.mobiles = ['+86 123'];
	await Promise.all([f.controller.save(original, first), f.controller.save(original, second)]);
	const saved = await f.controller.snapshot(original.path);
	assert.equal(saved.fields.region, '北京');
	assert.deepEqual(saved.fields.mobiles, ['+86 123']);
	const overlap = cloneRecord(original);
	overlap.fields.region = '上海';
	await assert.rejects(f.controller.save(original, overlap), /conflict/);
});

test('unsaved edits in the native Markdown editor prevent panel writes', async () => {
	const f = memoryVault();
	await f.controller.ensureLoaded();
	const original = await f.controller.create(newNamed('person', '编辑器草稿'));
	const editor = Object.assign(Object.create(MarkdownView.prototype) as MarkdownView, {
		file: f.vault.getFileByPath(original.path),
		getMode: () => 'source',
		editor: { getValue: () => original.raw + '\n未保存的文字' },
	});
	Object.assign(f.app.workspace, { getLeavesOfType: () => [{ view: editor }] });
	const draft = cloneRecord(original);
	draft.fields.region = '北京';
	await assert.rejects(f.controller.save(original, draft), /editorConflict/);
	assert.equal(f.text.get(original.path), original.raw);
});

test('an unreadable file does not hide other records during a rebuild', async () => {
	const f = memoryVault();
	await f.controller.ensureLoaded();
	const broken = await f.controller.create(newNamed('person', '读取失败'));
	const good = await f.controller.create(newNamed('person', '仍可读取'));
	const read = f.vault.cachedRead;
	f.vault.cachedRead = async (file) => {
		if (file.path === broken.path) throw new Error('unreadable');
		return read(file);
	};
	await f.controller.reload();
	assert.equal(f.controller.error, 'readFailed');
	assert.ok(f.controller.index.get(good.id));
});

test('a relationship entered from the opposite profile cannot duplicate its computed inverse', () => {
	const index = new ContactsIndex(),
		a = fixture(),
		b = fixture('person', '李四');
	a.relations = [
		{
			id: crypto.randomUUID(),
			person: { id: b.id, label: b.fields.name, link: '李四.md' },
			kind: 'leader',
			company: emptyRef(),
			notes: '',
		},
	];
	index.set(a);
	index.set(b);
	b.relations = [
		{
			id: crypto.randomUUID(),
			person: { id: a.id, label: a.fields.name, link: '张三.md' },
			kind: 'report',
			company: emptyRef(),
			notes: '',
		},
	];
	assert.throws(() => index.validateRelations(b), /duplicateRelation/);
});

test('renaming updates the generated heading without overwriting a customized heading', () => {
	const base = round(fixture());
	const draft = cloneRecord(base);
	draft.fields.name = '新名字';
	assert.ok(patchMarkdown(base.raw, base, draft).includes('# 新名字\n'));
	const customized = base.raw.replace('# 张三\n', '# 我的客户记录\n');
	assert.ok(patchMarkdown(customized, base, draft).includes('# 我的客户记录\n'));
});
