import assert from 'node:assert/strict';
import test from 'node:test';
import { parse, serialize } from '../src/core/dashboard/parser/parse';
import { BrowserOperationQueue } from '../src/core/browser/operation-queue';
import { HabitApplication } from '../src/core/habit/application';
import type { TextStorage } from '../src/shared/storage/ports';
import { threeWayMerge } from '../src/shared/storage/three-way-merge';
import { patchManagedLines } from '../src/shared/storage/managed-lines';
import { DocumentRepository, parseDocumentValue } from '../src/shared/storage/document-repository';
import { MarkdownCollectionStorage } from '../src/platform/obsidian/storage/document-collection';
import { habitDocuments } from '../src/core/habit/documents';
import { expenseDocuments } from '../src/core/expense/documents';
import { emptyData } from '../src/core/expense/model';
import { automationDocuments } from '../src/core/automations/documents';
import { zonedOccurrence } from '../src/core/automations/schedule/zoned-occurrences';
import { actionDescriptors, actionAvailability } from '../src/core/actions/executor';
import { RuntimeStartup } from '../src/core/pty/runtime-startup';
import { JsonStore } from '../src/shared/json-store';
import { NotificationService } from '../src/core/notifications/service';
import type { AutomationAction } from '../src/shared/automation/types';
import { memoryVault } from './fixtures/memory-vault';
import { MarkdownView } from 'obsidian';

class MemoryStorage implements TextStorage {
	files = new Map<string, string>();
	readError = false;
	writeError = false;
	async exists(path: string) {
		return this.files.has(path);
	}
	async read(path: string) {
		if (this.readError) throw new Error('read failed');
		return this.files.get(path)!;
	}
	async write(path: string, content: string) {
		if (this.writeError) throw new Error('write failed');
		this.files.set(path, content);
	}
	async mkdir(path: string) {
		this.files.set(path, '');
	}
}

test('replacement JSON store drains pending writes and queued inbox changes survive shutdown', async () => {
	const disk = new MemoryStorage();
	const validate = (value: unknown): value is { a: number; b: number } => !!value && typeof value === 'object' && 'a' in value && 'b' in value;
	const first = new JsonStore(disk, 'settings.json', validate), second = new JsonStore(disk, 'settings.json', validate);
	await first.load({ a: 0, b: 0 }); await second.load({ a: 0, b: 0 });
	await Promise.all([first.save({ a: 1, b: 0 }), second.save({ a: 0, b: 2 })]);
	assert.deepEqual(JSON.parse(await disk.read('settings.json')), { a: 1, b: 2 });
	const pending = first.save({ a: 3, b: 0 });
	const replacement = new JsonStore(disk, 'settings.json', validate);
	assert.deepEqual(await replacement.load({ a: 0, b: 0 }), { a: 3, b: 2 }); await pending;
	let deliveries = 0;
	const inbox = new NotificationService(disk, 'inbox.json', async () => {}, undefined, { available: () => true, send: () => { deliveries++; }, dispose: () => {} });
	await inbox.load(); const sending = inbox.send({ id: 'queued', title: 'Queued', body: 'Body', channels: ['in-app'] });
	const closing = inbox.shutdown(); await sending; await closing;
	assert.equal(deliveries, 0);
	assert.equal(JSON.parse(await disk.read('inbox.json')).receipts.queued['in-app'], 'unknown');
	await assert.rejects(inbox.markRead(), /shutting down/);
});

test('unreadable and corrupt data remain untouched; failed writes report unsaved and can retry', async () => {
	const disk = new MemoryStorage();
	const app = new HabitApplication(disk, 'data');
	await app.load();
	app.addHabit('original');
	await app.flush();
	const original = disk.files.get('data/habits.json');
	disk.readError = true;
	app.addHabit('new');
	await assert.rejects(app.flush(), /read failed/);
	assert.equal(app.saveState.status, 'unsaved');
	assert.equal(disk.files.get('data/habits.json'), original);
	disk.readError = false;
	disk.writeError = true;
	await assert.rejects(app.retrySave(), /write failed/);
	assert.equal(disk.files.get('data/habits.json'), original);
	disk.writeError = false;
	await app.retrySave();
	assert.equal(app.saveState.status, 'saved');
	disk.files.set('data/habits.json', '{broken');
	const corrupt = new HabitApplication(disk, 'data');
	await corrupt.load();
	corrupt.addHabit('draft');
	await assert.rejects(corrupt.flush());
	assert.equal(disk.files.get('data/habits.json'), '{broken');
});

test('concurrent additions do not resurrect deleted habits or check-ins', async () => {
	const disk = new MemoryStorage();
	const first = new HabitApplication(disk, 'data');
	await first.load();
	const old = first.addHabit('old')!;
	await first.flush();
	const second = new HabitApplication(disk, 'data');
	await second.load();
	first.removeHabit(old.id);
	second.addHabit('new');
	await Promise.all([first.flush(), second.flush()]);
	await first.syncFromDisk();
	assert.deepEqual(
		first.getHabits().map((h) => h.name),
		['new'],
	);
	assert.equal(
		second.getHabits().some((h) => h.id === old.id),
		false,
	);
	assert.throws(() => threeWayMerge({ name: 'old' }, { name: 'mine' }, { name: 'theirs' }), /Concurrent edit/);
});

test('dashboard preserves unknown YAML, comments, free prose and unchanged cards', () => {
	const original = `---\n# user metadata\nowner: someone\nbanner:\n  quote: "hello --- world" # keep me\n  custom: retained\ncolumns:\n  - name: Work\n    color: "#ffffff"\n    custom: retained\n---\nFree introduction.\n<!-- free comment -->\n\n## Work\nColumn introduction.\n\n### Card\nid: c1\ntype: task\n- [ ] first\n`;
	const data = parse(original);
	assert.equal(data.banner.quote, 'hello --- world');
	assert.equal(serialize(data), original);
	data.banner.quote = 'updated';
	const updated = serialize(data);
	for (const text of [
		'owner: someone',
		'# user metadata',
		'# keep me',
		'custom: retained',
		'Free introduction.',
		'<!-- free comment -->',
		'Column introduction.',
		'- [ ] first',
	])
		assert.ok(updated.includes(text), text);
	assert.equal(parse(updated).banner.quote, 'updated');
	data.columns[0]!.cards[0]!.tasks[0]!.checked = true;
	assert.ok(serialize(data).includes('- [x] first'));
	assert.equal(
		patchManagedLines(
			'### Card\n<!-- author -->\n- [ ] first\nFree text\n',
			'### Card\n- [ ] first\n',
			'### Renamed\n- [x] first\n',
		),
		'### Renamed\n<!-- author -->\n- [x] first\nFree text\n',
	);
});

test('closing cancels uncooperative and queued browser operations immediately', async () => {
	const queue = new BrowserOperationQueue();
	let finish!: (value: number) => void;
	const active = queue.run(
		() =>
			new Promise<number>((resolve) => {
				finish = resolve;
			}),
	);
	const waiting = queue.run(async () => assert.fail('queued work must not start'));
	const results = Promise.all([
		assert.rejects(active, /browser_page_closed/),
		assert.rejects(waiting, /browser_page_closed/),
	]);
	await Promise.resolve();
	queue.close();
	await results;
	finish(1);
	await assert.rejects(
		queue.run(async () => 1),
		/browser_page_closed/,
	);
});

test('managed tables and sections preserve author prose, reject malformed markers and merge independent edits', async () => {
	let text = '---\nowner: Ada # keep\n---\nPersonal prose.\n';
	const repository = new DocumentRepository({
		read: async () => text,
		process: async (_, update) => (text = update(text)),
	});
	let snapshot = await repository.read('note');
	snapshot = await repository.update('note', snapshot.value, {
		...snapshot.value,
		sections: { prompt: 'hello' },
		rows: [{ id: 'one', value: 'A|B\nC' }],
	});
	const baseline = snapshot.value;
	text = text.replace('owner: Ada', 'owner: Grace');
	snapshot = await repository.update('note', baseline, {
		...baseline,
		rows: [
			{ id: 'one', value: 'updated' },
			{ id: 'two', value: 'new' },
		],
	});
	assert.equal(snapshot.value.properties.owner, 'Grace');
	assert.equal((text.match(/<!-- nand:prompt -->/g) ?? []).length, 1);
	assert.ok(text.includes('Personal prose.'));
	assert.ok(text.includes('# keep'));
	assert.throws(() => parseDocumentValue(text.replace('<!-- /nand:prompt -->', '')), /markers/);
	await assert.rejects(
		repository.update('note', snapshot.value, { ...snapshot.value, sections: { prompt: '<!-- nand:records -->' } }),
		/Reserved/,
	);
});

test('Markdown collection survives restart, external edits and deletes without reading installation JSON', async () => {
	const vault = memoryVault({ '.obsidian/plugins/nand/habits.json': '{broken' });
	const storageA = new MarkdownCollectionStorage(vault.app, habitDocuments, 'data/habits.json');
	const a = new HabitApplication(storageA, 'data');
	await a.load();
	const old = a.addHabit('old')!;
	await a.flush();
	const storageB = new MarkdownCollectionStorage(vault.app, habitDocuments, 'data/habits.json');
	const b = new HabitApplication(storageB, 'data');
	await b.load();
	a.removeHabit(old.id);
	await a.flush();
	b.addHabit('new');
	await b.flush();
	await a.syncFromDisk();
	assert.deepEqual(
		a.getHabits().map((h) => h.name),
		['new'],
	);
	const file = [...vault.contents.keys()].find((path) => path.includes('/new-'))!;
	await vault.adapter.write(file, vault.contents.get(file)!.replace('name: new', 'name: external'));
	await a.syncFromDisk();
	assert.equal(a.getHabits()[0]!.name, 'external');
	await vault.adapter.write(file, '---\nnand-id: invalid\nname: [broken\n---\n');
	a.addHabit('draft');
	await assert.rejects(a.flush());
	assert.equal(a.saveState.status, 'unsaved');
	assert.ok(vault.contents.get(file)!.includes('[broken'));
	assert.ok([...vault.contents.keys()].some((path) => path.startsWith('.nand/recovery/drafts/')));
	storageA.dispose();
	storageB.dispose();
});

test('open editor contents block disk writes and preserve the pending draft', async () => {
	const vault = memoryVault();
	const storage = new MarkdownCollectionStorage(vault.app, habitDocuments, 'data/habits.json');
	const app = new HabitApplication(storage, 'data');
	await app.load();
	const habit = app.addHabit('one')!;
	await app.flush();
	const path = [...vault.contents.keys()].find((path) => path.endsWith('习惯.md'))!;
	const previous = vault.contents.get(path);
	const view = Object.assign(new MarkdownView({} as never), {
		file: vault.file(path),
		editor: { getValue: () => 'unsaved author text' },
	});
	vault.app.workspace.getLeavesOfType = () => [{ view }] as never;
	app.renameHabit(habit.id, 'two');
	await assert.rejects(app.flush(), /Unsaved editor/);
	assert.equal(vault.contents.get(path), previous);
	storage.dispose();
});

test('all seven action descriptors round-trip as Markdown; manual-only actions reject scheduling', async () => {
	for (const descriptor of actionDescriptors) {
		if (!descriptor.scheduled)
			assert.equal(actionAvailability(descriptor.kind, 'scheduled', true), 'automation.manualOnly');
	}
	const definition = {
		id: 'stable-id',
		name: 'Script',
		enabled: true,
		deviceId: 'device',
		revision: 1,
		graceMinutes: 5,
		channels: ['in-app'],
		notifyOn: 'always',
		createdAt: 1,
		updatedAt: 1,
		action: { kind: 'script' as const, script: 'echo "a --- b"', cwd: '.', shell: 'powershell' as const },
		schedule: { kind: 'manual' as const },
	};
	const vault = memoryVault();
	const storage = new MarkdownCollectionStorage(vault.app, automationDocuments, 'definitions');
	await storage.read('definitions');
	await storage.write('definitions', JSON.stringify({ definitions: [definition] }));
	const decoded = JSON.parse(await storage.read('definitions'));
	assert.equal(decoded.definitions[0].id, 'stable-id');
	assert.equal(decoded.definitions[0].action.script, definition.action.script);
	assert.equal(decoded.definitions[0].schedule.kind, 'manual');
	storage.dispose();
	const actions: AutomationAction[] = [
		definition.action,
		{
			kind: 'agent',
			agentId: 'codex',
			cwd: '.',
			prompt: 'Keep <!-- literal --> and YAML ---',
			sessionMode: 'fresh',
		},
		{ kind: 'notify', body: 'Reminder' },
		{ kind: 'create-task', path: 'Board.md', cardId: 'card', text: 'Do this' },
		{ kind: 'open-file', path: 'Note.md' },
		{ kind: 'open-url', url: 'https://example.com' },
		{ kind: 'obsidian-command', command: 'editor:toggle-bold' },
	];
	const all = new MarkdownCollectionStorage(vault.app, automationDocuments, 'definitions');
	await all.read('definitions');
	await all.write(
		'definitions',
		JSON.stringify({
			definitions: actions.map((action) => ({ ...definition, id: action.kind, name: action.kind, action })),
		}),
	);
	const roundtrip = JSON.parse(await all.read('definitions')).definitions;
	for (const action of actions)
		assert.deepEqual(roundtrip.find((row: { id: string }) => row.id === action.kind).action, action);
	const replacement = roundtrip.map((row: { id: string }) => row.id === 'script' ? { ...row, action: { kind: 'open-file', path: 'Note.md' } } : row);
	await all.write('definitions', JSON.stringify({ definitions: replacement }));
	const changed = JSON.parse(await all.read('definitions')).definitions.find((row: { id: string }) => row.id === 'script');
	assert.deepEqual(changed.action, { kind: 'open-file', path: 'Note.md' });
	assert.equal('shell' in changed, false);
	const rawChanged = [...vault.contents.values()].find(text => text.includes('nand-id: script'))!;
	assert.ok(rawChanged);
	assert.doesNotMatch(rawChanged, /^shell:|^cwd:/m);
	all.dispose();
});

test('runtime initialization coalesces callers and shutdown drains admitted work', async () => {
	const startup = new RuntimeStartup();
	let resolve!: (value: number) => void,
		calls = 0;
	const create = () => {
		calls++;
		return new Promise<number>((done) => {
			resolve = done;
		});
	};
	const first = startup.run('pty', create),
		second = startup.run('pty', create);
	assert.equal(first, second);
	await Promise.resolve();
	assert.equal(calls, 1);
	let closed = false;
	const closing = startup.shutdown().then(() => {
		closed = true;
	});
	await assert.rejects(startup.run('pty', create), /shutting down/);
	assert.equal(closed, false);
	resolve(42);
	assert.equal(await second, 42);
	await closing;
	assert.equal(closed, true);
	startup.open();
	assert.equal(await startup.run('pty', async () => 43), 43);
});

test('explicit New York timezone skips spring gap and resolves both repeated hours independent of host TZ', () => {
	const start = Date.parse('2026-01-01T00:00:00Z');
	const spring = zonedOccurrence('30 2 * * *', start, Date.parse('2026-03-08T00:00:00Z'), 'America/New_York', 1);
	assert.equal(new Date(spring!).toISOString(), '2026-03-09T06:30:00.000Z');
	const first = zonedOccurrence('30 1 * * *', start, Date.parse('2026-11-01T00:00:00Z'), 'America/New_York', 1)!;
	const second = zonedOccurrence('30 1 * * *', start, first, 'America/New_York', 1)!;
	assert.equal(new Date(first).toISOString(), '2026-11-01T05:30:00.000Z');
	assert.equal(second - first, 3600000);
});

test('10,000 ledger records update one daily document without rereading the full collection', async (t) => {
	const vault = memoryVault();
	const storage = new MarkdownCollectionStorage(vault.app, expenseDocuments, 'ledger');
	const data = emptyData();
	data.records = Array.from({ length: 10000 }, (_, i) => ({
		id: `record-${i}`,
		type: 'expense',
		amount: i + 1,
		category: 'food',
		date: new Date(Date.UTC(2026, 0, 1 + (i % 100))).toISOString().slice(0, 10),
		createdAt: i + 1,
	}));
	const start = performance.now();
	await storage.read('ledger');
	await storage.write('ledger', JSON.stringify(data));
	await storage.read('ledger');
	const beforeRead = vault.reads,
		beforeWrite = vault.writes,
		update = performance.now();
	data.records[5000]!.amount = 42;
	await storage.write('ledger', JSON.stringify(data));
	await storage.read('ledger');
	assert.equal(vault.writes - beforeWrite, 1);
	assert.ok(vault.reads - beforeRead <= 2);
	t.diagnostic(
		JSON.stringify({
			records: 10000,
			documents: 101,
			initialMs: Math.round(update - start),
			updateMs: Math.round(performance.now() - update),
			reads: vault.reads - beforeRead,
			writes: vault.writes - beforeWrite,
		}),
	);
	storage.dispose();
});
