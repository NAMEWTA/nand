// Real UI clone onboarding in a NEW disposable vault. Never attaches to a user's existing profile.
// NAND_OBSIDIAN_EXECUTABLE=<absolute executable> node scripts/obsidian-acceptance/sync-clone.mjs <new absolute directory>
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const root = process.argv[2];
assert.ok(root && path.isAbsolute(root));
const runtime = await launchFreshVault({ root, port: 9246, files: { 'Welcome.md': 'Current vault sentinel\n' }, settings: {
	version: 1, namespaces: { app: { language: 'en', introSeen: true, modules: { home: false, agent: false, browser: false, archives: false, automations: false, notifications: false, icons: false, comments: false, news: false, sync: true } } },
} });
const { connection: c, evidence, vault } = runtime;
const rows = [];
const until = async (expression) => {
	const deadline = Date.now() + 15000;
	while (Date.now() < deadline) { if (await c.evaluate(expression)) return; await delay(100); }
	throw Error(`Condition timed out: ${expression}`);
};
try {
	const identity = await c.evaluate(`({vault:app.vault.adapter.basePath,profile:require('@electron/remote').app.getPath('userData'),version:require('@electron/remote').app.getVersion()})`);
	assert.equal(path.resolve(identity.vault), path.resolve(vault));
	assert.equal(path.resolve(identity.profile), path.join(root, 'profile'));
	rows.push({ name: 'isolated-runtime', ...identity });
	await c.evaluate(`app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();`);
	const seed = path.join(root, 'seed'), remote = path.join(root, 'remote.git'), target = path.join(root, 'cloned-vault');
	await fs.mkdir(seed);
	const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, env: { ...process.env, GIT_CONFIG_GLOBAL: path.join(root, 'empty-gitconfig'), GIT_CONFIG_NOSYSTEM: '1' } }).trim();
	git(seed, 'init', '-q', '-b', 'main');
	await fs.writeFile(path.join(seed, 'From remote.md'), 'Cloned note\n');
	git(seed, 'add', '.');
	git(seed, '-c', 'user.name=Clone Test', '-c', 'user.email=clone@example.com', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'seed');
	git(root, 'clone', '--bare', seed, remote);
	await c.evaluate(`app.plugins.plugins.nand.openWorkbench()`);
	await until(`!!document.querySelector('.nand-rail-item[data-feature="sync"] button')`);
	await c.evaluate(`document.querySelector('.nand-rail-item[data-feature="sync"] button').click()`);
	await until(`!!document.querySelector('.nand-sync-clone summary')`);
	await c.evaluate(`document.querySelector('.nand-sync-clone summary').click()`);
	const fill = async (destination) => c.evaluate(`(()=>{const inputs=document.querySelectorAll('.nand-sync-clone input'); for(const [i,value] of ${JSON.stringify([remote, destination])}.entries()){inputs[i].value=value;inputs[i].dispatchEvent(new Event('input',{bubbles:true}));}})()`);
	const start = async () => {
		await until(`document.querySelector('.nand-sync-clone button')?.disabled===false`);
		const position = await c.evaluate(`(()=>{const b=document.querySelector('.nand-sync-clone button');b.scrollIntoView();const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
		await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...position, button: 'left', clickCount: 1 });
		await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...position, button: 'left', clickCount: 1 });
		await until(`!!document.querySelector('.modal .nand-btn--primary')`);
		await c.evaluate(`document.querySelector('.modal .nand-btn--primary').click()`);
	};
	await fill(target);
	await start();
	await until(`document.querySelector('.nand-sync-clone [role="status"]')?.textContent.includes('Cloned to')`);
	assert.equal((await fs.readFile(path.join(target, 'From remote.md'), 'utf8')).replaceAll('\r\n', '\n'), 'Cloned note\n');
	assert.equal(git(target, 'rev-parse', 'HEAD'), git(seed, 'rev-parse', 'HEAD'));
	assert.equal(await fs.readFile(path.join(vault, 'Welcome.md'), 'utf8'), 'Current vault sentinel\n');
	assert.equal(path.resolve(await c.evaluate(`app.vault.adapter.basePath`)), path.resolve(vault));
	rows.push({ name: 'clone-from-ui-preserves-current-vault', passed: true });
	await start();
	await until(`document.querySelector('.nand-sync-clone [role="alert"]')?.textContent.includes('contains files')`);
	assert.equal((await fs.readFile(path.join(target, 'From remote.md'), 'utf8')).replaceAll('\r\n', '\n'), 'Cloned note\n');
	rows.push({ name: 'nonempty-retry-refused', passed: true });
	await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'settings'})`);
	await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'sync',section:'changes'})`);
	await until(`document.querySelector('.nand-sync-clone [role="alert"]')?.textContent.includes('contains files')`);
	rows.push({ name: 'navigation-retains-result', passed: true });
	for (const preset of ['system', 'claude-code', 'eye-care']) {
		await c.evaluate(`app.plugins.plugins.nand.theme.update(d=>{d.preset=${JSON.stringify(preset)}},{persist:'immediate'})`);
		for (const mode of ['light', 'dark']) {
			await c.evaluate(`app.changeTheme(${JSON.stringify(mode === 'dark' ? 'obsidian' : 'moonstone')})`);
			for (const width of [1400, 850, 500]) {
				await c.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
				await delay(200);
				const layout = await c.evaluate(`(()=>{const p=document.querySelector('.nand-sync-page');const f=document.querySelector('.nand-sync-clone');return {overflow:p.scrollWidth-p.clientWidth,width:p.clientWidth,fields:[...f.querySelectorAll('input')].map(el=>({label:el.closest('label')?.textContent,within:el.getBoundingClientRect().right<=p.getBoundingClientRect().right+1}))}})()`);
				assert.ok(layout.overflow <= 1, JSON.stringify(layout));
				assert.ok(layout.fields.every(field => field.label && field.within));
				rows.push({ preset, mode, viewport: width, ...layout });
				await runtime.shot(`clone-${preset}-${mode}-${width}`);
			}
		}
	}
	const mainSha256 = createHash('sha256').update(await fs.readFile('main.js')).digest('hex');
	await fs.writeFile(path.join(evidence, 'result.json'), JSON.stringify({ passed: true, mainSha256, rows }, null, 2));
	console.log(JSON.stringify({ passed: true, evidence, checks: rows.length }));
} catch (error) {
	await runtime.shot('failure').catch(() => {});
	await fs.writeFile(path.join(evidence, 'page-failure.json'), JSON.stringify(await c.evaluate(`({errors:window.nandAcceptanceErrors,body:document.body.innerText,views:app.workspace.getLeavesOfType('nand-workbench-view').map(l=>l.view.getState())})`).catch(() => null), null, 2));
	await fs.writeFile(path.join(evidence, 'result.json'), JSON.stringify({ passed: false, rows, error: String(error) }, null, 2));
	throw error;
} finally { await runtime.stop(); }
