// Install the real downloaded plugin assets in a NEW isolated vault; optionally upgrade an old downloaded helper.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const [root, pluginSource, oldHelper] = process.argv.slice(2), rows = [];
assert.ok(root && pluginSource && path.isAbsolute(root) && path.isAbsolute(pluginSource));
assert.ok(!process.env.NAND_PTY_BINARY, 'Official release acceptance cannot use a development override');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await fs.readFile(path.join(pluginSource, 'manifest.json'), 'utf8'));
const asset = `nand-pty-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`;
const officialDigest = (await fs.readFile(path.join(pluginSource, asset + '.sha256'), 'utf8')).trim().split(/\s+/)[0];
let runtime, c;
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
const until = async expression => { const end = Date.now() + 90000; while (Date.now() < end) { if (await c.evaluate(expression)) return; await delay(100); } throw Error('Timed out: ' + expression); };
const page = async () => {
	await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'terminal',section:'running'})`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).some(s=>s.getViewType()==='nand-agent-page'&&s.controller)`);
	await c.evaluate(`window.ac=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-agent-page').controller;true`);
};
const shell = async marker => {
	await c.evaluate(`window.probe=null;ac.newShell(${JSON.stringify(process.platform === 'win32' ? 'cmd' : 'bash')}).then(s=>{window.rs=s;probe={ok:!!s,state:s?.connection}},e=>probe={ok:false,message:e.message});true`);
	await until('window.probe!==null'); const result = await c.evaluate('probe');
	check('official-helper-shell-' + marker, result.ok && result.state === 'connected', result);
	const command = process.platform === 'win32' ? `echo ${marker}\r` : `printf '${marker}\\n'\r`;
	await c.evaluate(`rs.input(${JSON.stringify(command)});true`);
	await until(`Array.from({length:rs.model.buffer.active.length},(_,i)=>rs.model.buffer.active.getLine(i)?.translateToString(true)).some(line=>line?.trim()===${JSON.stringify(marker)})`);
	check('native-input-output-' + marker, true);
	await c.evaluate('ac.sessions.end(rs.id,true);true'); await until('!rs.running');
};
try {
	runtime = await launchFreshVault({ root, pluginSource, port: 9463, settings: { version: 1, namespaces: { app: { language: 'en', introSeen: true, modules: Object.fromEntries(['home','agent','browser','news','archives','automations','notifications','icons','comments','sync'].map(id=>[id,false])) } } } }); c = runtime.connection;
	for (const file of ['main.js','manifest.json','styles.css']) check('installed-real-asset-' + file, sha(await fs.readFile(path.join(runtime.vault,'.obsidian/plugins/nand',file))) === sha(await fs.readFile(path.join(pluginSource,file))));
	if (oldHelper) {
		const legacy = path.join(runtime.vault,'.obsidian/plugins/nand/binaries',asset); await fs.mkdir(path.dirname(legacy),{recursive:true}); await fs.copyFile(oldHelper,legacy);
		await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('agent',true)`);
		check('upgrade-needs-main-process-restart', await c.evaluate(`app.plugins.plugins.nand.moduleState('agent')==='failed'`));
		await runtime.restart(); c = runtime.connection;
	} else await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('agent',true)`);
	await page();
	const helperPid = await c.evaluate(`ac.sessions.ensureHelper().then(helper=>helper.pid)`);
	if (process.platform === 'linux') {
		const descriptors = (await fs.readdir(`/proc/${helperPid}/fd`)).sort();
		check('helper-closes-inherited-host-descriptors', JSON.stringify(descriptors) === JSON.stringify(['0','1','2']), descriptors);
	}
	await shell('NAND_RELEASE_FRESH');
	const identity = JSON.parse(await fs.readFile(path.join(runtime.vault,'.nand/config/identity.json'),'utf8')), device = Object.keys(identity.devices)[0];
	const helper = path.join(runtime.vault,'.nand/helpers',device,`${process.platform}-${process.arch}`,manifest.version,asset);
	check('helper-has-official-release-digest', sha(await fs.readFile(helper))===officialDigest);
	check('plugin-runtime-data-retired', !await fs.stat(path.join(runtime.vault,'.obsidian/plugins/nand/binaries')).catch(()=>undefined));
	if (oldHelper) check('old-helper-recovery-copy-preserved', sha(await fs.readFile(path.join(runtime.vault,'.nand/helpers',device,'legacy-plugin/files',asset)))===sha(await fs.readFile(oldHelper)));
	await runtime.shot('release-installed');
	await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('agent',false)`);
	if (process.platform !== 'win32') await fs.chmod(helper,0o600);
	await runtime.restart(); c = runtime.connection; await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('agent',true)`); await page(); await shell('NAND_RELEASE_RESTART');
	if (process.platform !== 'win32') check('cached-helper-executable-mode-repaired', ((await fs.stat(helper)).mode&0o777)===0o700);
	check('restart-keeps-exact-helper-bytes', sha(await fs.readFile(helper))===officialDigest);
	await runtime.shot('release-restarted');
} catch (error) { rows.push({name:'acceptance-failure',passed:false,detail:error.stack}); await runtime?.shot('failure').catch(()=>{}); }
finally { if(runtime){await fs.writeFile(path.join(runtime.evidence,'result.json'),JSON.stringify({version:manifest.version,platform:process.platform,upgrade:!!oldHelper,realAccountsVerified:false,passed:rows.every(r=>r.passed),rows},null,2));await runtime.stop();} }
console.log(JSON.stringify({evidence:runtime?.evidence,checks:rows.length,failures:rows.filter(r=>!r.passed)}));
assert.ok(rows.every(r=>r.passed),'Real release vault acceptance failed');
