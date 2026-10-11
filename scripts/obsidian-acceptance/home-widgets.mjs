import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const members = [
	{ memberId: 'year', provider: 'home', kind: 'year-progress', instanceId: 'default' },
	{ memberId: 'countdown', provider: 'home', kind: 'countdown', instanceId: 'shared', label: 'Shared countdown' },
	{ memberId: 'news', provider: 'news', kind: 'news-featured', instanceId: 'featured', label: 'News reader' },
	{ memberId: 'external', provider: 'browser', kind: 'calendar', instanceId: 'default', label: 'External calendar' },
	{ memberId: 'broken', provider: 'browser', kind: 'broken', instanceId: 'default' },
	{ memberId: 'slow', provider: 'browser', kind: 'slow', instanceId: 'default' },
];
const board = layout => `---\r\nlayout: ${layout}\r\nwidgets: ${JSON.stringify(members)}\r\nimmersive: [{id: news, w: 4, cap: 40, x: 0, y: 0}]\r\ncustom: keep # personal\r\n---\r\n\r\n<!-- Keep this body -->\r\n\r\n## Notes\r\n`;
const originals = { 'A.md': board('stacked'), 'B.md': board('side') };
const runtime = await launchFreshVault({ root: process.argv[2], port: 9262, files: originals, settings: { version: 1, namespaces: {
	app: { language: 'en', introSeen: true, modules: { home: true, news: false, agent: false, browser: false, archives: false, automations: false, notifications: false, icons: false, comments: false, sync: false } },
	home: { dashboardFile: 'A', workspaceFiles: ['A', 'B'], workspaceNames: ['A', 'B'], widgetWeatherEnabled: false, widgetLunarEnabled: false, widgetMusicEnabled: false, pomodoroEnabled: false, widgetQuickActionsEnabled: false, widgetYearProgressEnabled: false, countdownEnabled: false, countdowns: [{ id: 'shared', label: 'Shared countdown', targetDate: '2030-01-01', displayMode: 'days', reminderDays: 0 }], widgetOrder: ['calendar', 'weather'] },
} } });
let c = runtime.connection;
const rows = [];
const check = (name, passed, detail) => rows.push({ name, passed, detail });
const until = async expression => { const end = Date.now() + 15000; while (Date.now() < end) { if (await c.evaluate(expression)) return; await delay(50); } throw Error(expression); };
const navigate = async resourceId => { await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard',resourceId:${JSON.stringify(resourceId)}})`); await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getState().target.resourceId===${JSON.stringify(resourceId)})`); await delay(180); };
const surface = `app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-dashboard-view')`;
const openCatalog = async () => {
	await c.send('Page.bringToFront');
	await c.evaluate('window.focus()');
	await delay(100);
	const point = await c.evaluate(`(()=>{const el=[...document.querySelectorAll('.nand-board-controls button')].find(e=>e.textContent==='Board widgets');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
	await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
	await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
};
const snapshot = () => c.evaluate(`Array.from(document.querySelectorAll('.nand-dashboard-root [data-widget-member]'),e=>({id:e.dataset.widgetMember,text:e.textContent}))`);
const bytes = name => fs.readFile(path.join(runtime.vault, `${name}.md`), 'utf8');
const fixture = `(()=>{
	const r=app.plugins.plugins.nand.registry;window.widgetEvents??={mount:0,dispose:0,lateDispose:0,ticks:0};
	const kinds=['calendar','broken','slow'].map(key=>({key,titleKey:'home.widget.calendar',icon:'calendar',defaultSize:{w:3,h:30},minSize:{w:1,h:3},instances:()=>[{id:'default'}],render:async(host,ctx)=>{
		if(key==='broken')throw Error('fixture render failure');
		if(key==='slow'){await new Promise(resolve=>setTimeout(resolve,220));return()=>widgetEvents.lateDispose++;}
		widgetEvents.mount++;window.fixtureWidgetContext=ctx;host.createDiv({cls:'dashboard-sidebar-widget',text:'External calendar mounted'});const timer=ctx.window.setInterval(()=>widgetEvents.ticks++,20);const off=()=>{ctx.window.clearInterval(timer);widgetEvents.dispose++};ctx.register(off);ctx.register(off);return off;
	}}));
	r.contributions.get('home:widgets').set('browser',{kinds});for(const cb of r.contributionWatchers.get('home:widgets')??[])cb();return true;
})()`;
const revoke = `(()=>{const r=app.plugins.plugins.nand.registry;r.contributions.get('home:widgets').delete('browser');for(const cb of r.contributionWatchers.get('home:widgets')??[])cb();return true})()`;
try {
	await c.evaluate('app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();true');
	await c.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
	await navigate('A');
	await until(`!!document.querySelector('.dashboard-sidebar-year-progress')`);
	let state = await snapshot();
	check('saved-members-ignore-old-global-enable-flags', state.length === 6 && state.some(item => item.id === 'countdown' && item.text.includes('Shared countdown')), state);
	check('disabled-and-unknown-members-visible', state.filter(item => ['news', 'external', 'broken', 'slow'].includes(item.id)).every(item => item.text.includes('unavailable')));
	await navigate('B'); await until(`!!document.querySelector('.dashboard-sidebar-year-progress')`);
	check('side-and-stacked-use-same-host', (await snapshot()).length === 6);
	check('readonly-both-files-byte-identical', await bytes('A') === originals['A.md'] && await bytes('B') === originals['B.md']);
	await navigate('A');
	await c.evaluate('app.plugins.plugins.nand.setModuleEnabled("news",true)');
	await until(`!!document.querySelector('[data-widget-member="news"] .dashboard-sidebar-news')`);
	check('news-contribution-mounted-in-existing-member', (await snapshot()).find(item => item.id === 'news')?.text.includes('No news to show'));
	check('provider-enable-no-board-writes', await bytes('A') === originals['A.md']);
	await c.evaluate('app.plugins.plugins.nand.setModuleEnabled("news",false)');
	await until(`document.querySelector('[data-widget-member="news"]')?.textContent.includes('unavailable')`);
	check('provider-disable-preserves-position-and-bytes', (await snapshot()).findIndex(item => item.id === 'news') === 2 && await bytes('A') === originals['A.md']);
	await c.evaluate('app.plugins.plugins.nand.setModuleEnabled("news",true)');
	await until(`document.querySelectorAll('[data-widget-member="news"] .dashboard-sidebar-news').length===1`);
	check('provider-reenable-mounts-once', true);
	await c.evaluate(fixture);
	await until(`document.querySelector('[data-widget-member="external"]')?.textContent.includes('External calendar mounted')`);
	await until(`document.querySelector('[data-widget-member="broken"]')?.textContent.includes('fixture render failure')`);
	check('external-same-kind-name-and-local-error-isolation', !!await c.evaluate(`document.querySelector('.dashboard-sidebar-year-progress')&&document.querySelector('.dashboard-sidebar-news')`));
	await delay(60);
	check('mounted-provider-timer-really-runs', await c.evaluate('widgetEvents.ticks') > 0);
	await c.evaluate(`fixtureWidgetContext.reportError(new Error('fixture async update failure'))`);
	await until(`document.querySelector('[data-widget-member="external"]')?.textContent.includes('fixture async update failure')`);
	check('async-update-error-releases-instance', await c.evaluate('widgetEvents.dispose===widgetEvents.mount'));
	await c.evaluate(revoke);
	await until(`document.querySelector('[data-widget-member="external"]')?.textContent.includes('unavailable')`);
	await delay(300);
	let events = await c.evaluate('window.widgetEvents');
	check('cleanup-once-and-late-async-disposed', events.dispose === events.mount && events.lateDispose === 1, events);
	const ticks = events.ticks; await delay(100);
	check('no-timer-after-provider-removal', await c.evaluate('widgetEvents.ticks') === ticks);
	check('fixture-provider-never-edits-board', await bytes('A') === originals['A.md']);
	await openCatalog();
	await until(`!!document.querySelector('.nand-widget-catalog')`);
	check('present-singleton-not-offered-again', !await c.evaluate(`[...document.querySelectorAll('.nand-widget-catalog button')].some(e=>e.textContent==='Add Year progress')`));
	await c.evaluate(`(()=>{const row=document.querySelector('[data-member-id="countdown"]');[...row.querySelectorAll('button')].find(e=>e.textContent==='Remove from board').click()})()`);
	await c.evaluate(`[...document.querySelectorAll('.nand-dialog-footer button')].find(e=>e.textContent==='Cancel').click()`);
	check('catalog-cancel-no-write', await bytes('A') === originals['A.md']);
	await openCatalog();
	await until(`!!document.querySelector('.nand-widget-catalog')`);
	await c.evaluate(`[...document.querySelectorAll('[data-member-id="countdown"] button')].find(e=>e.textContent==='Remove from board').click()`);
	await delay(30);
	await c.evaluate(`[...document.querySelectorAll('.nand-dialog-footer button')].find(e=>e.textContent==='Save').click()`);
	await until(`!document.querySelector('[data-widget-member="countdown"]')`);
	await delay(150);
	check('membership-remove-persists-current-board-only', !/"memberId":"countdown"/.test(await bytes('A')) && await bytes('B') === originals['B.md']);
	check('shared-instance-not-deleted', await c.evaluate(`app.plugins.plugins.nand.settingsNamespace('home').get().countdowns.some(item=>item.id==='shared')`));
	await navigate('B'); await until(`!!document.querySelector('[data-widget-member="countdown"] .dashboard-sidebar-countdown')`);
	check('other-board-retains-instance', true);
	await navigate('A');
	await openCatalog();
	await until(`!!document.querySelector('.nand-widget-catalog')`);
	await c.evaluate(`[...document.querySelectorAll('.nand-widget-catalog button')].find(e=>e.textContent==='Add Shared countdown').click()`);
	await delay(40);
	await c.evaluate(`[...document.querySelectorAll('.nand-dialog-footer button')].find(e=>e.textContent==='Save').click()`);
	await until(`!!document.querySelector('.dashboard-sidebar-countdown')`);
	check('existing-instance-can-be-added-again', true);
	check('global-order-unmodified', await c.evaluate(`JSON.stringify(app.plugins.plugins.nand.settingsNamespace('home').get().widgetOrder)==='["calendar","weather"]'`));
	await openCatalog(); await until(`!!document.querySelector('.nand-widget-catalog')`);
	const beforeOrder = await c.evaluate(`[...document.querySelectorAll('.nand-widget-catalog li')].map(e=>e.dataset.memberId)`);
	await c.evaluate(`[...document.querySelectorAll('.nand-widget-catalog li:last-child button')].find(e=>e.textContent==='Move up').focus()`);
	await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
	await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
	await delay(50);
	const afterOrder = await c.evaluate(`[...document.querySelectorAll('.nand-widget-catalog li')].map(e=>e.dataset.memberId)`);
	check('keyboard-member-reorder', afterOrder.at(-2) === beforeOrder.at(-1) && afterOrder.at(-1) === beforeOrder.at(-2), { beforeOrder, afterOrder });
	await c.evaluate(`[...document.querySelectorAll('.nand-dialog-footer button')].find(e=>e.textContent==='Save').click()`); await delay(180);
	check('member-order-rendered-and-saved', JSON.stringify((await snapshot()).map(item => item.id)) === JSON.stringify(afterOrder));
	await c.evaluate(`(()=>{const button=document.querySelector('.dashboard-sidebar-pin-btn');if(!button.classList.contains('dashboard-sidebar-pin-btn--active'))button.click()})()`);
	await delay(150);
	await runtime.shot('widgets-stacked');
	const savedA = await bytes('A');
	await runtime.restart(); c = runtime.connection; await navigate('A');
	await until(`!!document.querySelector('.dashboard-sidebar-countdown')`);
	check('restart-preserves-members-and-original-text', await bytes('A') === savedA && savedA.includes('<!-- Keep this body -->') && savedA.includes('# personal'));
	check('restart-other-board-byte-identical', await bytes('B') === originals['B.md']);
	await c.evaluate(`${surface}.refresh()`); await delay(150);
	check('unchanged-refresh-keeps-single-mounted-widget', await c.evaluate(`document.querySelectorAll('.dashboard-sidebar-countdown').length===1`));
	await openCatalog(); await until(`!!document.querySelector('.nand-widget-catalog')`);
	await navigate('B'); await until(`!document.querySelector('.nand-widget-catalog')`);
	check('leaving-board-closes-owned-catalog-without-write', await bytes('A') === savedA);
	await navigate('A');
	await c.evaluate(fixture); await until(`document.querySelector('[data-widget-member="external"]')?.textContent.includes('External calendar mounted')`);
	await openCatalog(); await until(`!!document.querySelector('.nand-widget-catalog')`);
	await c.evaluate('app.plugins.plugins.nand.setModuleEnabled("home",false)'); await delay(300);
	check('home-disable-cleans-mounted-and-pending-provider', await c.evaluate('widgetEvents.dispose===widgetEvents.mount&&widgetEvents.lateDispose===1'));
	check('home-disable-closes-owned-dialog', !await c.evaluate(`!!document.querySelector('.nand-widget-catalog')`));
	const errors = await c.evaluate('window.nandAcceptanceErrors'); check('no-unhandled-runtime-errors', errors.length === 0, errors);
	await fs.writeFile(path.join(runtime.evidence, 'review.json'), JSON.stringify({ rows, scope: 'Real Obsidian, real news module toggles, controlled external contribution fixture; no model calls or news source collection. Existing home services may fetch holiday data.' }, null, 2));
	const failed = rows.filter(row => !row.passed); console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length, failed }, null, 2)); assert.equal(failed.length, 0);
} catch (error) { await fs.writeFile(path.join(runtime.evidence, 'partial-review.json'), JSON.stringify(rows, null, 2)); await fs.writeFile(path.join(runtime.evidence, 'failure-state.json'), JSON.stringify(await c.evaluate(`({errors:window.nandAcceptanceErrors,notices:[...document.querySelectorAll('.notice')].map(e=>e.textContent),dialog:document.querySelector('.nand-dialog')?.outerHTML,callbacks:Object.keys(${surface}.createCallbacks()),state:app.plugins.plugins.nand.moduleState('home')})`), null, 2)); await runtime.shot('failure').catch(() => undefined); throw error; }
finally { await runtime.stop(); }
