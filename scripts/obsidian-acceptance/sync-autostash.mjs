// Real Git and Obsidian on a new disposable vault; no credentials or existing profiles.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const root = process.argv[2], rows = [], saved = { GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL, GIT_CONFIG_NOSYSTEM: process.env.GIT_CONFIG_NOSYSTEM };
assert.ok(root && path.isAbsolute(root));
process.env.GIT_CONFIG_GLOBAL = path.join(root, 'gitconfig'); process.env.GIT_CONFIG_NOSYSTEM = '1';
let runtime, c;
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const until = async expression => { const end = Date.now() + 30000; while (Date.now() < end) { if (await c.evaluate(expression)) return; await delay(80); } throw Error('Timed out: ' + expression); };
const open = async () => {
	await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'sync',section:'changes'})`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).some(s=>s.getViewType()==='nand-sync-page'&&s.host.service()?.snapshot.phase==='ready')`);
	await c.evaluate(`window.ss=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-sync-page').host.service();true`);
	// Observe delivery while still invoking Obsidian's Notice adapter; the toast DOM belongs to the host.
	await c.evaluate(`window.syncNotices=[];const originalNotice=ss.deps.notify;ss.deps.notify=(text,error)=>{syncNotices.push({text,error});originalNotice(text,error)};true`);
};
try {
	runtime = await launchFreshVault({ root, port: 9456, files: { 'note.md': 'base\n', '.gitignore': '.obsidian/\n.nand/\n' }, settings: {
		version: 1, namespaces: { app: { language: 'en', introSeen: true, modules: Object.fromEntries(['home','agent','browser','archives','automations','notifications','icons','comments','sync'].map(id => [id,false])) } },
	} }); c = runtime.connection;
	await fs.writeFile(path.join(root, 'gitconfig'), '[init]\n defaultBranch = main\n[user]\n name = Tester\n email = tester@example.com\n[commit]\n gpgsign = false\n');
	const remote = path.join(root, 'remote.git'), peer = path.join(root, 'peer');
	await fs.mkdir(remote); git(remote, 'init', '--bare', '-q');
	git(runtime.vault, 'init', '-q'); git(runtime.vault, 'add', 'note.md', '.gitignore'); git(runtime.vault, 'commit', '-qm', 'base');
	git(runtime.vault, 'remote', 'add', 'origin', remote); git(runtime.vault, 'push', '-qu', 'origin', 'main');
	git(root, 'clone', '-q', remote, peer); await fs.writeFile(path.join(peer, 'note.md'), 'remote edit\n');
	git(peer, 'add', 'note.md'); git(peer, 'commit', '-qm', 'remote'); git(peer, 'push', '-q');
	await fs.writeFile(path.join(runtime.vault, 'note.md'), 'unstaged local edit\n');
	await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('sync',true)`); await open();
	const report = await c.evaluate(`ss.pull({auto:true})`);
	check('zero-exit-autostash-is-a-failed-pull', !report.ok && report.steps[0].state === 'conflict' && report.steps[0].count === 1, report);
	await until(`document.querySelector('.nand-sync-page')?.textContent.includes('note.md')`);
	const notice = await c.evaluate(`syncNotices[syncNotices.length-1]`);
	check('host-ui-shows-conflict-and-delivers-error-notice', await c.evaluate(`document.querySelector('.nand-sync-page')?.textContent.includes('conflicts in 1')`) && notice?.error === true && /conflicts in 1/.test(notice.text), notice);
	check('host-service-counts-the-first-failure', await c.evaluate(`ss.snapshot.device.failures===1 && ss.snapshot.operation===null`));
	const before = await fs.readFile(path.join(runtime.vault, 'note.md'), 'utf8'), stash = git(runtime.vault, 'stash', 'show', '-p');
	await c.evaluate(`ss.abortOperation()`);
	check('no-operation-abort-keeps-conflict-and-stash', before === await fs.readFile(path.join(runtime.vault, 'note.md'), 'utf8') && stash === git(runtime.vault, 'stash', 'show', '-p'));
	await c.evaluate(`ss.pull({auto:true})`); await c.evaluate(`ss.pull({auto:true})`);
	check('three-failures-pause-automatic-sync', await c.evaluate(`ss.snapshot.device.failures===3 && ss.snapshot.device.paused==='failures'`));
	await runtime.shot('autostash-conflict'); await runtime.restart(); c = runtime.connection; await open();
	check('cold-restart-keeps-conflict-and-pause', await c.evaluate(`ss.snapshot.status.conflicted.some(r=>r.path==='note.md') && ss.snapshot.device.failures===3 && ss.snapshot.device.paused==='failures'`));
	await fs.writeFile(path.join(runtime.vault, 'note.md'), 'resolved edit\n'); await c.evaluate(`ss.markResolved(['note.md'])`);
	const resolved = await c.evaluate(`ss.commitAndSync('staged')`);
	check('resolution-pushes-and-clears-failures', resolved.ok && await c.evaluate(`ss.snapshot.device.failures===0 && ss.snapshot.device.paused===''`), resolved);
	check('local-edit-recovery-copy-is-still-retained', stash === git(runtime.vault, 'stash', 'show', '-p') && git(remote, 'show', 'main:note.md') === 'resolved edit');
	await runtime.shot('autostash-resolved');
} catch (error) {
	rows.push({ name: 'acceptance-failure', passed: false, detail: error.stack }); await runtime?.shot('failure').catch(() => {});
	if (runtime && c) await fs.writeFile(path.join(runtime.evidence, 'failure-state.json'), JSON.stringify(await c.evaluate(`({body:document.body.innerText,errors:window.nandAcceptanceErrors,snapshot:window.ss?.snapshot,notices:[...document.querySelectorAll('.notice')].map(el=>el.outerHTML)})`).catch(()=>null), null, 2));
}
finally {
	if (runtime) { await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ platform: process.platform, passed: rows.every(row=>row.passed), rows }, null, 2)); await runtime.stop(); }
	for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
}
console.log(JSON.stringify({ evidence: runtime?.evidence, checks: rows.length, failures: rows.filter(row=>!row.passed) }));
assert.ok(rows.every(row=>row.passed), 'Sync autostash acceptance failed');
