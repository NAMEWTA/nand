import { archiveLocation, safeArchiveName, queryResources, normalizeValues } from '../src/core/contacts/resources';
import { WriteQueue } from '../src/shared/storage/write-queue';
import { t, setLanguage } from '../src/shared/i18n/index';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Setting, TFile, TFolder, MarkdownView, type App } from 'obsidian';
import { renderContactsSettings } from '../src/plugin/settings/contacts-settings';
import { cloneRecord, newRecord, emptyRef, ContactsError, type ArchiveRecord } from '../src/core/contacts/model';
import { createMarkdown, parseRecord, patchMarkdown, relativeLink } from '../src/core/contacts/persist/markdown';
import { ContactsIndex, emptyQuery } from '../src/core/contacts/index-store';
import { ContactsController } from '../src/platform/obsidian/contacts/controller';
import { normalizeContactsSettings, validContactsFolder } from '../src/shared/contacts-settings';
import { FilterModal } from '../src/view/contacts/forms';
import { El } from './mini-dom';
import { Setting as StubSetting } from './obsidian-stub';
import { parseHTML } from 'linkedom';
import { h, render } from 'preact';
import { ContactsSurface } from '../src/view/contacts/surface';
import { ResourceList } from '../src/view/contacts/ResourceList';
import type { ContactsPanelHost } from '../src/view/contacts/panel-contract';
import { applyLayout, contactsTarget, CONTACTS_PAGE_STATE_KEYS, emptyPanelState, layoutsFor, restoreContactsState, showContactKind } from '../src/view/contacts/panel-state';
import { navigateContacts } from '../src/view/contacts/navigate';
import { cleanPageState } from '../src/view/workbench/navigation-state';

function fixture(kind: 'person' | 'company' = 'person', name = '张三'): ArchiveRecord {
	const record = newRecord(kind);
	record.fields.name = name;
	record.folderPath = `档案/${kind === 'person' ? '个人档案' : '企业档案'}/${name}`;
	record.path = record.folderPath + '/基本信息.md';
	return record;
}
function round(record: ArchiveRecord): ArchiveRecord {
	const parsed = parseRecord(createMarkdown(record), record.path)!;
	assert.deepEqual(parsed.errors, []);
	return parsed;
}

test('5,000 archives stay indexed through repeated search and single-record updates', t => {
	const index = new ContactsIndex(), started = performance.now();
	for (let i = 0; i < 5000; i++) { const record = fixture('person', `Person ${i}`); record.fields.tags = ['team-' + i % 10]; index.set(record); }
	const loaded = performance.now();
	for (let i = 0; i < 20; i++) assert.equal(index.query({ ...emptyQuery(), search: 'Person 4999' }).length, 1);
	const record = [...index.byPath.values()][4999]!;
	index.set({ ...record, fields: { ...record.fields, name: 'Updated person' } });
	assert.equal(index.query({ ...emptyQuery(), search: 'Updated person' }).length, 1);
	assert.equal(index.byPath.size, 5000);
	t.diagnostic(JSON.stringify({ records: 5000, indexMs: Math.round(loaded - started), search20AndUpdateMs: Math.round(performance.now() - loaded), vaultReadsDuringSearch: 0 }));
	index.clear(); assert.equal(index.byPath.size, 0); assert.equal(index.byId.size, 0);
});
function job(company: ArchiveRecord, status: 'current' | 'past' = 'current') {
	return {
		id: crypto.randomUUID(),
		company: {
			id: company.id,
			label: company.fields.name,
			link: relativeLink('档案/个人档案/张三/基本信息.md', company.path),
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
	assert.ok(result.raw.includes(`| ${t('contacts.company')} |`));
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
		base.raw.replace(`| ${t('contacts.company')} |`, '| changed |'),
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
			if (files.has(path)) throw new Error('exists');
			const folder = Object.assign(new TFolder(), { path });
			Object.defineProperty(folder, 'children', {
				get: () =>
					[...files.values()].filter(
						(f) => f.path !== folder.path && f.path.slice(0, f.path.lastIndexOf('/')) === folder.path,
					),
			});
			files.set(path, folder);
		},
		create: async (path: string, value: string) => {
			if (files.has(path)) throw new Error('exists');
			const f = Object.assign(new TFile(), {
				path,
				extension: path.split('.').pop()!,
				stat: { mtime: Date.now(), size: value.length },
			});
			files.set(path, f);
			text.set(path, value);
			emit('create', f);
			return f;
		},
		rename: async (file: TFile | TFolder, next: string) => {
			const oldPath = file.path;
			const moved = [...files.entries()].filter(([path]) => path === oldPath || path.startsWith(oldPath + '/'));
			for (const [path, value] of moved) {
				files.delete(path);
				value.path = next + path.slice(oldPath.length);
				files.set(value.path, value);
				if (text.has(path)) {
					text.set(value.path, text.get(path)!);
					text.delete(path);
				}
			}
			emit('rename', file, oldPath);
		},
		createBinary: async (path: string, bytes: ArrayBuffer) => vault.create(path, new TextDecoder().decode(bytes)),
		process: async (file: TFile, fn: (raw: string) => string) => {
			if (fail) throw new Error('disk full');
			const updated = fn(text.get(file.path)!);
			text.set(file.path, updated);
			file.stat.mtime++;
			file.stat.size = updated.length;
			emit('modify', file);
			return updated;
		},
	};
	const app = {
		vault,
		workspace: { getLeavesOfType: () => [], layoutReady: true },
		fileManager: {
			trashFile: async (file: TFile) => {
				for (const path of files.keys())
					if (path === file.path || path.startsWith(file.path + '/')) {
						files.delete(path);
						text.delete(path);
					}
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
	await f.controller.remove(await f.controller.deletion(snapshot.id));
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

test('a late read cannot publish into a newer folder or a disposed archive', async () => {
	const blockNext = (vault: { cachedRead: (file: TFile) => Promise<string> }) => {
		let release = () => {};
		let opened = () => {};
		const started = new Promise<void>((resolve) => {
			opened = resolve;
		});
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const read = vault.cachedRead.bind(vault);
		let armed = true;
		vault.cachedRead = async (file: TFile) => {
			const value = await read(file);
			if (armed) {
				armed = false;
				opened();
				await gate;
			}
			return value;
		};
		return { started, release: () => release() };
	};
	const folder = memoryVault();
	await folder.controller.ensureLoaded();
	const person = await folder.controller.create(newNamed('person', '旧根目录的人'));
	const held = blockNext(folder.vault);
	const first = folder.controller.reload();
	await held.started;
	folder.settings.rootFolder = '其他档案';
	const second = folder.controller.reload();
	held.release();
	await first;
	await second;
	assert.equal(folder.controller.index.byPath.has(person.path), false);
	assert.equal([...folder.controller.index.byPath.keys()].some((path) => path.startsWith('档案/')), false);

	const disposed = memoryVault();
	await disposed.controller.ensureLoaded();
	await disposed.controller.create(newNamed('person', '卸载前的人'));
	const unloading = blockNext(disposed.vault);
	const pending = disposed.controller.reload();
	await unloading.started;
	disposed.controller.onunload();
	unloading.release();
	await pending;
	assert.equal(disposed.controller.index.byPath.size, 0);
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

test('new notes localize headings and tables while language changes preserve parsing', () => {
	for (const language of ['en', 'zh'] as const) {
		setLanguage(language);
		const raw = createMarkdown(fixture());
		assert.ok(raw.includes(`## ${t('contacts.employments')}`));
		assert.ok(!raw.includes('website:'));
		setLanguage(language === 'en' ? 'zh' : 'en');
		assert.deepEqual(parseRecord(raw, 'person.md')?.errors, []);
	}
	setLanguage('zh');
});

test('format guide uses creation-time language and preserves existing documents and record identity', async () => {
	setLanguage('zh');
	const f = memoryVault();
	try {
		await f.controller.ensureLoaded();
		setLanguage('en'); // The controller was created before this language change.
		const company = await f.controller.create(newNamed('company', 'Guide Company'));
		const english = f.text.get('档案/档案格式说明.md')!;
		assert.match(english, /^# Archive format\r?\n/, 'An English first creation needs the complete English guide');
		assert.match(english, /Changing the display name does not rename the file/);
		const original = f.text.get(company.path)!;
		setLanguage('zh');
		await f.controller.create(newNamed('person', 'Later Person'));
		assert.equal(
			f.text.get('档案/档案格式说明.md'),
			english,
			'Switching language never replaces an existing guide',
		);
		assert.equal(f.text.get(company.path), original);
		const base = await f.controller.snapshot(company.path),
			draft = cloneRecord(base);
		draft.fields.name = 'Renamed Company';
		const renamed = await f.controller.save(base, draft);
		assert.equal(renamed.id, company.id);
		assert.equal(renamed.path, company.path);

		f.settings.rootFolder = '中文档案';
		await f.controller.reload();
		await f.controller.create(newNamed('person', '中文人物'));
		const chinese = f.text.get('中文档案/档案格式说明.md')!;
		assert.match(chinese, /^# 档案格式\r?\n/);
		assert.match(chinese, /更改显示名称不会自动重命名文件/);
		for (const guide of [english, chinese]) {
			for (const marker of ['employments', 'relations', 'traits', 'habits', 'notes']) {
				assert.ok(guide.includes(`<!-- nand:${marker} -->`));
				assert.ok(guide.includes(`<!-- /nand:${marker} -->`));
			}
			for (const field of [
				'nand-type',
				'nand-id',
				'birthday',
				'birthplace',
				'region',
				'website',
				'aliases',
				'mobiles',
				'phones',
				'wechat',
				'emails',
				'tags',
				'key_role',
			])
				assert.ok(guide.includes('`' + field + '`'), field);
		}
		const custom = '# My guide\r\nKeep exact bytes: 用户内容\r\n';
		f.text.set('中文档案/档案格式说明.md', custom);
		const before = new Map(f.text);
		setLanguage('en');
		await f.controller.reload();
		await f.controller.create(newNamed('person', 'Another Person'));
		for (const [path, value] of before) assert.equal(f.text.get(path), value, path);
	} finally {
		f.controller.onunload();
		setLanguage('zh');
	}
});

test('both format guides document table headings accepted by the real Markdown parser', () => {
	for (const name of ['format-guide.md', 'format-guide-en.md']) {
		const guide = readFileSync(`src/core/contacts/persist/${name}`, 'utf8');
		const headers = guide
			.split('\n')
			.filter((line) => /^\| (company|Companies|企业|person|People|联系人) \|/.test(line));
		assert.ok(headers.length >= 6, 'Each guide documents machine, English and Chinese heading rows');
		for (const header of headers) {
			const columns = header.split('|').length - 2;
			const scope = columns === 8 ? 'employments' : 'relations';
			assert.ok(columns === 8 || columns === 4);
			const record = fixture();
			const raw = createMarkdown(record).replace(new RegExp(`(<!-- nand:${scope} -->\\n)[^\\n]+`), '$1' + header);
			assert.deepEqual(parseRecord(raw, record.path)!.errors, [], `${name}: ${header}`);
		}
	}
});

test('archive folder row is the only contacts setting that reserves description width', () => {
	setLanguage('zh');
	const registry = (
		Setting as unknown as {
			created: Array<{ name: string; settingEl: { classList: { contains(name: string): boolean } } }>;
		}
	).created;
	const before = registry.length;
	const tab = {
		plugin: { settings: { contacts: { rootFolder: '档案', maxColumns: 6 } } },
		app: {},
		refresh() {},
		refreshContactsViews() {},
	};
	renderContactsSettings.call(tab as never, { appendChild() {} } as never);
	const created = registry.slice(before);
	const folder = created.find((row) => row.name === t('contacts.folder'));
	const columns = created.find((row) => row.name === t('contacts.columns'));
	assert.ok(folder);
	assert.equal(folder.settingEl.classList.contains('nand-contacts-folder-setting'), true);
	assert.ok(columns);
	assert.equal(columns.settingEl.classList.contains('nand-contacts-folder-setting'), false);
});

test('strict folder entry rules exclude flat archives, ordinary material notes and nested fake entries', async () => {
	const f = memoryVault();
	const valid = await f.controller.create(newNamed('person', '王天肖'));
	assert.equal(valid.path, '档案/个人档案/王天肖/基本信息.md');
	assert.equal(valid.folderPath, '档案/个人档案/王天肖');
	for (const path of [
		'档案/联系人/旧档案.md',
		valid.folderPath + '/沟通记录.md',
		valid.folderPath + '/资料/基本信息.md',
	]) {
		await f.vault.create(path, createMarkdown(newNamed('person', '附件中的档案属性')));
		assert.equal(archiveLocation('档案', path), null);
	}
	await f.controller.reload();
	assert.equal(f.controller.index.byPath.size, 1);
	assert.equal(f.controller.resources(valid.id).length, 1); // The unparented fake nested file is not a Vault folder child.
	f.controller.onunload();
});

test('portable folder names and collisions never merge with an unrelated existing directory', async () => {
	assert.equal(safeArchiveName('CON'), '_CON');
	assert.equal(safeArchiveName('lpt1.txt'), '_lpt1.txt');
	assert.equal(safeArchiveName(' 王/天:肖. '), '王-天-肖');
	assert.throws(() => safeArchiveName('...'), /invalidName/);
	const f = memoryVault();
	await f.vault.createFolder('档案/个人档案/同名');
	const record = await f.controller.create(newNamed('person', '同名'));
	assert.match(record.folderPath, /同名-[\w-]+$/);
	const edited = cloneRecord(record);
	edited.fields.name = '改名';
	assert.equal((await f.controller.save(record, edited)).folderPath, record.folderPath);
	f.controller.onunload();
});

test('resources recurse, preserve sources, avoid primary names and report partial import failures', async () => {
	const f = memoryVault();
	const record = await f.controller.create(newNamed('company', '企业资料'));
	await f.vault.createFolder(record.folderPath + '/项目资料');
	await f.vault.create(record.folderPath + '/项目资料/说明.pdf', 'PDF');
	const bytes = new ArrayBuffer(12);
	new Uint8Array(bytes).set(new TextEncoder().encode('source bytes'));
	const result = await f.controller.importResources(record.id, [
		{ name: '介绍.pdf', read: async () => bytes },
		{ name: '介绍.pdf', read: async () => bytes },
		{
			name: '坏文件.docx',
			read: async () => {
				throw new Error('unreadable');
			},
		},
		{ name: '基本信息.md', read: async () => bytes },
	]);
	assert.equal(new TextDecoder().decode(bytes), 'source bytes');
	assert.ok(result[0]!.path?.endsWith('/介绍.pdf'));
	assert.ok(result[1]!.path?.endsWith('/介绍 (1).pdf'));
	assert.equal(result[2]!.error, 'importFailed');
	assert.ok(result[3]!.path?.endsWith('/基本信息 (1).md'));
	assert.equal(f.controller.resources(record.id).length, 4);
	assert.equal(
		queryResources(f.controller.resources(record.id), '项目资料/', 'name')[0]!.relativePath,
		'项目资料/说明.pdf',
	);
	assert.equal(queryResources(f.controller.resources(record.id), '不存在', 'modified').length, 0);
	assert.ok((await f.controller.createNote(record.id, '沟通')).endsWith('/沟通.md'));
	assert.ok((await f.controller.createNote(record.id, '沟通.md')).endsWith('/沟通 (1).md'));
	assert.equal(f.controller.index.byPath.size, 1);
	f.controller.onunload();
});

test('resource events notify without reparsing Markdown and a folder rename retains stable identity', async () => {
	const f = memoryVault();
	const record = await f.controller.create(newNamed('person', '晶晶'));
	let reads = 0,
		events = 0;
	const cachedRead = f.vault.cachedRead;
	f.vault.cachedRead = async (file) => {
		reads++;
		return cachedRead(file);
	};
	const unsubscribe = f.controller.subscribe(() => {
		events++;
	});
	await f.controller.importResources(
		record.id,
		[1, 2, 3].map((n) => ({ name: `${n}.pdf`, read: async () => new ArrayBuffer(2) })),
	);
	assert.equal(events, 1);
	assert.equal(reads, 0);
	await f.vault.rename(f.vault.getAbstractFileByPath(record.folderPath)!, '档案/个人档案/晶晶新目录');
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(f.controller.index.get(record.id)?.folderPath, '档案/个人档案/晶晶新目录');
	assert.equal(f.controller.resources(record.id).length, 3);
	assert.equal(reads, 1);
	unsubscribe();
	f.controller.onunload();
	await assert.rejects(f.controller.createNote(record.id, '停用之后'), /disabled/);
});

test('whole-folder deletion rejects changed scope and unsaved material notes; unrelated folders survive', async () => {
	const f = memoryVault();
	const record = await f.controller.create(newNamed('person', '删除范围'));
	const keep = await f.controller.create(newNamed('person', '保留'));
	const ticket = await f.controller.deletion(record.id);
	const note = await f.controller.createNote(record.id, '新资料');
	await assert.rejects(f.controller.remove(ticket), /deleteChanged/);
	const editor = Object.assign(Object.create(MarkdownView.prototype) as MarkdownView, {
		file: f.vault.getFileByPath(note),
		getMode: () => 'source',
		editor: { getValue: () => '未保存' },
	});
	Object.assign(f.app.workspace, { getLeavesOfType: () => [{ view: editor }] });
	await assert.rejects(f.controller.deletion(record.id), /editorConflict/);
	Object.assign(f.app.workspace, { getLeavesOfType: () => [] });
	const final = await f.controller.deletion(record.id);
	assert.equal(final.resources, 1);
	await f.controller.remove(final);
	assert.equal(f.vault.getAbstractFileByPath(record.folderPath), undefined);
	assert.equal(f.vault.getFileByPath(note), null);
	assert.ok(f.vault.getFileByPath(keep.path));
	await assert.rejects(f.controller.remove(final), /missing/);
	f.controller.onunload();
});

test('delete queues behind imports and refuses the earlier confirmation scope', async () => {
	const f = memoryVault();
	const record = await f.controller.create(newNamed('person', '并发'));
	const ticket = await f.controller.deletion(record.id);
	let release!: (value: ArrayBuffer) => void;
	const uploading = f.controller.importResources(record.id, [
		{
			name: '延迟.pdf',
			read: () =>
				new Promise((resolve) => {
					release = resolve;
				}),
		},
	]);
	const removal = f.controller.remove(ticket);
	await new Promise((resolve) => setTimeout(resolve, 0));
	release(new ArrayBuffer(3));
	await uploading;
	await assert.rejects(removal, /deleteChanged/);
	assert.ok(f.vault.getFileByPath(record.folderPath + '/延迟.pdf'));
	f.controller.onunload();
});

test('company contact fields and normalized pasted values retain string semantics in Markdown', () => {
	const record = fixture('company');
	record.fields.phones = normalizeValues(['+1 212', '00123', '', '00123\n 00999 ']);
	record.fields.emails = ['info@example.com'];
	assert.deepEqual(round(record).fields.phones, ['+1 212', '00123', '00999']);
	assert.deepEqual(round(record).fields.emails, ['info@example.com']);
});

test('resource list paginates at 60 and preserves search on live updates without opening stale rows', async () => {
	const environment = globalThis as { document?: Document },
		previous = environment.document;
	const { document } = parseHTML('<html><body></body></html>');
	Object.assign(globalThis, { document });
	const target = document.createElement('div');
	document.body.appendChild(target);
	const record = fixture();
	let files = Array.from({ length: 65 }, (_, index) => ({
		path: record.folderPath + `/资料${index}.pdf`,
		relativePath: `资料${index}.pdf`,
		name: `资料${index}.pdf`,
		extension: 'pdf',
		size: index,
		modified: index,
	}));
	let opened = '';
	const view = {
		resources: () => files,
		newNote() {},
		addResources() {},
		openResource(path: string) {
			opened = path;
		},
	} as unknown as ContactsPanelHost;
	const paint = () => render(h(ResourceList, { view, record }), target);
	const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
	try {
		paint();
		await settle();
		assert.equal(target.querySelectorAll('button.nand-contacts-resource-row').length, 60);
		target.querySelectorAll<HTMLButtonElement>('.nand-contacts-pagination button')[1]!.click();
		await settle();
		assert.equal(target.querySelectorAll('button.nand-contacts-resource-row').length, 5);
		const search = target.querySelector('input')!;
		search.value = '资料64';
		search.dispatchEvent(new document.defaultView!.Event('input', { bubbles: true }));
		await settle();
		assert.equal(target.querySelectorAll('button.nand-contacts-resource-row').length, 1);
		const added = {
			...files[0]!,
			path: record.folderPath + '/项目/资料64.pdf',
			relativePath: '项目/资料64.pdf',
			name: '资料64.pdf',
		};
		files = [...files, added];
		paint();
		await settle();
		assert.equal(search.value, '资料64');
		assert.equal(target.querySelectorAll('button.nand-contacts-resource-row').length, 2);
		target.querySelector<HTMLButtonElement>('button.nand-contacts-resource-row')!.click();
		assert.equal(opened, record.folderPath + '/资料64.pdf');
		files = [];
		paint();
		await settle();
		assert.equal(target.querySelectorAll('button.nand-contacts-resource-row').length, 0);
	} finally {
		render(null, target);
		if (previous) environment.document = previous;
		else delete environment.document;
	}
});

test('empty archive filters explain missing data and preserve existing choices on apply', () => {
	try {
		for (const language of ['zh', 'en'] as const) {
			setLanguage(language);
			for (const kind of ['person', 'company'] as const) {
				const index = new ContactsIndex();
				const controller = { app: {}, index, choices: () => [] } as unknown as ContactsController;
				const query = { ...emptyQuery(), kind };
				const empty = new FilterModal(controller, query, () => {});
				Object.assign(empty, { modalEl: new El('div'), setTitle() { return empty; } });
				empty.onOpen();
				const emptyContent = empty.contentEl as unknown as El;
				assert.equal(
					emptyContent.querySelectorAll('.nand-contacts-placeholder').length,
					kind === 'person' ? 5 : 2,
				);
				assert.equal(emptyContent.querySelector('p')?.textContent, t('contacts.filterEmpty'));
				for (const placeholder of emptyContent.querySelectorAll('.nand-contacts-placeholder')) {
					assert.equal(placeholder.textContent, t('contacts.noFilterOptions'));
					assert.ok(placeholder.hasClass('nand-contacts-muted'));
				}
				empty.onClose();
				assert.equal(emptyContent.childElementCount, 0);

				const record = fixture(kind);
				record.fields.region = '上海';
				index.set(record);
				query.regions = ['Previous region'];
				let applied = { ...emptyQuery(), kind };
				const before = (Setting as unknown as typeof StubSetting).created.length;
				const partial = new FilterModal(controller, query, (next) => {
					applied = next;
				});
				Object.assign(partial, { modalEl: new El('div'), setTitle() { return partial; } });
				partial.onOpen();
				const partialContent = partial.contentEl as unknown as El;
				assert.equal(
					partialContent.querySelectorAll('.nand-contacts-placeholder').length,
					kind === 'person' ? 4 : 1,
				);
				assert.equal(partialContent.textContent.includes(t('contacts.filterEmpty')), false);
				const settings = (Setting as unknown as typeof StubSetting).created.slice(before);
				settings.find((setting) => setting.name === '上海')!.toggles[0]!.fire!(true);
				assert.deepEqual(
					query.regions,
					['Previous region'],
					'Editing the modal does not mutate the original query',
				);
				settings.at(-1)!.buttons[1]!.click!();
				assert.deepEqual(applied.regions, ['Previous region', '上海']);
				partial.onClose();
			}
		}
	} finally {
		setLanguage('zh');
	}
});

test('archive search follows the selected kind and empty prose stays distinct from user text', async () => {
	const environment = globalThis as { document?: Document };
	const previousDocument = environment.document;
	const { document } = parseHTML('<html><body></body></html>');
	Object.assign(globalThis, { document });
	const panel = document.createElement('div');
	document.body.appendChild(panel);
	const waitForEffects = () => new Promise<void>((resolve) => setTimeout(resolve, 160));
	const index = new ContactsIndex();
	const person = fixture();
	const company = fixture('company', 'Example Company');
	index.set(person);
	index.set(company);
	const mounted: string[] = [];
	let unmounted = 0;
	const view: ContactsPanelHost = {
		state: emptyPanelState(),
		enabled: true,
		columns: 6,
		controller: { index, error: '', loading: false, reload: async () => {} },
		mountMarkdown(target, text) {
			mounted.push(text);
			const p = document.createElement('p');
			p.textContent = text;
			target.appendChild(p);
			return () => {
				unmounted++;
				target.textContent = '';
			};
		},
		select(path) {
			view.state.selectedPath = path;
			paint();
		},
		back() {
			view.state.selectedPath = '';
			paint();
		},
		changeKind(kind) {
			view.state.query.kind = kind;
			paint();
		},
		layout(mode) {
			view.state = applyLayout(view.state, mode);
			paint();
		},
		setScope(value) {
			view.state.query = { ...view.state.query, scope: value };
			paint();
		},
		search(value) {
			view.state.query.search = value;
			paint();
		},
		sort() {},
		page() {},
		clearFilters() {},
		filters() {},
		add() {},
		edit() {},
		deleteRow() {},
		more() {},
		resources: () => [],
		newNote() {},
		addResources() {},
		openResource() {},
		revealFolder() {},
	};
	const paint = () => render(h(ContactsSurface, { view }), panel);
	try {
		for (const language of ['zh', 'en'] as const) {
			setLanguage(language);
			view.state.query = emptyQuery();
			view.state.selectedPath = '';
			paint();
			const input = panel.querySelector('input')!;
			assert.equal(input.getAttribute('placeholder'), t('contacts.searchPeople'));
			panel.querySelectorAll<HTMLButtonElement>('.nand-contacts-tabs button')[1]!.click();
			assert.equal(panel.querySelector('input'), input, 'Changing archive kind retains the search control');
			assert.equal(input.getAttribute('placeholder'), t('contacts.searchCompanies'));
			assert.equal(input.getAttribute('aria-label'), t('contacts.searchCompanies'));
			input.value = 'Example';
			input.dispatchEvent(new document.defaultView!.Event('input', { bubbles: true }));
			assert.equal(view.state.query.search, 'Example');
			for (const record of [person, company]) {
				const keys = record.kind === 'person' ? (['traits', 'habits', 'notes'] as const) : (['notes'] as const);
				for (const key of keys) record.prose[key] = ' \n ';
				view.state.selectedPath = record.path;
				const before = mounted.length;
				paint();
				await waitForEffects();
				const proseSections = Array.from(panel.querySelectorAll<HTMLElement>('.nand-contacts-section')).slice(
					-keys.length,
				);
				for (const section of proseSections) {
					section.querySelector<HTMLButtonElement>('.nand-contacts-section-toggle')!.click();
					await waitForEffects();
					const placeholder = section.querySelector('p')!;
					assert.equal(placeholder.textContent, t('contacts.noDetails'));
					assert.ok(placeholder.classList.contains('nand-contacts-muted'));
					assert.ok(placeholder.classList.contains('nand-contacts-placeholder'));
				}
				assert.equal(mounted.length, before, 'Empty prose does not invoke the Markdown renderer');
				const userText = t('contacts.noDetails');
				for (const key of keys) record.prose[key] = userText;
				paint();
				await waitForEffects();
				assert.deepEqual(
					mounted.slice(before),
					keys.map(() => userText),
					'Literal user text matching the placeholder stays real Markdown',
				);
				for (const section of proseSections)
					assert.equal(section.querySelector('.nand-contacts-placeholder'), null);
				const beforeCleanup = unmounted;
				for (const key of keys) record.prose[key] = '';
				paint();
				await waitForEffects();
				assert.equal(unmounted - beforeCleanup, keys.length, 'Clearing prose releases its Markdown renderer');
			}
		}
	} finally {
		render(null, panel);
		if (previousDocument) environment.document = previousDocument;
		else delete environment.document;
		setLanguage('zh');
	}
});

test('new and restored archive leaves pick layouts without throwing on bad values', () => {
	assert.deepEqual(layoutsFor({}), { person: 'list', company: 'card' });
	assert.deepEqual(layoutsFor({ query: { kind: 'person' } }), { person: 'card', company: 'card' });
	assert.deepEqual(layoutsFor({ page: 1, layout: { person: 'list', company: 'sideways' } }), {
		person: 'list',
		company: 'card',
	});
	assert.deepEqual(layoutsFor({ layout: { person: 'grid' } }), { person: 'list', company: 'card' });
	assert.equal(restoreContactsState({}).query.scope, 'record');
	assert.equal(restoreContactsState({ query: { scope: 'nope' } }).query.scope, 'record');
	assert.equal(restoreContactsState({ query: { scope: 'fields' } }).query.scope, 'fields');
	const state = emptyPanelState();
	state.query.search = 'kept';
	state.page = 2;
	state.selectedPath = '档案/a.md';
	const next = applyLayout(state, 'card', '档案/a.md');
	assert.equal(next.query, state.query);
	assert.equal(next.page, 2);
	assert.equal(next.selectedPath, state.selectedPath);
	assert.equal(next.layout.person, 'card');
	assert.equal(next.anchors.person.list, '档案/a.md');
	assert.equal(next.anchors.person.card, '档案/a.md');
	assert.equal(applyLayout(next, 'card', 'other'), next);
});

test('archive group navigation clears the previous detail and a record kind wins', async () => {
	let state = { ...emptyPanelState(), selectedPath: 'People/A.md', selectedId: 'person-a', focus: 'notes' };
	state = showContactKind(state, 'company');
	assert.equal(state.selectedPath, '');
	assert.equal(state.selectedId, '');
	assert.equal(state.focus, '');
	assert.equal(state.query.kind, 'company');
	assert.equal(contactsTarget(state).section, 'company');
	assert.equal(contactsTarget(state).resourceId, undefined);
	const records = new Map<string, { kind: 'person' | 'company'; path: string }>([
		['person-a', { kind: 'person', path: 'People/A.md' }],
		['company-b', { kind: 'company', path: 'Companies/B.md' }],
	]);
	const surface = {
		controller: {
			ensureLoaded: async () => {},
			index: {
				get: (id: string) => records.get(id),
				byPath: { get: (path: string) => [...records.values()].find((record) => record.path === path) },
			},
		},
		changeKind(kind: 'person' | 'company') { state = showContactKind(state, kind); },
		select(path: string) {
			state = { ...state, selectedPath: path, selectedId: [...records.entries()].find(([, item]) => item.path === path)?.[0] ?? '' };
		},
	};
	await navigateContacts(surface, { feature: 'contacts', section: 'company' }, new AbortController().signal);
	assert.equal(state.query.kind, 'company');
	assert.equal(state.selectedPath, '');
	assert.equal(contactsTarget(state).section === 'company', true);
	assert.equal(contactsTarget(state).section === 'person', false);
	await navigateContacts(surface, { feature: 'contacts', section: 'person', resourceId: 'company-b' }, new AbortController().signal);
	assert.equal(state.query.kind, 'company');
	assert.equal(state.selectedPath, 'Companies/B.md');
	assert.equal(contactsTarget(state).section, 'company');
	assert.equal(contactsTarget(state).resourceId, 'company-b');
	await navigateContacts(surface, { feature: 'contacts', section: 'person' }, new AbortController().signal);
	assert.equal(state.selectedPath, '');
	assert.equal(state.query.kind, 'person');
	setLanguage('zh');
	await assert.rejects(navigateContacts(surface, { feature: 'contacts', resourceId: 'missing' }, new AbortController().signal), { message: t('workbench.missing') });
});

test('contacts layout and anchors survive the real workbench state whitelist', () => {
	const raw = {
		query: { kind: 'company', search: 'ada', sort: 'modified', scope: 'fields', current: ['now'], past: [], regions: [], tags: ['x'], relations: [] },
		page: 2, selectedPath: 'Companies/B.md', selectedId: 'company-b', scroll: 48, focus: 'runtime', token: 'secret',
		layout: { person: 'list', company: 'list' },
		anchors: { person: { list: 'People/A.md', card: '' }, company: { list: 'Companies/B.md', card: 'Companies/C.md' } },
	};
	const cleaned = cleanPageState(raw, CONTACTS_PAGE_STATE_KEYS);
	assert.equal(Object.prototype.hasOwnProperty.call(cleaned, 'focus'), false);
	assert.equal(Object.prototype.hasOwnProperty.call(cleaned, 'token'), false);
	const restored = restoreContactsState(cleaned);
	assert.deepEqual(restored.layout, { person: 'list', company: 'list' });
	assert.equal(restored.anchors.person.list, 'People/A.md');
	assert.equal(restored.anchors.company.card, 'Companies/C.md');
	assert.equal(restored.query.search, 'ada');
	assert.equal(restored.query.kind, 'company');
	assert.equal(restored.selectedId, 'company-b');
	assert.equal(restored.scroll, 48);
	const legacy = restoreContactsState(cleanPageState({ query: { kind: 'person' }, page: 1, selectedPath: 'People/A.md' }, CONTACTS_PAGE_STATE_KEYS));
	assert.deepEqual(legacy.layout, { person: 'card', company: 'card' });
	assert.equal(legacy.anchors.person.list, '');
});

test('entry-note search keeps both records that share an email and reports the hit source', () => {
	const index = new ContactsIndex();
	const company = fixture('company', '旧企业');
	const person = fixture('person', '王五');
	const other = fixture('person', '赵六');
	person.fields.emails = ['shared@example.com', 'second@example.com'];
	other.fields.emails = ['shared@example.com'];
	person.employments = [{ ...job(company), notes: '任职暗语' }];
	person.relations = [
		{
			id: crypto.randomUUID(),
			person: { id: other.id, label: other.fields.name, link: relativeLink(person.path, other.path) },
			kind: 'friend',
			company: { id: company.id, label: company.fields.name, link: relativeLink(person.path, company.path) },
			notes: '关系暗语',
		},
	];
	person.prose.notes = '<script>alert(1)</script>紫薇星';
	person.raw = `${createMarkdown(person)}\n\n自由段落 青龙\n`;
	company.prose.notes = '特别情况词';
	company.raw = createMarkdown(company);
	const duplicate = fixture('person', '同号的另一个人');
	duplicate.id = person.id;
	duplicate.path = '档案/个人档案/同号/基本信息.md';
	index.set(company);
	index.set(other);
	index.set(person);
	index.set(duplicate);
	assert.equal(index.byPath.size, 4);
	assert.equal(index.query({ ...emptyQuery(), search: 'shared@example.com' }).length, 2);
	assert.equal(index.query({ ...emptyQuery(), search: '紫薇星' }).length, 1);
	assert.equal(index.hit(person, '紫薇星')?.source, 'notes');
	assert.equal(index.hit(person, '紫薇星')?.snippet.includes('<'), false);
	assert.equal(index.query({ ...emptyQuery(), search: '紫薇星', scope: 'fields' }).length, 0);
	assert.equal(index.hit(person, '任职暗语')?.source, 'employment');
	assert.equal(index.query({ ...emptyQuery(), search: '任职暗语', scope: 'fields' }).length, 0);
	assert.equal(index.hit(person, '关系暗语')?.source, 'relation');
	assert.equal(index.hit(person, '青龙')?.source, 'body');
	assert.equal(index.hit(company, '特别情况词')?.source, 'notes');
	assert.equal(index.query({ ...emptyQuery(), search: person.id }).length, 0);
	assert.equal(index.query({ ...emptyQuery(), search: 'nand:notes' }).length, 0);
	assert.equal(index.query({ ...emptyQuery(), search: '<!-- nand:notes -->' }).length, 0);
	assert.equal(index.query({ ...emptyQuery(), kind: 'person', search: '旧企业' }).some((record) => record.path === person.path), true);
	company.fields.name = '新企业';
	index.set(company);
	assert.equal(index.query({ ...emptyQuery(), kind: 'person', search: '新企业' }).some((record) => record.path === person.path), true);
	assert.equal(index.query({ ...emptyQuery(), kind: 'person', search: '旧企业' }).some((record) => record.path === person.path), false);
	const moved = { ...person, path: '档案/个人档案/搬迁/基本信息.md' };
	index.remove(person.path);
	index.set(moved);
	assert.equal(index.byPath.has(person.path), false);
	assert.equal(index.query({ ...emptyQuery(), search: '青龙' }).some((record) => record.path === moved.path), true);
	const broken = fixture('person', '边界');
	broken.raw = `${createMarkdown(broken).replace('<!-- /nand:notes -->', '')}\n未闭合之后 玄武\n`;
	index.set(broken);
	assert.equal(index.query({ ...emptyQuery(), search: 'nand:notes' }).some((record) => record.path === broken.path), false);
	assert.equal(index.hit(broken, '玄武')?.source, 'body');
	const current = createMarkdown(person) + '\n自由段落保持\n';
	const parsed = parseRecord(current, person.path)!;
	assert.deepEqual(parsed.errors, []);
	const edited = cloneRecord(parsed);
	edited.fields.region = '杭州';
	const patched = patchMarkdown(current, parsed, edited);
	assert.equal(patched.includes('自由段落保持'), true);
	assert.equal(patched.includes('杭州'), true);
});

function fileLine(raw: string, needle: string): number {
	const line = raw.split(/\r?\n/).findIndex((item) => item.includes(needle));
	assert.ok(line >= 0, needle);
	return line + 1;
}
function loneSurrogate(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = value.charCodeAt(i + 1);
			if (next < 0xdc00 || next > 0xdfff) return true;
			i++;
		} else if (code >= 0xdc00 && code <= 0xdfff) return true;
	}
	return false;
}

test('record search matches one fragment, keeps foreign UUIDs, and maps body lines to the file', () => {
	const index = new ContactsIndex();
	const person = fixture('person', '检索甲');
	const business = '123e4567-e89b-12d3-a456-426614174000';
	const row = '123e4567-e89b-12d3-a456-426614174111';
	assert.notEqual(person.id, business);
	person.prose.traits = '乙段开头';
	person.prose.notes = `甲段末尾 订单 ${business} [显示文字](https://example.com/secret-token) ![风景图](https://cdn.example/token.png)`;
	person.raw = `${createMarkdown(person)}\n\n见 [正文链接](https://example.com/body-token) <img alt="正文图" src="https://cdn.example/img-token.png">\n<!-- nand:row ${row} -->\n${person.id}\n自由段落 青龙\n`;
	index.set(person);
	assert.equal(index.query({ ...emptyQuery(), search: business }).some((record) => record.path === person.path), true);
	assert.equal(index.hit(person, business)?.source, 'notes');
	assert.equal(index.query({ ...emptyQuery(), search: person.id }).length, 0);
	assert.equal(index.query({ ...emptyQuery(), search: row }).length, 0);
	assert.equal(index.query({ ...emptyQuery(), search: '乙段开头 甲段末尾' }).length, 0);
	assert.equal(index.query({ ...emptyQuery(), search: '显示文字' }).length, 1);
	assert.equal(index.query({ ...emptyQuery(), search: '风景图' }).length, 1);
	assert.equal(index.query({ ...emptyQuery(), search: 'secret-token' }).length, 0);
	assert.equal(index.query({ ...emptyQuery(), search: 'cdn.example' }).length, 0);
	assert.equal(index.hit(person, '正文链接')?.source, 'body');
	assert.equal(index.hit(person, '正文图')?.source, 'body');
	assert.equal(index.query({ ...emptyQuery(), search: 'body-token' }).length, 0);
	assert.equal(index.query({ ...emptyQuery(), search: 'img-token' }).length, 0);
	assert.equal(index.hit(person, '青龙')?.line, fileLine(person.raw, '青龙'));
	assert.equal(index.hit(person, '青龙')?.snippet.includes('<'), false);
	const crlf = fixture('person', '回车');
	crlf.raw = createMarkdown(crlf).replace(/\n/g, '\r\n') + '\r\n\r\n自由段落 朱雀\r\n';
	index.set(crlf);
	assert.equal(index.hit(crlf, '朱雀')?.line, fileLine(crlf.raw, '朱雀'));
	const wrapped = fixture('person', '跨行');
	wrapped.raw = `${createMarkdown(wrapped)}\n跨行甲\n乙尾\n`;
	index.set(wrapped);
	assert.equal(index.query({ ...emptyQuery(), search: '跨行甲 乙尾' }).some((record) => record.path === wrapped.path), true);
	assert.equal(index.hit(wrapped, '跨行甲 乙尾')?.line, undefined);
	assert.equal(index.hit(wrapped, '跨行甲')?.line, fileLine(wrapped.raw, '跨行甲'));
	const emoji = fixture('person', '表情');
	emoji.prose.notes = `😀${'测'.repeat(23)}界标`;
	index.set(emoji);
	const snippet = index.hit(emoji, '界标')?.snippet ?? '';
	assert.equal(loneSurrogate(snippet), false);
	assert.equal(snippet.includes('😀'), true);
	assert.equal(index.query({ ...emptyQuery(), search: '甲段末尾', scope: 'fields' }).length, 0);
});

test('a path-only reference refreshes when the target is renamed in place or removed', () => {
	const index = new ContactsIndex();
	const company = fixture('company', '路径企业');
	const person = fixture('person', '路径的人');
	person.employments = [
		{
			...job(company),
			company: { id: '', label: '手写标签', link: relativeLink(person.path, company.path) },
		},
	];
	index.set(person);
	index.set(company);
	const named = (search: string) => index.query({ ...emptyQuery(), kind: 'person', search }).some((record) => record.path === person.path);
	assert.equal(index.resolve(person.employments[0]!.company, person)?.path, company.path);
	assert.equal(named('路径企业'), true);
	company.fields.name = '路径新名';
	index.set(company);
	assert.equal(named('路径新名'), true);
	assert.equal(named('路径企业'), false);
	const stored = index.byPath.get(company.path)!;
	stored.fields.name = '原地新名';
	index.set(stored);
	assert.equal(named('原地新名'), true);
	assert.equal(named('路径新名'), false);
	index.remove(company.path);
	assert.equal(named('手写标签'), true);
	assert.equal(named('原地新名'), false);
});

test('hot queries answer from the index after the note text is gone', () => {
	const index = new ContactsIndex();
	const records: ArchiveRecord[] = [];
	for (let i = 0; i < 100; i++) {
		const record = fixture('person', `热查询 ${i}`);
		record.prose.notes = `备注词-${i}`;
		record.raw = `自由 ${record.id} 不应被读`;
		index.set(record);
		records.push(record);
	}
	for (const record of records) {
		record.raw = '磁盘上的另一个词';
		record.prose = { traits: '磁盘性格', habits: '磁盘习惯', notes: '磁盘备注' };
		record.fields = { ...record.fields, name: '磁盘姓名' };
	}
	assert.equal(index.query({ ...emptyQuery(), search: '备注词-42' }).length, 1);
	assert.equal(index.hit(records[42]!, '备注词-42')?.source, 'notes');
	assert.equal(index.query({ ...emptyQuery(), search: '磁盘备注' }).length, 0);
	assert.equal(index.query({ ...emptyQuery(), search: '磁盘姓名' }).length, 0);
	assert.equal(index.query({ ...emptyQuery(), search: records[42]!.id }).length, 0);
});

test('list and card render the same paths, and switching layout does not reload', async () => {
	const environment = globalThis as { document?: Document };
	const previousDocument = environment.document;
	const { document } = parseHTML('<html><body></body></html>');
	Object.assign(globalThis, { document });
	const panel = document.createElement('div');
	document.body.appendChild(panel);
	const index = new ContactsIndex();
	const person = fixture('person', '列表甲');
	person.fields.emails = ['a@example.com', 'b@example.com'];
	person.fields.region = '杭州';
	person.prose.notes = '只在备注';
	index.set(person);
	index.set(fixture('person', '列表乙'));
	let reloads = 0;
	const view: ContactsPanelHost = {
		state: emptyPanelState(),
		enabled: true,
		columns: 6,
		controller: { index, error: '', loading: false, reload: async () => { reloads += 1; } },
		mountMarkdown: () => () => {},
		select() {},
		back() {},
		changeKind() {},
		search() {},
		sort() {},
		page() {},
		clearFilters() {},
		filters() {},
		add() {},
		edit() {},
		deleteRow() {},
		more() {},
		resources: () => [],
		newNote() {},
		addResources() {},
		openResource() {},
		revealFolder() {},
		layout(mode) {
			const query = view.state.query;
			const page = view.state.page;
			const selectedPath = view.state.selectedPath;
			view.state = applyLayout(view.state, mode);
			assert.equal(view.state.query, query);
			assert.equal(view.state.page, page);
			assert.equal(view.state.selectedPath, selectedPath);
			paint();
		},
		setScope() {},
	};
	const paint = () => render(h(ContactsSurface, { view }), panel);
	const paths = () => Array.from(panel.querySelectorAll<HTMLElement>('[data-path]'), (node) => node.dataset.path);
	try {
		view.state.query.search = '只在备注';
		paint();
		const listed = paths();
		const hitText = () => panel.querySelector('.nand-contacts-hit')?.textContent ?? '';
		assert.deepEqual(listed, index.query(view.state.query).map((record) => record.path));
		assert.equal(hitText().includes('<'), false);
		assert.equal(hitText().includes(t('contacts.hit.notes')), true);
		assert.ok(panel.querySelector('.nand-contacts-row-copy'));
		assert.equal(panel.querySelector('button.nand-contacts-row-name button'), null);
		panel.querySelectorAll<HTMLButtonElement>('.nand-contacts-layout button')[1]!.click();
		assert.equal(reloads, 0);
		assert.deepEqual(paths(), listed);
		assert.equal(view.state.layout.person, 'card');
		assert.equal(hitText().includes('<'), false);
		assert.equal(hitText().includes(t('contacts.hit.notes')), true);
		const searches: string[] = [];
		view.search = (value: string) => {
			searches.push(value);
		};
		const input = panel.querySelector<HTMLInputElement>('input[type=search]');
		assert.ok(input);
		const ViewEvent = input.ownerDocument.defaultView!.Event;
		const fire = (type: string) => input.dispatchEvent(new ViewEvent(type, { bubbles: true }));
		input.value = '王';
		fire('input');
		assert.deepEqual(searches, ['王']);
		searches.length = 0;
		input.value = 'zhong';
		fire('compositionstart');
		fire('input');
		assert.deepEqual(searches, []);
		input.value = '中';
		fire('compositionend');
		assert.deepEqual(searches, ['中']);
	} finally {
		render(null, panel);
		if (previousDocument) environment.document = previousDocument;
		else delete environment.document;
	}
});

test('hot entry-note queries stay in memory', (t) => {
	const samples: Array<{ count: number; bytes: number; p95: number }> = [];
	for (const count of [100, 1000, 5000]) {
		for (const bytes of [0, 2000, 20000]) {
			const index = new ContactsIndex();
			const body = bytes ? `${'甲'.repeat(40)}\n`.repeat(Math.ceil(bytes / 41)).slice(0, bytes) : '';
			for (let i = 0; i < count; i++) {
				const record = fixture('person', `Timed ${i}`);
				record.path = `档案/个人档案/timed-${i}/基本信息.md`;
				record.raw = body ? `\n\n${body} token-${i}\n` : '';
				index.set(record);
			}
			const timings: number[] = [];
			for (let n = 0; n < 20; n++) {
				const started = performance.now();
				index.query({ ...emptyQuery(), search: `missing-${n}` });
				timings.push(performance.now() - started);
			}
			timings.sort((a, b) => a - b);
			samples.push({ count, bytes, p95: Math.round((timings[Math.ceil(timings.length * 0.95) - 1] ?? 0) * 100) / 100 });
			index.clear();
		}
	}
	t.diagnostic(JSON.stringify(samples));
	const target = samples.find((sample) => sample.count === 1000 && sample.bytes === 2000);
	assert.ok(target && target.p95 <= 100, `1,000 records of about 2KB should stay within 100ms, measured ${target?.p95}`);
});
