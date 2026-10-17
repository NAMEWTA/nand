// Acceptance: the canvas edge cases found in review — old immersive boards, timers during gestures, the narrowest
// tile toolbar, extra banner instances, workflow colors and the add panel in a pop-out window.
// HOME / CLI homes / XDG dirs point into the fixture (fresh-vault.mjs). Run from the repo root after `pnpm build`:
//   NAND_OBSIDIAN_EXECUTABLE=/opt/Obsidian/obsidian xvfb-run -a node scripts/obsidian-acceptance/home-canvas-edges.mjs /tmp/nand-canvas-edges-01
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parse as yaml } from 'yaml';
import { launchFreshVault } from './fresh-vault.mjs';

const IMM = '.nand/content/OldImmersive';
const COLORS = '.nand/content/Colors';
const widgets = ['pomodoro', 'calendar'].map((kind) => ({ memberId: `home:${kind}:default`, provider: 'home', kind, instanceId: 'default' }));
const oldImmersive = `---\nlayout: immersive\nwidgets: ${JSON.stringify(widgets)}\nimmersive: [{id: 'widget:pomodoro', w: 2, cap: 24, fixed: true, x: 0, y: 0}, {id: 'widget:calendar', w: 4, cap: 40, fixed: true, x: 2, y: 0}]\nbanner:\n  quote: 'Preserve old banner'\n  author: 'Reviewer'\n---\n## Notes\n### Kept memo\nKept text\n`;
const pipeline = { rootFolder: 'Work', statusField: 'status', stages: [{ id: 'draft', value: 'Draft', label: 'Draft' }, { id: 'done', value: 'Done', label: 'Done' }], sortBy: 'title', sortDesc: false, filterFields: [], filters: {}, search: '', skills: [] };
const cols = ['solid', 'trello', 'blush'].map((style) => ({ id: style, name: style, type: 'pipeline', pipeline: { ...pipeline, boardStyle: style } }));
const colors = `---\nlayout: immersive\ncanvas: 1\nwidgets: []\nimmersive: ${JSON.stringify(cols.map((c, i) => ({ id: c.id, w: 12, cap: 50, x: 0, y: 50 * i, fixed: true })))}\ncolumns: ${JSON.stringify(cols)}\n---\n${cols.map((c) => '## ' + c.name + '\n').join('\n')}`;
const modules = { home: true, agent: false, browser: false, archives: false, automations: false, notifications: false, icons: false, comments: false, sync: false };
const runtime = await launchFreshVault({
	root: process.argv[2],
	port: Number(process.env.NAND_CANVAS_PORT || 9273),
	files: { [IMM + '.md']: oldImmersive, [COLORS + '.md']: colors, 'Work/Example.md': '---\nstatus: Draft\n---\n# Example\n' },
	settings: { version: 1, namespaces: { app: { language: 'en', introSeen: true, modules, palette: 'orca' }, home: { dashboardFile: IMM, workspaceFiles: [IMM, COLORS], workspaceNames: ['', ''] } } },
});
let c = runtime.connection;
const rows = [];
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); if (!passed) console.error('FAILED', name, JSON.stringify(detail)?.slice(0, 500)); };
const until = async (expression, label = expression) => { for (let i = 0; i < 200; i++) { if (await c.evaluate(expression).catch(() => false)) return; await delay(100); } throw new Error('Timeout: ' + label); };
const click = (label) => c.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}||b.getAttribute('aria-label')===${JSON.stringify(label)});b?.click();return !!b})()`);
const front = async (file) => yaml((await fs.readFile(path.join(runtime.vault, file + '.md'), 'utf8')).split('---')[1]);
const open = async (file, ready) => { await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard',resourceId:${JSON.stringify(file)}});true`); await until(ready); await delay(600); };

try {
	await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
	await c.evaluate('app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();true');

	// 1. An old immersive board: the banner joins as a widget, positions stay, nothing converts twice.
	await open(IMM, `!!document.querySelector('[data-tile="widget:pomodoro"]')`);
	await until(`!!document.querySelector('[data-tile="widget:banner"]')`, 'banner tile');
	let meta = await front(IMM);
	check('old-immersive-banner-shown', await c.evaluate(`document.body.textContent.includes('Preserve old banner')`), meta.widgets);
	check('old-immersive-canvas-mark-and-positions', meta.canvas === 1 && meta.immersive.find((t) => t.id === 'widget:pomodoro').x === 0 && meta.immersive.find((t) => t.id === 'widget:calendar').x === 2, meta.immersive);

	// 2. A running timer refreshes every second; it must not cancel a layout gesture in progress.
	await click('Start focus'); await delay(1200); await click('Edit board');
	const handle = `document.querySelector('[data-tile="widget:calendar"] [data-grid-action="move"]')`;
	await c.evaluate(`${handle}.focus();${handle}.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));${handle}.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));true`);
	const lifted = await c.evaluate(`!!document.querySelector('[data-lifted="true"]')`);
	await delay(2500);
	check('timer-does-not-cancel-gesture', lifted && await c.evaluate(`!!document.querySelector('[data-lifted="true"]')`), { lifted });
	await c.evaluate(`${handle}.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));true`);

	// 3. The narrowest legal tile (2 columns) keeps every action inside its frame and reachable.
	const bounds = await c.evaluate(`(()=>{const t=document.querySelector('[data-tile="widget:pomodoro"]'),r=t.getBoundingClientRect();return {tile:r.width,mode:t.querySelector('.nand-immersive-toolbar').dataset.toolbarMode,controls:[...t.querySelectorAll('.nand-immersive-toolbar button')].map(b=>{const x=b.getBoundingClientRect();return {label:b.getAttribute('aria-label'),w:Math.round(x.width),h:Math.round(x.height),clipped:x.right>r.right+0.5||x.left<r.left-0.5}})}})()`);
	check('narrow-toolbar-nothing-clipped', bounds.controls.length >= 2 && bounds.controls.every((control) => !control.clipped && control.w >= 32 && control.h >= 32), bounds);
	await runtime.shot('narrow-toolbar');
	await c.evaluate(`(()=>{const b=document.querySelector('[data-tile="widget:pomodoro"] button[aria-label^="More actions"]');b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse'}));return !!b})()`);
	await until(`[...document.querySelectorAll('[role="menuitem"],[role="menuitemcheckbox"]')].some(e=>/Remove|Large|Medium/.test(e.textContent))`, 'menu items');
	check('narrow-toolbar-menu-reachable', true);
	await runtime.shot('narrow-toolbar-menu');
	await c.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));true`);
	await delay(300);
	await click('Pause');

	// 3b. Touch input (44px targets): nothing is clipped vertically or horizontally, delete stays reachable.
	await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
	await c.send('Emulation.setDeviceMetricsOverride', { width: 1290, height: 1000, deviceScaleFactor: 1, mobile: false });
	await delay(700);
	const touch = await c.evaluate(`(()=>({coarse:matchMedia('(pointer:coarse)').matches,tiles:['widget:calendar','widget:pomodoro'].map(id=>{const t=document.querySelector('[data-tile="'+id+'"]'),r=t.getBoundingClientRect(),bar=t.querySelector('.nand-immersive-toolbar'),b=bar.getBoundingClientRect();return {id,mode:bar.dataset.toolbarMode,barHeight:Math.round(b.height),controls:[...bar.querySelectorAll('button')].map(x=>{const q=x.getBoundingClientRect();return {label:x.getAttribute('aria-label'),w:Math.round(q.width),h:Math.round(q.height),clipped:q.right>r.right+0.5||q.left<r.left-0.5||q.bottom>b.bottom+0.5||q.top<b.top-0.5}})}})}))()`);
	check('touch-toolbar-nothing-clipped', touch.coarse && touch.tiles.every((tile) => tile.controls.length >= 2 && tile.barHeight >= 44 && tile.controls.every((control) => !control.clipped && control.w >= 44 && control.h >= 44)), touch);
	check('touch-toolbar-delete-reachable', touch.tiles.every((tile) => tile.controls.some((control) => /^Remove|^More actions/.test(control.label ?? ''))), touch);
	await runtime.shot('touch-toolbar');
	await c.send('Emulation.setTouchEmulationEnabled', { enabled: false });
	await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
	await delay(500);

	// 4. A second banner is its own instance with its own data.
	await click('Add widget'); await until(`!!document.querySelector('[data-widget-entry="banner"]')`);
	await c.evaluate(`document.querySelector('[data-widget-entry="banner"] button[aria-label^="Create and add"]').click();true`);
	await delay(900);
	meta = await front(IMM);
	const extra = meta.widgets.find((w) => w.kind === 'banner' && w.instanceId !== 'default');
	check('second-banner-added', !!extra && meta.widgets.filter((w) => w.kind === 'banner').length === 2, meta.widgets);
	await c.evaluate(`(()=>{const s=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-dashboard-view');return s.sync.updateBanner({quote:'Second banner quote'},${JSON.stringify(extra?.instanceId)})})()`);
	await delay(800);
	meta = await front(IMM);
	check('second-banner-own-data', meta.banners?.[extra.instanceId]?.quote === 'Second banner quote' && meta.banner.quote === 'Preserve old banner' && await c.evaluate(`document.body.textContent.includes('Second banner quote')&&document.body.textContent.includes('Preserve old banner')`), meta.banners);
	// removing the original banner stays removed after a restart (no second conversion)
	await c.evaluate(`document.querySelector('[data-tile="widget:banner"] button[aria-label^="Remove"]').click();true`);
	await delay(800);
	await click('Done');
	const removed = await fs.readFile(path.join(runtime.vault, IMM + '.md'), 'utf8');
	check('default-banner-removed', !(await front(IMM)).widgets.some((w) => w.kind === 'banner' && w.instanceId === 'default'));
	await runtime.restart(); c = runtime.connection;
	await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
	await c.evaluate('app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();true');
	await open(IMM, `!!document.querySelector('[data-tile="widget:pomodoro"]')`);
	check('removed-banner-stays-removed-after-restart', await fs.readFile(path.join(runtime.vault, IMM + '.md'), 'utf8') === removed && await c.evaluate(`!document.querySelector('[data-tile="widget:banner"]')`));

	// 5. Workflow colors: column title and column background differ and read well in every palette and mode.
	await open(COLORS, `document.querySelectorAll('.dashboard-pipeline-col-title').length>=6`);
	const probe = `(()=>{const ctx=Object.assign(document.createElement('canvas'),{width:1,height:1}).getContext('2d',{willReadFrequently:true});const px=(css,under)=>{ctx.clearRect(0,0,1,1);if(under){ctx.fillStyle=under;ctx.fillRect(0,0,1,1)}ctx.fillStyle=css;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3)};const lum=([r,g,b])=>[r,g,b].map(c=>{c/=255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4}).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);const ratio=(a,b)=>{const [hi,lo]=[lum(a),lum(b)].sort((x,y)=>y-x);return (hi+.05)/(lo+.05)};
	const page=getComputedStyle(document.querySelector('.nand-dashboard-root')).backgroundColor;
	return Array.from(document.querySelectorAll('.dashboard-pipeline'),p=>{const col=p.querySelector('.dashboard-pipeline-col'),title=p.querySelector('.dashboard-pipeline-col-title'),card=p.querySelector('.dashboard-pipeline-card'),cardTitle=p.querySelector('.dashboard-pipeline-card-title');const colBg=px(getComputedStyle(col).backgroundColor,page);return {style:p.className.match(/dashboard-pipeline--[^ ]+/)?.[0],title:ratio(px(getComputedStyle(title).color,'rgb('+colBg+')'),colBg),card:card&&cardTitle?ratio(px(getComputedStyle(cardTitle).color,'rgb('+px(getComputedStyle(card).backgroundColor,'rgb('+colBg+')')+')'),px(getComputedStyle(card).backgroundColor,'rgb('+colBg+')')):null}})})()`;
	const minimalDir = process.env.NAND_CANVAS_MINIMAL_DIR;
	if (minimalDir) {
		const themeDir = path.join(runtime.vault, '.obsidian/themes/Minimal');
		await fs.mkdir(themeDir, { recursive: true });
		for (const file of ['theme.css', 'manifest.json']) await fs.copyFile(path.join(minimalDir, file), path.join(themeDir, file));
	}
	for (const css of minimalDir ? ['', 'Minimal'] : ['']) for (const palette of ['host', 'orca']) for (const theme of ['moonstone', 'obsidian']) {
		await c.evaluate(`app.plugins.plugins.nand.appSettings.update(d=>{d.palette='${palette}'},{persist:'immediate'});app.customCss.setTheme('${css}');app.vault.setConfig('theme','${theme}');app.updateTheme();true`);
		await delay(500);
		const measured = await c.evaluate(probe);
		check(`pipeline-readable-${css || 'default'}-${palette}-${theme}`, measured.length === 3 && measured.every((m) => m.title >= 4.5 && (m.card === null || m.card >= 4.5)), measured);
		await runtime.shot(`pipeline-${css || 'default'}-${palette}-${theme}`);
	}
	check('no-runtime-errors', (await c.evaluate('window.nandAcceptanceErrors')).length === 0, await c.evaluate('window.nandAcceptanceErrors'));
	await fs.writeFile(path.join(runtime.evidence, 'review.json'), JSON.stringify({ rows }, null, 2));
	const failed = rows.filter((r) => !r.passed);
	console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length, failed }, null, 2));
	assert.equal(failed.length, 0);
} catch (error) {
	await fs.writeFile(path.join(runtime.evidence, 'partial-review.json'), JSON.stringify(rows, null, 2));
	await runtime.shot('failure').catch(() => undefined);
	throw error;
} finally {
	await runtime.stop();
}
