// Acceptance: the board is one widget canvas. Old boards convert once, edit mode adds / moves / resizes / removes
// widgets with one write per gesture, layouts survive a restart, and colors follow NAND's palette in every theme.
// All HOME / CLI homes / XDG dirs point into the fixture (fresh-vault.mjs). Run from the repo root after `pnpm build`:
//   NAND_OBSIDIAN_EXECUTABLE=/opt/Obsidian/obsidian NAND_CANVAS_MINIMAL_DIR=~/refs/obsidian-minimal-9.0.2 \
//   xvfb-run -a node scripts/obsidian-acceptance/home-canvas.mjs /tmp/nand-canvas-01
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parse as yaml } from 'yaml';
import { launchFreshVault } from './fresh-vault.mjs';

const BOARD = '.nand/content/Legacy';
const legacy = `---\nlayout: stacked\nbanner:\n  quote: "Keep going"\n  author: "Me"\n---\n\n## Notes\n\n### Grouped memo\nid: grouped\ntype: generic\nVisible grouped body.\n`;
const modules = { home: true, agent: false, browser: false, archives: false, automations: false, notifications: false, icons: false, comments: false, sync: false };
const runtime = await launchFreshVault({
	root: process.argv[2],
	port: Number(process.env.NAND_CANVAS_PORT || 9271),
	files: { [BOARD + '.md']: legacy },
	settings: { version: 1, namespaces: {
		app: { language: 'en', introSeen: true, modules, palette: 'orca' },
		home: { dashboardFile: BOARD, workspaceFiles: [BOARD], workspaceNames: [''], widgetCalendarEnabled: true, widgetQuickActionsEnabled: true, widgetLunarEnabled: false, pomodoroEnabled: false },
	} },
});
let c = runtime.connection;
const rows = [];
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); if (!passed) console.error('FAILED', name, JSON.stringify(detail)?.slice(0, 600)); };
const until = async (expression, label = expression) => { const end = Date.now() + 20000; while (Date.now() < end) { if (await c.evaluate(expression).catch(() => false)) return; await delay(80); } throw new Error('Timeout: ' + label); };
const bytes = () => fs.readFile(path.join(runtime.vault, BOARD + '.md'), 'utf8');
const meta = async () => { const text = await bytes(); const front = yaml(text.split('---')[1] ?? ''); return { text, widgets: front.widgets ?? null, tiles: front.immersive ?? null, layout: front.layout, columns: front.columns }; };
const width = async (value, height = 1000) => { await c.send('Emulation.setDeviceMetricsOverride', { width: value, height, deviceScaleFactor: 1, mobile: false }); await delay(500); };
const open = async () => { await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard',resourceId:${JSON.stringify(BOARD)}})`); await until(`!!document.querySelector('.nand-immersive-grid [data-tile]')`, 'canvas tiles'); await delay(600); };
const click = (selector, text) => c.evaluate(`(()=>{const els=[...document.querySelectorAll(${JSON.stringify(selector)})];const el=${text ? `els.find(e=>e.textContent.trim()===${JSON.stringify(text)}||e.getAttribute('aria-label')===${JSON.stringify(text)})` : 'els[0]'};if(!el)return false;el.click();return true})()`);
const clickByLabel = (label) => c.evaluate(`(()=>{const el=[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)}||e.textContent.trim()===${JSON.stringify(label)});if(!el)return false;el.click();return true})()`);
const tiles = () => c.evaluate(`Array.from(document.querySelectorAll('.nand-immersive-grid [data-tile]'),e=>({id:e.dataset.tile,key:e.dataset.widgetKey??null,column:e.style.gridColumn,row:e.style.gridRow,w:e.clientWidth,h:e.clientHeight,text:e.textContent.slice(0,80)}))`);
const state = () => c.evaluate(`(()=>{const g=document.querySelector('.nand-immersive-grid');return {editing:g?.dataset.editing,columns:g?.dataset.columns,sidebar:!!document.querySelector('.dashboard-sidebar'),editVisible:[...document.querySelectorAll('[data-grid-action="resize"]')].some(e=>e.getClientRects().length>0)}})()`);
const point = (id, action = 'move') => c.evaluate(`(()=>{const e=document.querySelector('[data-tile="${id}"] [data-grid-action="${action}"]');const t=document.querySelector('[data-tile="${id}"]');t.scrollIntoView({block:'center'});const r=(${action === 'move'}?t:e).getBoundingClientRect();return ${action === 'move'}?{x:r.x+r.width/2,y:r.y+r.height*0.7}:{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
const mouse = (type, p) => c.send('Input.dispatchMouseEvent', { type, ...p, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const count = () => c.evaluate(`window.boardWrites`);
const hookWrites = () => c.evaluate(`(()=>{window.boardWrites=0;if(window.boardHooked)return true;window.boardHooked=true;const hit=(f)=>String(f?.path??f).endsWith('Legacy.md');for(const [o,k] of [[app.vault,'process'],[app.vault.adapter,'process'],[app.vault.adapter,'write']]){const orig=o[k];if(!orig)continue;o[k]=function(f,...a){if(hit(f))window.boardWrites++;return orig.call(this,f,...a)}}return true})()`);

try {
	await c.evaluate('app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();true');
	await width(1440);
	// 1. Opening an old board converts it once.
	await hookWrites();
	await open();
	let m = await meta();
	check('old-board-converted-to-canvas', m.layout === 'immersive' && m.widgets?.some((w) => w.kind === 'banner') && m.widgets?.some((w) => w.kind === 'calendar') && m.widgets?.some((w) => w.kind === 'quick-actions') && !m.widgets?.some((w) => w.kind === 'lunar') && m.tiles?.every((t) => Number.isFinite(t.x) && Number.isFinite(t.y)), m);
	check('conversion-kept-card-data', m.text.includes('Visible grouped body.') && m.text.includes('Keep going'), m.text.slice(0, 300));
	check('conversion-wrote-once-and-no-sidebar', (await count()) <= 1 && !(await state()).sidebar, await count());
	const converted = await bytes();
	await runtime.shot('01-converted-1440');
	// 2. Outside edit mode nothing drags and the edit chrome is hidden.
	let s = await state();
	check('view-mode-hides-edit-chrome', s.editing === 'false' && !s.editVisible, s);
	let origin = await point('widget:calendar');
	await mouse('mousePressed', origin); await mouse('mouseMoved', { x: origin.x + 160, y: origin.y + 80 }); await mouse('mouseReleased', { x: origin.x + 160, y: origin.y + 80 }); await delay(400);
	check('view-mode-never-drags', (await bytes()) === converted, 'bytes changed');
	// 3. Edit mode: add a widget at a chosen size, one write.
	await click('button', 'Edit board'); await until(`document.querySelector('.nand-immersive-grid').dataset.editing==='true'`);
	s = await state(); check('edit-mode-shows-chrome', s.editVisible, s);
	await runtime.shot('02-edit-mode-1440');
	await hookWrites();
	await clickByLabel('Add widget'); await until(`!!document.querySelector('[data-widget-entry]')`);
	await runtime.shot('03-add-panel-1440');
	await c.evaluate(`(()=>{const i=document.querySelector('input[aria-label="Search widgets"]');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'pomo');i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
	await until(`document.querySelectorAll('[data-widget-entry]').length===1 && !!document.querySelector('[data-widget-entry="pomodoro"]')`, 'search result');
	check('add-panel-search-filters', true);
	await c.evaluate(`[...document.querySelectorAll('[data-widget-entry="pomodoro"] button')].find(b=>b.textContent.trim()==='L').click();true`);
	await delay(150);
	const footprint = await c.evaluate(`(()=>{const f=document.querySelector('[data-widget-entry="pomodoro"] [data-testid="footprint"]');return {w:f.style.width,h:f.style.height}})()`);
	check('add-panel-size-preview-follows-tier', Math.abs(parseFloat(footprint.w) - 100 / 3) < 0.01, footprint);
	await clickByLabel('Add Pomodoro'); await until(`!!document.querySelector('[data-tile="widget:pomodoro"]')`, 'pomodoro tile'); await delay(500);
	m = await meta(); const pomo = m.tiles.find((t) => t.id === 'widget:pomodoro');
	check('add-writes-once-at-chosen-size', (await count()) === 1 && pomo?.w === 4 && pomo?.cap === 32 && pomo.fixed === true, { writes: await count(), pomo });
	check('add-keeps-other-positions', converted.split('\n').filter((l) => l.startsWith('immersive:')).every(() => true) && yaml(converted.split('---')[1]).immersive.every((t) => { const n = m.tiles.find((x) => x.id === t.id); return n && n.x === t.x && n.y === t.y; }));
	// 4. Size tiers.
	await hookWrites();
	await clickByLabel('Set Pomodoro to Small'); await delay(500);
	m = await meta();
	check('tier-switch-writes-once', (await count()) === 1 && m.tiles.find((t) => t.id === 'widget:pomodoro').w === 3 && m.tiles.find((t) => t.id === 'widget:pomodoro').cap === 16, { writes: await count(), tile: m.tiles.find((t) => t.id === 'widget:pomodoro') });
	// 5. Drag in edit mode (whole tile), one write.
	await hookWrites();
	origin = await point('widget:pomodoro'); const target = await point('widget:quickActions');
	await mouse('mousePressed', origin); await mouse('mouseMoved', { x: origin.x + 10, y: origin.y + 10 }); await mouse('mouseMoved', target); await delay(150); await mouse('mouseReleased', target); await delay(600);
	check('edit-drag-writes-once', (await count()) === 1, await count());
	// 6. Resize handle, one write.
	await hookWrites();
	const before = (await meta()).tiles.find((t) => t.id === 'widget:pomodoro');
	origin = await point('widget:pomodoro', 'resize');
	await mouse('mousePressed', origin); await mouse('mouseMoved', { x: origin.x + 4, y: origin.y + 10 }); await mouse('mouseMoved', { x: origin.x + 120, y: origin.y + 90 }); await delay(150); await mouse('mouseReleased', { x: origin.x + 120, y: origin.y + 90 }); await delay(600);
	const after = (await meta()).tiles.find((t) => t.id === 'widget:pomodoro');
	check('resize-writes-once-and-grows', (await count()) === 1 && (after.w > before.w || after.cap > before.cap), { before, after, writes: await count() });
	// 7. Keyboard (Enter picks up, arrows move, Enter drops).
	await hookWrites();
	await c.evaluate(`document.querySelector('[data-tile="widget:pomodoro"] [data-grid-action="move"]').focus();true`); await delay(100);
	const key = async (name, code) => { await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: code }); await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: code }); };
	await key('Enter', 13); await key('ArrowDown', 40); await key('ArrowDown', 40); await key('Enter', 13); await delay(500);
	check('keyboard-move-writes-once', (await count()) === 1, await count());
	await hookWrites();
	await c.evaluate(`document.querySelector('[data-tile="widget:pomodoro"] [data-grid-action="move"]').focus();true`); await key('Enter', 13); await key('ArrowDown', 40); await key('Escape', 27); await delay(300);
	check('keyboard-escape-cancels-without-write', (await count()) === 0, await count());
	// 8. Remove the widget.
	await clickByLabel('Remove Pomodoro from this board'); await delay(600);
	m = await meta();
	check('remove-drops-member-and-tile', !m.widgets.some((w) => w.kind === 'pomodoro') && !m.tiles.some((t) => t.id === 'widget:pomodoro'), m.widgets);
	// 9. Section as a widget.
	await clickByLabel('Add widget'); await until(`!!document.querySelector('[data-widget-entry="section-todo"]')`);
	await clickByLabel('Add To-do'); await delay(700);
	m = await meta();
	check('section-widget-adds-column', /### |## /.test(m.text) && m.tiles.some((t) => t.id.startsWith('section:')), m.tiles.map((t) => t.id));
	// Done
	await click('button', 'Done'); await until(`document.querySelector('.nand-immersive-grid').dataset.editing==='false'`);
	await runtime.shot('04-after-edit-1440');
	const saved = await bytes(); const positions = (await tiles()).map((t) => [t.id, t.column, t.row]);
	// 10. Restart keeps the layout.
	await runtime.restart(); c = runtime.connection; await c.evaluate('app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();true'); await width(1440); await open();
	check('restart-keeps-bytes-and-positions', (await bytes()) === saved && JSON.stringify((await tiles()).map((t) => [t.id, t.column, t.row])) === JSON.stringify(positions), { positions, after: (await tiles()).map((t) => [t.id, t.column, t.row]) });
	// 11. Narrow: one column projection, no writes.
	await hookWrites();
	await width(560);
	s = await state();
	check('narrow-projects-one-column', s.columns === '1', s);
	const narrow = await tiles();
	check('narrow-tiles-stack-full-width', narrow.every((t) => /^1 \/ span 1$/.test(t.column)), narrow.map((t) => t.column));
	await runtime.shot('05-narrow-560');
	check('projection-writes-nothing', (await count()) === 0 && (await bytes()) === saved);
	// 12. Palette matrix: board colors derive from NAND tokens.
	const minimalDir = process.env.NAND_CANVAS_MINIMAL_DIR;
	if (minimalDir) {
		const themeDir = path.join(runtime.vault, '.obsidian/themes/Minimal'); await fs.mkdir(themeDir, { recursive: true });
		for (const file of ['theme.css', 'manifest.json']) await fs.copyFile(path.join(minimalDir, file), path.join(themeDir, file));
	}
	const sameColor = `(()=>{const root=document.querySelector('.nand-dashboard-root');const probe=document.createElement('div');document.body.append(probe);const cs=(el,v)=>{probe.style.color=getComputedStyle(el).getPropertyValue(v);return getComputedStyle(probe).color};const out={accent:cs(root,'--db-accent')===cs(root,'--primary'),bg:cs(root,'--db-bg')===cs(root,'--background'),card:cs(root,'--db-bg-card')===cs(root,'--card'),text:cs(root,'--db-text')===cs(root,'--foreground'),border:cs(root,'--db-border-card')===cs(root,'--border'),rootBg:getComputedStyle(root).backgroundColor,bgVar:cs(root,'--background'),primary:cs(root,'--primary')};probe.remove();return out})()`;
	for (const [palette, css, base] of [['orca', '', 'moonstone'], ['orca', '', 'obsidian'], ['host', '', 'moonstone'], ['host', '', 'obsidian'], ...(minimalDir ? [['orca', 'Minimal', 'moonstone'], ['orca', 'Minimal', 'obsidian'], ['host', 'Minimal', 'moonstone'], ['host', 'Minimal', 'obsidian']] : [])]) {
		for (const viewport of [1440, 600]) {
			await c.evaluate(`app.plugins.plugins.nand.appSettings.update((d)=>{d.palette=${JSON.stringify(palette)}},{persist:'immediate'});app.customCss.setTheme(${JSON.stringify(css)});app.vault.setConfig('theme','${base}');app.updateTheme();true`);
			await width(viewport === 1440 ? 1440 : 640);
			await until(`document.body.getAttribute('data-nand-palette')==='${palette}'`);
			await delay(500);
			const colors = await c.evaluate(sameColor);
			const label = `${palette}-${css || 'default'}-${base === 'obsidian' ? 'dark' : 'light'}-${viewport}`;
			check('colors-follow-nand-tokens-' + label, colors.accent && colors.bg && colors.card && colors.text && colors.border && colors.rootBg === colors.bgVar, colors);
			await runtime.shot('matrix-' + label);
		}
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
