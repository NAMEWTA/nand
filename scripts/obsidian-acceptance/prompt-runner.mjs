// Real Obsidian/helper processes, with an explicit native-hook protocol fixture.
// This verifies process/result ownership; it does not claim a provider/model acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const fixture = `const fs=require('fs'), path=require('path'), cp=require('child_process');
const home=process.env.CODEX_HOME, prompt=process.argv.at(-1);
const hooks=JSON.parse(fs.readFileSync(path.join(home,'hooks.json'),'utf8')).hooks;
const script=/"([^\"]+nand-automation-hook.cjs)"/.exec(hooks.Stop[0].hooks[0].command)?.[1];
if(!script) throw Error('Missing installed hook');
fs.writeFileSync(path.join(home,'probe.json'),JSON.stringify({pid:process.pid,promptLength:prompt.length,hookDir:process.env.NAND_HOOK_DIR,hasGrant:!!process.env.NAND_BROWSER_TOKEN}));
const post=(event,data={})=>cp.spawnSync(process.execPath,[script,event],{input:JSON.stringify(data),env:process.env,windowsHide:true});
post('UserPromptSubmit');
process.stdout.write('SCREEN_ONLY_NO_ANSWER\\n');
if(prompt==='permission') post('PermissionRequest');
else if(prompt==='oversize') post('Stop',{last_assistant_message:'x'.repeat(2*1024*1024+1)});
else if(prompt==='exit') process.exit(0);
else if(prompt!=='wait') post('Stop',{last_assistant_message:JSON.stringify(Array.from({length:3000},(_,id)=>({id,text:'完整结果'})))});
process.stdin.setEncoding('utf8');
process.stdin.on('data',text=>{if(text.includes('REPAIR')){post('UserPromptSubmit');post('Stop',{last_assistant_message:'{"repaired":true}'});}});
setInterval(()=>{},1000);
`;
const runtime = await launchFreshVault({ root: process.argv[2], port: 9253,
	files: { 'runner-fixture.cjs': fixture }, settings: { version: 1, namespaces: {
		app: { language: 'en', introSeen: true, modules: { agent: true, home: false, archives: false, browser: false, news: false, sync: false, comments: false, notifications: false, automations: false, icons: false } },
	} } });
const rows = [];
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
const until = async expression => {
	const deadline = Date.now() + 30000;
	while (Date.now() < deadline) { if (await runtime.connection.evaluate(expression)) return; await delay(80); }
	throw Error(`Condition timed out: ${expression}`);
};
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const account = path.join(runtime.vault, '.obsidian/plugins/nand/accounts/codex/runner-probe/home');
const probe = async () => JSON.parse(await fs.readFile(path.join(account, 'probe.json'), 'utf8'));
const start = async (prompt, options = '') => {
	await fs.unlink(path.join(account, 'probe.json')).catch(() => undefined);
	await runtime.connection.evaluate(`window.runResult=null;window.runStates=[];window.runAbort=new AbortController();ac.prompts.run({agentId:'codex',prompt:${JSON.stringify(prompt)},purpose:'Native runner probe',signal:runAbort.signal,timeoutMs:20000,onState:s=>runStates.push(s),${options}}).then(r=>runResult=r).catch(e=>runResult={thrown:String(e)});true`);
};
const finished = async () => { await until('!!window.runResult'); return runtime.connection.evaluate('runResult'); };
try {
	await runtime.connection.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'terminal',section:'running'})`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-agent-page'))`);
	await runtime.connection.evaluate(`window.ac=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-agent-page').controller;true`);
	await runtime.connection.evaluate(`ac.settings.update(d=>{d.agents.agents.codex.enabled=true;d.agents.agents.codex.cliPath=${JSON.stringify(process.execPath)};d.agents.agents.codex.accountId='runner-probe';d.agents.agents.codex.permissionMode='manual';d.agents.agents.codex.extraArgs=${JSON.stringify('"' + path.join(runtime.vault, 'runner-fixture.cjs') + '"')}})`);
	await runtime.connection.evaluate(`ac.newShell('cmd').then(s=>{window.manual=s;return true})`);
	check('manual-session-started', await runtime.connection.evaluate('manual.running'));
	await start('中文'.repeat(5000));
	const result = await finished();
	const first = await probe();
	check('full-native-answer-over-8000-characters', result.status === 'succeeded' && result.text.length > 8000 && JSON.parse(result.text).length === 3000 && !result.text.includes('SCREEN_ONLY'), { status: result.status, chars: result.text?.length, promptChars: first.promptLength });
	check('long-Chinese-argv-arrives-intact', first.promptLength === 10000);
	await delay(600);
	check('default-completion-kills-owned-process', !alive(first.pid) && await runtime.connection.evaluate(`!ac.sessions.get(${JSON.stringify(result.terminalId)})`));
	check('manual-session-survives', await runtime.connection.evaluate('manual.running'));
	await start('permission');
	await until(`runStates.some(s=>s.status==='running')&&runStates.at(-1)?.status==='needs-attention'`);
	const permission = await probe();
	await runtime.connection.evaluate(`ac.prompts.open(runStates.at(-1).terminalId)`);
	check('permission-wait-opens-terminal', await runtime.connection.evaluate(`ac.sessions.get(runStates.at(-1).terminalId)?.activity==='waiting'`));
	await runtime.shot('permission-wait');
	await runtime.connection.evaluate('runAbort.abort();true');
	check('cancel-is-terminal', (await finished()).status === 'cancelled');
	await delay(600);
	check('cancel-kills-process', !alive(permission.pid));
	await start('wait', 'timeoutMs:1500');
	const timeout = await finished();
	const timed = await probe();
	await delay(600);
	check('timeout-kills-process', timeout.status === 'timeout' && !alive(timed.pid), timeout);
	await start('oversize');
	const oversize = await finished();
	check('oversize-keeps-error-completion', oversize.status === 'failed' && oversize.errorCode === 'answerTooLarge' && oversize.text === '', oversize);
	await start('exit');
	const exited = await finished();
	check('zero-exit-without-native-answer-fails', exited.status === 'failed' && exited.errorCode === 'processExit', exited);
	await start('x'.repeat(32000));
	const argv = await finished();
	check('oversize-argv-rejected-before-spawn', argv.status === 'failed' && argv.errorCode === 'promptTooLarge' && !await fs.stat(path.join(account, 'probe.json')).catch(() => undefined), argv);
	await start('complete', 'keepTerminal:true');
	const retained = await finished();
	const kept = await probe();
	check('explicitly-retained-terminal-stays-owned', retained.status === 'succeeded' && alive(kept.pid));
	await runtime.connection.evaluate(`window.runResult=null;ac.prompts.run({agentId:'codex',prompt:'REPAIR',purpose:'Native repair probe',continueTerminalId:${JSON.stringify(retained.terminalId)},timeoutMs:5000}).then(r=>runResult=r);true`);
	const repaired = await finished();
	check('format-repair-reuses-same-terminal', repaired.status === 'succeeded' && repaired.terminalId === retained.terminalId && JSON.parse(repaired.text).repaired === true, repaired);
	await delay(600);
	check('completed-repair-closes-owned-terminal', !alive(kept.pid));
	await start('wait');
	await until(`runStates.some(s=>s.status==='running')`);
	const disabled = await probe();
	await runtime.connection.evaluate(`app.plugins.plugins.nand.setModuleEnabled('agent',false)`);
	check('agent-disable-interrupts-run', (await finished()).status === 'interrupted');
	await delay(600);
	check('agent-disable-kills-process', !alive(disabled.pid));
	check('no-host-errors', await runtime.connection.evaluate('nandAcceptanceErrors.length===0'), await runtime.connection.evaluate('nandAcceptanceErrors'));
} catch (error) {
	rows.push({ name: 'acceptance-failure', passed: false, detail: error.stack });
	await runtime.shot('failure').catch(() => undefined);
} finally {
	await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ passed: rows.every(row => row.passed), method: 'native Obsidian + published PTY helper + protocol fixture; no model/provider claim', rows }, null, 2));
	console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length, failures: rows.filter(row => !row.passed) }));
	await runtime.stop();
}
assert.ok(rows.every(row => row.passed), 'Prompt runner acceptance failed');
