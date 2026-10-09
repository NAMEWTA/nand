// Three-column workbench probe. Runs only in the nonce-marked disposable Vault created by workbench-fresh-runtime.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { connect } from './cdp.mjs';
assert.equal(process.env.NAND_ALLOW_BROWSER_E2E, '1');
for (const key of ['NAND_ACCEPTANCE_DIR', 'NAND_ACCEPTANCE_VAULT', 'NAND_ACCEPTANCE_PROFILE']) assert.ok(path.isAbsolute(process.env[key] || ''), key);
assert.match(process.env.NAND_EXPECT_MAIN_SHA || '', /^[a-f0-9]{64}$/);
assert.ok(process.env.NAND_WINDOWS_E2E_NONCE);
const dir = process.env.NAND_ACCEPTANCE_DIR, c = await connect(), checks = [];
const restart = process.argv.includes('--verify-restart');
let server;

async function call(expression, ms = 20000) {
	let timeout;
	try { return await Promise.race([c.evaluate(expression), new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('Native evaluation timeout: ' + expression.slice(0, 100))), ms); })]); }
	finally { clearTimeout(timeout); }
}
async function until(expression, label, ms = 15000) {
	const end = Date.now() + ms;
	let last;
	while (Date.now() < end) { last = await call(expression); if (last) return last; await delay(75); }
	const state = await call(`(()=>{try{return JSON.stringify({target:nandProbe.target(),layout:nandProbe.layout(),panel:nandProbe.panel(),message:nandProbe.message().slice(0,120)})}catch(e){return String(e)}})()`).catch(String);
	throw Error('Native condition timed out: ' + label + ' (' + JSON.stringify(last) + ') workbench ' + state);
}
const check = (name, detail = {}) => { checks.push({ name, passed: true, ...detail }); console.log(name, JSON.stringify(detail)); };
async function shot(name) { await fs.writeFile(path.join(dir, name + '.png'), Buffer.from((await c.send('Page.captureScreenshot')).data, 'base64')); }
const settle = () => delay(260);

// Page-side helpers: every query goes through the full (non-focus) workbench of the main window.
const helpers = `window.nandProbe = {
	wb: () => app.workspace.getLeavesOfType('nand-workbench-view').map((leaf) => leaf.view).find((view) => !view.getState().focus),
	shell: () => nandProbe.wb()?.contentEl.querySelector('.nand-shell'),
	target: () => nandProbe.wb()?.getState().target,
	rail: () => [...(nandProbe.shell()?.querySelectorAll('.nand-rail .nand-rail-item') ?? [])].map((el) => ({ id: el.dataset.feature, active: el.classList.contains('is-active'), slot: el.closest('.nand-rail-group--bottom') ? 'bottom' : 'top', expanded: el.querySelector('button')?.getAttribute('aria-expanded') ?? null })),
	clickRail: (id) => { const button = nandProbe.shell()?.querySelector('.nand-rail-item[data-feature="' + id + '"] button'); if (!button) throw Error('No rail item ' + id); button.click(); },
	panel: () => { const el = nandProbe.shell()?.querySelector('.nand-panel'); if (!el) return null; return { title: el.querySelector('.nand-panel-title')?.textContent ?? '', width: Math.round(el.getBoundingClientRect().width), items: [...el.querySelectorAll('.nand-list-item')].map((item) => ({ label: item.querySelector('.nand-list-item-label')?.textContent ?? '', active: item.classList.contains('is-active') })), custom: el.querySelector('.nand-panel-custom')?.childElementCount ?? 0, search: !!el.querySelector('.nand-panel-search input'), primary: el.querySelector('.nand-panel-primary-button')?.textContent ?? '' }; },
	clickPanelItem: (label) => { const item = [...(nandProbe.shell()?.querySelectorAll('.nand-panel .nand-list-item') ?? [])].find((el) => el.querySelector('.nand-list-item-label')?.textContent === label); if (!item) throw Error('No panel item ' + label); item.click(); },
	header: () => { const el = nandProbe.shell()?.querySelector('.nand-page-header'); return el ? { title: el.querySelector('.nand-page-title')?.textContent ?? '', toggle: !!el.querySelector('.nand-page-panel-toggle'), back: !!el.querySelector('.nand-page-open-workbench'), overflow: el.scrollWidth - el.clientWidth } : null; },
	layout: () => { const el = nandProbe.shell(); return el ? { kind: [...el.classList].find((cls) => cls.startsWith('nand-shell--'))?.slice(12), width: el.clientWidth, panelOpen: el.classList.contains('is-panel-open'), overlay: el.querySelector('.nand-shell-overlay')?.className ?? '', horizontalRail: !!el.querySelector('.nand-shell-overlay .nand-rail--horizontal'), rail: !!el.querySelector(':scope > .nand-rail'), main: Math.round(el.querySelector(':scope > .nand-shell-main').getBoundingClientRect().width), panel: Math.round(el.querySelector(':scope > .nand-panel')?.getBoundingClientRect().width ?? 0) } : null; },
	visiblePage: () => [...(nandProbe.shell()?.querySelectorAll('.nand-workbench-page') ?? [])].find((el) => !el.hidden),
	surfaces: (type) => nandProbe.wb()?.getNativeSurfaces().filter((surface) => surface.getViewType() === type) ?? [],
	tabs: () => [...(nandProbe.shell()?.querySelectorAll('.nand-tabstrip .nand-tab') ?? [])].map((el) => ({ title: el.querySelector('.nand-tab-title')?.textContent ?? '', active: el.classList.contains('is-active') })),
	message: () => nandProbe.shell()?.querySelector('.nand-shell-message')?.innerText ?? '',
	setModule: (flag, value) => app.plugins.plugins.nand.setModuleEnabled({ terminal: 'agent', contacts: 'archives', iconic: 'icons', dashboard: 'home', editor: 'comments', browser: 'browser', automation: 'automations', notifications: 'notifications', sync: 'sync' }[flag] ?? flag, value),
};true`;

const wbExpr = 'nandProbe.wb()';
let runtime;
try {
	await fs.mkdir(dir, { recursive: true });
	runtime = await call(`(async()=>{const p=app.plugins.plugins.nand;return {vault:app.vault.adapter.basePath,profile:require('@electron/remote').app.getPath('userData'),marker:JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json')),version:require('@electron/remote').app.getVersion(),mainSha256:require('crypto').createHash('sha256').update(require('fs').readFileSync(app.vault.adapter.basePath+'/'+p.manifest.dir+'/main.js')).digest('hex')}})()`);
	assert.equal(runtime.marker.nonce, process.env.NAND_WINDOWS_E2E_NONCE);
	assert.equal(path.resolve(runtime.vault), path.resolve(process.env.NAND_ACCEPTANCE_VAULT));
	assert.equal(path.resolve(runtime.profile), path.resolve(process.env.NAND_ACCEPTANCE_PROFILE));
	assert.equal(runtime.mainSha256, process.env.NAND_EXPECT_MAIN_SHA);
	assert.equal(createHash('sha256').update(await fs.readFile('main.js')).digest('hex'), runtime.mainSha256);
	assert.equal(runtime.version, '1.13.7');
	await call(helpers);
	await call(`(()=>{window.nandWorkbenchErrors=[];window.nandWorkbenchErrorHandler=e=>nandWorkbenchErrors.push(String(e.reason??e.error??e.message));window.addEventListener('unhandledrejection',nandWorkbenchErrorHandler);window.addEventListener('error',nandWorkbenchErrorHandler);app.setting.close();})()`);
	await call(`require('@electron/remote').getCurrentWindow().setSize(1440,1000)`);
	await delay(150);

	if (restart) {
		await until(`nandProbe.target()?.feature==='contacts'`, 'persisted workbench page');
		await until(`!!nandProbe.visiblePage()?.querySelector('.nand-contacts-surface')`, 'restored archive presentation');
		const restored = await call(`({target:nandProbe.target(),panel:nandProbe.panel(),width:${wbExpr}.getState().panelWidth,lastTargets:${wbExpr}.getState().lastTargets,rail:nandProbe.rail().filter(r=>r.active).map(r=>r.id)})`);
		assert.equal(restored.target.section, 'company');
		assert.equal(restored.width, 300);
		assert.equal(restored.panel?.width, 300);
		assert.deepEqual(restored.rail, ['contacts']);
		assert.equal(restored.lastTargets?.automations?.section, 'runs');
		check('restart-restores-route-panel-width-and-route-memory', restored);
		await call(`nandProbe.clickRail('automations')`); await settle();
		assert.equal((await call(`nandProbe.target()`)).section, 'runs');
		check('restart-rail-returns-to-remembered-route');
		await shot('restart-restored-archives');
	} else {
		// ---- Home in the shell -----------------------------------------------------------------------
		await call(`(async()=>{const f=app.vault.getFileByPath('Welcome.md');await app.workspace.getLeaf('tab').openFile(f);await app.plugins.plugins.nand.openWorkbench({feature:'dashboard'});})()`);
		const initial = await until(`(()=>{const v=${wbExpr};const s=nandProbe.surfaces('nand-dashboard-view')[0];return s?.data&&{id:v.leaf.id,target:v.getState().target,columns:s.data.columns.length,notes:app.workspace.getLeavesOfType('markdown').map(l=>l.view.file?.path)}})()`, 'real dashboard in workbench');
		assert.ok(initial.columns > 0); assert.equal(initial.target.feature, 'dashboard'); assert.ok(initial.notes.includes('Welcome.md'));
		check('home-is-real-dashboard-without-overwriting-the-note', initial);
		const ribbons = await call(`app.workspace.leftRibbon.items.filter(i=>i.id.startsWith('nand:')).map(i=>({id:i.id,title:i.title}))`);
		assert.equal(ribbons.length, 1); assert.equal(ribbons[0].id, 'nand:ribbon-home'); check('one-native-ribbon-registration', { ribbons });
		const views = await call(`Object.keys(app.viewRegistry.viewByType).filter(t=>t.startsWith('nand-')||t==='terminal-view').sort()`);
		assert.deepEqual(views, ['nand-comments-view', 'nand-workbench-view']);
		check('only-workbench-and-comments-views-registered', { views });

		// ---- Three columns -------------------------------------------------------------------------------
		const shell = await call(`({layout:nandProbe.layout(),rail:nandProbe.rail(),panel:nandProbe.panel(),header:nandProbe.header(),nativeHeader:getComputedStyle(${wbExpr}.containerEl.querySelector('.view-header')).display})`);
		assert.equal(shell.layout.kind, 'wide'); assert.equal(shell.layout.panelOpen, true); assert.ok(shell.layout.width >= 960);
		assert.ok(Math.abs(shell.layout.main - (shell.layout.width - 52 - shell.layout.panel)) <= 2, JSON.stringify(shell.layout));
		assert.deepEqual(shell.rail.filter((r) => r.slot === 'top').map((r) => r.id), ['dashboard', 'browser', 'contacts', 'automations', 'news', 'comments']);
		assert.deepEqual(shell.rail.filter((r) => r.slot === 'bottom').map((r) => r.id), ['notifications', 'settings']);
		assert.deepEqual(shell.rail.filter((r) => r.active).map((r) => r.id), ['dashboard']);
		assert.equal(shell.rail.find((r) => r.active).expanded, 'true');
		assert.equal(shell.panel.width, 260); assert.ok(shell.panel.items.length >= 1, 'boards are listed'); assert.ok(shell.panel.primary.length > 0, 'new board action');
		assert.equal(shell.header.toggle, false); assert.equal(shell.nativeHeader, 'none');
		check('three-columns-wide-with-rail-panel-and-page', shell);
		await shot('home-zh-wide');

		await call(`nandProbe.clickRail('dashboard')`); await settle();
		const collapsed = await call(`({layout:nandProbe.layout(),panel:nandProbe.panel(),header:nandProbe.header(),rail:nandProbe.rail().find(r=>r.active)})`);
		assert.equal(collapsed.layout.panelOpen, false); assert.equal(collapsed.panel, null);
		assert.ok(collapsed.layout.main >= collapsed.layout.width - 60, 'the page fills the freed space: ' + JSON.stringify(collapsed.layout)); assert.equal(collapsed.header.toggle, true); assert.equal(collapsed.rail.expanded, 'false');
		check('clicking-the-active-rail-icon-collapses-the-panel', collapsed);
		await shot('home-panel-collapsed');
		await call(`nandProbe.clickRail('contacts')`); await settle();
		const switched = await call(`({target:nandProbe.target(),layout:nandProbe.layout()})`);
		assert.equal(switched.target.feature, 'contacts'); assert.equal(switched.layout.panelOpen, false);
		check('switching-module-keeps-the-panel-state', switched);
		await call(`nandProbe.shell().querySelector('.nand-page-panel-toggle').click()`); await settle();
		assert.equal((await call(`nandProbe.layout()`)).panelOpen, true);
		check('header-toggle-reopens-the-panel');
		const people = await call(`nandProbe.panel().items.map(i=>i.label)`);
		await call(`nandProbe.clickPanelItem(${JSON.stringify(people[1])})`); await settle();
		assert.equal((await call(`nandProbe.target()`)).section, 'company');
		await call(`nandProbe.clickRail('automations')`); await settle();
		const runsLabel = await call(`nandProbe.panel().items.map(i=>i.label)[1]`);
		await call(`nandProbe.clickPanelItem(${JSON.stringify(runsLabel)})`); await settle();
		await call(`nandProbe.clickRail('contacts')`); await settle();
		const remembered = await call(`nandProbe.target()`);
		assert.equal(remembered.feature, 'contacts'); assert.equal(remembered.section, 'company');
		check('rail-returns-to-the-last-route-of-each-module', remembered);

		// Panel width: keyboard on the separator; committed once, restored after restart.
		await call(`(()=>{const sep=nandProbe.shell().querySelector('.nand-shell-resizer');sep.focus();for(let i=0;i<5;i++)sep.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));})()`); await settle();
		const resized = await call(`({panel:nandProbe.panel().width,state:${wbExpr}.getState().panelWidth})`);
		assert.equal(resized.panel, 300); assert.equal(resized.state, 300);
		check('panel-resizer-commits-width', resized);

		// F6 cycles rail → panel → main.
		const regions = await call(`(()=>{const root=nandProbe.shell();const out=[];root.querySelector('.nand-rail button').focus();for(let i=0;i<3;i++){document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'F6',bubbles:true}));const a=document.activeElement;out.push(a.closest('.nand-rail')?'rail':a.closest('.nand-panel')?'panel':a.closest('.nand-shell-main')?'main':'none')}return out})()`);
		assert.deepEqual(regions, ['panel', 'main', 'rail']);
		check('f6-cycles-the-three-regions', { regions });

		for (const target of [{ feature: 'contacts', section: 'person' }, { feature: 'automations', section: 'tasks' }, { feature: 'notifications' }, { feature: 'dashboard' }]) {
			await call(`app.plugins.plugins.nand.openWorkbench(${JSON.stringify(target)})`);
			const state = await call(`({id:${wbExpr}.leaf.id,target:${wbExpr}.getState().target,count:app.workspace.getLeavesOfType('nand-workbench-view').length})`);
			assert.equal(state.id, initial.id); assert.equal(state.count, 1); assert.equal(state.target.feature, target.feature);
			check('same-native-leaf-' + target.feature + '-' + (target.section || 'root'), state);
		}

		// ---- Modules on/off -------------------------------------------------------------------------
		await call(`nandProbe.setModule('iconic', true)`); await settle();
		assert.ok((await call(`nandProbe.rail().map(r=>r.id)`)).includes('icons'));
		await call(`nandProbe.clickRail('icons')`);
		await until(`nandProbe.visiblePage()?.querySelector('[data-settings-page]:not([hidden])')`, 'icons page');
		const icons = await call(`({panel:nandProbe.panel().items.map(i=>i.label),title:nandProbe.header().title})`);
		assert.ok(icons.panel.length >= 3);
		check('enabling-icons-adds-its-rail-entry-and-page', icons);
		await shot('icons-page');
		// Obsidian turns every hovered `aria-label` into a tooltip; containers must not carry one.
		const hover = await call(`({tooltips:[...document.querySelectorAll('.tooltip')].map(t=>t.textContent),labelled:[...nandProbe.shell().querySelectorAll('nav[aria-label],aside[aria-label],section[aria-label],[role=listbox][aria-label],[role=tablist][aria-label],[role=dialog][aria-label]')].length})`);
		assert.deepEqual(hover, { tooltips: [], labelled: 0 });
		check('containers-do-not-raise-hover-tooltips', hover);
		// Icons: commands, editor hooks and body classes exist only while the module is on; the picker loads its data on open.
		const iconsOn = await call(`({commands:Object.keys(app.commands.commands).filter(id=>id==='nand:open-rulebook'||id==='nand:change-icon-current-file'),body:document.body.classList.contains('nand-iconic-enabled'),theme:document.body.getAttribute('data-theme')})`);
		assert.equal(iconsOn.commands.length, 2); assert.equal(iconsOn.body, true);
		await call(`(async()=>{await app.workspace.getLeaf('tab').openFile(app.vault.getFileByPath('Welcome.md'));app.commands.executeCommandById('nand:change-icon-current-file');})()`);
		const picker = await until(`(()=>{const m=document.querySelector('.modal.iconic-icon-picker');return m&&{results:m.querySelectorAll('.iconic-search-result, .iconic-icon-result, button').length}})()`, 'icon picker opens with its data');
		await call(`document.querySelector('.modal.iconic-icon-picker .modal-close-button')?.click()`);
		await call(`nandProbe.setModule('iconic', false)`); await settle();
		assert.equal((await call(`nandProbe.rail().map(r=>r.id)`)).includes('icons'), false);
		const iconsOff = await call(`({commands:Object.keys(app.commands.commands).filter(id=>id==='nand:open-rulebook').length,body:document.body.classList.contains('nand-iconic-enabled'),attr:document.body.hasAttribute('data-nand-iconic-theme'),theme:document.body.getAttribute('data-theme')})`);
		assert.deepEqual([iconsOff.commands, iconsOff.body, iconsOff.attr, iconsOff.theme], [0, false, false, iconsOn.theme]);
		check('disabling-icons-removes-rail-entry-commands-and-body-classes', { iconsOn, picker, iconsOff });
		await call(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard'})`);

		await call(`(async()=>{await nandProbe.setModule('terminal',true);await app.plugins.plugins.nand.openWorkbench({feature:'terminal',section:'running'});})()`);
		await until(`!!app.plugins.plugins.nand.services.peek({owner:'agent',id:'workbench'})`, 'agent module active');
		for (const section of ['running', 'history', 'usage', 'running']) {
			await call(`app.plugins.plugins.nand.openWorkbench({feature:'terminal',section:${JSON.stringify(section)}})`);
			await settle();
			assert.equal(await call(`document.querySelectorAll('.nand-terminal-view').length`), 0);
			check('agent-navigation-does-not-create-pty-' + section);
		}
		const agentPanel = await until(`(()=>{const p=nandProbe.panel();return p&&p.primary&&{primary:p.primary,items:p.items.map(i=>i.label),rail:nandProbe.rail().map(r=>r.id),empty:!!nandProbe.visiblePage()?.querySelector('.nand-agent-empty')}})()`, 'agent panel');
		assert.ok(agentPanel.items.length >= 2, JSON.stringify(agentPanel)); assert.ok(agentPanel.rail.includes('terminal')); assert.equal(agentPanel.empty, true);
		check('agent-object-list-lives-in-the-side-panel', agentPanel);
		await shot('agent-no-implicit-session');

		const saved = await call(`(async()=>{const v=${wbExpr};for(let i=0;i<8;i++){const a=v.navigate({feature:'contacts',section:'person'});const b=v.navigate({feature:'automations',section:'runs'});await Promise.all([a,b]);}return v.getState().target})()`);
		assert.equal(saved.feature, 'automations'); check('rapid-navigation-latest-target-wins', saved);

		await call(`(async()=>{await app.plugins.plugins.nand.openWorkbench({feature:'contacts'});await nandProbe.setModule('contacts',false);})()`); await settle();
		assert.equal(await call(`nandProbe.surfaces('nand-contacts-view').length`), 0);
		const disabled = await call(`({message:nandProbe.message(),action:!!nandProbe.shell().querySelector('.nand-shell-message .nand-btn--primary'),rail:nandProbe.rail().map(r=>r.id)})`);
		assert.ok(disabled.message.length > 0); assert.equal(disabled.action, true); assert.equal(disabled.rail.includes('contacts'), false);
		check('disabled-module-shows-turn-on-placeholder', disabled);
		await call(`(async()=>{await nandProbe.setModule('contacts',true);await app.plugins.plugins.nand.openWorkbench({feature:'contacts'});})()`);
		await until(`nandProbe.surfaces('nand-contacts-view').length===1`, 'archives restored once');
		check('module-disable-releases-presentation-reenable-restores-once');

		// ---- Notifications: the inbox is its own module ------------------------------------------
		// A definition document as it sits in a vault, run as a quick action.
		const notifyRun = `(async()=>{const p=app.plugins.plugins.nand;const path='NAND/自动化/Probe notice-e-notify/操作.md';if(!app.vault.getFileByPath(path)){await app.vault.createFolder('NAND/自动化/Probe notice-e-notify').catch(()=>{});await app.vault.create(path,['---','nand-type: automation','nand-id: probe-notice-notify','id: probe-notice-notify','name: Probe notice','enabled: true','deviceId: '+app.loadLocalStorage('nand.device-id'),'revision: 1','channels:','  - in-app','notifyOn: always','graceMinutes: 0','createdAt: 1790000000000','updatedAt: 1790000000000','action: notify','schedule: manual','---','','<!-- nand:prompt -->','Probe body','<!-- /nand:prompt -->',''].join('\\n'));}await p.automationHost.runAction('probe-notice-notify');})()`;
		await call(notifyRun);
		const badge = await until(`nandProbe.shell().querySelector('.nand-rail-item[data-feature="notifications"] .nand-rail-badge')?.textContent`, 'unread badge');
		assert.equal(badge, '1');
		await call(`nandProbe.clickRail('notifications')`);
		const inbox = await until(`(()=>{const t=nandProbe.visiblePage()?.innerText??'';return t.includes('Probe body')&&t})()`, 'inbox shows the run');
		check('automation-results-land-in-the-notifications-inbox', { badge, inbox: inbox.slice(0, 120) });
		await shot('notifications-inbox');
		const panelRows = await call(`nandProbe.panel().items.map(i=>i.label)`);
		assert.equal(panelRows.length, 2);
		await call(`nandProbe.clickPanelItem(${JSON.stringify(panelRows[0])})`);
		await until(`nandProbe.target()?.section==='unread'&&nandProbe.visiblePage()?.innerText.includes('Probe body')`, 'unread filter lists the unread run');
		await call(`[...nandProbe.visiblePage().querySelectorAll('.nand-inbox-item-actions button')].at(-1).click()`);
		await until(`!nandProbe.visiblePage()?.innerText.includes('Probe body')&&!nandProbe.shell().querySelector('.nand-rail-item[data-feature="notifications"] .nand-rail-badge')`, 'read record leaves the unread view and the badge');
		check('unread-filter-and-badge-follow-read-state', { panelRows });
		await call(`app.plugins.plugins.nand.setModuleEnabled('notifications',false)`);
		await settle();
		const off = await call(`({rail:nandProbe.rail().map(r=>r.id),state:app.plugins.plugins.nand.moduleState('notifications'),message:nandProbe.message()})`);
		assert.equal(off.rail.includes('notifications'), false); assert.equal(off.state, 'off'); assert.ok(off.message.length > 0);
		await call(`document.querySelectorAll('.notice').forEach(n=>n.remove())`);
		await call(notifyRun);
		const notice = await until(`[...document.querySelectorAll('.notice')].map(n=>n.innerText).find(t=>t.includes('Probe notice'))`, 'fallback notice');
		check('with-notifications-off-runs-fall-back-to-a-notice', { off, notice });
		await call(`app.plugins.plugins.nand.setModuleEnabled('notifications',true)`);
		await until(`nandProbe.rail().some(r=>r.id==='notifications')`, 'notifications back on the rail');
		const records = await call(`app.plugins.plugins.nand.services.peek({owner:'notifications',id:'inbox'})?.records.map(r=>({id:r.id,channels:r.channels}))`);
		assert.equal(records.length, 1); assert.deepEqual(records[0].channels, ['in-app']);
		check('inbox-survives-module-restart', { records });
		const toggles = await call(`(async()=>{app.plugins.plugins.nand.openSettings();await new Promise(r=>setTimeout(r,400));return [...nandProbe.visiblePage().querySelectorAll('.setting-item-name')].map(e=>e.textContent)})()`);
		assert.ok(toggles.includes('通知') || toggles.includes('Notifications'), JSON.stringify(toggles));
		check('module-switches-come-from-manifests', { toggles });
		await call(`app.plugins.plugins.nand.setModuleEnabled('automations',false)`);
		const automationsOff = await call(`({service:!!app.plugins.plugins.nand.automationHost,state:app.plugins.plugins.nand.moduleState('automations'),rail:nandProbe.rail().map(r=>r.id)})`);
		assert.deepEqual([automationsOff.service, automationsOff.state, automationsOff.rail.includes('automations')], [false, 'off', false]);
		await call(`app.plugins.plugins.nand.setModuleEnabled('automations',true)`);
		const actions = await until(`(()=>{const a=app.plugins.plugins.nand.automationHost?.actions().map(x=>x.id);return a?.includes('probe-notice-notify')&&a})()`, 'automations runtime restored with its definitions');
		check('automations-off-releases-the-runtime-and-on-restores-definitions', { automationsOff, actions });
		await call(`app.plugins.plugins.nand.automationHost.edit({kind:'dashboard',path:'dashboard.md',id:'probe-card'},'Probe card')`);
		const editor = await until(`(()=>{const page=nandProbe.visiblePage();const form=page?.querySelector('.nand-automation-editor-page');if(!form||form.style.display==='none')return false;return {target:nandProbe.target(),name:form.querySelector('input')?.value,modal:!!document.querySelector('.modal-container'),list:getComputedStyle(page.querySelector('.nand-automation-view')).display}})()`, 'inline automation editor');
		assert.equal(editor.target.feature, 'automations'); assert.equal(editor.name, 'Probe card'); assert.equal(editor.modal, false); assert.equal(editor.list, 'none');
		await shot('automation-inline-editor');
		await call(`[...nandProbe.visiblePage().querySelectorAll('.nand-automation-editor-page button')].find(b=>b.textContent==='取消'||b.textContent==='Cancel').click()`);
		await until(`getComputedStyle(nandProbe.visiblePage().querySelector('.nand-automation-view')).display!=='none'`, 'editor closes back to the list');
		check('automation-editor-opens-inline-in-the-page', editor);

		// ---- Archives: inline record form, module settings page, list/card ------------------------
		await call(`app.plugins.plugins.nand.openWorkbench({feature:'contacts',section:'person'})`);
		await until(`!!nandProbe.surfaces('nand-contacts-view')[0]?.controller`, 'archives page');
		await call(`nandProbe.surfaces('nand-contacts-view')[0].add('person')`);
		const form = await until(`(()=>{const page=nandProbe.visiblePage();const host=page?.querySelector('.nand-contacts-editor-page');if(!host||host.style.display==='none')return false;return {title:host.querySelector('.nand-contacts-form-title')?.textContent,inputs:host.querySelectorAll('input').length,modal:!!document.querySelector('.modal-container')}})()`, 'inline record form');
		assert.equal(form.modal, false); assert.ok(form.inputs > 0);
		await call(`(()=>{const input=nandProbe.visiblePage().querySelector('.nand-contacts-editor-page input');input.value='Probe Person';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
		await shot('archives-inline-form');
		await call(`[...nandProbe.visiblePage().querySelectorAll('.nand-contacts-editor-page button')].find(b=>b.textContent==='保存'||b.textContent==='Save').click()`);
		const created = await until(`(()=>{const s=nandProbe.surfaces('nand-contacts-view')[0];const r=[...s.controller.index.byPath.values()].find(r=>r.fields.name==='Probe Person');const host=nandProbe.visiblePage().querySelector('.nand-contacts-editor-page');return r&&host.style.display==='none'&&{path:r.path,selected:s.state.selectedPath}})()`, 'record saved from the inline form');
		assert.equal(created.selected, created.path);
		check('archive-records-are-created-in-an-inline-form', { form, created });
		const layouts = await call(`(async()=>{const s=nandProbe.surfaces('nand-contacts-view')[0];s.back();s.layout('card');await new Promise(r=>setTimeout(r,100));const card=!!nandProbe.visiblePage().querySelector('.nand-contacts-grid, .nand-contacts-card');s.layout('list');await new Promise(r=>setTimeout(r,100));return {card,state:s.state.layout}})()`);
		assert.equal(layouts.card, true); assert.equal(layouts.state.person, 'list');
		check('archive-list-and-card-layouts-switch-per-kind', layouts);
		await call(`app.plugins.plugins.nand.openWorkbench({feature:'settings',section:'contacts'})`);
		const archiveSettings = await until(`(()=>{const row=nandProbe.visiblePage()?.querySelector('.nand-contacts-folder-setting');return row&&{rows:nandProbe.visiblePage().querySelectorAll('.setting-item').length}})()`, 'archives settings page from the module');
		check('archives-settings-page-comes-from-the-module', archiveSettings);

		// ---- Comments: module-owned editor features, side panel and workbench overview -------------
		await call(`(async()=>{const leaf=app.workspace.getLeaf('tab');await leaf.openFile(app.vault.getFileByPath('Welcome.md'));await leaf.setViewState({...leaf.getViewState(),state:{...leaf.getViewState().state,mode:'source'}});app.workspace.setActiveLeaf(leaf,{focus:true});const editor=leaf.view.editor;const text=editor.getValue();const at=text.indexOf('issue');editor.setSelection(editor.offsetToPos(at),editor.offsetToPos(at+5));app.commands.executeCommandById('nand:add-comment-to-selection');})()`);
		await until(`!!document.querySelector('.nand-editor-comment-prompt')`, 'comment prompt');
		await call(`(()=>{const input=document.querySelector('.nand-editor-comment-prompt');input.value='Probe comment';input.dispatchEvent(new Event('input',{bubbles:true}));[...document.querySelectorAll('.nand-editor-comment-prompt-host button')].find(b=>b.classList.contains('mod-cta')).click();})()`);
		const commented = await until(`(()=>{const notes=app.plugins.plugins.nand.services.peek({owner:'comments',id:'index'})?.notes()??[];return notes.length&&notes})()`, 'comment indexed');
		assert.equal(commented[0].path, 'Welcome.md'); assert.equal(commented[0].open, 1);
		const highlighted = await until(`document.querySelectorAll('.cm-content .nand-editor-comment-hl').length`, 'editor highlight');
		await call(`app.plugins.plugins.nand.openEditorView()`);
		const sidePanel = await until(`(()=>{const leaf=app.workspace.getLeavesOfType('nand-comments-view')[0];const t=leaf?.view.contentEl.innerText??'';return t.includes('Probe comment')&&t.slice(0,80)})()`, 'side panel shows the comment');
		// The right sidebar narrows the workbench; keep it wide so the panel is a column, not an overlay.
		await call(`(async()=>{app.workspace.leftSplit.collapse();await app.plugins.plugins.nand.openWorkbench({feature:'comments',section:'open'});})()`);
		const commentsPanel = await until(`(()=>{const p=nandProbe.panel();return p&&p.items.some(i=>i.label==='Welcome')&&p.items.map(i=>i.label)})()`, 'comments panel lists the note');
		await call(`nandProbe.clickPanelItem('Welcome')`);
		const commentOverview = await until(`(()=>{const t=nandProbe.visiblePage()?.innerText??'';return t.includes('Probe comment')&&{target:nandProbe.target(),title:nandProbe.header().title}})()`, 'overview shows the thread');
		assert.equal(commentOverview.target.resourceId, 'Welcome.md');
		await shot('comments-overview');
		await call(`app.plugins.plugins.nand.setModuleEnabled('comments',false)`); await settle();
		const commentsOff = await call(`({hl:document.querySelectorAll('.cm-content .nand-editor-comment-hl').length,command:!!app.commands.commands['nand:add-comment-to-selection'],rail:nandProbe.rail().map(r=>r.id),side:app.workspace.getLeavesOfType('nand-comments-view')[0]?.view.contentEl.innerText.slice(0,40)})`);
		assert.equal(commentsOff.hl, 0); assert.equal(commentsOff.command, false); assert.equal(commentsOff.rail.includes('comments'), false); assert.ok(!commentsOff.side.includes('Probe comment'));
		await call(`app.plugins.plugins.nand.setModuleEnabled('comments',true)`);
		await until(`document.querySelectorAll('.cm-content .nand-editor-comment-hl').length>0&&app.workspace.getLeavesOfType('nand-comments-view')[0]?.view.contentEl.innerText.includes('Probe comment')`, 'comments back after turning the module on');
		check('comments-are-module-owned-with-side-panel-and-overview', { commented, highlighted, sidePanel, commentsPanel, commentOverview, commentsOff });
		await call(`(()=>{app.workspace.getLeavesOfType('nand-comments-view').forEach(l=>l.detach());app.workspace.rightSplit.collapse();app.workspace.leftSplit.expand();})()`);
		await call(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard'})`);
		await until(`nandProbe.layout()?.kind==='wide'`, 'workbench back in front');

		// ---- Browser tabs -------------------------------------------------------------------------------
		server = createServer((request, response) => { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(`<!doctype html><title>NAND fixture ${request.url === '/two' ? 'two' : 'one'}</title><h1>Native browser fixture</h1>`); });
		server.listen(0, '127.0.0.1'); await once(server, 'listening');
		const url = 'http://127.0.0.1:' + server.address().port + '/';
		await call(`app.plugins.plugins.nand.openBrowser({url:${JSON.stringify(url)}})`);
		const browser = await until(`(()=>{const s=nandProbe.surfaces('nand-browser-view').find(s=>s.state.title==='NAND fixture one');return s&&{id:s.state.id,url:s.state.url}})()`, 'real browser guest navigation');
		await call(`app.plugins.plugins.nand.openBrowser({url:${JSON.stringify(url + 'two')}})`);
		await until(`nandProbe.surfaces('nand-browser-view').some(s=>s.state.title==='NAND fixture two')`, 'second browser page');
		const tabs = await until(`(()=>{const t=nandProbe.tabs();return t.length===2&&t.map(x=>x.title).sort().join('|')==='NAND fixture one|NAND fixture two'&&t})()`, 'two browser tabs titled by their pages');
		assert.equal(tabs.filter((tab) => tab.active).length, 1);
		const browserPanel = await call(`nandProbe.panel()`);
		assert.equal(browserPanel.items.length, 2);
		check('browser-pages-show-as-tabs-and-panel-rows', { tabs, browserPanel });
		await shot('browser-tabs');
		await call(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard'})`);
		await call(`nandProbe.clickRail('browser')`); await settle();
		const back = await call(`nandProbe.target().resourceId`);
		assert.ok(back);
		check('browser-real-guest-identity-survives-ordinary-switch', { ...browser, back });
		await call(`[...nandProbe.shell().querySelectorAll('.nand-tabstrip .nand-tab')].find(t=>t.classList.contains('is-active')).querySelector('.nand-tab-close button').click()`);
		await until(`nandProbe.tabs().length===1`, 'closed one tab');
		assert.equal(await call(`app.workspace.getLeavesOfType('nand-workbench-view').length`), 1);
		assert.equal(await call(`nandProbe.target().feature`), 'browser');
		check('closing-a-browser-tab-keeps-the-workbench-and-shows-the-neighbour');
		// Browser: the agent bridge is opt-in, the settings page comes from the module, off closes guests.
		const bridgeOff = await call(`(async()=>Object.keys(await app.plugins.plugins.nand.services.peek({owner:'browser',id:'agent-bridge'}).environment()))()`);
		assert.deepEqual(bridgeOff, []);
		await call(`app.plugins.plugins.nand.openWorkbench({feature:'settings',section:'browser'})`);
		const accessRow = await until(`(()=>{const rows=[...nandProbe.visiblePage()?.querySelectorAll('.setting-item')??[]];const row=rows.find(r=>/智能体会话|agent sessions/i.test(r.innerText));return row&&{rows:rows.length,checked:row.querySelector('.checkbox-container')?.classList.contains('is-enabled')}})()`, 'browser settings page');
		assert.equal(accessRow.checked, false);
		await call(`[...nandProbe.visiblePage().querySelectorAll('.setting-item')].find(r=>/智能体会话|agent sessions/i.test(r.innerText)).querySelector('.checkbox-container').click()`);
		const bridgeOn = await until(`(async()=>{const env=await app.plugins.plugins.nand.services.peek({owner:'browser',id:'agent-bridge'}).environment();return env.NAND_BROWSER_TOKEN?Object.keys(env).sort():false})()`, 'bridge after opting in', 30000);
		assert.ok(bridgeOn.includes('NAND_BROWSER_CLI'));
		await call(`[...nandProbe.visiblePage().querySelectorAll('.setting-item')].find(r=>/智能体会话|agent sessions/i.test(r.innerText)).querySelector('.checkbox-container').click()`);
		check('browser-agent-bridge-is-opt-in-from-the-module-settings-page', { accessRow, bridgeOn });
		await call(`app.plugins.plugins.nand.setModuleEnabled('browser',false)`); await settle();
		const browserOff = await call(`({surfaces:nandProbe.surfaces('nand-browser-view').length,rail:nandProbe.rail().map(r=>r.id),service:!!app.plugins.plugins.nand.services.peek({owner:'browser',id:'open'})})`);
		assert.deepEqual([browserOff.surfaces, browserOff.rail.includes('browser'), browserOff.service], [0, false, false]);
		await call(`app.plugins.plugins.nand.setModuleEnabled('browser',true)`);
		await until(`nandProbe.rail().some(r=>r.id==='browser')`, 'browser back on');
		await call(`nandProbe.clickRail('browser')`);
		await until(`nandProbe.target()?.feature==='browser'&&nandProbe.surfaces('nand-browser-view').length>0`, 'browser page restored after turning the module back on');
		check('turning-the-browser-off-closes-every-guest', browserOff);

		// ---- Focus mode -----------------------------------------------------------------------------
		await call(`(async()=>{const v=${wbExpr};const b=v.surface.pages.getCurrent();await v.host.openFocus(v.getState().target,b.getState?.()??b.surface.getState(),'tab',window)})()`);
		const focus = await until(`(()=>{const f=app.workspace.getLeavesOfType('nand-workbench-view').map(l=>l.view).find(v=>v.getState().focus);const root=f?.contentEl.querySelector('.nand-shell');return root&&{target:f.getState().target,focusClass:root.classList.contains('is-focus'),rail:!!root.querySelector('.nand-rail'),panel:!!root.querySelector('.nand-panel'),back:!!root.querySelector('.nand-page-open-workbench'),title:f.getDisplayText()}})()`, 'focus leaf');
		assert.equal(focus.focusClass, true); assert.equal(focus.rail, false); assert.equal(focus.panel, false); assert.equal(focus.back, true); assert.equal(focus.target.feature, 'browser');
		check('focus-mode-leaf-shows-only-the-page', focus);
		await shot('focus-mode-browser');
		await call(`app.workspace.getLeavesOfType('nand-workbench-view').map(l=>l.view).find(v=>v.getState().focus).contentEl.querySelector('.nand-page-open-workbench').click()`);
		await until(`app.workspace.getLeavesOfType('nand-workbench-view').length===1`, 'focus leaf closed');
		assert.equal(await call(`nandProbe.target().feature`), 'browser');
		check('focus-mode-back-to-workbench-closes-the-focus-leaf');

		// ---- Settings inside the workbench -----------------------------------------------------------
		await call(`app.plugins.plugins.nand.openSettings()`);
		await until(`nandProbe.target()?.feature==='settings'&&!!nandProbe.visiblePage()?.querySelector('.nand-settings-page .setting-item')`, 'general settings page');
		const settings = await call(`({panel:nandProbe.panel(),title:nandProbe.header().title,rows:nandProbe.visiblePage().querySelectorAll('.setting-item').length,modal:!!document.querySelector('.modal-container .mod-settings')})`);
		assert.equal(settings.modal, false); assert.ok(settings.panel.items.length >= 4); assert.equal(settings.panel.search, true); assert.ok(settings.rows >= 5);
		check('settings-open-inside-the-workbench', settings);
		await shot('settings-general');
		await call(`nandProbe.clickPanelItem(nandProbe.panel().items[1].label)`);
		await until(`nandProbe.target()?.section==='appearance'&&!!nandProbe.visiblePage()?.querySelector('.nand-settings-page select')`, 'appearance page');
		await shot('settings-appearance');
		check('appearance-category-renders');
		await call(`nandProbe.clickPanelItem(nandProbe.panel().items.at(-2).label)`);
		await until(`!!nandProbe.visiblePage()?.querySelector('.nand-settings-page .setting-item')&&nandProbe.target()?.section!=='appearance'`, 'product settings page');
		check('product-settings-category-renders', { section: await call(`nandProbe.target().section`) });
		// Board and automation settings come from their modules; About is an app page.
		const ownedSettings = {};
		for (const section of ['dashboard', 'automation', 'about']) {
			await call(`app.plugins.plugins.nand.openWorkbench({feature:'settings',section:'${section}'})`);
			ownedSettings[section] = await until(`(()=>{const page=nandProbe.visiblePage()?.querySelector('.nand-settings-page');return nandProbe.target()?.section==='${section}'&&page&&(page.querySelectorAll('.setting-item').length||page.querySelectorAll('.dashboard-about-section').length)})()`, 'settings ' + section);
			await shot('settings-' + section);
		}
		assert.ok(ownedSettings.dashboard >= 10, JSON.stringify(ownedSettings));
		check('board-automation-and-about-settings-pages-render', ownedSettings);
		const native = await call(`(async()=>{app.setting.open();app.setting.openTabById('nand');await new Promise(r=>setTimeout(r,200));const names=[...app.setting.activeTab.containerEl.querySelectorAll('.setting-item-name')].map(e=>e.textContent);app.setting.close();return names})()`);
		assert.ok(native.length >= 5 && native.length <= 17 && !native.includes('Markdown'), JSON.stringify(native));
		check('obsidian-settings-tab-is-slim', { native });

		// ---- Layouts --------------------------------------------------------------------------------
		for (const lang of ['zh', 'en']) {
			await call(`(async()=>{const p=app.plugins.plugins.nand;await p.changeLanguage(${JSON.stringify(lang)});await p.openWorkbench({feature:'contacts',section:'person'});})()`);
			for (const width of [1120, 760, 448]) {
				await call(`(()=>{const v=${wbExpr};v.contentEl.style.width='${width}px';v.contentEl.style.maxWidth='100%';})()`); await settle();
				const layout = await call(`({layout:nandProbe.layout(),header:nandProbe.header()})`);
				const expected = width >= 960 ? 'wide' : width >= 600 ? 'medium' : 'narrow';
				assert.equal(layout.layout.kind, expected, JSON.stringify(layout));
				assert.ok(layout.header.overflow <= 2, JSON.stringify(layout));
				assert.ok(Math.abs(layout.layout.main - (layout.layout.width - (layout.layout.rail ? 52 : 0) - layout.layout.panel)) <= 2, JSON.stringify(layout));
				if (expected === 'wide') assert.equal(layout.layout.rail, true);
				if (expected === 'medium') {
					assert.equal(layout.layout.rail, true); assert.equal(layout.header.toggle, true);
					await call(`nandProbe.shell().querySelector('.nand-page-panel-toggle').click()`); await settle();
					assert.match((await call(`nandProbe.layout()`)).overlay, /nand-shell-overlay--medium/);
					await shot(`archives-${lang}-${width}-overlay`);
					await call(`nandProbe.shell().dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await settle();
					assert.equal((await call(`nandProbe.layout()`)).overlay, '');
				}
				if (expected === 'narrow') {
					assert.equal(layout.layout.rail, false); assert.equal(layout.header.toggle, true);
					await call(`nandProbe.shell().querySelector('.nand-page-panel-toggle').click()`); await settle();
					const drawer = await call(`nandProbe.layout()`);
					assert.match(drawer.overlay, /nand-shell-overlay--narrow/); assert.equal(drawer.horizontalRail, true);
					await shot(`archives-${lang}-${width}-drawer`);
					await call(`nandProbe.shell().querySelector('.nand-shell-scrim').click()`); await settle();
				}
				check('layout-' + lang + '-' + width, layout); await shot('archives-' + lang + '-' + width);
			}
		}
		await call(`(()=>{const v=${wbExpr};v.contentEl.style.width='';v.contentEl.style.maxWidth='';})()`);

		// ---- Home overview -------------------------------------------------------------------
		await call(`require('@electron/remote').getCurrentWindow().setSize(1280,1000)`);
		await call(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard'})`);
		await delay(300);
		const overview = await call(`(()=>{const root=${wbExpr}.contentEl;const box=root.querySelector('.nand-workbench-home-overview');const calendar=box?.querySelector('.dashboard-sidebar-week-calendar');const recent=box?.querySelector('.dashboard-recent');const shown=el=>!!el&&el.getClientRects().length>0&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';const hit=el=>{if(!el)return false;el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();const target=document.elementFromPoint(r.left+r.width/2,r.top+Math.min(12,r.height/2));return !!target&&el.contains(target)};return {calendar:shown(calendar),recent:shown(recent),calendarHit:hit(calendar),recentHit:hit(recent),cells:calendar?.querySelectorAll('.dashboard-sidebar-week-cell').length??0,recentItem:!!recent?.querySelector('.dashboard-recent-item')}})()`);
		assert.equal(overview.calendar, true); assert.equal(overview.recent, true);
		assert.equal(overview.calendarHit, true); assert.equal(overview.recentHit, true);
		assert.equal(overview.cells, 7); assert.equal(overview.recentItem, true);
		check('home-overview-calendar-and-recent-visible', overview);
		await shot('home-overview-1280');

		// ---- Records pages: habit, expense, Pomodoro and reading records are pages under Home ----------
		await call(`require('@electron/remote').getCurrentWindow().setSize(1440,1000)`); await settle();
		await call(`(async()=>{const p=app.plugins.plugins.nand;const home=p.settingsNamespace('home');Object.assign(home.get(),{widgetHabitEnabled:true,widgetExpenseEnabled:true,pomodoroEnabled:true,readingEnabled:true});await home.touch();await p.openWorkbench({feature:'dashboard'});})()`);
		const recordLabels = await until(`(()=>{const labels=nandProbe.panel()?.items.map(i=>i.label)??[];return ['Habits','Expenses','Pomodoro','Reading'].every(l=>labels.includes(l))&&labels})()`, 'home panel lists the records pages');
		const strip = await until(`(()=>{const s=nandProbe.surfaces('nand-dashboard-view')[0];return s?.contentEl.querySelectorAll('.dashboard-sidebar-widgets-row').length??0})()`, 'stacked widget strip');
		const recordPages = {};
		for (const [label, section, cls] of [['Habits', 'habits', 'dashboard-habit-stats-modal'], ['Expenses', 'expenses', 'dashboard-expense-stats-modal'], ['Pomodoro', 'pomodoro', 'dashboard-pomodoro-stats-modal'], ['Reading', 'reading', 'dashboard-reading-stats-modal']]) {
			await call(`nandProbe.clickPanelItem(${JSON.stringify(label)})`);
			recordPages[section] = await until(`(()=>{const t=nandProbe.target();const body=nandProbe.visiblePage()?.querySelector('.nand-records-page-body.${cls}');return t?.feature==='records'&&t.section===${JSON.stringify(section)}&&body&&body.childElementCount>0&&{rail:nandProbe.rail().filter(r=>r.active).map(r=>r.id),title:nandProbe.header()?.title,active:nandProbe.panel()?.items.filter(i=>i.active).map(i=>i.label),modals:document.querySelectorAll('.modal-container').length}})()`, 'records page ' + section);
			assert.deepEqual(recordPages[section].rail, ['dashboard']); assert.deepEqual(recordPages[section].active, [label]); assert.equal(recordPages[section].modals, 0);
			await shot('records-' + section);
		}
		await call(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard'})`);
		await until(`!!nandProbe.surfaces('nand-dashboard-view')[0]?.contentEl.querySelector('.dashboard-sidebar-pomodoro-stats-btn')`, 'pomodoro widget');
		await call(`nandProbe.surfaces('nand-dashboard-view')[0].contentEl.querySelector('.dashboard-sidebar-pomodoro-stats-btn').click()`);
		const statsButton = await until(`(()=>{const t=nandProbe.target();return t?.feature==='records'&&t.section==='pomodoro'&&{modals:document.querySelectorAll('.modal-container').length}})()`, 'stats button opens the records page');
		assert.equal(statsButton.modals, 0);
		check('records-are-pages-under-home-and-boards-are-stacked', { recordLabels, strip, recordPages, statsButton });

		// ---- Agent terminal on the native helper ---------------------------
		await call(`require('@electron/remote').getCurrentWindow().setSize(1440,1000)`);
		// The DOM renderer lets the probe read the screen text.
		await call(`app.plugins.plugins.nand.openWorkbench({feature:'settings',section:'terminal'})`);
		await until(`!!nandProbe.visiblePage()?.querySelector('.nand-settings-page .setting-item')`, 'agent settings page');
		const renderer = await call(`(()=>{const row=[...nandProbe.visiblePage().querySelectorAll('.setting-item')].find(r=>/渲染器|Renderer/.test(r.querySelector('.setting-item-name')?.textContent||''));const select=row?.querySelector('select');if(!select)return false;select.value='dom';select.dispatchEvent(new Event('change'));return {rows:nandProbe.visiblePage().querySelectorAll('.setting-item').length}})()`);
		assert.ok(renderer && renderer.rows >= 10, JSON.stringify(renderer));
		check('agent-settings-page-comes-from-the-module', renderer);
		const dead = await call(`(async()=>{const p=app.plugins.plugins.nand;await p.openWorkbench({feature:'terminal',section:'running',resourceId:'terminal-dead'});return {target:nandProbe.target(),message:nandProbe.message(),views:document.querySelectorAll('.nand-terminal-view').length}})()`);
		assert.equal(dead.target.feature, 'terminal'); assert.equal(dead.target.resourceId ?? '', ''); assert.equal(dead.message, ''); assert.equal(dead.views, 0);
		check('dead-terminal-id-opens-section', dead);
		await call(`app.commands.executeCommandById('nand:terminal-new')`);
		const opened = await until(`(()=>{const page=nandProbe.visiblePage();const view=page?.querySelector('.nand-terminal-view:not(.is-hidden) .xterm');const status=page?.querySelector('.nand-agent-pane-status')?.textContent;const target=nandProbe.target();return !!view&&(status==='已连接'||status==='Connected')&&!!target?.resourceId?{status,target,tabs:nandProbe.tabs().length}:false})()`, 'shell session connected', 60000);
		assert.equal(opened.tabs, 1); assert.ok(opened.target.resourceId?.startsWith('terminal-'));
		await delay(400);
		const fill = await call(`(()=>{const page=nandProbe.visiblePage();const rect=el=>{const r=el.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),left:Math.round(r.left),top:Math.round(r.top)}};return {page:rect(page),view:rect(page.querySelector('.nand-terminal-view:not(.is-hidden)')),xterm:rect(page.querySelector('.nand-terminal-view:not(.is-hidden) .xterm-screen'))}})()`);
		assert.ok(fill.view.w >= fill.page.w - 40, JSON.stringify(fill)); assert.ok(fill.view.h >= fill.page.h - 120, JSON.stringify(fill)); assert.ok(fill.view.left - fill.page.left <= 16, JSON.stringify(fill));
		check('embedded-terminal-fills-its-page', fill);
		await call(`nandProbe.visiblePage().querySelector('.nand-terminal-view:not(.is-hidden) textarea').focus()`);
		await c.send('Input.insertText', { text: 'echo nand-qa-$((6*7))' });
		await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
		await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
		const screenText = `(nandProbe.visiblePage()?.querySelector('.nand-terminal-view:not(.is-hidden) .xterm-rows')?.textContent||'')`;
		await until(`${screenText}.includes('nand-qa-42')`, 'shell echoes typed input', 20000);
		for (const lang of ['zh', 'en']) {
			await call(`app.plugins.plugins.nand.changeLanguage(${JSON.stringify(lang)})`);
			const label = await until(`nandProbe.visiblePage()?.querySelector('.nand-agent-pane-status')?.textContent`, 'status label');
			assert.equal(label, lang === 'zh' ? '已连接' : 'Connected', label);
		}
		const sessionRows = await call(`nandProbe.panel().items.map(i=>i.label)`);
		check('connected-shell-echoes-without-agent-activity', { opened, sessionRows: sessionRows.slice(0, 4) });
		await shot('shell-connected-echo');
		// Leaving the page keeps the session; returning replays the screen from the session model.
		await call(`app.plugins.plugins.nand.openWorkbench({feature:'contacts',section:'person'})`); await settle();
		await call(`app.plugins.plugins.nand.openWorkbench({feature:'terminal',section:'running'})`);
		await until(`${screenText}.includes('nand-qa-42')`, 'replayed screen after returning', 20000);
		check('hidden-session-keeps-running-and-replays');
		// A second pane in the same tab runs its own shell.
		await call(`nandProbe.visiblePage().querySelectorAll('.nand-agent-pane-actions button')[1].click()`);
		const split = await until(`(()=>{const panes=nandProbe.visiblePage().querySelectorAll('.nand-agent-pane');const statuses=[...panes].map(p=>p.querySelector('.nand-agent-pane-status')?.textContent);return panes.length===2&&statuses.every(s=>s==='Connected')&&{panes:panes.length,tabs:nandProbe.tabs().length,statuses}})()`, 'split pane', 30000);
		assert.equal(split.tabs, 1);
		check('split-pane-starts-a-second-shell', split);
		await shot('terminal-split');

		// ---- Git sync ----------------------------------------------------------------------------------
		// Off by default: no rail entry and no commands until it is turned on.
		const gitOff = await call(`({state:app.plugins.plugins.nand.moduleState('sync'),rail:nandProbe.rail().map(r=>r.id),commands:Object.keys(app.commands.commands).filter(id=>id.startsWith('nand:sync-'))})`);
		assert.equal(gitOff.rail.includes('sync'), false); assert.deepEqual(gitOff.commands, []); assert.notEqual(gitOff.state, 'active');
		check('git-sync-is-off-by-default', gitOff);
		const vaultDir = process.env.NAND_ACCEPTANCE_VAULT, remote = path.join(dir, 'sync-remote.git'), other = path.join(dir, 'sync-other');
		const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=Probe', '-c', 'user.email=probe@example.com', '-c', 'init.defaultBranch=main', ...args], { cwd, encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } });
		await fs.rm(remote, { recursive: true, force: true }); await fs.rm(other, { recursive: true, force: true });
		await fs.mkdir(remote, { recursive: true }); git(remote, 'init', '--bare', '-q');
		await call(`app.plugins.plugins.nand.setModuleEnabled('sync',true)`);
		await until(`app.plugins.plugins.nand.moduleState('sync')==='active'`, 'sync module active');
		await call(`app.plugins.plugins.nand.openWorkbench({feature:'sync',section:'changes'})`);
		const setup = await until(`(()=>{const page=nandProbe.visiblePage();const el=page?.querySelector('.nand-sync-setup');return el&&{text:el.textContent.slice(0,160),rail:nandProbe.rail().filter(r=>r.slot==='top').map(r=>r.id),commands:Object.keys(app.commands.commands).filter(id=>id.startsWith('nand:sync-')).length}})()`, 'sync setup page');
		assert.ok(setup.rail.includes('sync')); assert.ok(setup.commands >= 12);
		check('git-sync-guides-a-vault-without-a-repository', setup);
		await shot('git-sync-setup');
		await call(`nandProbe.visiblePage().querySelector('.nand-sync-setup .nand-btn--primary').click()`);
		await until(`!!document.querySelector('.nand-dialog .nand-btn--primary')`, 'init confirmation');
		await call(`document.querySelector('.nand-dialog .nand-btn--primary').click()`);
		await until(`!!nandProbe.visiblePage()?.querySelector('.nand-sync-summary')`, 'repository created', 20000);
		assert.ok((await fs.readFile(path.join(vaultDir, '.gitignore'), 'utf8')).includes('/workspace.json'));
		git(vaultDir, 'config', 'user.name', 'Probe'); git(vaultDir, 'config', 'user.email', 'probe@example.com');
		git(vaultDir, 'remote', 'add', 'origin', remote);
		await call(`app.commands.executeCommandById('nand:sync-commit-and-sync')`);
		await until(`!!document.querySelector('.nand-dialog .nand-btn--primary')`, 'publish branch confirmation', 20000);
		await call(`document.querySelector('.nand-dialog .nand-btn--primary').click()`);
		// `git init` in the app uses git's own default branch name; everything below follows whatever it chose.
		const branch = git(vaultDir, 'rev-parse', '--abbrev-ref', 'HEAD').trim();
		const published = await until(`(()=>{const page=nandProbe.visiblePage();const branch=page?.querySelector('.nand-sync-branch')?.textContent??'';return branch.includes(${JSON.stringify('origin/' + branch)})&&!!page.querySelector('.nand-sync-clean')&&{branch,panel:nandProbe.panel()?.items.map(i=>i.label)}})()`, 'published vault', 30000);
		assert.equal(Number(git(remote, 'rev-list', '--count', branch).trim()), 1);
		assert.ok(git(remote, 'ls-tree', '-r', '--name-only', branch).split('\n').includes('Welcome.md'));
		git(remote, 'symbolic-ref', 'HEAD', `refs/heads/${branch}`);
		check('git-sync-commit-and-sync-publishes-the-vault', published);
		await shot('git-sync-published');
		// Another copy changes the same line; the next sync stops on the conflict and pushes nothing.
		git(dir, 'clone', '-q', remote, other);
		await fs.writeFile(path.join(other, 'Welcome.md'), 'Changed on the other device.\n');
		git(other, 'commit', '-q', '-am', 'other device'); git(other, 'push', '-q');
		await call(`(async()=>{await app.vault.modify(app.vault.getFileByPath('Welcome.md'),'Changed in this vault.\\n');})()`);
		await delay(500);
		await call(`app.commands.executeCommandById('nand:sync-commit-and-sync')`);
		const conflict = await until(`(()=>{const page=nandProbe.visiblePage();const banner=page?.querySelector('.nand-sync-conflict');return banner&&{banner:banner.textContent.slice(0,200),files:[...page.querySelectorAll('.nand-sync-file.is-conflict .nand-sync-file-name')].map(e=>e.textContent),status:[...document.querySelectorAll('.nand-workbench-status, .status-bar-item')].map(e=>e.textContent).filter(t=>t.includes('Git')).slice(0,3)}})()`, 'conflict shown', 30000);
		assert.deepEqual(conflict.files, ['Welcome.md']);
		assert.equal(Number(git(remote, 'rev-list', '--count', branch).trim()), 2);
		const markers = await until(`(async()=>{const leaf=app.workspace.getLeaf('tab');await leaf.openFile(app.vault.getFileByPath('Welcome.md'));await new Promise(r=>setTimeout(r,400));const n=leaf.view.containerEl.querySelectorAll('.nand-sync-conflict-actions button').length;leaf.detach();return n})()`, 'editor conflict buttons', 20000);
		assert.ok(markers >= 3);
		check('git-sync-conflict-stops-the-push-and-explains-the-resolution', { ...conflict, editorButtons: markers });
		await call(`app.plugins.plugins.nand.openWorkbench({feature:'sync',section:'changes'})`);
		await shot('git-sync-conflict');
		await call(`nandProbe.visiblePage().querySelector('.nand-sync-conflict .nand-btn--danger').click()`);
		await until(`!!document.querySelector('.nand-dialog .nand-btn--danger')`, 'abort confirmation');
		await call(`document.querySelector('.nand-dialog .nand-btn--danger').click()`);
		await until(`!nandProbe.visiblePage()?.querySelector('.nand-sync-conflict')`, 'conflict aborted', 20000);
		assert.equal(await fs.readFile(path.join(vaultDir, 'Welcome.md'), 'utf8'), 'Changed in this vault.\n');
		assert.equal(git(vaultDir, 'status', '--porcelain'), '');
		check('git-sync-abort-returns-to-the-local-commit');
		await call(`app.plugins.plugins.nand.setModuleEnabled('sync',false)`); await settle();
		const gitGone = await call(`({rail:nandProbe.rail().map(r=>r.id),commands:Object.keys(app.commands.commands).filter(id=>id.startsWith('nand:sync-'))})`);
		assert.equal(gitGone.rail.includes('sync'), false); assert.deepEqual(gitGone.commands, []);
		check('git-sync-off-removes-commands-and-rail', gitGone);

		// ---- Prepare the restart check --------------------------------------------------------------
		await call(`(async()=>{const p=app.plugins.plugins.nand;await p.changeLanguage('zh');await nandProbe.setModule('terminal',false);await p.openWorkbench({feature:'automations',section:'runs'});await p.openWorkbench({feature:'contacts',section:'company'});await new Promise(r=>setTimeout(r,500));const view=nandProbe.wb();const leaf=view.leaf;app.workspace.setActiveLeaf(leaf,{focus:true});leaf.parent?.selectTabIndex?.(leaf.parent.children.indexOf(leaf));app.workspace.requestSaveLayout.cancel();await app.workspace.saveLayout();const layout=JSON.parse(await app.vault.adapter.read(app.vault.configDir+'/workspace.json'));if(layout.active!==leaf.id)throw Error('saved active leaf is not the workbench');})()`);
		check('restart-prepared');
		await delay(1500);
	}
	const errors = await call(`window.nandWorkbenchErrors`); assert.deepEqual(errors, []);
	check('no-unhandled-native-errors');
	await fs.writeFile(path.join(dir, 'result.json'), JSON.stringify({ passed: true, restart, runtime, sourceCommit: process.env.GITHUB_SHA, checks }, null, 2));
} catch (error) {
	try { await shot('failure'); await fs.writeFile(path.join(dir, 'diagnostic.json'), JSON.stringify(await call(`(()=>{const v=nandProbe.wb();return {errors:window.nandWorkbenchErrors,state:v?.getState(),html:v?.contentEl?.innerHTML?.slice(0,12000)}})()`), null, 2)); } catch {}
	await fs.writeFile(path.join(dir, 'result.json'), JSON.stringify({ passed: false, restart, runtime, checks, error: String(error) }, null, 2));
	throw error;
} finally {
	try { await call(`(()=>{window.removeEventListener('error',window.nandWorkbenchErrorHandler);window.removeEventListener('unhandledrejection',window.nandWorkbenchErrorHandler)})()`); } catch {}
	server?.close(); c.close();
}
