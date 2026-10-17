// Acceptance: switching boards is a transaction. While the target (an old board that converts on open) is being
// written, the old page is read-only; nothing it does reaches the target, and path and data change together.
// HOME / CLI homes / XDG dirs point into the fixture (fresh-vault.mjs). Run from the repo root after `pnpm build`:
//   NAND_OBSIDIAN_EXECUTABLE=/opt/Obsidian/obsidian xvfb-run -a node scripts/obsidian-acceptance/home-canvas-switch.mjs /tmp/nand-canvas-switch-01
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parse as yaml } from 'yaml';
import { launchFreshVault } from './fresh-vault.mjs';

const A = '.nand/content/A', B = '.nand/content/B';
const member = { memberId: 'home:calendar:default', provider: 'home', kind: 'calendar', instanceId: 'default' };
const modules = { home: true, agent: false, browser: false, archives: false, automations: false, notifications: false, icons: false, comments: false, sync: false };
const runtime = await launchFreshVault({
	root: process.argv[2],
	port: Number(process.env.NAND_CANVAS_PORT || 9279),
	files: {
		[A + '.md']: `---\ncanvas: 1\nlayout: immersive\nwidgets: ${JSON.stringify([member])}\nimmersive: [{id: 'widget:calendar', w: 4, cap: 40, x: 0, y: 0}]\n---\n`,
		[B + '.md']: '---\nlayout: immersive\nwidgets: []\n---\n',
	},
	settings: { version: 1, namespaces: { app: { language: 'en', introSeen: true, modules }, home: { dashboardFile: A, workspaceFiles: [A, B] } } },
});
const c = runtime.connection;
const rows = [];
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); if (!passed) console.error('FAILED', name, JSON.stringify(detail)?.slice(0, 400)); };
const until = async (expression) => { for (let i = 0; i < 150; i++) { if (await c.evaluate(expression).catch(() => false)) return; await delay(100); } throw new Error('Timeout ' + expression); };
const front = async (file) => yaml((await fs.readFile(path.join(runtime.vault, file + '.md'), 'utf8')).split('---')[1]);
try {
	await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
	await c.evaluate(`app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();app.plugins.plugins.nand.openWorkbench({feature:'dashboard',resourceId:'${A}'});true`);
	await until(`!!document.querySelector('[data-tile="widget:calendar"]')`);
	await delay(400);
	// hold the target's conversion write, then switch
	await c.evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Edit board').click();const a=app.vault.adapter;window.revWrite=a.process;window.revBlocked=false;a.process=async function(p,...rest){if(p==='${B}.md'&&!window.revBlocked){window.revBlocked=true;await new Promise(r=>window.revRelease=r)}return window.revWrite.call(this,p,...rest)};app.workspace.iterateAllLeaves(l=>{const s=l.view.getNativeSurfaces?.().find(s=>s.getViewType()==='nand-dashboard-view');if(s)window.revSurface=s});window.revSwitch=window.revSurface.plugin.switchWorkspace('${B}').then(()=>window.revDone=true,e=>window.revError=String(e));return true})()`);
	await until('window.revBlocked');
	await delay(400);
	const pending = await c.evaluate(`({overlay:document.body.textContent.includes('Switching board'),inert:document.querySelector('.dashboard-scroll-region')?.hasAttribute('inert'),calendar:!!document.querySelector('[data-tile="widget:calendar"]')})`);
	check('switch-pending-page-is-read-only', pending.overlay && pending.inert && pending.calendar, pending);
	await runtime.shot('switch-pending');
	await c.evaluate(`document.querySelector('button[aria-label="Remove Calendar from this board"]')?.click();true`);
	await c.evaluate('window.revRelease();true');
	await until('window.revDone||window.revError');
	await delay(700);
	const meta = await front(B);
	check('remove-on-source-never-reaches-target', meta.widgets?.some((w) => w.kind === 'banner') && !meta.widgets.some((w) => w.kind === 'calendar') && meta.canvas === 1, meta.widgets);
	check('source-board-untouched', (await front(A)).widgets.some((w) => w.kind === 'calendar'));
	check('target-shown-after-commit', await c.evaluate(`!document.body.textContent.includes('Switching board')&&!!document.querySelector('[data-tile="widget:banner"]')&&!document.querySelector('[data-tile="widget:calendar"]')`));
	await runtime.shot('switch-done');
	check('no-runtime-errors', (await c.evaluate('window.nandAcceptanceErrors')).length === 0, await c.evaluate('window.nandAcceptanceErrors'));
	await fs.writeFile(path.join(runtime.evidence, 'review.json'), JSON.stringify({ rows }, null, 2));
	const failed = rows.filter((r) => !r.passed);
	console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length, failed }, null, 2));
	assert.equal(failed.length, 0);
} finally {
	await c.evaluate('window.revRelease?.();if(window.revWrite)app.vault.adapter.process=window.revWrite;true').catch(() => undefined);
	await runtime.stop();
}
