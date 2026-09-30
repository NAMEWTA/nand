import { AutomationsPanel } from '../src/view/automations/AutomationsPanel';
import type { AutomationViewHost } from '../src/view/automations/panel-contract';
import type { AutomationDefinition } from '../src/shared/automation/types';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Notice, TFile, TFolder, type App } from 'obsidian';
import { NativeHistory } from '../src/platform/obsidian/ai-vault/service';
import { HistoryPreview, HistorySidebar, NewConversationButton, SessionSidebar, TerminalHeader, UsageFooter } from '../src/view/terminal/workbench';
import { createWorkbenchState, sidebarWidth, type WorkbenchState } from '../src/view/terminal/workbench-state';
import { DEFAULT_AGENT_SETTINGS } from '../src/core/agent-launch/defaults';
import { DEFAULT_TERMINAL_SETTINGS } from '../src/core/pty/settings';
import { refreshRegisteredUsage, registerOrca, type OrcaPluginHost } from '../src/plugin/modules/agents/register';
import type { PtySession } from '../src/platform/desktop/terminal/pty-session';
import type { TerminalService } from '../src/platform/desktop/terminal/terminal-service';
import { UsageModal } from '../src/view/agent-usage/usage-modal';
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
	state: createWorkbenchState(),
	onStateChange: () => {},
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
left.querySelector<HTMLButtonElement>('.nand-agent-session-controls button')!.click();
right.querySelector<HTMLButtonElement>('button')!.click();
assert.deepEqual(read, ['updated', 'right'], 'composed instances dispatch to their own hosts');
render(null, left);
assert.equal(terminal, null, 'unmount releases native island refs');
assert.equal(left.childNodes.length, 0);
assert.ok(right.textContent?.includes('One'), 'unmounting a workbench leaves separately composed panels alive');
render(null, right);
console.log('Panel composition: independent actions, persistent xterm island/search, clean unmount passed.');

function mountHistoryPanel(panel: HTMLElement, history: NativeHistory, host: WorkbenchHost) {
	const state = createWorkbenchState(); state.navigation = 'history';
	const change = (patch: Partial<WorkbenchState>) => { Object.assign(state, patch); paint(); };
	const paint = () => render(h('div', {},
		h(HistorySidebar, { history, host, state, onStateChange: change }),
		h(HistoryPreview, { history, host, state, onStateChange: change }),
	), panel);
	paint();
	return { state, paint };
}

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
	const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 240));
	const notices = (Notice as unknown as { messages: string[] }).messages;
	const previewPanel = mountHistoryPanel(panel, history, host); await wait();
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
		setLanguage(language); previewPanel.paint();
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
void verifyExports().then(verifyHistoryMatrix).then(verifySessionIdentity).then(verifyUsageLanguage).then(verifyAutomationFilters).then(verifyOrcaRegression).catch((error) => { console.error(error); process.exitCode = 1; });

async function verifySessionIdentity() {
	const panel = document.createElement('div'); document.body.appendChild(panel);
	const first = { id: 'terminal-12345678-aaaa', getTitle: () => 'Same Terminal', getCwd: () => '/vault', nativeStatus: 'unknown' } as PtySession;
	const second = { id: 'terminal-abcdef01-bbbb', getTitle: () => 'Same Terminal', getCwd: () => '/vault', nativeStatus: 'unknown' } as PtySession;
	let sessions = [first, second], selected: PtySession | undefined, redraw = () => {}, unsubscribed = 0;
	const service = {
		getAllTerminals: () => sessions,
		subscribe: (listener: () => void) => { redraw = listener; return () => { unsubscribed++; }; },
	} as unknown as TerminalService;
	const host = { settings: { agentSettings: { agents: {} }, presetScripts: [] } } as unknown as WorkbenchHost;
	const state = createWorkbenchState();
	const paint = () => render(h(SessionSidebar, { host, service, state, onStateChange: (patch) => { Object.assign(state, patch); paint(); }, active: selected?.id ?? first.id, select: (session) => { selected = session; }, close: async () => {} }), panel);
	const buttons = () => Array.from(panel.querySelectorAll<HTMLButtonElement>('.nand-session-row > button:first-child'));
	const sessionId = (button: HTMLButtonElement) => button.dataset.terminalId ?? '';
	const css = readFileSync(join(process.cwd(), 'styles.css'), 'utf8');
	const rule = (selector: string) => {
		const at = css.indexOf(selector);
		assert.ok(at >= 0, selector);
		return css.slice(at, css.indexOf('}', at) + 1);
	};
	const titleButton = rule('.nand-session-row > button:first-child {');
	assert.match(titleButton, /overflow-wrap:\s*normal/);
	assert.equal(titleButton.includes('anywhere'), false);
	const lines = rule('.nand-session-row > button:first-child :is(span, small)');
	assert.match(lines, /white-space:\s*nowrap/);
	assert.match(lines, /text-overflow:\s*ellipsis/);
	assert.match(lines, /min-width:\s*0/);
	const closeButton = rule('.nand-session-row > button:last-child');
	assert.match(closeButton, /flex:\s*0 0 32px/);
	assert.match(closeButton, /width:\s*32px/);
	assert.match(rule('.nand-session-row-meta {'), /display:\s*grid/);
	assert.equal(css.includes('.nand-session-row-id {'), false, 'Technical identity has no visible row styling');
	assert.match(rule('.nand-agent-sidebar button {'), /overflow-wrap:\s*normal/, 'navigation wraps at word boundaries');
	const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 160));
	for (const language of ['zh', 'en', 'zh'] as const) {
		setLanguage(language); sessions = [first, second]; paint(); await wait();
		assert.equal(panel.querySelector('input')?.getAttribute('aria-label'), t('terminalAgent.workbench.searchSessions'));
		assert.equal(t('main.dashboard'), language === 'zh' ? '看板' : 'Dashboard');
		const before = new Map(buttons().map((button) => [sessionId(button), button.textContent]));
		assert.equal(panel.querySelector('.nand-session-row-id'), null);
		assert.ok(!before.get(first.id)!.includes('#12345678'));
		const status = t('terminalAgent.workbench.status.unknown');
		for (const button of buttons()) {
			assert.match(button.textContent!, new RegExp(status));
			assert.equal(button.title, `Same Terminal\n/vault\n${status}`);
		}
		buttons()[1]!.click(); paint();
		assert.equal(selected, second, 'Same titles still select the exact session object');
		assert.equal(sessionId(panel.querySelector<HTMLButtonElement>('.is-active')!), second.id);
		sessions = [second, first]; redraw(); await wait();
		for (const button of buttons()) assert.equal(button.textContent, before.get(sessionId(button)), 'Reordering preserves session labels');
		sessions = [second]; redraw(); await wait();
		assert.equal(buttons()[0]!.textContent, before.get(second.id), 'Closing another session does not renumber the survivor');
	}
	render(null, panel);
	assert.equal(unsubscribed, 1, 'Unmount releases the service subscription');
	console.log('Session sidebar: stable identity, exact selection, reorder/close, unknown status and bilingual surface names passed.');
}

async function verifyUsageLanguage() {
	class StatusItem {
		hidden = false;
		spans: Array<{ text?: string }> = [];
		listeners = new Map<string, () => void>();
		cleared = 0;
		win = {
			setInterval: (_callback: () => void, _delay: number) => 42,
			clearInterval: (id: number) => { this.cleared = id; },
		};
		addClass(): void {}
		toggleClass(name: string, on: boolean): void { if (name === 'is-hidden') this.hidden = on; }
		replaceChildren(): void { this.spans = []; }
		createSpan(spec: { text?: string }): StatusItem { this.spans.push(spec); return new StatusItem(); }
		addEventListener(name: string, callback: () => void): void { this.listeners.set(name, callback); }
		removeEventListener(name: string, callback: () => void): void {
			if (this.listeners.get(name) === callback) this.listeners.delete(name);
		}
		get text(): string { return this.spans.map((span) => span.text ?? '').join(''); }
	}
	const previousWindow = globalThis.window;
	let runtimeReads = 0;
	globalThis.window = {
		require: (name: string) => {
			assert.equal(name, 'node:process');
			runtimeReads++;
			return process;
		},
	} as unknown as Window & typeof globalThis;
	setLanguage('zh');
	const status = new StatusItem();
	const agentSettings = structuredClone(DEFAULT_AGENT_SETTINGS);
	for (const settings of Object.values(agentSettings.agents)) settings.enabled = false;
	agentSettings.agents.codex.enabled = true;
	agentSettings.agents.codex.accountId = 'language-fixture';
	let active = true;
	const host = {
		settings: { ...DEFAULT_TERMINAL_SETTINGS, agentSettings },
		app: { vault: { adapter: { getBasePath: () => '/nand-nonexistent-usage-language-fixture' } } },
		manifest: { dir: '.obsidian/plugins/nand' },
		addCommand: () => {},
		addStatusBarItem: () => status,
		registerInterval: (id: number) => id,
		isActive: () => active,
	} as unknown as OrcaPluginHost;
	const cleanup = registerOrca(host);
	const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 160));
	const panel = document.createElement('div'); document.body.appendChild(panel);
	try {
		await wait();
		assert.equal(status.text, '用量');
		const before = runtimeReads;
		for (const language of ['en', 'zh', 'en'] as const) {
			setLanguage(language);
			assert.equal(status.text, language === 'zh' ? '用量' : 'Usage');
			assert.equal(runtimeReads, before, 'Switching language does not read providers or reset the poll');
		}
		active = false; setLanguage('zh');
		assert.equal(status.hidden, true);
		assert.equal(status.text, '');
		active = true; cleanup();
		assert.equal(status.cleared, 42);
		assert.equal(status.listeners.size, 0);
		setLanguage('en'); refreshRegisteredUsage(host); await wait();
		assert.equal(runtimeReads, before, 'Disposed hosts no longer react to language or refresh requests');
		assert.equal(status.text, '');

		let historyReads = 0, timers = 0, cleared = 0;
		agentSettings.agents.pi.enabled = true;
		const footerHost = {
			...host,
			app: { ...host.app, workspace: { containerEl: { win: {
				setInterval: () => { timers++; return 99; },
				clearInterval: (id: number) => { assert.equal(id, 99); cleared++; },
			} } } },
		} as unknown as WorkbenchHost;
		const history = { subscribe: () => () => {}, usage: async () => { historyReads++; return { known: false }; } } as unknown as NativeHistory;
		setLanguage('zh');
		render(h(UsageFooter, { host: footerHost, history }), panel); await wait();
		assert.ok(panel.textContent!.includes('未登录'));
		assert.ok(panel.textContent!.includes('此服务商不提供可读取的订阅额度'));
		const afterRead = runtimeReads;
		for (const language of ['en', 'zh', 'en'] as const) {
			setLanguage(language); await wait();
			assert.ok(panel.textContent!.includes(t('terminalAgent.agents.notSignedIn')));
			assert.ok(panel.textContent!.includes(t('terminalAgent.agents.quotaUnsupported')));
			assert.ok(panel.textContent!.includes(t('terminalAgent.workbench.vaultUsage')));
			assert.equal(runtimeReads, afterRead, 'Footer repaint uses cached provider states');
			assert.equal(historyReads, 1, 'Footer language events do not query history');
			assert.equal(timers, 1, 'Footer language events do not restart polling');
			const environment = globalThis as { document?: unknown };
			delete environment.document; // Native Modal stub owns a separate mini-DOM.
			try {
				const modal = new UsageModal({} as App, [
					{ agentId: 'codex', provider: 'Codex', account: null, failed: false, windows: [], status: '未登录', statusKey: 'notSignedIn' },
					{ agentId: 'pi', provider: 'Pi', account: null, failed: true, windows: [], status: 'Provider response 429: retry after 20s' },
				]);
				modal.onOpen();
				assert.ok(modal.contentEl.textContent!.includes(t('terminalAgent.agents.notSignedIn')), 'Opening cached usage uses the current language');
				assert.ok(modal.contentEl.textContent!.includes('Provider response 429: retry after 20s'), 'Raw provider diagnostics stay intact');
				modal.onClose();
			} finally { environment.document = document; }
		}
		render(h(UsageFooter, { host: footerHost, history, visible: false }), panel); await wait();
		assert.equal(cleared, 1, 'Hiding a leaf releases its usage polling interval');
		assert.equal(historyReads, 1, 'Hidden leaves do not query native aggregate usage');
		assert.equal(runtimeReads, afterRead, 'Hidden leaves do not read provider state');
		render(null, panel); setLanguage('zh'); await wait();
		assert.equal(cleared, 1);
		assert.equal(panel.textContent, '');
		assert.equal(runtimeReads, afterRead);
	} finally {
		render(null, panel);
		cleanup();
		globalThis.window = previousWindow;
	}
	console.log('Usage language: immediate cached status/footer repaint, no provider/history reads or timer restart, inactive and disposed lifecycle passed.');
}

async function verifyHistoryMatrix() {
	const panel = document.createElement('div'); document.body.appendChild(panel);
	const modifiedAtMs = Date.UTC(2026, 8, 28, 12);
	const all = Array.from({ length: 111 }, (_, index) => ({
		key: String(index), title: `History ${index}`, agentId: 'codex', modifiedAtMs,
		usage: { known: false }, accountKey: '{}', text: `Transcript ${index}`,
	} as NativeSession));
	let records = all.slice(), failSave = false;
	const metadata = new Map<string, { favorite?: boolean; archived?: boolean }>();
	const requests: Array<{ query: string; offset: number; filter: string }> = [];
	let version = 0, indexVersion = 0;
	const listeners = new Set<() => void>();
	const publish = () => { version++; for (const listener of listeners) listener(); };
	const history = {
		get hasScanned() { return indexVersion > 0; },
		get revision() { return version; }, get indexRevision() { return indexVersion; },
		subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
		scan: async () => { indexVersion++; return []; }, refresh: async () => { indexVersion++; publish(); return []; },
		meta: (key: string) => metadata.get(key) ?? {},
		read: async (session: NativeSession) => session,
		update: async (key: string, patch: object) => { if (failSave) throw Error('disk full'); metadata.set(key, { ...metadata.get(key), ...patch }); publish(); },
		query: async (query = '', offset = 0, _signal?: AbortSignal, filter = 'active') => {
			requests.push({ query, offset, filter });
			const matches = records.filter((row) => row.title.includes(query) && (filter === 'favorite' ? metadata.get(row.key)?.favorite : filter === 'archived' ? metadata.get(row.key)?.archived : !metadata.get(row.key)?.archived));
			return { rows: matches.slice(offset, offset + 100), total: matches.length };
		},
	} as unknown as NativeHistory;
	const host = { app: {} } as WorkbenchHost;
	const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 320));
	const button = (key: string) => Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === t('terminalAgent.workbench.' + key))!;
	const range = () => panel.querySelector('.nand-history-pagination span')?.textContent;
	const paginate = (direction: 'next' | 'previous') => panel.querySelector<HTMLButtonElement>(`[aria-label="${t('terminalAgent.workbench.' + direction)}"]`)!.click();
	const changeFilter = async (value: string) => {
		const select = panel.querySelector('select')!;
		Object.defineProperty(select, 'value', { value, writable: true, configurable: true });
		select.dispatchEvent(new document.defaultView!.Event('change', { bubbles: true })); await wait();
	};
	const searchFor = async (value: string) => {
		const input = panel.querySelector('input')!; input.value = value;
		input.dispatchEvent(new document.defaultView!.Event('input', { bubbles: true })); await wait();
	};
	for (const language of ['zh', 'en', 'zh'] as const) {
		setLanguage(language); records = all.slice(); metadata.clear();
		mountHistoryPanel(panel, history, host); await wait();
		assert.equal(range(), t('terminalAgent.workbench.range', { start: 1, end: 100, total: 111 }));
		assert.equal(panel.querySelector('.nand-history-row small')!.textContent, `codex · ${new Date(modifiedAtMs).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US')}`);
		paginate('next'); await wait();
		assert.equal(range(), t('terminalAgent.workbench.range', { start: 101, end: 111, total: 111 }));
		assert.equal(panel.querySelectorAll('.nand-history-row').length, 11);
		assert.equal(panel.querySelector<HTMLButtonElement>(`[aria-label="${t('terminalAgent.workbench.next')}"]`)!.disabled, true);
		panel.querySelector<HTMLButtonElement>('.nand-history-row button')!.click(); await wait();
		assert.ok(panel.querySelector('.nand-history-preview')!.textContent!.includes(t('terminalAgent.workbench.usageUnknown')));
		button('favorite').click(); await wait();
		assert.equal(button('unfavorite').getAttribute('aria-pressed'), 'true');
		await changeFilter('favorite');
		assert.equal(requests.at(-1)!.offset, 0);
		assert.equal(panel.querySelectorAll('.nand-history-row').length, 1);
		button('unfavorite').click(); await wait();
		assert.ok(panel.textContent!.includes(t('terminalAgent.workbench.noMatches')));
		assert.equal(button('favorite').getAttribute('aria-pressed'), 'false');
		await changeFilter('active');
		await searchFor('unmatched');
		assert.ok(panel.textContent!.includes(t('terminalAgent.workbench.noMatches')));
		await searchFor('');
		records = all.slice(0, 101);
		panel.querySelector<HTMLButtonElement>(`[aria-label="${t('terminalAgent.workbench.refresh')}"]`)!.click(); await wait();
		paginate('next'); await wait();
		assert.equal(range(), t('terminalAgent.workbench.range', { start: 101, end: 101, total: 101 }));
		panel.querySelector<HTMLButtonElement>('.nand-history-row button')!.click(); await wait();
		button('archived').click(); await wait(); await wait();
		assert.equal(button('unarchive').getAttribute('aria-pressed'), 'true');
		assert.equal(panel.querySelectorAll('.nand-history-row').length, 100, 'Archiving the last row clamps to the remaining first page');
		assert.equal(requests.at(-1)!.offset, 0);
		assert.equal(range(), undefined, 'A single remaining page needs no pager');
		await changeFilter('archived');
		assert.equal(panel.querySelectorAll('.nand-history-row').length, 1);
		button('unarchive').click(); await wait();
		assert.ok(panel.textContent!.includes(t('terminalAgent.workbench.noMatches')));
		assert.equal(button('archived').getAttribute('aria-pressed'), 'false');
		failSave = true; button('favorite').click(); await wait();
		assert.equal(button('favorite').getAttribute('aria-pressed'), 'false', 'Failed metadata writes do not publish a state change');
		failSave = false;
		await changeFilter('active'); records = [];
		panel.querySelector<HTMLButtonElement>(`[aria-label="${t('terminalAgent.workbench.refresh')}"]`)!.click(); await wait();
		assert.ok(panel.textContent!.includes(t('terminalAgent.workbench.empty')));
		assert.ok(!panel.textContent!.includes(t('terminalAgent.workbench.noMatches')));
		const environment = globalThis as { document?: unknown };
		delete environment.document; // Native Modal stub owns its mini-DOM, separate from Preact's document.
		try {
			const usage = new UsageModal({} as App, [{ provider: 'Synthetic', checkedAt: modifiedAtMs, status: 'unknown', stale: true, windows: [{ name: '每月', usedPct: null, resetAt: modifiedAtMs }] } as never]);
			usage.onOpen();
			const localizedTime = new Date(modifiedAtMs).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US');
			assert.equal(usage.contentEl.textContent!.split(localizedTime).length - 1, 2, 'Checked and reset dates use the NAND language');
			assert.ok(!usage.contentEl.textContent!.includes('100%'), 'Unknown remaining quota is not inferred');
			usage.onClose();
		} finally { environment.document = document; }
		render(null, panel);
	}
	console.log('History matrix: zh/en/zh dates, 111/101 ranges, search/filter empty states, metadata toggles, page shrink and unknown usage passed.');
}

async function verifyAutomationFilters() {
	const panel = document.createElement('div'); document.body.appendChild(panel);
	const prompt = 'User prompt 第一行\nSecond line 保留';
	const definitions: AutomationDefinition[] = Array.from({ length: 106 }, (_, i) => ({
		id: String(i), name: `Automation ${i}`, enabled: i % 2 === 0, deviceId: 'device', revision: 1,
		schedule: { kind: 'manual' }, action: i % 3 === 0 ? { kind: 'notify', body: prompt } : { kind: 'agent', agentId: i % 2 ? 'codex' : 'claude-code', cwd: '/vault', prompt, sessionMode: 'fresh' },
		channels: ['in-app'], notifyOn: 'always', graceMinutes: 30, createdAt: 0, updatedAt: 0,
	}));
	const host = { service: { deviceId: 'device', definitions, state: { cursors: {}, runs: [{ id: 'run', automationId: '1', revision: 1, status: 'succeeded', startedAt: 0, message: '', output: 'CLI output\n code()' }] }, agent: () => ({ listAgents: () => [{ id: 'codex', title: 'Codex' }, { id: 'claude-code', title: 'Claude Code' }] }) }, edit: () => {}, inbox: () => {} } as unknown as AutomationViewHost;
	const state = { selected: '1', search: '', filter: '', agentFilter: '' };
	const actions = { clearHistory: () => {}, remove: () => {}, run: (operation: () => Promise<unknown>) => { void operation(); } };
	const paint = () => render(h(AutomationsPanel, { host, state, refresh: paint, actions }), panel);
	const filter = (index: number, value: string) => {
		const el = panel.querySelectorAll('select')[index]!;
		Object.defineProperty(el, 'value', { value, writable: true, configurable: true });
		el.dispatchEvent(new document.defaultView!.Event('change', { bubbles: true }));
	};
	const ids = () => Array.from(panel.querySelectorAll('.nand-automation-list strong')).map(el => el.textContent);
	for (const language of ['zh', 'en', 'zh'] as const) {
		setLanguage(language); state.search = ''; state.filter = ''; state.agentFilter = ''; state.selected = '1'; paint();
		assert.equal(ids().length, 106);
		assert.equal(panel.querySelector('input')?.getAttribute('type'), 'search', 'Automation search uses Obsidian theme input styling');
		for (const select of Array.from(panel.querySelectorAll('select'))) assert.equal(select.closest('label')?.querySelector('span')?.textContent, select.getAttribute('aria-label'), 'Visible and accessible filter names agree');
		assert.deepEqual(Array.from(panel.querySelectorAll('select')).map(el => el.getAttribute('aria-label')), [t('automation.actionFilter'), t('automation.agentFilter')]);
		assert.equal(panel.querySelector('.nand-automation-prompt')?.textContent, prompt);
		assert.equal(panel.querySelector('.nand-automation-prompt')?.tagName, 'P');
		assert.equal(panel.querySelector('.nand-automation-run pre')?.textContent, 'CLI output\n code()');
		filter(0, 'enabled'); filter(1, 'claude-code');
		assert.deepEqual(ids(), definitions.filter(d => d.enabled && d.action.kind === 'agent' && d.action.agentId === 'claude-code').map(d => d.name));
		assert.equal(panel.querySelector('.nand-automation-detail h3')?.textContent, 'Automation 1', 'Filtering preserves the selected detail');
		const search = panel.querySelector('input')!; search.value = 'no-such-record'; search.dispatchEvent(new document.defaultView!.Event('input', { bubbles: true }));
		assert.equal(ids().length, 0);
		assert.ok(panel.querySelector('.nand-automation-list')?.textContent?.includes(t('automation.empty')));
	}
	Object.assign(host.service, { loadError: 'Synthetic load failure\n'.repeat(200) });
	let retried = false;
	host.retry = async () => { retried = true; };
	paint();
	panel.querySelector<HTMLButtonElement>('.nand-automation-load-error button')!.click();
	await new Promise<void>(resolve => setTimeout(resolve, 0));
	assert.equal(retried, true, 'Load failure retains a usable retry action');
	render(null, panel);
	console.log('Automation panel: visible filter labels, combined filtering, empty result, retained selection and prompt/output semantics passed.');
}

async function verifyOrcaRegression() {
	const panel = document.createElement('div'); document.body.appendChild(panel);
	const state = createWorkbenchState(); state.navigation = 'history';
	assert.equal(state.sidebarWidth, 272); assert.equal(state.drawerOpen, false); assert.equal(state.wideSidebarOpen, true);
	assert.deepEqual([sidebarWidth(120), sidebarWidth(480), sidebarWidth(NaN)], [240, 360, 272]);
	let revision = 0, indexRevision = 1, sourceText = 'Original transcript\n'.repeat(200);
	const listeners = new Set<() => void>();
	const requests: string[] = [];
	let scans = 0, reads = 0, resumes = 0, resumeFailed = false, release!: () => void;
	let resumeGate = new Promise<void>((resolve) => { release = resolve; });
	const session = { key: 'orca-fixture', sessionId: 'orca-fixture', agentId: 'codex', accountKey: '{}', cwd: '/vault', title: 'Fixture conversation', modifiedAtMs: 0, transcriptPath: 'fixture', usage: { known: false } } as NativeSession;
	const history = {
		get revision() { return revision; }, get indexRevision() { return indexRevision; }, hasScanned: true,
		subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
		meta: () => ({}),
		scan: async () => { scans++; return []; },
		refresh: async () => { scans++; indexRevision++; revision++; for (const listener of listeners) listener(); return []; },
		query: async (query = '') => { requests.push(query); return { rows: [session], total: 1 }; },
		read: async () => { reads++; return { ...session, text: sourceText }; },
	} as unknown as NativeHistory;
	const host = { app: {}, resumeSession: async () => { resumes++; await resumeGate; if (resumeFailed) throw Error('Fixture resume failure'); } } as unknown as WorkbenchHost;
	const wait = (ms = 280) => new Promise<void>((resolve) => setTimeout(resolve, ms));
	let width = 1000, activeObserver: (() => void) | undefined, disconnected = 0, observed = 0;
	function ownerWindow(): Window {
		return { ResizeObserver: class {
			constructor(private callback: () => void) { activeObserver = callback; }
			observe() { observed++; this.callback(); }
			disconnect() { disconnected++; }
		} } as unknown as Window;
	}
	let owner = ownerWindow();
	const change = (patch: Partial<WorkbenchState>) => { Object.assign(state, patch); paint(); };
	const paint = () => render(h(TerminalWorkbench, {
		...refs, ...actions, state, onStateChange: change, ownerWindow: owner,
		newConversation: h(NewConversationButton, { host, create: async () => {}, primary: !state.showHistory }),
		rootRef: (element) => { if (element) element.getBoundingClientRect = () => ({ width } as DOMRect); },
		header: h(TerminalHeader, { title: 'Fixture terminal', cwd: '/vault', status: 'unknown', search: () => {}, more: () => {}, sidebarToggle: () => change(width < 800 ? { drawerOpen: !state.drawerOpen } : { wideSidebarOpen: !state.wideSidebarOpen }) }),
		history: h(HistorySidebar, { history, state, onStateChange: change }),
		preview: h(HistoryPreview, { history, host, state, onStateChange: change }),
	}), panel);
	paint(); await wait();
	assert.equal(panel.querySelector('.nand-agent-new-btn')?.closest('[hidden]'), null, 'New conversation remains available in history navigation');
	const xterm = panel.querySelector('.terminal-container')!;
	const canvas = document.createElement('canvas'); xterm.appendChild(canvas);
	const query = panel.querySelector<HTMLInputElement>('.nand-history-controls input')!;
	const initialRequests = requests.length;
	for (const value of ['F', 'Fi', 'Fixture']) {
		query.value = value; query.dispatchEvent(new document.defaultView!.Event('input', { bubbles: true })); await wait(35);
	}
	await wait(380);
	assert.deepEqual(requests.slice(initialRequests), ['Fixture'], 'Queued history search cancels obsolete inputs and requests only the debounced final query');
	panel.querySelector<HTMLButtonElement>('.nand-history-row button')!.click(); await wait();
	assert.equal(state.showHistory, true);
	assert.equal(panel.querySelector('.nand-agent-history .nand-history-preview'), null, 'History navigation never owns the full transcript');
	assert.equal(panel.querySelector('.terminal-history-pane .nand-history-transcript')?.textContent, sourceText, 'The main preview shows the complete original transcript');
	assert.equal(panel.querySelector('.terminal-container'), xterm); assert.equal(xterm.firstChild, canvas);
	sourceText = 'Updated source transcript\n'.repeat(240);
	const readsBefore = reads;
	panel.querySelector<HTMLButtonElement>(`[aria-label="${t('terminalAgent.workbench.refresh')}"]`)!.click(); await wait();
	assert.equal(scans, 1, 'Explicit Refresh scans under a non-empty search');
	assert.ok(reads > readsBefore, 'Index changes reload the currently selected transcript');
	assert.equal(panel.querySelector('.nand-history-transcript')?.textContent, sourceText);
	const resume = () => panel.querySelector<HTMLButtonElement>('.nand-history-resume')!;
	resume().click(); resume().click(); await wait();
	assert.equal(resumes, 1); assert.equal(resume().disabled, true); assert.equal(state.resumeKey, session.key);
	const snapshot = { ...state };
	owner = ownerWindow(); paint(); await wait();
	assert.equal(disconnected, 1, 'Migration disconnects the observer on the old window');
	assert.equal(observed, 2, 'Migration measures using the new window runtime');
	assert.equal(panel.querySelector('.terminal-container'), xterm); assert.equal(xterm.firstChild, canvas);
	assert.equal(state.resumeKey, snapshot.resumeKey); resume().click(); await wait(10); assert.equal(resumes, 1, 'Pending Resume survives migration without duplicate launch');
	release(); await wait(); assert.equal(state.resumeKey, null); assert.equal(state.showHistory, false);
	change({ showHistory: true }); resumeFailed = true;
	resumeGate = Promise.resolve(); resume().click(); await wait();
	assert.equal(state.resumeKey, null); assert.equal(state.showHistory, true, 'Failed resume clears busy state and retains the preview for retry');
	resumeFailed = false; resume().click(); await wait(); assert.equal(resumes, 3); assert.equal(state.showHistory, false);
	const separator = panel.querySelector<HTMLButtonElement>('.terminal-sidebar-resizer')!;
	const key = (name: string) => { const event = new document.defaultView!.Event('keydown', { bubbles: true, cancelable: true }); Object.defineProperty(event, 'key', { value: name }); separator.dispatchEvent(event); };
	key('End'); assert.equal(state.sidebarWidth, 360); key('Home'); assert.equal(state.sidebarWidth, 240); key('ArrowRight'); assert.equal(state.sidebarWidth, 248);
	width = 600; activeObserver?.(); await wait();
	panel.querySelector<HTMLButtonElement>('.terminal-navigation-toggle')!.click(); await wait();
	assert.equal(state.drawerOpen, true); assert.equal(panel.querySelector('aside')?.getAttribute('role'), 'dialog');
	panel.querySelector<HTMLButtonElement>('.terminal-drawer-close')!.click(); await wait(); assert.equal(state.drawerOpen, false);
	assert.equal(panel.querySelector('.terminal-container'), xterm); assert.equal(xterm.firstChild, canvas);
	for (const language of ['zh', 'en', 'zh'] as const) { setLanguage(language); paint(); assert.equal(panel.querySelector('.nand-agent-workbench-title')?.textContent, t('terminalAgent.workbench.title')); assert.equal(panel.querySelector('.terminal-container'), xterm); }
	render(null, panel); assert.equal(listeners.size, 0); assert.equal(disconnected, 2);
	console.log('Orca regression: debounce/cancel, searched refresh/full preview, Resume pending/migration/failure retry, 240–360 resize, narrow drawer, bilingual repaint and stable xterm passed.');
}
