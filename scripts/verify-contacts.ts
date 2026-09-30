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
import type { ContactsPanelHost } from '../src/view/contacts/panel-contract';

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
		assert.ok(english.startsWith('# Archive format\n'), 'An English first creation needs the complete English guide');
		assert.match(english, /Changing the display name does not rename the file/);
		const original = f.text.get(company.path)!;
		setLanguage('zh');
		await f.controller.create(newNamed('person', 'Later Person'));
		assert.equal(f.text.get('档案/档案格式说明.md'), english, 'Switching language never replaces an existing guide');
		assert.equal(f.text.get(company.path), original);
		const base = await f.controller.snapshot(company.path), draft = cloneRecord(base);
		draft.fields.name = 'Renamed Company';
		const renamed = await f.controller.save(base, draft);
		assert.equal(renamed.id, company.id);
		assert.equal(renamed.path, company.path);

		f.settings.rootFolder = '中文档案';
		await f.controller.reload();
		await f.controller.create(newNamed('person', '中文人物'));
		const chinese = f.text.get('中文档案/档案格式说明.md')!;
		assert.ok(chinese.startsWith('# 档案格式\n'));
		assert.match(chinese, /更改显示名称不会自动重命名文件/);
		for (const guide of [english, chinese]) {
			for (const marker of ['employments', 'relations', 'traits', 'habits', 'notes']) {
				assert.ok(guide.includes(`<!-- nand:${marker} -->`));
				assert.ok(guide.includes(`<!-- /nand:${marker} -->`));
			}
			for (const field of ['nand-type', 'nand-id', 'birthday', 'birthplace', 'region', 'website', 'aliases', 'mobiles', 'phones', 'wechat', 'emails', 'tags', 'key_role'])
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
		const headers = guide.split('\n').filter((line) => /^\| (company|Companies|企业|person|People|联系人) \|/.test(line));
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
	const registry = (Setting as unknown as { created: Array<{ name: string; settingEl: { classList: { contains(name: string): boolean } } }> }).created;
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

test('empty archive filters explain missing data and preserve existing choices on apply', () => {
	try {
		for (const language of ['zh', 'en'] as const) {
			setLanguage(language);
			for (const kind of ['person', 'company'] as const) {
				const index = new ContactsIndex();
				const controller = { app: {}, index, choices: () => [] } as unknown as ContactsController;
				const query = { ...emptyQuery(), kind };
				const empty = new FilterModal(controller, query, () => {});
				Object.assign(empty, { modalEl: new El('div'), setTitle() {} });
				empty.onOpen();
				const emptyContent = empty.contentEl as unknown as El;
				assert.equal(emptyContent.querySelectorAll('.nand-contacts-placeholder').length, kind === 'person' ? 5 : 2);
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
				const partial = new FilterModal(controller, query, (next) => { applied = next; });
				Object.assign(partial, { modalEl: new El('div'), setTitle() {} });
				partial.onOpen();
				const partialContent = partial.contentEl as unknown as El;
				assert.equal(partialContent.querySelectorAll('.nand-contacts-placeholder').length, kind === 'person' ? 4 : 1);
				assert.equal(partialContent.textContent.includes(t('contacts.filterEmpty')), false);
				const settings = (Setting as unknown as typeof StubSetting).created.slice(before);
				settings.find((setting) => setting.name === '上海')!.toggles[0]!.fire!(true);
				assert.deepEqual(query.regions, ['Previous region'], 'Editing the modal does not mutate the original query');
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
		state: { query: emptyQuery(), page: 0, selectedPath: '', selectedId: '', scroll: 0 },
		enabled: true, columns: 6,
		controller: { index, error: '', loading: false, reload: async () => {} },
		mountMarkdown(target, text) {
			mounted.push(text);
			const p = document.createElement('p');
			p.textContent = text;
			target.appendChild(p);
			return () => { unmounted++; target.textContent = ''; };
		},
		select(path) { view.state.selectedPath = path; paint(); },
		back() { view.state.selectedPath = ''; paint(); },
		changeKind(kind) { view.state.query.kind = kind; paint(); },
		search(value) { view.state.query.search = value; paint(); },
		sort() {}, page() {}, clearFilters() {}, filters() {}, add() {}, edit() {}, deleteRow() {}, more() {},
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
				const keys = record.kind === 'person' ? ['traits', 'habits', 'notes'] as const : ['notes'] as const;
				for (const key of keys) record.prose[key] = ' \n ';
				view.state.selectedPath = record.path;
				const before = mounted.length;
				paint(); await waitForEffects();
				const proseSections = Array.from(panel.querySelectorAll<HTMLElement>('.nand-contacts-section')).slice(-keys.length);
				for (const section of proseSections) {
					const placeholder = section.querySelector('p')!;
					assert.equal(placeholder.textContent, t('contacts.noDetails'));
					assert.ok(placeholder.classList.contains('nand-contacts-muted'));
					assert.ok(placeholder.classList.contains('nand-contacts-placeholder'));
				}
				assert.equal(mounted.length, before, 'Empty prose does not invoke the Markdown renderer');
				const userText = t('contacts.noDetails');
				for (const key of keys) record.prose[key] = userText;
				paint(); await waitForEffects();
				assert.deepEqual(mounted.slice(before), keys.map(() => userText), 'Literal user text matching the placeholder stays real Markdown');
				for (const section of proseSections) assert.equal(section.querySelector('.nand-contacts-placeholder'), null);
				const beforeCleanup = unmounted;
				for (const key of keys) record.prose[key] = '';
				paint(); await waitForEffects();
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
