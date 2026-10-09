// Golden samples of every user-owned on-disk format. Code may move and be rewritten freely, but
// the bytes written to a user's vault must not change unless a snapshot update is reviewed on purpose.
//
// Update intentionally with: pnpm vitest run test/golden -u
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, vi } from 'vitest';
import { memoryVault } from '../../scripts/fixtures/memory-vault';
import { MarkdownCollectionStorage } from '../../src/host/obsidian/storage/document-collection';
import type { DocumentCollectionCodec } from '../../src/shared/storage/document-collection';
import { habitDocuments } from '../../src/modules/home/core/habit/documents';
import type { HabitData } from '../../src/modules/home/core/habit/model';
import { expenseDocuments } from '../../src/modules/home/core/expense/documents';
import type { ExpenseData } from '../../src/modules/home/core/expense/model';
import { pomodoroDocuments } from '../../src/modules/home/core/pomodoro/documents';
import type { PomodoroData } from '../../src/modules/home/core/pomodoro/application';
import { readingDocuments } from '../../src/modules/home/core/reading/documents';
import type { ReadingData } from '../../src/modules/home/core/reading/application';
import { automationDocuments, type DefinitionCollection } from '../../src/modules/automations/core/documents';
import { parse, serialize } from '../../src/modules/home/core/board/parser/parse';
import { generateDefaultMarkdown } from '../../src/modules/home/core/board/parser/default-document';
import { createMarkdown, parseRecord } from '../../src/modules/archives/core/persist/markdown';
import { newRecord, type ArchiveRecord } from '../../src/modules/archives/core/model';

const snapshot = (name: string) => fileURLToPath(new URL(`./__snapshots__/${name}`, import.meta.url));

/** Writes `data` through the production Markdown collection storage; returns every file it created plus what a restart reads back. */
async function writeCollection<T>(codec: DocumentCollectionCodec<T>, data: T): Promise<{ files: string; readBack: T }> {
	const vault = memoryVault();
	const writer = new MarkdownCollectionStorage(vault.app, codec, 'data.json');
	await writer.read('data.json');
	await writer.write('data.json', JSON.stringify(data));
	writer.dispose();
	const files = [...vault.contents.entries()]
		.filter(([path]) => path.endsWith('.md'))
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([path, text]) => `=== ${path} ===\n${text}`)
		.join('\n');
	// A fresh storage reads only what is on disk, like a restart.
	const reader = new MarkdownCollectionStorage(vault.app, codec, 'data.json');
	const readBack = JSON.parse(await reader.read('data.json')) as T;
	reader.dispose();
	return { files: `${files}\n=== read back ===\n${JSON.stringify(readBack, null, '\t')}\n`, readBack };
}

const habits: HabitData = {
	version: 1,
	habits: [
		{ id: 'habit-0000-0000-read', name: '阅读', createdAt: '2026-09-01' },
		{ id: 'habit-0000-0000-walk', name: 'Walk: 30 min', createdAt: '2026-09-15' },
	],
	records: {
		'2026-10-01': ['habit-0000-0000-read'],
		'2026-10-02': ['habit-0000-0000-read', 'habit-0000-0000-walk'],
	},
};

const expenses: ExpenseData = {
	version: 1,
	records: [
		{ id: 'exp-1', type: 'expense', amount: 32.5, category: 'food', note: '午饭 | 同事', date: '2026-10-01', createdAt: 1790000000000 },
		{ id: 'exp-2', type: 'income', amount: 1200, category: 'salary', date: '2026-10-01', createdAt: 1790000100000 },
		{ id: 'exp-3', type: 'expense', amount: 8, category: '咖啡', date: '2026-10-03', createdAt: 1790200000000 },
	],
	lastCategory: { expense: 'food', income: 'salary' },
	customCategories: { expense: ['咖啡'] },
	categoryOrder: { expense: ['咖啡', 'food'] },
	primaryCategories: { expense: ['日常'] },
	categoryParents: { expense: { 咖啡: '日常', food: '日常' } },
};

const pomodoro: PomodoroData = {
	version: 2,
	currentActivity: '写作',
	tags: [{ name: '写作', pinned: true }, { name: 'Review', pinned: false }],
	sessions: [
		{
			date: '2026-10-02',
			completed: 2,
			records: [
				{ timestamp: '2026-10-02T09:00:00.000Z', activity: '写作', duration: 25, interruptions: 1, breakMinutes: 5, breakCompleted: true },
				{ timestamp: '2026-10-02T10:00:00.000Z', activity: 'Review', duration: 20 },
			],
		},
	],
};

const reading: ReadingData = {
	activeBooks: [
		{ id: 'book-0000-0000-dune', title: 'Dune: Book 1', author: 'Frank Herbert', coverUrl: '', isbn: '9780441013593', source: 'manual', currentPage: 120, totalPages: 612, finished: false },
	],
	sessions: [
		{
			date: '2026-10-04',
			records: [
				{ timestamp: '2026-10-04T20:00:00.000Z', bookTitle: 'Dune: Book 1', bookAuthor: 'Frank Herbert', coverUrl: '', durationSeconds: 1800, isbn: '9780441013593', startPage: 100, endPage: 120, finished: false },
			],
		},
	],
};

const automations: DefinitionCollection = {
	definitions: [
		{
			id: 'auto-0000-0000-agent',
			name: '每日总结',
			enabled: true,
			deviceId: 'device-a',
			revision: 3,
			schedule: { kind: 'recurring', expression: '0 9 * * 1-5', start: Date.UTC(2026, 9, 1, 13), timezone: 'Asia/Shanghai' },
			action: { kind: 'agent', agentId: 'claude-code', cwd: '', prompt: 'Summarize yesterday.\n\n- tasks\n- notes', sessionMode: 'fresh' },
			channels: ['in-app'],
			notifyOn: 'failure',
			graceMinutes: 720,
			createdAt: 1790000000000,
			updatedAt: 1790000500000,
		},
		{
			id: 'auto-0000-0000-script',
			name: 'Backup',
			enabled: false,
			deviceId: 'device-a',
			revision: 1,
			schedule: { kind: 'once', at: Date.UTC(2026, 9, 10, 2) },
			action: { kind: 'script', script: 'echo "backup" | tee log.txt', cwd: '', shell: 'bash' },
			channels: ['in-app', 'system'],
			notifyOn: 'always',
			graceMinutes: 60,
			createdAt: 1790000000000,
			updatedAt: 1790000000000,
		},
		{
			id: 'auto-0000-0000-notify',
			name: 'Stand up',
			enabled: true,
			deviceId: 'device-b',
			revision: 1,
			schedule: { kind: 'manual' },
			action: { kind: 'notify', body: 'Stretch for five minutes.' },
			channels: ['in-app'],
			notifyOn: 'never',
			graceMinutes: 0,
			createdAt: 1790000000000,
			updatedAt: 1790000000000,
		},
	],
};

test('habit documents keep their paths, frontmatter and record tables', async () => {
	const { files, readBack } = await writeCollection(habitDocuments, habits);
	await expect(files).toMatchFileSnapshot(snapshot('habits.md'));
	assert.deepEqual(readBack, habits);
});

test('expense documents keep their paths, frontmatter and record tables', async () => {
	const { files, readBack } = await writeCollection(expenseDocuments, expenses);
	await expect(files).toMatchFileSnapshot(snapshot('expenses.md'));
	assert.deepEqual(readBack, expenses);
});

test('pomodoro documents keep their paths, frontmatter and record tables', async () => {
	const { files, readBack } = await writeCollection(pomodoroDocuments, pomodoro);
	await expect(files).toMatchFileSnapshot(snapshot('pomodoro.md'));
	assert.deepEqual(readBack, pomodoro);
});

test('reading documents keep their paths, frontmatter and record tables', async () => {
	const { files, readBack } = await writeCollection(readingDocuments, reading);
	await expect(files).toMatchFileSnapshot(snapshot('reading.md'));
	assert.deepEqual(readBack, reading);
});

test('automation definitions keep their paths, frontmatter and prompt/script sections', async () => {
	const { files, readBack } = await writeCollection(automationDocuments, automations);
	await expect(files).toMatchFileSnapshot(snapshot('automations.md'));
	assert.deepEqual(readBack, automations);
});

test('dashboard Markdown round-trips byte for byte and keeps its generated form', async () => {
	// The default board dates its first memo; pin the clock so the snapshot does not roll over at midnight.
	vi.useFakeTimers({ now: new Date(2026, 9, 6, 12), toFake: ['Date'] });
	let generatedDefault: string;
	try {
		generatedDefault = generateDefaultMarkdown();
	} finally {
		vi.useRealTimers();
	}
	const samples = {
		template: readFileSync(new URL('./dashboard-template.md', import.meta.url), 'utf8'),
		default: generatedDefault,
	};
	const generated: string[] = [];
	for (const [name, markdown] of Object.entries(samples)) {
		const data = parse(markdown);
		assert.equal(serialize(data), markdown, `${name} must round-trip unchanged`);
		generated.push(`=== ${name} ===\n${serialize({ ...data, document: undefined })}`);
	}
	await expect(generated.join('\n')).toMatchFileSnapshot(snapshot('dashboard.md'));
});

test('archive records keep their Markdown layout and parse back without errors', async () => {
	const record = (kind: 'person' | 'company', id: string, name: string, fields: Record<string, string> = {}): ArchiveRecord => {
		const value = newRecord(kind);
		value.id = id;
		Object.assign(value.fields, { name, ...fields });
		value.folderPath = `档案/${kind === 'person' ? '个人档案' : '企业档案'}/${name}`;
		value.path = `${value.folderPath}/基本信息.md`;
		return value;
	};
	const records = [record('person', 'person-0000-zhang', '张三', { region: '上海' }), record('company', 'company-0000-acme', 'Acme Ltd')];
	const files: string[] = [];
	for (const value of records) {
		const markdown = createMarkdown(value);
		const parsed = parseRecord(markdown, value.path);
		assert.ok(parsed);
		assert.deepEqual(parsed.errors, []);
		assert.equal(parsed.id, value.id);
		assert.deepEqual(parsed.fields, value.fields);
		files.push(`=== ${value.path} ===\n${markdown}`);
	}
	await expect(files.join('\n')).toMatchFileSnapshot(snapshot('archives.md'));
});
