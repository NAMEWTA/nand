import assert from 'node:assert/strict';
import { Notice, TFile, TFolder, type App } from 'obsidian';
import { NativeHistory } from '../src/platform/obsidian/ai-vault/service';
import { HistorySidebar } from '../src/view/terminal/workbench';
import type { NativeSession } from '../src/platform/terminal-server/agent-data-client';
import type { WorkbenchHost } from '../src/view/terminal/host';
import { parseHTML } from 'linkedom';
import { h, render } from 'preact';
import { TerminalWorkbench } from '../src/view/terminal/TerminalWorkbench';
import { InboxPanel } from '../src/view/notifications/InboxPanel';
import type { NotificationRecord } from '../src/core/notifications/service';
import { onLeafLanguageChanged } from '../src/platform/obsidian/workspace-title';
import { setLanguage, t } from '../src/shared/i18n';

const { document } = parseHTML('<html><body></body></html>');
Object.assign(globalThis, { document });
const left = document.createElement('div');
const right = document.createElement('div');
document.body.append(left, right);
let searches = 0,
	previous = 0,
	next = 0,
	closed = 0;
let terminal: HTMLDivElement | null = null;
let input: HTMLInputElement | null = null;
const refs = {
	terminalRef: (node: HTMLDivElement | null) => {
		terminal = node;
	},
	inputRef: (node: HTMLInputElement | null) => {
		input = node;
	},
	searchRef: () => {},
};
const actions = {
	search: () => {
		searches++;
	},
	previous: () => {
		previous++;
	},
	next: () => {
		next++;
	},
	closeSearch: () => {
		closed++;
	},
};
const row: NotificationRecord = {
	id: 'one',
	title: 'One',
	body: 'Content',
	createdAt: 0,
	read: false,
	channels: [],
	deliveries: {},
};
const read: string[] = [];
function inbox(id: string) {
	return h(InboxPanel, {
		records: [row],
		unread: 1,
		markRead: () => {
			read.push(id);
		},
		clearRead: () => {},
		open: () => {},
	});
}
render(h(TerminalWorkbench, { ...refs, ...actions, sessions: inbox('left') }), left);
render(inbox('right'), right);
const xtermHost = left.querySelector('.terminal-container')!;
assert.equal(terminal, xtermHost);
const xtermOwnedChild = document.createElement('canvas');
xtermHost.appendChild(xtermOwnedChild);
const search = left.querySelector<HTMLInputElement>('input')!;
assert.equal(input, search);
search.value = 'needle';
search.dispatchEvent(new document.defaultView!.Event('input', { bubbles: true }));
assert.equal(searches, 1);
for (const button of Array.from(left.querySelectorAll<HTMLButtonElement>('.terminal-search-btn'))) button.click();
assert.deepEqual([previous, next, closed], [1, 1, 1]);
render(
	h(TerminalWorkbench, { ...refs, ...actions, sessions: inbox('updated'), usage: h('span', {}, 'Updated quota') }),
	left,
);
assert.equal(left.querySelector('.terminal-container'), xtermHost, 'workbench refresh preserves the xterm island');
assert.equal(xtermHost.firstChild, xtermOwnedChild, 'Preact does not replace xterm-owned content');
assert.equal(left.querySelector('input'), search, 'search focus target survives data refresh');
assert.equal(search.value, 'needle');
setLanguage('zh');
let header = '', headerUpdates = 0, mainUpdates = 0, popoutUpdates = 0;
const mainContainer = {};
const nativeContainer = document.createElement('div');
const nativeHeader = document.createElement('div');
nativeHeader.className = 'view-header-title';
nativeContainer.appendChild(nativeHeader);
const popoutContainer = { updateTitle: () => { popoutUpdates++; } };
let owner = mainContainer;
const nativeLeaf = {
	view: { containerEl: nativeContainer, getDisplayText: () => t('automation.title') },
	getContainer: () => owner,
	updateHeader: () => { header = t('automation.title'); headerUpdates++; },
};
const nativeApp = { workspace: { rootSplit: mainContainer, updateTitle: () => { mainUpdates++; } } };
const offLanguage = onLeafLanguageChanged(nativeApp as never, nativeLeaf as never, () => {
	render(h(TerminalWorkbench, { ...refs, ...actions, sessions: inbox('updated'), usage: t('automation.title') }), left);
});
for (const language of ['en', 'zh', 'zh'] as const) {
	setLanguage(language);
	assert.equal(header, t('automation.title'));
	assert.equal(nativeHeader.textContent, t('automation.title'), 'The pane header and tab both update');
	assert.equal(left.querySelector('.terminal-container'), xtermHost);
	assert.equal(xtermHost.firstChild, xtermOwnedChild, 'Language changes must not remount the native terminal');
	assert.equal(left.querySelector('input'), search);
	assert.equal(search.value, 'needle', 'Language repaint retains the current search input');
}
assert.equal(headerUpdates, 2, 'Same-language updates are idempotent');
assert.equal(mainUpdates, 2);
owner = popoutContainer;
setLanguage('en');
assert.equal(popoutUpdates, 1, 'A migrated leaf refreshes the current host window');
assert.equal(mainUpdates, 2, 'Popout refresh does not alter the main window title');
offLanguage();
setLanguage('zh');
assert.equal(headerUpdates, 3, 'Closed views release both repaint and header subscriptions');
left.querySelector<HTMLButtonElement>('.nand-agent-sidebar button')!.click();
right.querySelector<HTMLButtonElement>('button')!.click();
assert.deepEqual(read, ['updated', 'right'], 'composed instances dispatch to their own hosts');
render(null, left);
assert.equal(terminal, null, 'unmount releases native island refs');
assert.equal(left.childNodes.length, 0);
assert.ok(right.textContent?.includes('One'), 'unmounting a workbench leaves separately composed panels alive');
render(null, right);
console.log('Panel composition: independent actions, persistent xterm island/search, clean unmount passed.');

async function verifyExports() {
	const files = new Map<string, TFile | TFolder>(), contents = new Map<string, string>();
	const metadata = new Map<string, string>();
	const opened: TFile[] = [];
	let failRead = false, failWrite = false, failOpen = false, gate: Promise<void> | undefined;
	const app = {
		loadLocalStorage: () => 'export-test',
		vault: {
			adapter: {
				exists: async (path: string) => metadata.has(path), read: async (path: string) => metadata.get(path)!,
				mkdir: async (path: string) => { metadata.set(path, ''); },
				write: async (path: string, text: string) => { metadata.set(path, text); },
			},
			getAbstractFileByPath: (path: string) => files.get(path) ?? null,
			createFolder: async (path: string) => {
				await Promise.resolve();
				if (files.has(path)) throw Error('exists');
				files.set(path, Object.assign(new TFolder(), { path }));
			},
			create: async (path: string, text: string) => {
				await Promise.resolve();
				if (failWrite) throw Error('disk full');
				if (files.has(path)) throw Error('exists');
				const file = Object.assign(new TFile(), { path });
				files.set(path, file); contents.set(path, text); return file;
			},
		},
		workspace: { getLeaf: (mode: string) => {
			assert.equal(mode, 'tab');
			return { openFile: async (file: TFile) => { if (failOpen) throw Error('leaf unavailable'); opened.push(file); } };
		} },
	} as unknown as App;
	const history = new NativeHistory(app, {} as never, () => ({} as never), '');
	const session = { key: 'one', agentId: 'co/dex', sessionId: '../a:b\\c?*', title: 'Selected history', text: '', modifiedAtMs: 0 } as NativeSession;
	const transcript = 'user: keep original 中文\n\nassistant: ```code```';
	history.read = async (row) => { if (gate) await gate; if (failRead) throw Error('source unavailable'); return { ...row, text: transcript }; };
	history.scan = async () => [];
	history.query = async () => ({ rows: [session], total: 1 } as never);
	await history.update(session.key, { title: 'My custom title 中文' });
	const results = await Promise.all([history.export(session), history.export(session), history.export(session)]);
	assert.equal(new Set(results.map((file) => file.path)).size, 3, 'Concurrent exports claim unique paths');
	for (const file of results) {
		assert.ok(file instanceof TFile);
		assert.match(file.path, /^NAND Exports\/[a-zA-Z0-9_() -]+\.md$/);
		assert.equal(contents.get(file.path), `# My custom title 中文\n\n${transcript}`);
	}
	const firstBytes = contents.get(results[0]!.path);
	for (const language of ['en', 'zh'] as const) {
		setLanguage(language);
		failRead = true;
		await assert.rejects(history.export(session), new RegExp(language === 'en' ? 'Could not read' : '无法读取'));
		failRead = false; failWrite = true;
		await assert.rejects(history.export(session), new RegExp(language === 'en' ? 'Could not save' : '无法保存'));
		failWrite = false;
	}
	assert.equal(contents.size, 3, 'Read/write failures never publish a file');
	assert.equal(contents.get(results[0]!.path), firstBytes, 'Existing files are not overwritten');
	files.set('NAND Exports', Object.assign(new TFile(), { path: 'NAND Exports' }));
	await assert.rejects(history.export(session), /不是文件夹/);
	files.set('NAND Exports', Object.assign(new TFolder(), { path: 'NAND Exports' }));

	const panel = document.createElement('div'); document.body.appendChild(panel);
	const host = { app } as WorkbenchHost;
	const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 100));
	const notices = (Notice as unknown as { messages: string[] }).messages;
	render(h(HistorySidebar, { history, host }), panel); await wait();
	panel.querySelector<HTMLButtonElement>('.nand-history-row button')!.click(); await wait();
	const preview = panel.querySelector('.nand-history-preview pre')!.textContent;
	const exportButton = () => Array.from(panel.querySelectorAll<HTMLButtonElement>('.nand-history-actions button')).find((button) => button.textContent === t('terminalAgent.workbench.export'))!;
	let release!: () => void;
	gate = new Promise<void>((resolve) => { release = resolve; });
	exportButton().click(); exportButton().click(); await wait();
	assert.equal(exportButton().disabled, true);
	assert.equal(opened.length, 0);
	release(); gate = undefined; await wait();
	assert.equal(opened.length, 1, 'Rapid repeat clicks export and open only once');
	assert.ok(notices.at(-1)!.startsWith('已导出并打开：NAND Exports/'));
	assert.equal(contents.size, 4);
	for (const language of ['en', 'zh'] as const) {
		setLanguage(language); render(h(HistorySidebar, { history, host }), panel);
		failRead = true; exportButton().click(); await wait();
		assert.match(notices.at(-1)!, new RegExp(language === 'en' ? 'Could not read' : '无法读取'));
		failRead = false; failWrite = true; exportButton().click(); await wait();
		assert.match(notices.at(-1)!, new RegExp(language === 'en' ? 'Could not save' : '无法保存'));
		failWrite = false;
		assert.equal(panel.querySelector('.nand-history-preview pre')!.textContent, preview, 'Failures preserve the current preview');
		assert.equal(opened.length, 1);
		assert.equal(contents.size, 4);
	}
	failOpen = true; exportButton().click(); await wait();
	assert.match(notices.at(-1)!, /笔记已保存到 NAND Exports\/.*但无法打开/);
	assert.equal(contents.size, 5, 'An open failure retains the successfully saved note');
	assert.equal(opened.length, 1);
	render(null, panel);
	console.log('History export: visible Vault files, concurrent collisions, safe names, content, localized failures and actual sidebar open/pending behavior passed.');
}
void verifyExports().catch((error) => { console.error(error); process.exitCode = 1; });
