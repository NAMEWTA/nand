// Real release installation and terminal lifecycle in a disposable Obsidian vault.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

assert.ok(!process.env.NAND_PTY_BINARY, 'This acceptance must download the published helper');
const runtime = await launchFreshVault({ root: process.argv[2], port: 9249,
	// The host export is read-only; an owned fixture copy provides the download error seam.
	files: { '.obsidian/plugins/nand/main.js': 'window.nandAcceptanceObsidian = {...require("obsidian")};\n' + (await fs.readFile('main.js', 'utf8')).replaceAll('require("obsidian")', 'window.nandAcceptanceObsidian') },
	settings: { version: 1, namespaces: {
	app: { language: 'en', introSeen: true, modules: { agent: true, home: false, archives: false, browser: false, news: false, sync: false, comments: false, notifications: false, automations: false, icons: false } },
} } });
const rows = [];
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
const until = async expression => {
	const deadline = Date.now() + 80000;
	while (Date.now() < deadline) { if (await runtime.connection.evaluate(expression)) return; await delay(100); }
	throw Error(`Condition timed out: ${expression}`);
};
const page = async () => {
	await runtime.connection.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'terminal',section:'running'})`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-agent-page'))`);
	await runtime.connection.evaluate(`window.agentPage=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-agent-page');window.agentController=agentPage.controller;true`);
};
try {
	// Configure only this disposable profile's network session for the test machine's proxy.
	if (process.env.HTTPS_PROXY) await runtime.connection.evaluate(`require('@electron/remote').session.defaultSession.setProxy({proxyRules:process.env.HTTPS_PROXY})`);
	await page();
	const binaries = path.join(runtime.vault, '.obsidian/plugins/nand/binaries');
	check('fresh-vault-no-binary-or-override', !await fs.stat(binaries).catch(() => undefined) && await runtime.connection.evaluate(`!process.env.NAND_PTY_BINARY`));
	await runtime.connection.evaluate(`window.hostRequest=window.nandAcceptanceObsidian.requestUrl;window.helperNotices=[];window.nandAcceptanceObsidian.Notice=class extends window.nandAcceptanceObsidian.Notice{constructor(message,...args){super(message,...args);helperNotices.push(String(message))}};window.helperWarnings=[];window.hostWarn=console.warn;console.warn=(...args)=>{helperWarnings.push(args.map(a=>typeof a==='string'?a:JSON.stringify(a)).join(' '));hostWarn(...args)};true`);
	for (const [language, status] of [['en', 404], ['zh', 503]]) {
		await runtime.connection.evaluate(`app.plugins.plugins.nand.changeLanguage(${JSON.stringify(language)})`);
		await runtime.connection.evaluate(`window.nandAcceptanceObsidian.requestUrl=async()=>({status:${status},arrayBuffer:new ArrayBuffer(0)});window.failureResult=null;agentController.checkHelper().then(()=>failureResult={unexpectedSuccess:true}).catch(e=>{failureResult={code:e.code,detail:e.detail,notice:helperNotices.join(' ')}});true`);
		await until(`!!window.failureResult`);
		const failure = await runtime.connection.evaluate(`failureResult`);
		check(`localized-http-${status}-${language}`, failure.code === 'http' && failure.detail.status === status && failure.notice.includes(String(status)) && failure.notice.includes('0.0.1-alpha.1') && (status !== 404 || failure.notice.includes('has not been published')), failure);
	}
	await runtime.connection.evaluate(`window.nandAcceptanceObsidian.requestUrl=async()=>{throw Error('reset https://signed.example/?token=secret-test-token')};window.failureResult=null;agentController.checkHelper().catch(e=>{failureResult={code:e.code,notice:helperNotices.join(' ')}});true`);
	await until(`!!window.failureResult`);
	check('localized-network-and-sanitized-log', await runtime.connection.evaluate(`failureResult.code==='network'&&failureResult.notice.includes('连接')&&helperWarnings.every(s=>!s.includes('secret-test-token'))&&helperWarnings.some(s=>s.includes('/releases/download/'))`));
	await runtime.connection.evaluate(`window.nandAcceptanceObsidian.requestUrl=hostRequest;console.warn=hostWarn;app.plugins.plugins.nand.changeLanguage('en')`);
	await runtime.connection.evaluate(`window.installResult=null;agentController.newShell('cmd').then(s=>{window.probeSession=s;installResult={ok:!!s,state:s?.connection}}).catch(e=>installResult={ok:false,code:e.code,message:e.message,detail:e.detail});true`);
	await until(`!!window.installResult`);
	const installation = await runtime.connection.evaluate(`installResult`);
	check('real-release-download-handshake-shell', installation.ok && installation.state === 'connected', installation);
	const stamp = JSON.parse(await fs.readFile(path.join(binaries, 'nand-pty.json'), 'utf8'));
	const file = path.join(binaries, 'nand-pty-win32-x64.exe');
	check('download-matches-published-stamp', createHash('sha256').update(await fs.readFile(file)).digest('hex') === stamp.sha256, stamp);
	await runtime.connection.evaluate(`probeSession.input(${JSON.stringify('echo NAND_REAL_SHELL_OK\r')});true`);
	await until(`Array.from({length:probeSession.model.buffer.active.length},(_,i)=>probeSession.model.buffer.active.getLine(i)?.translateToString(true)).includes('NAND_REAL_SHELL_OK')`);
	check('real-shell-input-output', true);
	await runtime.connection.evaluate(`probeSession.resize(110,32);probeSession.input(${JSON.stringify('echo NAND_AFTER_RESIZE\r')});true`);
	await until(`Array.from({length:probeSession.model.buffer.active.length},(_,i)=>probeSession.model.buffer.active.getLine(i)?.translateToString(true)).includes('NAND_AFTER_RESIZE')`);
	check('shell-remains-usable-after-resize', true);
	await runtime.shot('shell-installed');
	if (process.argv[3]) {
		await runtime.connection.evaluate(`agentController.settings.update(d=>{d.agents.agents.codex.enabled=true;d.agents.agents.codex.cliPath=${JSON.stringify(process.argv[3])};d.agents.agents.codex.accountId='acceptance-empty';d.agents.agents.codex.permissionMode='manual'})`);
		await runtime.connection.evaluate(`agentController.newAgent('codex')`);
		await until(`agentController.sessions.list().some(s=>s.agentId==='codex'&&s.connection==='connected'&&Array.from({length:s.model.buffer.active.length},(_,i)=>s.model.buffer.active.getLine(i)?.translateToString(true)).join(' ').includes('Codex'))`);
		await delay(300);
		check('installed-agent-opens-with-isolated-empty-account', true);
		await runtime.shot('agent-open');
		await runtime.connection.evaluate(`for(const s of agentController.sessions.list())if(s.agentId==='codex')agentController.sessions.end(s.id,true);true`);
		await until(`agentController.sessions.list().filter(s=>s.agentId==='codex').every(s=>!s.running)`);
		check('installed-agent-closes', true);
	}
	const before = await fs.stat(file);
	const firstPid = await runtime.connection.evaluate(`agentController.sessions.helper.pid`);
	await runtime.restart();
	check('helper-exits-with-host', (() => { try { process.kill(firstPid, 0); return false; } catch { return true; } })());
	await page();
	await runtime.connection.evaluate(`window.hostRequest=window.nandAcceptanceObsidian.requestUrl;window.nandAcceptanceObsidian.requestUrl=()=>{throw Error('Unexpected download on restart')};window.installResult=null;agentController.newShell('cmd').then(s=>{window.probeSession=s;installResult={ok:!!s,state:s?.connection}}).catch(e=>installResult={ok:false,message:e.message});true`);
	await until(`!!window.installResult`);
	check('verified-binary-reused-after-restart-without-network', await runtime.connection.evaluate(`installResult.ok&&installResult.state==='connected'`), await runtime.connection.evaluate(`installResult`));
	check('cached-binary-unchanged', (await fs.stat(file)).mtimeMs === before.mtimeMs);
	await runtime.connection.evaluate(`window.nandAcceptanceObsidian.requestUrl=hostRequest;probeSession.input(${JSON.stringify('exit\r')});true`);
	await until(`probeSession.connection==='exited'`);
	check('shell-exits-cleanly', true);
	check('no-host-errors', await runtime.connection.evaluate(`nandAcceptanceErrors.length===0`), await runtime.connection.evaluate(`nandAcceptanceErrors`));
} catch (error) {
	rows.push({ name: 'acceptance-failure', passed: false, detail: error.stack });
	await runtime.shot('failure').catch(() => undefined);
} finally {
	await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ passed: rows.every(row => row.passed), proxyFromEnvironment: !!process.env.HTTPS_PROXY, rows }, null, 2));
	console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length, failures: rows.filter(row => !row.passed) }));
	await runtime.stop();
}
assert.ok(rows.every(row => row.passed), 'Terminal acceptance failed');
