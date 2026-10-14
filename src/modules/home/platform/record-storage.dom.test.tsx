import { afterEach, expect, test, vi } from 'vitest';
import { memoryVault } from '../../../../scripts/fixtures/memory-vault';
import { DEFAULT_DASHBOARD_SETTINGS } from '../core/board/types/model';
import type { WidgetSettingsHost } from './widget-settings-host';
import { HabitService } from './habit/habit-service';
import { ExpenseService } from './expense/expense-service';
import { PomodoroService } from './pomodoro/pomodoro-service';
import { ReadingService } from './reading/reading-service';
vi.mock('./audio/chime', () => ({ playDing: vi.fn(), unlockChime: vi.fn() }));
const active: { destroy(): void }[] = [];
afterEach(() => {
	for (const s of active.splice(0)) s.destroy();
	vi.useRealTimers();
});
async function fixture(initial: Record<string, string> = {}) {
	const vault = memoryVault(initial, window),
		container = Object.assign(document.createElement('div'), { win: window });
	Object.assign(vault.app.workspace, { containerEl: container, onLayoutReady: (fn: () => void) => fn() });
	const host = {
		app: vault.app,
		settings: structuredClone(DEFAULT_DASHBOARD_SETTINGS),
		saveSettings: async () => {},
	} as unknown as WidgetSettingsHost;
	const habit = new HabitService(host),
		expense = new ExpenseService(host),
		pomodoro = new PomodoroService(host),
		reading = new ReadingService(host);
	active.push(habit, expense, pomodoro, reading);
	await Promise.all([habit.load(), expense.load(), pomodoro.loadSessions(), reading.loadSessions()]);
	return { vault, habit, expense, pomodoro, reading };
}
test('production services write Apex JSON in the four content folders and leave legacy Markdown intact', async () => {
	vi.useFakeTimers({ now: new Date('2026-10-14T12:00:00'), toFake: ['Date'] });
	const old = '.nand/content/NAND/习惯/旧数据/习惯.md',
		f = await fixture({ [old]: 'legacy untouched' });
	const h = f.habit.addHabit('Read')!;
	f.habit.toggle(h.id);
	f.expense.addRecord({ type: 'expense', amount: 12.5, category: 'food', date: '2026-10-14', note: 'Lunch' });
	f.pomodoro.setActivity('Writing');
	await f.reading.addActiveBook({
		title: 'Book',
		author: 'Author',
		coverUrl: '',
		isbn: '',
		source: 'manual',
		currentPage: 0,
		totalPages: 120,
		finished: false,
	});
	await Promise.all([f.habit.flush(), f.expense.flush(), f.pomodoro.flush(), f.reading.flush()]);
	const read = (path: string) => JSON.parse(f.vault.contents.get('.nand/content/NAND/' + path)!);
	expect(read('习惯/habits.json')).toEqual({ version: 1, habits: [h], records: { '2026-10-14': [h.id] } });
	expect(read('记账/expense.json')).toEqual({
		version: 1,
		records: [
			expect.objectContaining({
				type: 'expense',
				amount: 12.5,
				category: 'food',
				date: '2026-10-14',
				note: 'Lunch',
			}),
		],
		lastCategory: { expense: 'food' },
	});
	expect(read('番茄钟/pomodoro.json')).toEqual({
		version: 2,
		currentActivity: 'Writing',
		tags: expect.any(Array),
		sessions: [],
	});
	expect(read('阅读/reading.json')).toEqual({
		activeBooks: [
			{
				title: 'Book',
				author: 'Author',
				coverUrl: '',
				isbn: '',
				source: 'manual',
				currentPage: 0,
				totalPages: 120,
				finished: false,
			},
		],
		sessions: [],
	});
	expect(f.vault.contents.get(old)).toBe('legacy untouched');
	expect([...f.vault.contents.keys()].filter((p) => p.endsWith('.md'))).toEqual([old]);
	const restored = await fixture(Object.fromEntries(f.vault.contents));
	expect(restored.habit.getHabits()).toEqual([h]);
	expect(restored.expense.getRecords()[0]?.amount).toBe(12.5);
	expect(restored.reading.getActiveBooks()[0]?.title).toBe('Book');
});
test('unreadable Apex JSON is retained and unsaved changes are reported', async () => {
	const path = '.nand/content/NAND/记账/expense.json',
		f = await fixture({ [path]: '{broken' });
	expect(f.expense.saveState.error).toBeTruthy();
	f.expense.addRecord({ type: 'expense', amount: 10, category: 'food', date: '2026-10-14' });
	await expect(f.expense.flush()).rejects.toThrow();
	expect(f.vault.contents.get(path)).toBe('{broken');
	expect(f.expense.saveState.status).not.toBe('saved');
});

const expensePath = '.nand/content/NAND/记账/expense.json';
const entry = (id: string, amount = 10) => ({ id, type: 'expense', amount, category: 'food', date: '2026-10-14', createdAt: 1 });
const data = (records: ReturnType<typeof entry>[]) => JSON.stringify({ version: 1, records, lastCategory: {} });

// Inject after the service's load/read but before the native atomic callback.
// Competing writers participate in adapter.process, as Obsidian's adapter requires.
test('production JSON merges concurrent additions/deletions at commit time across service instances', async () => {
	const f = await fixture({ [expensePath]: data([entry('removed'), entry('retained')]) });
	const nativeProcess = f.vault.adapter.process;
	let injected = false;
	f.vault.adapter.process = async (path, update) => {
		if (path === expensePath && !injected) {
			injected = true;
			await nativeProcess(path, () => data([entry('retained'), entry('external')]));
		}
		return nativeProcess(path, update);
	};
	f.expense.addRecord({ type: 'expense', amount: 20, category: 'food', date: '2026-10-14' });
	await f.expense.flush();
	const stored = JSON.parse(f.vault.contents.get(expensePath)!);
	expect(stored.records.map((r: { id: string }) => r.id)).toEqual(expect.arrayContaining(['external', 'retained']));
	expect(stored.records).toHaveLength(3);
	expect(stored.records.some((r: { id: string }) => r.id === 'removed')).toBe(false);
	expect(f.expense.saveState.status).toBe('saved');
});

test('production JSON preserves a same-field concurrent conflict and the local recovery draft', async () => {
	const f = await fixture({ [expensePath]: data([entry('same')]) });
	const nativeProcess = f.vault.adapter.process;
	let injected = false;
	f.vault.adapter.process = async (path, update) => {
		if (path === expensePath && !injected) {
			injected = true;
			await nativeProcess(path, () => data([entry('same', 30)]));
		}
		return nativeProcess(path, update);
	};
	f.expense.updateRecord('same', { amount: 20 });
	await expect(f.expense.flush()).rejects.toThrow();
	expect(JSON.parse(f.vault.contents.get(expensePath)!).records[0].amount).toBe(30);
	expect(f.expense.getRecords()[0]?.amount).toBe(20);
	expect(f.expense.saveState.status).toBe('conflict');
	const recovery = [...f.vault.contents].find(([path]) => path.startsWith('.nand/recovery/drafts/'));
	expect(JSON.parse(recovery![1]).draft.records[0].amount).toBe(20);
});

test('two independently loaded production services serialize their JSON updates', async () => {
	const f = await fixture({ [expensePath]: data([]) });
	const other = new ExpenseService({ app: f.vault.app, settings: structuredClone(DEFAULT_DASHBOARD_SETTINGS) } as unknown as WidgetSettingsHost);
	active.push(other); await other.load();
	f.expense.addRecord({ type: 'expense', amount: 11, category: 'food', date: '2026-10-14' });
	other.addRecord({ type: 'expense', amount: 22, category: 'food', date: '2026-10-14' });
	await Promise.all([f.expense.flush(), other.flush()]);
	expect(JSON.parse(f.vault.contents.get(expensePath)!).records.map((r: { amount: number }) => r.amount).sort()).toEqual([11, 22]);
});

test('all four JSON services observe external create, modify and delete through the managed content index', async () => {
	const { contentFiles } = await import('../../../host/obsidian/storage/content-files');
	const f = await fixture();
	const book = (title: string) => ({ title, author: '', coverUrl: '', isbn: '', source: 'manual', currentPage: 0, totalPages: 100, finished: false });
	const cases = [
		{ path: '习惯/habits.json', data: (name: string) => ({ version: 1, habits: [{ id: 'h', name, createdAt: '2026-10-14' }], records: {} }), current: () => f.habit.getHabits()[0]?.name, flush: () => f.habit.flush(), empty: undefined },
		{ path: '记账/expense.json', data: (note: string) => ({ version: 1, records: [{ ...entry('e'), note }], lastCategory: {} }), current: () => f.expense.getRecords()[0]?.note, flush: () => f.expense.flush(), empty: undefined },
		{ path: '番茄钟/pomodoro.json', data: (currentActivity: string) => ({ version: 2, currentActivity, tags: [], sessions: [] }), current: () => f.pomodoro.getActivity(), flush: () => f.pomodoro.flush(), empty: '' },
		{ path: '阅读/reading.json', data: (title: string) => ({ activeBooks: [book(title)], sessions: [] }), current: () => f.reading.getActiveBooks()[0]?.title, flush: () => f.reading.flush(), empty: undefined },
	];
	for (const c of cases) {
		const path = '.nand/content/NAND/' + c.path;
		for (const name of ['External create', 'External edit']) {
			await f.vault.adapter.write(path, JSON.stringify(c.data(name)));
			await contentFiles(f.vault.app).refresh(); await c.flush();
			await vi.waitFor(() => expect(c.current()).toBe(name));
		}
		await f.vault.adapter.remove(path); await contentFiles(f.vault.app).refresh(); await c.flush();
		await vi.waitFor(() => expect(c.current()).toBe(c.empty));
	}
});
