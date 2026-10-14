import { installPreactMiniDom } from './preact-mini-dom';
installPreactMiniDom();
import { registerShellCommands } from '../src/app/commands';
import type DashboardPlugin from '../src/app/main';
import assert from 'node:assert/strict';
import { type App } from 'obsidian';
import { El, findTag } from './mini-dom';
import { Setting as StubSetting } from './obsidian-stub';
import { resolveWidgetLabel } from '../src/modules/home/core/board/default-widget-label';
import { generateDefaultMarkdown } from '../src/modules/home/core/board/parser/default-document';
import { parse, serialize } from '../src/modules/home/core/board/parser';
import type { AnniversaryConfig, CountdownConfig } from '../src/modules/home/core/board/types';
import { CountdownSettingsModal } from '../src/modules/home/ui/widgets/countdown-modal';
import { AnniversarySettingsModal } from '../src/modules/home/ui/widgets/anniversary-settings-modal';
import { createDashboardSettingsAccess } from '../src/modules/home/ui/settings-access';
import { readCalendarTaskFilter, writeCalendarTaskFilter } from '../src/modules/home/ui/calendar/calendar-preferences';
import { onLanguageChanged, setLanguage, t } from '../src/shared/i18n/index';
import { registerLocalizedCommand, type LocalizedCommand } from '../src/host/obsidian/localized-command';
import { registerCommentCommands } from '../src/modules/comments/ui/commands';
import { registerCopyCommands } from '../src/app/copy-commands';
import type { CommentsEnv } from '../src/modules/comments/ui/env';
import type { Command, Plugin } from 'obsidian';
import {
	refreshLeafTitle,
	retitleDeferredLeaves,
	setDeferredLeafTitle,
	translatedLeafTitle,
} from '../src/host/obsidian/workspace-title';
import type { DashboardSettings } from '../src/modules/home/core/board/types/index';
import { renderCopyHelp } from '../src/app/settings/editor-settings';

async function main() {
	for (const language of ['zh', 'en'] as const) {
		setLanguage(language);
		const beforeHelp = StubSetting.created.length;
		renderCopyHelp(new El('div') as never);
		const help = StubSetting.created.slice(beforeHelp);
		assert.deepEqual(help.map(row => row.name), ['editor.copy.title', 'editor.copy.relative', 'editor.copy.absolute'].map(key => t(key)));
		assert.ok(help.every(row => row.desc.length > 20 && row.toggles.length === 0));
	}
	const exampleCountdown: CountdownConfig = { id: 'cd-default', label: 'New Year Countdown', targetDate: '2030-12-31T23:55', displayMode: 'hours', reminderDays: 0 };
	const exampleAnniversary: AnniversaryConfig = { id: 'av-default', label: '纪念日', startDate: '2025-09-29', precision: 'ymd', annualReminder: false };
	for (const language of ['zh', 'en', 'zh'] as const) {
		setLanguage(language);
		assert.equal(resolveWidgetLabel(exampleCountdown, 'countdown'), language === 'zh' ? '新年' : 'New Year');
		assert.equal(resolveWidgetLabel({ ...exampleCountdown, label: 'Countdown to New Year' }, 'countdown'), language === 'zh' ? '新年' : 'New Year');
		assert.equal(resolveWidgetLabel({ ...exampleCountdown, label: 'Countdown to New Year', defaultLabel: false }, 'countdown'), 'Countdown to New Year');
		assert.equal(resolveWidgetLabel(exampleAnniversary, 'anniversary'), language === 'zh' ? '纪念日' : 'Anniversary');
		assert.equal(resolveWidgetLabel({ ...exampleAnniversary, label: 'Wedding / 结婚' }, 'anniversary'), 'Wedding / 结婚');
		assert.equal(resolveWidgetLabel({ ...exampleAnniversary, id: 'user-entry' }, 'anniversary'), '纪念日');
		assert.equal(resolveWidgetLabel({ ...exampleCountdown, defaultLabel: false }, 'countdown'), 'New Year Countdown');
		assert.equal(resolveWidgetLabel({ ...exampleAnniversary, label: 'Anniversary', defaultLabel: false }, 'anniversary'), 'Anniversary', 'Explicitly entered default-looking names remain custom');
		const fresh = parse(generateDefaultMarkdown());
		assert.deepEqual(fresh.columns.slice(0, 2).map((column) => column.name), language === 'zh' ? ['备忘', '待办'] : ['Memo', 'Todo']);
		for (const column of fresh.columns.slice(0, 2)) assert.ok(column.cards.every((card) => card.column === column.name), 'Translated section and card ownership stay aligned');
		fresh.columns[0]!.name = 'My memo / 自定义';
		const saved = serialize(fresh);
		setLanguage(language === 'zh' ? 'en' : 'zh');
		assert.equal(parse(saved).columns[0]!.name, 'My memo / 自定义', 'Language changes never rewrite saved section names');
	}
	setLanguage('en');
	(globalThis as unknown as { activeDocument: unknown }).activeDocument = { querySelector: () => null };
	let savedCountdown: CountdownConfig | undefined;
	const editCountdown = (input: boolean) => {
		const before = StubSetting.created.length;
		const modal = new CountdownSettingsModal({} as App, exampleCountdown, (updated) => { savedCountdown = updated; });
		modal.onOpen();
		const name = StubSetting.created.slice(before).find(row => row.name === t('countdown.label'))!.texts[0]!;
		assert.equal(name.value, 'New Year');
		if (input) name.fire!('Anniversary');
		findTag(modal.contentEl as unknown as El, 'button').find((button) => button.textContent === t('common.save'))!.click();
	};
	editCountdown(false);
	assert.equal(savedCountdown!.defaultLabel, true, 'Saving another field preserves localized default mode');
	setLanguage('zh');
	assert.equal(resolveWidgetLabel(savedCountdown!, 'countdown'), '新年');
	setLanguage('en');
	editCountdown(true);
	setLanguage('zh');
	assert.equal(savedCountdown!.defaultLabel, false);
	assert.equal(resolveWidgetLabel(savedCountdown!, 'countdown'), 'Anniversary');
	let savedAnniversary: AnniversaryConfig | undefined;
	const anniversaryModal = new AnniversarySettingsModal({} as App, exampleAnniversary, (updated) => { savedAnniversary = updated; });
	const beforeSettings = StubSetting.created.length;
	anniversaryModal.onOpen();
	const labelSetting = StubSetting.created.slice(beforeSettings).find((setting) => setting.name === t('anniversary.label'))!;
	assert.equal(labelSetting.texts[0]!.value, '纪念日');
	labelSetting.texts[0]!.fire!('Anniversary');
	findTag(anniversaryModal.contentEl as unknown as El, 'button').find((button) => button.textContent === t('common.save'))!.click();
	assert.equal(savedAnniversary!.defaultLabel, false);
	setLanguage('en');
	assert.equal(resolveWidgetLabel(savedAnniversary!, 'anniversary'), 'Anniversary');
	setLanguage('zh');
	assert.equal(resolveWidgetLabel(savedAnniversary!, 'anniversary'), 'Anniversary', 'Typing an English default name is explicit user intent');
	const commandCleanups: Array<() => void> = [];
	const commands: Command[] = [];
	const commandHost = {
		manifest: { name: 'NAND' } as Plugin['manifest'],
		register: (off: () => void) => commandCleanups.push(off),
	};
	const addCommand = (command: LocalizedCommand) => registerLocalizedCommand(commandHost, command, (native) => {
		const registered = { ...native, id: `nand:${native.id}`, name: `NAND: ${native.name}` };
		commands.push(registered);
		return registered;
	});
	setLanguage('zh');
	registerCommentCommands({ app: {}, store: () => null, settings: () => ({ highlightEnabled: true, popoverEnabled: true }) } as unknown as CommentsEnv, { add: addCommand });
	registerCopyCommands({ app: {} as never, addCommand });
	let scriptName = 'My workflow 中文';
	const callback = () => {};
	const hotkeys: Command['hotkeys'] = [{ modifiers: ['Mod'], key: '9' }];
	const workflow = addCommand({ id: 'custom-workflow', name: '', nameResolver: () => `${t('workbench.agent')}: ${scriptName}`, callback, hotkeys });
	const originalCommands = [...commands];
	const originalCallbacks = commands.map((command) => command.callback ?? command.editorCallback);
	for (const language of ['en', 'zh', 'zh', 'en'] as const) {
		setLanguage(language);
		const keys = ['editor.comments.add', 'editor.comments.openPanel', 'editor.comments.atCursor', 'editor.comments.next', 'editor.comments.previous', 'editor.comments.resolveAll', 'editor.copy.relative', 'editor.copy.absolute'];
		keys.forEach((key, index) => assert.equal(commands[index]!.name, `NAND: ${t(key)}`));
		assert.equal(workflow.name, `NAND: ${t('workbench.agent')}: ${scriptName}`);
		assert.equal(workflow.hotkeys, hotkeys);
		assert.deepEqual(commands, originalCommands, 'Language changes update the existing registered objects');
		assert.deepEqual(commands.map((command) => command.callback ?? command.editorCallback), originalCallbacks);
	}
	scriptName = '用户改名 / Keep English';
	setLanguage('zh');
	assert.equal(workflow.name, `NAND: ${t('workbench.agent')}: ${scriptName}`);
	assert.equal(commands.length, 9, 'Repeated language events do not register commands again');
	assert.equal(commandCleanups.length, 9);
	const disposedNames = commands.map((command) => command.name);
	commandCleanups.forEach((off) => off());
	setLanguage('en');
	assert.deepEqual(commands.map((command) => command.name), disposedNames, 'Plugin unload releases name subscriptions');
	let automationOpens = 0, inboxOpens = 0, browserOpens = 0;
	registerShellCommands({ addCommand, moduleState: () => 'active', openBrowser: async () => { browserOpens++; }, openWorkbench: async (target: { feature: string }) => { if (target.feature === 'notifications') inboxOpens++; }, automationHost: { open: async () => { automationOpens++; } } } as unknown as DashboardPlugin);
	const shellCommands = commands.slice(9);
	// Board commands are registered by the home module itself.
	const expectedShellIds = ['open-workbench', 'open-browser', 'open-automations', 'open-notifications', 'new-automation', 'open-contacts', 'open-editor-view', 'cycle-theme'].map(id => `nand:${id}`).sort();
	assert.deepEqual(shellCommands.map(command => command.id).sort(), expectedShellIds);
	const openBrowser = shellCommands.find(command => command.id === 'nand:open-browser')!;
	const openAutomation = shellCommands.find(command => command.id === 'nand:open-automations')!;
	const openInbox = shellCommands.find(command => command.id === 'nand:open-notifications')!;
	const shellCallbacks = shellCommands.map(command => command.callback ?? command.checkCallback);
	for (const language of ['zh', 'en', 'zh'] as const) {
		setLanguage(language);
		assert.equal(openBrowser.name, `NAND: ${t('browser.open')}`);
		assert.equal(openAutomation.name, language === 'zh' ? 'NAND: 打开自动化' : 'NAND: Open automations');
		assert.equal(openInbox.name, language === 'zh' ? 'NAND: 打开通知中心' : 'NAND: Open notifications');
		assert.equal(t('automation.title'), language === 'zh' ? '自动化' : 'Automations');
		assert.equal(t('automation.inbox'), language === 'zh' ? '通知中心' : 'Notifications');
		for (const command of [openAutomation, openInbox, openBrowser]) assert.equal(command.checkCallback?.(false), true, 'Module commands run while the module is active');
		assert.deepEqual(shellCommands.map(command => command.callback ?? command.checkCallback), shellCallbacks);
		assert.deepEqual(commands.slice(9).map(command => command.id).sort(), expectedShellIds);
		shellCommands.forEach((command, i) => assert.equal(commands[i + 9], command));
		assert.equal(commandCleanups.length, commands.length, 'One subscription per command');
	}
	assert.deepEqual([automationOpens, inboxOpens, browserOpens], [3, 3, 3]);
	commandCleanups.slice(9).forEach(off => off());
	// React composer/IME/draft/error behavior is covered by comments DOM tests.

	setLanguage('en');
	let changed = 0;
	const off = onLanguageChanged(() => changed++);
	setLanguage('zh');
	setLanguage('zh');
	off();
	setLanguage('en');
	assert.equal(changed, 1, 'language notification is idempotent and disposable');

	let mainTitle = '', popoutTitle = '', headerCalls = 0, layoutSaves = 0;
	let mainActive = 'Note', popupActive = 'Terminal';
	const root = {};
	const popupWindow = { updateTitle() { popoutTitle = popupActive; } };
	const titleApp = {
		workspace: {
			rootSplit: root,
			updateTitle() { mainTitle = mainActive; },
			requestSaveLayout() { layoutSaves++; },
		},
	};
	const mainLeaf = { getContainer: () => root, updateHeader() { headerCalls++; } };
	const popupLeaf = { getContainer: () => popupWindow, updateHeader() { headerCalls++; } };
	refreshLeafTitle(titleApp as never, mainLeaf as never);
	assert.equal(mainTitle, 'Note', 'background terminal refresh preserves the current note title');
	mainActive = '智能体';
	refreshLeafTitle(titleApp as never, mainLeaf as never);
	assert.equal(mainTitle, '智能体');
	mainActive = 'Terminal';
	refreshLeafTitle(titleApp as never, mainLeaf as never);
	assert.equal(mainTitle, 'Terminal');
	refreshLeafTitle(titleApp as never, popupLeaf as never);
	assert.equal(popoutTitle, 'Terminal');
	popupActive = 'Renamed';
	refreshLeafTitle(titleApp as never, popupLeaf as never);
	assert.equal(popoutTitle, 'Renamed');
	assert.equal(mainTitle, 'Terminal');
	assert.equal(headerCalls, 5);
	assert.equal(layoutSaves, 5, 'Each title refresh asks Obsidian to persist the layout');
	assert.doesNotThrow(() => refreshLeafTitle({ workspace: { rootSplit: root } } as never, mainLeaf as never));
	assert.equal(layoutSaves, 5, 'A host without requestSaveLayout is left alone');
	const terminalPairs = [
		{ en: 'Terminal', zh: '终端' },
		{ en: 'Agents', zh: '智能体' },
	];
	assert.equal(translatedLeafTitle('Terminal', terminalPairs, 'zh'), '终端');
	assert.equal(translatedLeafTitle('终端', terminalPairs, 'en'), 'Terminal');
	assert.equal(translatedLeafTitle('Agents', terminalPairs, 'zh'), '智能体');
	assert.equal(translatedLeafTitle('智能体', terminalPairs, 'en'), 'Agents');
	assert.equal(translatedLeafTitle('Terminal', terminalPairs, 'en'), undefined);
	assert.equal(translatedLeafTitle('智能体', terminalPairs, 'zh'), undefined);
	assert.equal(translatedLeafTitle('My session', terminalPairs, 'zh'), undefined);
	assert.equal(translatedLeafTitle('Terminal', [{ en: 'Dashboard', zh: '看板' }], 'zh'), undefined);
	assert.equal(translatedLeafTitle(undefined, terminalPairs, 'zh'), undefined);
	for (const type of ['nand-dashboard-view', 'nand-editor-view', 'nand-contacts-view', 'nand-automation-view', 'terminal-view', 'nand-browser-view']) {
		for (const language of ['en', 'zh'] as const) {
			const placeholder = { type, title: language === 'en' ? 'Product' : '产品' };
			assert.equal(translatedLeafTitle(type, terminalPairs, language, placeholder), placeholder.title);
			assert.equal(translatedLeafTitle('My custom page', terminalPairs, language, placeholder), undefined);
			assert.equal(translatedLeafTitle('other-view', terminalPairs, language, placeholder), undefined);
		}
	}
	const deferred = { view: { title: 'Terminal' }, loaded: false, loadIfDeferred() { this.loaded = true; } };
	assert.equal(setDeferredLeafTitle(deferred as never, '终端'), true);
	assert.equal(deferred.view.title, '终端');
	assert.equal(deferred.loaded, false);
	assert.equal(setDeferredLeafTitle({ view: {} } as never, '看板'), false);
	const titleRefreshes = new Map<object, number>();
	const countRefresh = (leaf: object) => titleRefreshes.set(leaf, (titleRefreshes.get(leaf) ?? 0) + 1);
	const deferredLeaf = (title: string, isDeferred = true) => {
		const view: { title?: string } = { title };
		return {
			isDeferred,
			view,
			loaded: false,
			loadIfDeferred() {
				this.loaded = true;
			},
			getViewState() {
				return { title: view.title };
			},
		};
	};
	const terminalLeaf = deferredLeaf('Terminal');
	const agentsLeaf = deferredLeaf('Agents');
	const customLeaf = deferredLeaf('My session');
	const openLeaf = deferredLeaf('Terminal', false);
	const missingLeaf = {
		isDeferred: true,
		view: {} as { title?: string },
		loaded: false,
		loadIfDeferred() {
			this.loaded = true;
		},
		getViewState() {
			return { title: 'Terminal' };
		},
	};
	const titled = [terminalLeaf, agentsLeaf, customLeaf, openLeaf, missingLeaf];
	retitleDeferredLeaves(titled as never, terminalPairs, 'zh', countRefresh as never);
	assert.equal(terminalLeaf.view.title, '终端');
	assert.notEqual(terminalLeaf.view.title, '智能体');
	assert.equal(agentsLeaf.view.title, '智能体');
	assert.equal(customLeaf.view.title, 'My session');
	assert.equal(openLeaf.view.title, 'Terminal');
	assert.equal('title' in missingLeaf.view, false);
	assert.equal(titleRefreshes.get(terminalLeaf), 1);
	assert.equal(titleRefreshes.get(agentsLeaf), 1);
	assert.equal(titleRefreshes.has(customLeaf), false);
	assert.equal(titleRefreshes.has(openLeaf), false);
	assert.equal(titleRefreshes.has(missingLeaf), false);
	for (const leaf of titled) assert.equal(leaf.loaded, false);
	retitleDeferredLeaves([terminalLeaf, agentsLeaf] as never, terminalPairs, 'zh', countRefresh as never);
	assert.equal(titleRefreshes.get(terminalLeaf), 1);
	assert.equal(titleRefreshes.get(agentsLeaf), 1);
	assert.equal(terminalLeaf.view.title, '终端');
	const englishLeaf = deferredLeaf('终端');
	retitleDeferredLeaves([englishLeaf] as never, terminalPairs, 'en', countRefresh as never);
	assert.equal(englishLeaf.view.title, 'Terminal');
	assert.equal(englishLeaf.loaded, false);
	const rawLeaf = deferredLeaf('terminal-view');
	retitleDeferredLeaves([rawLeaf] as never, terminalPairs, 'en', countRefresh as never, { type: 'terminal-view', title: 'Agents' });
	assert.equal(rawLeaf.view.title, 'Agents');
	assert.equal(rawLeaf.loaded, false);
	assert.equal(titleRefreshes.get(rawLeaf), 1);

	let disk = '';
	let refreshes = 0;
	let rejectSave = false;
	const owner = {
		settings: {
			calendarTaskFilter: 'all',
			countdowns: [{ id: 'one', bg: 'before' }],
			anniversaries: [],
			bgImage: 'initial',
		} as unknown as DashboardSettings,
		async saveSettings() {
			if (rejectSave) throw Error('disk full');
			disk = JSON.stringify(this.settings);
		},
		refreshAllDashboards() {
			refreshes++;
		},
	};
	const access = createDashboardSettingsAccess(owner);
	assert.equal(await writeCalendarTaskFilter(access, 'open'), true);
	assert.equal(JSON.parse(disk).calendarTaskFilter, 'open');
	owner.settings = JSON.parse(disk);
	assert.equal(readCalendarTaskFilter(access), 'open', 'reopen reads saved filter');
	owner.settings = { ...owner.settings, bgImage: 'newest' };
	await access.updateSettings((current) => ({
		...current,
		countdowns: current.countdowns.map((x) => ({ ...x, bg: 'selected' })),
	}));
	assert.equal(JSON.parse(disk).bgImage, 'newest', 'callback retains settings updated after render');
	assert.equal(JSON.parse(disk).countdowns[0].bg, 'selected');
	const previous = owner.settings;
	rejectSave = true;
	assert.equal(await writeCalendarTaskFilter(access, 'all'), false);
	assert.equal(owner.settings, previous);
	assert.equal(refreshes, 2, 'failed save must not report a successful refresh');
	assert.equal(await writeCalendarTaskFilter(undefined, 'all'), false, 'missing persistence must be visible');
	console.log('verify-issue-regressions: default-name localization, edit intent, command registration, language lifecycle and settings persistence passed');
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
