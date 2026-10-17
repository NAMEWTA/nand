// Acceptance: a confirmation opened on board A is closed when the page switches to board B and cannot delete on B.
// HOME / CLI homes / XDG dirs point into the fixture (fresh-vault.mjs). Run from the repo root after `pnpm build`:
//   NAND_OBSIDIAN_EXECUTABLE=/opt/Obsidian/obsidian xvfb-run -a node scripts/obsidian-acceptance/home-canvas-switch-dialog.mjs /tmp/nand-canvas-switch-dialog-01
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const A = '.nand/content/A', B = '.nand/content/B';
const board = (body) => '---\ncanvas: 1\nlayout: immersive\nwidgets: []\n---\n## Notes\n### Kept\n' + body + '\n';
const modules = { home: true, agent: false, browser: false, archives: false, automations: false, notifications: false, icons: false, comments: false, sync: false };
const runtime = await launchFreshVault({
	root: process.argv[2],
	port: Number(process.env.NAND_CANVAS_PORT || 9283),
	files: { [A + '.md']: board('A text'), [B + '.md']: board('B text') },
	settings: { version: 1, namespaces: { app: { language: 'en', introSeen: true, modules }, home: { dashboardFile: A, workspaceFiles: [A, B] } } },
});
const c = runtime.connection;
const rows = [];
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); if (!passed) console.error('FAILED', name, JSON.stringify(detail)?.slice(0, 400)); };
const until = async (expression) => { for (let i = 0; i < 150; i++) { if (await c.evaluate(expression).catch(() => false)) return; await delay(100); } throw new Error('Timeout ' + expression); };
try {
	await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
	await c.evaluate(`app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();app.plugins.plugins.nand.openWorkbench({feature:'dashboard',resourceId:'${A}'});true`);
	await until(`!!document.querySelector('[data-tile="section:Notes"]')`);
	await delay(400);
	await c.evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Edit board').click();app.workspace.iterateAllLeaves(l=>{const s=l.view.getNativeSurfaces?.().find(s=>s.getViewType()==='nand-dashboard-view');if(s)window.revSurface=s});return true})()`);
	await until(`!!document.querySelector('button[aria-label="Remove Notes from this board"]')`);
	await c.evaluate(`document.querySelector('button[aria-label="Remove Notes from this board"]').click();true`);
	await until(`!!document.querySelector('[role="dialog"]')`);
	check('source-confirmation-open', await c.evaluate(`document.querySelector('[role="dialog"]').textContent.includes('Notes')`));
	await c.evaluate(`window.revSurface.plugin.switchWorkspace('${B}')`);
	await delay(900);
	const after = await c.evaluate(`({path:window.revSurface.plugin.settings.dashboardFile,dialogs:document.querySelectorAll('[role="dialog"]').length,hasB:document.body.textContent.includes('B text')})`);
	check('switch-closed-the-confirmation', after.path === B && after.dialogs === 0 && after.hasB, after);
	await runtime.shot('switch-dialog-closed');
	await delay(500);
	const text = await fs.readFile(path.join(runtime.vault, B + '.md'), 'utf8');
	check('target-section-intact', text.includes('B text') && text.includes('## Notes'), text);
	check('no-runtime-errors', (await c.evaluate('window.nandAcceptanceErrors')).length === 0, await c.evaluate('window.nandAcceptanceErrors'));
	await fs.writeFile(path.join(runtime.evidence, 'review.json'), JSON.stringify({ rows }, null, 2));
	const failed = rows.filter((r) => !r.passed);
	console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length, failed }, null, 2));
	assert.equal(failed.length, 0);
} finally {
	await runtime.stop();
}
