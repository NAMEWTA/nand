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
import { upsertMaterial } from '../../src/modules/news/core/materials';
import { favoriteMaterial, refreshEditionNote, serializeEdition, serializeMaterial } from '../../src/modules/news/platform/notes';
import type { NewsEdition } from '../../src/modules/news/core/model';
import { messages as newsMessages } from '../../src/modules/news/i18n';
import { getLanguage, registerMessages, setLanguage } from '../../src/shared/i18n';
import { emptyPipeline } from '../../src/modules/home/core/pipeline/model';
import { patchPipelineFields } from '../../src/modules/home/platform/pipeline/vault';
import { normalizeDashboardSettings } from '../../src/modules/home/core/board/settings';
import { newsSettings } from '../../src/modules/news/settings';

test('news widget instances persist independent view, count, summary and stale configuration', async () => {
	const widgets = [
		{ id: 'hot-main', mode: 'hot', name: 'Top events', count: 5, showSummary: false, staleMinutes: 30 },
		{ id: 'view-one', mode: 'view', name: 'Research', viewId: 'research-view', count: 3, showSummary: true, staleMinutes: 120 },
		{ id: 'view-two', mode: 'view', name: '', viewId: 'tools-view', count: 8, showSummary: false, staleMinutes: 60 },
	];
	const saved = newsSettings.normalize({ widgets }).widgets;
	assert.deepEqual(saved, widgets);
	const serialized = JSON.stringify({ widgets: saved }, null, 2) + '\n';
	await expect(serialized).toMatchFileSnapshot(snapshot('news-widget-settings.json'));
	assert.deepEqual(newsSettings.normalize(JSON.parse(serialized)).widgets, widgets);
});
import { editImageFocal } from '../../src/modules/home/core/board/focal-point';
import { homeSettings } from '../../src/modules/home/settings';

const snapshot = (name: string) => fileURLToPath(new URL(`./__snapshots__/${name}`, import.meta.url));

test('named appearances persist only global theme and Home decoration', async () => {
	const stored = homeSettings.normalize({ appearancePresets: [{ id: 'evening', name: 'Evening',
		theme: { preset: 'eye-care', headings: 'accented', emphasis: 'highlight', accentLight: '#275c3a', accentDark: '#99d6ab', lineHeight: 1.9 },
		home: { bgImage: 'Images/bg.svg', bgDim: 33, bgBlur: 3, bgSize: 'contain', bgFocal: { x: 22, y: 77 }, surfaceOpacity: 75, glassBlur: 6, radiusScale: 19, fontScale: 'large', dashboardFile: 'excluded' },
	}], activeAppearancePresetId: 'evening' });
	const value = { appearancePresets: stored.appearancePresets, activeAppearancePresetId: stored.activeAppearancePresetId };
	const serialized = JSON.stringify(value, null, 2) + '\n';
	await expect(serialized).toMatchFileSnapshot(snapshot('appearance-settings.json'));
	assert.deepEqual(homeSettings.normalize(JSON.parse(serialized)).appearancePresets, value.appearancePresets);
});

test('image focal points persist independently without replacing other raw values or legacy card prose', async () => {
	const original = '---\nbanner:\n  image: Images/A.svg\n  images: [Images/A.svg, Images/B.svg]\n  imagePos:\n    Images/B.svg: "invalid" # author\ncustom: keep\n---\n## Projects\n### Cover\ncover: Images/A.svg\nAuthor paragraph.\n';
	const board = parse(original);
	board.banner.imagePos = editImageFocal(board.banner.imagePos, 'Images/A.svg', { x: 20, y: 80 });
	board.columns[0]!.cards[0]!.coverPos = '70,30';
	const text = serialize(board);
	await expect(text).toMatchFileSnapshot(snapshot('board-image-focal.md'));
	const restored = parse(text);
	assert.deepEqual(restored.banner.imagePos, { 'Images/B.svg': 'invalid', 'Images/A.svg': '20,80' });
	assert.equal(restored.columns[0]!.cards[0]!.coverPos, '70,30');
	assert.equal(serialize(restored), text);
});

test('anniversary settings retain real solar instants and optional lunar recurrence', async () => {
	const anniversaries = [
		{ id: 'solar', label: 'Solar', startDate: '2020-02-29T12:34:56', precision: 'hours', annualReminder: true },
		{ id: 'lunar', label: 'Lunar', startDate: '2020-05-24T12:34:56.123+08:00', calendar: 'lunar', precision: 'ymd', annualReminder: true },
	];
	const normalized = normalizeDashboardSettings({ anniversaries }).anniversaries;
	const serialized = JSON.stringify(normalized, null, 2) + '\n';
	await expect(serialized).toMatchFileSnapshot(snapshot('anniversary-settings.json'));
	assert.deepEqual(normalizeDashboardSettings({ anniversaries: JSON.parse(serialized) }).anniversaries, anniversaries);
});

test('multi-template library and folder lists preserve order and explicit blank choices', async () => {
	const original = '---\ncustom: keep # author\ncolumns: [{name: Library, type: library, library: {filters: [], templatePath: Templates/Old.md}}, {name: Folder, type: folder, library: {filters: [], folders: [Work], templatePath: Templates/Old.md}}]\n---\n## Library\nAuthor prose.\n\n## Folder\n';
	const board = parse(original);
	board.columns[0]!.libraryConfig!.templatePaths = ['Templates/B.md', 'Templates/A.md'];
	board.columns[0]!.libraryConfig!.templatePath = 'Templates/B.md';
	board.columns[1]!.libraryConfig!.templatePaths = [];
	board.columns[1]!.libraryConfig!.templatePath = undefined;
	const text = serialize(board);
	await expect(text).toMatchFileSnapshot(snapshot('board-multi-templates.md'));
	assert.deepEqual(parse(text).columns.map(column => column.libraryConfig!.templatePaths), [['Templates/B.md', 'Templates/A.md'], []]);
	assert.equal(serialize(parse(text)), text);
});

test('table preferences preserve separate section order and hidden fields', async () => {
	const board = parse('---\ncustom: keep # author\ncolumns: [{name: One, type: library, library: {filters: [], visibleProperties: [owner]}}, {name: Two, type: folder, library: {filters: [], folders: [Work]}}]\n---\n## One\nAuthor prose.\n\n## Two\n');
	Object.assign(board.columns[0]!.libraryConfig!, { tableOrder: ['property:owner', 'file.name', 'property:missing', 'file.modified'], tableHidden: ['property:missing'] });
	Object.assign(board.columns[1]!.libraryConfig!, { tableOrder: ['file.modified', 'file.name'], tableHidden: ['file.modified'] });
	const text = serialize(board);
	await expect(text).toMatchFileSnapshot(snapshot('board-table-columns.md'));
	assert.deepEqual(parse(text).columns.map(column => column.libraryConfig!.tableOrder), board.columns.map(column => column.libraryConfig!.tableOrder));
	assert.equal(serialize(parse(text)), text);
});

test('workflow board preserves its scope, stages, preferences and scoped skills', async () => {
	const board = parse('---\ncustom: keep # author\ncolumns: [{id: flow, name: Workflow, type: pipeline}]\n---\n## Workflow\nMy workflow notes.\n');
	board.columns[0]!.pipelineConfig = { ...emptyPipeline(), rootFolder: 'Work', statusField: 'state', stages: [{ id: 'draft', value: 'Draft', label: 'Draft', width: 300 }, { id: 'review', value: 'Review', label: 'Review', folder: 'Review', width: 420 }],
		excludeFolders: ['Work/Templates'], archiveFolder: 'Archive', templatePaths: ['Templates/Article.md'], sortBy: 'due', sortDesc: false, filterFields: ['channel'], filters: { channel: 'local' }, search: 'Article',
		skills: [{ id: 'column-review', label: 'Review column', scope: 'stage', stages: ['Review'], agentId: 'codex', skillName: 'review', promptTemplate: '{{stage}}\n{{paths}}', directSend: false, destination: { kind: 'fresh', cwd: '' } }],
	};
	const text = serialize(board);
	await expect(text).toMatchFileSnapshot(snapshot('board-pipeline.md'));
	assert.deepEqual(parse(text).columns[0]!.pipelineConfig, board.columns[0]!.pipelineConfig);
	assert.equal(serialize(parse(text)), text);
});

test('workflow note reminder uses the existing definition format and retains author text', async () => {
	const note = '---\nstatus: Draft # author\ncustom: keep\n---\n# Article\n- [ ] Review it\n';
	const saved = patchPipelineFields(note, { due: '2030-01-02 10:30', remind: true, nandAutomation: {
		id: 'pipeline:note-reminder', name: 'Article', deviceId: 'device-fixture', enabled: true, revision: 1,
		schedule: { kind: 'once', at: 1893580200000 }, action: { kind: 'notify', body: 'Article' }, channels: ['in-app'], notifyOn: 'always', graceMinutes: 720, createdAt: 1, updatedAt: 1,
	} });
	await expect(saved).toMatchFileSnapshot(snapshot('pipeline-note.md'));
	assert.equal(patchPipelineFields(saved, { due: undefined, remind: undefined, nandAutomation: undefined }), note);
});

test('board skills persist each button destination and direct-send choice', async () => {
	const data = parse('---\ncustom: keep # author\n---\n\n<!-- My notes -->\n');
	data.skills = [
		{ id: 'fresh-review', label: 'Review', icon: 'sparkles', agentId: 'codex', skillName: 'review', promptTemplate: '  {{path}}\n{{input}}\n', inputPlaceholder: 'What matters?', directSend: false, destination: { kind: 'fresh', cwd: '' } },
		{ id: 'existing-plugin', label: '检查', agentId: 'claude-code', skillName: 'plugin:check', promptTemplate: '{{paths}}', directSend: true, destination: { kind: 'existing', sessionId: 'remembered-session' } },
	];
	const text = serialize(data);
	await expect(text).toMatchFileSnapshot(snapshot('board-skills.md'));
	assert.deepEqual(parse(text).skills, data.skills);
	assert.equal(serialize(parse(text)), text);
});

test('news daily edition keeps local boundaries, citations and reader-owned annotations', async () => {
	const language = getLanguage(); registerMessages(newsMessages); setLanguage('zh');
	try {
		const material = await upsertMaterial(undefined, { sourceId: 'example', url: 'https://example.com/story', title: '模型发布', summary: '官方公布模型。', publishedAt: Date.UTC(2026, 9, 9, 4) }, Date.UTC(2026, 9, 9, 5));
		const edition: NewsEdition = { id: 'edition-2026-10-09', date: '2026-10-09', startAt: Date.UTC(2026, 9, 8, 16), endAt: Date.UTC(2026, 9, 9, 16), timeZone: 'Asia/Shanghai', offsetMinutes: -480, generatedAt: Date.UTC(2026, 9, 9, 6),
			main: [{ materialId: material.id, storyId: 'event-one', occurrenceIds: ['occ-one'], relatedIds: [], sourceIds: ['example'], participants: 3, official: true, importance: 95, followUp: '2026-10-08' }], flashes: [], materialIds: [material.id], storyIds: ['event-one'] };
		const markdown = serializeEdition(edition, [material], [], []);
		await expect(markdown).toMatchFileSnapshot(snapshot('news-edition.md'));
		const custom = markdown.replace('---\n', '---\nreader: keep # comment\n') + '\n## 我的批注\n明天再看\n';
		const next = refreshEditionNote(custom, edition, [{ ...material, summary: '更新的短摘要。' }], [], []);
		assert.match(next, /reader: keep # comment/); assert.match(next, /明天再看/); assert.match(next, /更新的短摘要/);
	} finally { setLanguage(language); }
});

test('news favorites keep visible Markdown identity, source metadata, excerpt and reader annotation', async () => {
	const language = getLanguage();
	registerMessages(newsMessages);
	setLanguage('zh');
	try {
		const material = await upsertMaterial(undefined, { sourceId: 'example', sourceItemId: 'article-1', url: 'https://example.com/news?topic=ai', title: '新闻: 示例', summary: '摘要，不转载全文。', publishedAt: Date.UTC(2026, 9, 9, 12) }, Date.UTC(2026, 9, 9, 13));
		const markdown = serializeMaterial(material, '我的想法\n\n- 后续跟进');
		await expect(markdown).toMatchFileSnapshot(snapshot('news-favorite.md'));
		assert.equal(favoriteMaterial(markdown)?.id, material.id);
	} finally { setLanguage(language); }
});

/** Writes `data` through the production Markdown collection storage; returns every file it created plus what a restart reads back. */
async function writeCollection<T>(codec: DocumentCollectionCodec<T>, data: T): Promise<{ files: string; readBack: T }> {
	const vault = memoryVault();
	const writer = new MarkdownCollectionStorage(vault.app, codec, 'data.json');
	await writer.read('data.json');
	await writer.write('data.json', JSON.stringify(data));
	writer.dispose();
	const files = [...vault.contents.entries()]
		.filter(([path]) => path.endsWith('.md'))
		.sort(([a], [b]) => a.localeCompare(b, 'en'))
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
