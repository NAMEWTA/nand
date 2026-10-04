// Real PTY/downloader acceptance. Never run in a daily Vault or an occupied terminal service.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { connect } from './cdp.mjs';
import { delay, language } from './common.mjs';
import {
	issueConfig, ISSUE_RUNTIME, verifyIssueRuntime, acquireIssueLock, assertInside,
	hashBytes, snapshotFiles, restoreFiles, issueShell, countBrowserEnvironmentCommand,
	parseBrowserEnvironmentCount, assertEndpointClosed,
} from './issue-fixture.mjs';

const config = issueConfig(); // Reject missing authorization before CDP or filesystem mutations.
assert.ok(path.isAbsolute(process.env.NAND_ACCEPTANCE_BINARY ?? ''), 'Absolute verified binary path required');
assert.match(process.env.NAND_ACCEPTANCE_BINARY_SHA256 ?? '', /^[a-f0-9]{64}$/i, 'Pin the independently verified binary SHA256');
const binary = await fs.readFile(process.env.NAND_ACCEPTANCE_BINARY);
const checksum = hashBytes(binary);
assert.equal(checksum, process.env.NAND_ACCEPTANCE_BINARY_SHA256.toLowerCase(), 'Wrong fixture binary');
const c = await connect();
const run = expression => c.evaluate(`(()=>eval(${JSON.stringify(expression)}))()`);
const checks = [], sessions = [], failures = [];
let runtime, dir, unlock, fixture, snapshots, target, patched = false, browserTouched = false, languageTouched = false;
const until = async (expression, label, timeout = 12000) => {
	const end = Date.now() + timeout;
	do { const result = await run(expression); if (result) return result; await delay(60); } while (Date.now() < end);
	throw Error(`Timed out: ${label}`);
};
const check = (name, details = {}) => { checks.push({ name, passed: true, ...details }); console.log(name); };
try {
	runtime = await verifyIssueRuntime(config, await c.evaluate(ISSUE_RUNTIME));
	unlock = await acquireIssueLock(runtime.profile);
	await fs.mkdir(config.dir, { recursive: true });
	dir = await fs.mkdtemp(path.join(config.dir, 'terminal-repair-'));
	const shell = issueShell(runtime);
	const admission = await run(`(()=>{const p=app.plugins.plugins.nand,h=p.terminalHost;return {
	 browser:p.settings.modules.browser===true,agentsDisabled:Object.values(h.settings.agentSettings.agents).every(a=>!a.enabled&&!a.accountId),
	 sessions:h._terminalService?.getAllTerminals().length??0,offline:h.settings.serverConnection.offlineMode};})()`);
	assert.ok(admission.browser && admission.agentsDisabled && !admission.offline, 'Use browser enabled, online mode and no authenticated Agent configuration');
	assert.equal(admission.sessions, 0, 'Existing sessions must not be shut down by this test');
	await run(`(()=>{if(window.nandIssueRepair)throw Error('Another repair is active');app.setting.close();})()`);
	let available = false;
	fixture = http.createServer((req, res) => {
		if (!available) { res.writeHead(404); res.end('missing fixture release'); return; }
		if (req.url === '/server.sha256') { res.end(`${checksum}  server\n`); return; }
		res.end(binary);
	});
	await new Promise((resolve, reject) => { fixture.once('error', reject); fixture.listen(0, '127.0.0.1', resolve); });
	const base = `http://127.0.0.1:${fixture.address().port}`;
	await run(`(async()=>{const host=app.plugins.plugins.nand.terminalHost,service=await host.getTerminalService();
	 if(service.getAllTerminals().length)throw Error('A session appeared before admission');
	 const manager=await host.getServerManager(),downloader=manager.binaryDownloader;
	 window.nandIssueRepair={service,manager,downloader,originalInfo:downloader.getBinaryInfo,outputs:{},sessions:[]};
	 })()`);
	patched = true;
	await run('nandIssueRepair.manager.shutdown()');
	target = await run('nandIssueRepair.downloader.getBinaryPath()');
	const extension = runtime.platform === 'win32' ? '.exe' : '';
	assert.equal(path.resolve(target), path.join(runtime.pluginDir, 'binaries', `rust-terminal-servers-${runtime.platform}-${runtime.arch}${extension}`));
	await assertInside(runtime.pluginDir, target);
	const cache = path.join(path.dirname(target), '.rust-terminal-servers.version.json');
	snapshots = await snapshotFiles(runtime.pluginDir, [target, cache]);
	// Retain recoverable originals if restoration fails. No credentials or arbitrary Vault files.
	for (const [index, item] of snapshots.entries()) {
		if (item.bytes !== null) await fs.writeFile(path.join(dir, `original-${index}.bin`), item.bytes, { mode: 0o600 });
	}
	await fs.writeFile(path.join(dir, 'original-files.json'), JSON.stringify(snapshots.map(({ bytes, ...item }) => ({ ...item, existed: bytes !== null })), null, 2));
	await run(`nandIssueRepair.downloader.getBinaryInfo=()=>({filename:'server',url:'${base}/server',checksumUrl:'${base}/server.sha256'})`);
	await fs.rm(target, { force: true });
	await fs.rm(cache, { force: true });
	for (const locale of ['en', 'zh']) {
		languageTouched = true;
		await language(c, locale);
		for (let attempt = 0; attempt < 2; attempt++) {
			const result = await run(`nandIssueRepair.service.createTerminal(${JSON.stringify({ ...shell, cwd: runtime.vault })}).then(t=>({id:t.id}),e=>({error:String(e.message)}))`);
			if (result.id) sessions.push(result.id);
			assert.match(result.error ?? '', /HTTP 404/);
			if (locale === 'en') assert.doesNotMatch(result.error, /[\u4e00-\u9fff]/);
			else assert.match(result.error, /[\u4e00-\u9fff]/);
			await until(`[...document.querySelectorAll('.notice')].filter(e=>e.textContent.includes('HTTP 404')).length===1`, 'one localized failure notice');
			check(`native-download-failure-${locale}-${attempt}`);
		}
	}
	available = true;
	await fs.mkdir(path.dirname(target), { recursive: true });
	await fs.writeFile(target, binary);
	if (runtime.platform !== 'win32') await fs.chmod(target, 0o755);
	await run('nandIssueRepair.manager.ensureServer()');
	assert.equal(await run('nandIssueRepair.manager.isConnected()'), true);
	await until(`[...document.querySelectorAll('.notice')].filter(e=>e.textContent.includes('HTTP 404')).length===0`, 'failure notice disappears on repair');
	check('native-manual-repair-protocol2-without-reload', { binarySha256: checksum });
	await run('nandIssueRepair.downloader.getBinaryInfo=nandIssueRepair.originalInfo');
	async function session(agent) {
		const options = { ...shell, cwd: runtime.vault, ...(agent ? { agentId: 'codex' } : {}) };
		const id = await run(`(async()=>{const s=nandIssueRepair,t=await s.service.createTerminal(${JSON.stringify(options)});s.sessions.push(t.id);s.outputs[t.id]='';t.onOutput(value=>s.outputs[t.id]=(s.outputs[t.id]+value).slice(-65536));return t.id})()`);
		sessions.push(id);
		await run(`nandIssueRepair.service.getTerminal(${JSON.stringify(id)}).write(${JSON.stringify(countBrowserEnvironmentCommand(runtime.platform))})`);
		const end = Date.now() + 12000;
		do {
			const count = parseBrowserEnvironmentCount(await run(`nandIssueRepair.outputs[${JSON.stringify(id)}]`));
			if (count !== null) return { id, count };
			await delay(60);
		} while (Date.now() < end);
		throw Error('Timed out waiting for a count from the real shell');
	}
	const plain = await session(false), agent = await session(true), after = await session(false);
	assert.deepEqual([plain.count, agent.count, after.count], [0, 4, 0]);
	check('native-shell-agent-shell-credential-boundary', { counts: [plain.count, agent.count, after.count] });
	await run(`app.plugins.plugins.nand.terminalHost.openAutomationTerminal(${JSON.stringify(plain.id)})`);
	await until(`app.workspace.getLeavesOfType('terminal-view').some(l=>l.view.getTerminalInstance?.()?.id===${JSON.stringify(plain.id)})`, 'source terminal view');
	await run(`app.commands.executeCommandById('nand:terminal-quick-switch')`);
	await until(`!!activeDocument.querySelector('.prompt-input')`, 'real quick-switch command');
	await c.send('Input.insertText', { text: agent.id });
	await until(`activeDocument.querySelectorAll('.suggestion-item').length===1`, 'search narrows to exact session ID');
	await run(`activeDocument.querySelector('.suggestion-item').click()`);
	await until(`app.workspace.activeLeaf?.view?.getTerminalInstance?.()?.id===${JSON.stringify(agent.id)}`, 'selected session becomes active');
	check('native-terminal-picker-selects-the-requested-session');
	const resources = await run(`(async()=>{const h=app.plugins.plugins.nand.browserHost;await h.environment();const b=h.bridge;return {directory:b.directory,endpoint:b.endpoint,attachments:b.writeArtifact('data:image/png;base64,aGVsbG8=','acceptance retained reference')}})()`);
	browserTouched = true;
	await run('app.plugins.plugins.nand.browserHost.setEnabled(false)');
	await assert.rejects(fs.stat(resources.directory), { code: 'ENOENT' });
	await assertEndpointClosed(resources.endpoint); // Both Unix sockets and Windows Named Pipes.
	for (const file of resources.attachments) await fs.stat(file);
	await run('app.plugins.plugins.nand.browserHost.setEnabled(true)');
	check('native-browser-disable-cleans-run-retains-attachments');
} catch (error) {
	failures.push(String(error));
} finally {
	const cleanup = async (name, work) => { try { await work(); } catch (error) { failures.push(`${name}: ${String(error)}`); } };
	if (patched) {
		await cleanup('Restore downloader and stop owned sessions', () => run(`(async()=>{const s=window.nandIssueRepair;if(!s)throw Error('Repair state lost');s.downloader.getBinaryInfo=s.originalInfo;for(const id of new Set([...s.sessions,...${JSON.stringify(sessions)}]))if(s.service.getTerminal(id))await s.service.destroyTerminal(id);await s.manager.shutdown();})()`));
		// Never replace an executable that could still be running after failed shutdown.
		if (!failures.some(message => message.startsWith('Restore downloader and stop owned sessions:')) && snapshots) {
			await cleanup('Restore binary and version metadata', () => restoreFiles(runtime.pluginDir, snapshots));
		}
		await cleanup('Remove owned renderer state', () => run('delete window.nandIssueRepair'));
	}
	if (browserTouched) await cleanup('Restore browser module', () => run('app.plugins.plugins.nand.browserHost.setEnabled(true)'));
	if (languageTouched) await cleanup('Restore language', () => language(c, runtime.originalLanguage));
	if (fixture) await cleanup('Close HTTP fixture', async () => { fixture.closeAllConnections(); if (fixture.listening) await new Promise((resolve, reject) => fixture.close(error => error ? reject(error) : resolve())); });
	c.close();
	if (unlock) await cleanup('Release acceptance lock', unlock);
	if (dir) await fs.writeFile(path.join(dir, failures.length ? 'terminal-repair-partial.json' : 'terminal-repair.json'), JSON.stringify({ runtime, fixtureBinarySha256: checksum, checks, failures, passed: failures.length === 0, scope: 'controlled-fault-and-native-pty; not an online release test' }, null, 2));
}
if (failures.length) throw new Error(failures.join('\n'));
