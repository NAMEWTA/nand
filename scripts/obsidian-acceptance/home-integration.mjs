// Actual Obsidian: all built-in widget kinds together with News and saved automation actions.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parse as yaml } from 'yaml';
import { launchFreshVault } from './fresh-vault.mjs';

const kinds = ['calendar', 'lunar', 'anniversary', 'countdown', 'habit', 'expense', 'pomodoro', 'reading', 'weather', 'music', 'album', 'year-progress', 'quick-actions', 'skills'];
const newsKinds = ['featured', 'hot', 'view'];
const members = [...kinds.map(kind => ({ memberId: kind, provider: 'home', kind, instanceId: ['anniversary', 'countdown'].includes(kind) ? 'shared' : kind === 'album' ? '1' : 'default' })), ...newsKinds.map(kind => ({ memberId: `news-${kind}`, provider: 'news', kind: `news-${kind}`, instanceId: kind }))];
const original = `---\r\nlayout: immersive\r\nwidgets: ${JSON.stringify(members)}\r\nimmersive: ${JSON.stringify(members.map((m, i) => ({ id: m.memberId, w: 4, cap: 40, x: i % 3 * 4, y: Math.floor(i / 3) * 40 })))}\r\nquickActions: [{name: Review action, icon: bell, type: action, target: review-action}]\r\nskills: [{id: review-skill, label: Review skill, agentId: codex, skillName: review, promptTemplate: '', directSend: false, destination: {kind: fresh, cwd: ''}}]\r\ncustom: keep # personal\r\n---\r\n\r\nKeep this board body.\r\n`;
const action = '---\nnand-type: automation\nnand-id: review-action\nid: review-action\nname: Review action\nenabled: true\ndeviceId: fixture\nrevision: 1\ngraceMinutes: 0\nchannels: []\nnotifyOn: always\ncreatedAt: 1\nupdatedAt: 1\naction: open-file\npath: Target.md\nschedule: manual\n---\n\n<!-- nand:prompt -->\nTarget.md\n<!-- /nand:prompt -->\n';
const runtime = await launchFreshVault({ root: process.argv[2], port: 9276, files: { 'Board.md': original, 'Target.md': '# Action target\n', 'Photos/placeholder.txt': 'No image fixture', 'NAND/自动化/Review/操作.md': action }, settings: { version: 1, namespaces: {
 app: { language: 'en', introSeen: true, modules: { home: true, news: true, agent: true, automations: true, browser: false, archives: false, notifications: false, comments: false, icons: false, sync: false } },
 home: { dashboardFile: 'Board', workspaceFiles: ['Board'], workspaceNames: ['Board'], widgetWeatherCity: '', widgetWeatherLat: '', widgetWeatherLon: '', widgetWeatherEnabled: false, albums: [{ id: 1, folder: 'Photos', intervalSec: 8, recursive: true, ratio: '1:1', transition: 'fade', heightRatio: 'full' }], anniversaries: [{ id: 'shared', label: 'Anniversary', startDate: '2020-01-02', precision: 'ymd', annualReminder: false }], countdowns: [{ id: 'shared', label: 'Countdown', targetDate: '2030-01-01', displayMode: 'days', reminderDays: 0 }] },
 news: { enabled: false, analysisEnabled: false, autoRefresh: false, refreshOnStartup: false, refreshWhenStale: false, sources: [], widgets: newsKinds.map(mode => ({ id: mode, mode, count: 3, showSummary: true, staleMinutes: 60, ...(mode === 'view' ? { viewId: 'empty' } : {}) })), views: [{ id: 'empty', name: 'Empty view', query: '' }] },
} } });
let c = runtime.connection;
const p = 'app.plugins.plugins.nand', rows = [];
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
const until = async expression => { const end = Date.now() + 25000; while (Date.now() < end) { if (await c.evaluate(expression)) return; await delay(80); } throw Error(expression); };
const raw = () => fs.readFile(path.join(runtime.vault, 'Board.md'), 'utf8');
const home = async () => { await c.evaluate(`${p}.openWorkbench({feature:'dashboard',resourceId:'Board'},window)`); await until(`document.querySelectorAll('.nand-immersive-grid [data-tile]').length===17`); await delay(300); };
const click = async expression => {
 await c.send('Page.bringToFront'); await c.evaluate(`window.focus();${expression}.scrollIntoView({block:'center',inline:'center'});true`); await delay(150);
 const point = await c.evaluate(`(()=>{const r=${expression}.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
 await until(`(()=>{const e=${expression},r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()`);
 for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
};
const key = async (name, code) => { for (const type of ['keyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type, key: name, code: name, windowsVirtualKeyCode: code, ...(type === 'keyDown' && name === 'Enter' ? { text: '\r' } : {}) }); await delay(150); };
const actionButton = `document.querySelector('.dashboard-qa-item--saved .dashboard-qa-run')`;
try {
 await c.evaluate('app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();true');
 await c.send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false }); await home();
 await c.evaluate(`app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath('NAND/自动化/Review/操作.md'),fm=>{fm.deviceId=app.loadLocalStorage('nand.device-id')})`);
 await until(`${p}.services.peek({owner:'automations',id:'ui'})?.actions().some(a=>a.id==='review-action'&&!a.unavailable)`);
 await until(`document.querySelectorAll('.dashboard-sidebar-news').length===3`);
 const mounted = await c.evaluate(`Array.from(document.querySelectorAll('.nand-immersive-grid [data-tile]'),e=>({id:e.dataset.tile,text:e.querySelector('.nand-immersive-body').textContent.trim()}))`);
 check('fourteen-builtins-and-three-news-kinds-mounted', mounted.length === 17 && mounted.every(x => x.text.length > 0 && !x.text.includes('Widget unavailable')), mounted);
 check('saved-automation-available-in-registry-widget', await c.evaluate(`${actionButton}&&!${actionButton}.disabled`));
 await click(actionButton); await until(`app.workspace.getLeavesOfType('markdown').some(l=>l.view.file?.path==='Target.md')`); check('automation-button-opens-its-explicit-file', true); await home();
 for (const module of ['news', 'agent', 'automations']) {
  if (module === 'automations') await c.evaluate(`window.retiredAutomations=${p}.services.peek({owner:'automations',id:'ui'});true`);
  await c.evaluate(`${p}.setModuleEnabled(${JSON.stringify(module)},false)`); await delay(350);
  check(`${module}-off-preserves-all-members-and-layout`, await raw() === original && await c.evaluate(`document.querySelectorAll('.nand-immersive-grid [data-tile]').length===17&&${p}.moduleState(${JSON.stringify(module)})==='off'`));
  if (module === 'news') check('news-off-replaces-three-mounts-with-placeholders', await c.evaluate(`document.querySelectorAll('.dashboard-sidebar-news').length===0&&['featured','hot','view'].every(k=>document.querySelector('[data-tile="news-'+k+'"]').textContent.includes('unavailable'))`));
  if (module === 'agent') check('agent-off-disables-skill-with-local-status', await c.evaluate(`document.querySelector('[data-skill-id="review-skill"] button').disabled&&!!document.querySelector('.nand-skills-widget [role="status"]')`));
  if (module === 'automations') check('automations-off-disables-saved-action', await c.evaluate(`${actionButton}.disabled`));
  if (module === 'automations') check('revoked-automation-port-rejects-execution', await c.evaluate(`retiredAutomations.runAction('review-action').then(()=>false,error=>error.code==='moduleOff')`));
  await c.evaluate(`${p}.setModuleEnabled(${JSON.stringify(module)},true)`); await delay(350);
 }
 check('all-modules-return-without-board-write', await raw() === original && await c.evaluate(`document.querySelectorAll('.dashboard-sidebar-news').length===3&&!${actionButton}.disabled`));
 await c.evaluate(`${p}.setModuleEnabled('automations',false)`);
 await c.evaluate(`app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath('NAND/自动化/Review/操作.md'),fm=>{fm.action='unsupported'})`);
 await c.evaluate(`${p}.setModuleEnabled('automations',true)`);
 check('invalid-automation-is-visible-load-error', await c.evaluate(`${p}.services.peek({owner:'automations',id:'ui'}).loadError.includes('Invalid action')&&${actionButton}.disabled`));
 await c.evaluate(`${p}.setModuleEnabled('automations',false)`);
 await c.evaluate(`app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath('NAND/自动化/Review/操作.md'),fm=>{fm.action='open-file'})`);
 await c.evaluate(`${p}.setModuleEnabled('automations',true)`); await until(`!${actionButton}.disabled`);
 check('repaired-definition-reloads-and-restores-action', await c.evaluate(`${p}.services.peek({owner:'automations',id:'ui'}).loadError===''`));
 for (const preset of ['system', 'claude-code', 'eye-care']) for (const dark of [false, true]) for (const width of [500, 800, 1500]) {
  await c.evaluate(`${p}.theme.update(d=>{d.preset=${JSON.stringify(preset)}});app.changeTheme(${JSON.stringify(dark ? 'obsidian' : 'moonstone')});true`);
  await c.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false }); await delay(250);
  const dimensions = await c.evaluate(`(()=>{const g=document.querySelector('.nand-immersive-grid');return{grid:g.scrollWidth-g.clientWidth,tiles:[...g.querySelectorAll('[data-tile]')].map(e=>({id:e.dataset.tile,overflow:e.scrollWidth-e.clientWidth,width:e.clientWidth,height:e.clientHeight})),controls:[...g.querySelectorAll('[data-grid-action]')].every(e=>e.getBoundingClientRect().height>=32)}})()`);
  check(`all-kinds-${preset}-${dark ? 'dark' : 'light'}-${width}`, dimensions.grid <= 1 && dimensions.tiles.every(x => x.overflow <= 1 && x.width > 0 && x.height > 0) && dimensions.controls, dimensions);
  if (preset === 'system' && !dark || preset === 'eye-care' && dark && width === 1500) await runtime.shot(`all-kinds-${preset}-${dark ? 'dark' : 'light'}-${width}`);
 }
 await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
 const moving = await c.evaluate(`Array.from(document.querySelectorAll('.nand-dashboard-root *')).filter(e=>{const s=getComputedStyle(e);return s.animationName!=='none'&&s.animationDuration.split(',').some(t=>parseFloat(t)>0.01)||s.transitionDuration.split(',').some(t=>parseFloat(t)>0.01)}).map(e=>({cls:e.className,animation:getComputedStyle(e).animationDuration,transition:getComputedStyle(e).transitionDuration}))`);
 check('reduced-motion-stops-home-animation-and-transitions', moving.length === 0, moving);
 await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 }); await c.send('Emulation.setDeviceMetricsOverride', { width: 500, height: 1000, deviceScaleFactor: 1, mobile: true }); await delay(200);
 check('coarse-grid-controls44', await c.evaluate(`matchMedia('(pointer:coarse)').matches&&[...document.querySelectorAll('[data-grid-action]')].every(e=>e.getBoundingClientRect().height>=44)`));
 await c.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await c.send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
 check('theme-width-motion-changes-are-readonly', await raw() === original);
 for (const layout of ['side', 'stacked', 'immersive']) {
  await c.evaluate(`(()=>{const e=document.querySelector('[data-board-layout-choice]');e.value=${JSON.stringify(layout)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await delay(500);
  const fm = yaml((await raw()).split('---')[1]); check(`layout-${layout}-retains-every-member`, fm.layout === layout && JSON.stringify(fm.widgets) === JSON.stringify(members));
 }
 const saved = await raw(); await runtime.restart(); c = runtime.connection; await home();
 check('restart-restores-all-kinds-without-rewriting', await raw() === saved && await c.evaluate(`document.querySelectorAll('.dashboard-sidebar-news').length===3&&!${actionButton}.disabled`));
 await click(`[...document.querySelectorAll('.nand-panel button')].find(e=>e.textContent==='New board')`); await until(`!!document.querySelector('.nand-dialog input')`);
 await click(`document.querySelector('.nand-dialog input')`); await c.send('Input.insertText', { text: 'New immersive' });
 await c.evaluate(`(()=>{const e=document.querySelector('.nand-dialog select');e.value='immersive';e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await click(`document.querySelector('.nand-dialog button[type="submit"]')`);
 await until(`${p}.settingsNamespace('home').get().workspaceFiles.length===2`);
 const newPath = await c.evaluate(`${p}.settingsNamespace('home').get().dashboardFile`), fresh = yaml((await fs.readFile(path.join(runtime.vault, newPath+'.md'), 'utf8')).split('---')[1]);
 check('native-create-explicit-immersive-persists-canonical-grid', fresh.layout === 'immersive' && fresh.immersive.length > 0 && fresh.immersive.every(t => Number.isFinite(t.x) && Number.isFinite(t.y) && t.cap > 0), fresh);
 await c.evaluate(`${p}.setModuleEnabled('home',false)`); await until(`!document.querySelector('.nand-dashboard-root')`);
 check('home-disable-clears-all-widget-mounts', await c.evaluate(`document.querySelectorAll('.dashboard-sidebar-widget').length===0`) && await raw() === saved);
 const errors = await c.evaluate('nandAcceptanceErrors'); check('no-native-errors', errors.length === 0, errors);
 await fs.writeFile(path.join(runtime.evidence, 'review.json'), JSON.stringify({ rows, method: 'Actual Obsidian, all widget kinds and native automation open-file action; empty local News data, no provider/model calls', unverified: ['Actual phone hardware and non-Windows platforms', 'Real provider model quality'] }, null, 2));
} catch (error) {
 await fs.writeFile(path.join(runtime.evidence, 'partial.json'), JSON.stringify({ rows, error: String(error), state: await c.evaluate(`({errors:nandAcceptanceErrors,actions:${p}.services.peek({owner:'automations',id:'ui'})?.actions(),loadError:${p}.services.peek({owner:'automations',id:'ui'})?.loadError,body:document.body.innerText})`) }, null, 2));
 await Promise.race([runtime.shot('failure').catch(() => {}), delay(5000)]); throw error;
} finally { console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length, failed: rows.filter(r => !r.passed) })); await runtime.stop(); }
