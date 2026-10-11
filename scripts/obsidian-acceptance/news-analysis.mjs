// Native News storage + published PTY/helper + explicit answer-protocol fixture.
// This is not a real provider/model editorial-quality acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const fixture = `const fs=require('fs'),path=require('path'),cp=require('child_process');
const home=process.env.CODEX_HOME,prompt=process.argv.at(-1),cwd=process.cwd();
const hooks=JSON.parse(fs.readFileSync(path.join(home,'hooks.json'),'utf8')).hooks;
const script=/"([^\"]+nand-automation-hook.cjs)"/.exec(hooks.Stop[0].hooks[0].command)?.[1];
const post=(event,data={})=>cp.spawnSync(process.execPath,[script,event],{input:JSON.stringify(data),env:process.env,windowsHide:true});
const payload=JSON.parse(prompt.slice(prompt.lastIndexOf('\\n\\n')+2));
const device=fs.readdirSync(path.join(cwd,'.nand/news'))[0];
const runs=JSON.parse(fs.readFileSync(path.join(cwd,'.nand/news',device,'runs.json'),'utf8')).items;
fs.appendFileSync(path.join(cwd,'probe.jsonl'),JSON.stringify({pid:process.pid,ids:payload.materials.map(m=>m.id),started:runs.at(-1).receipt.state==='started',promptChars:prompt.length})+'\\n');
const answer='<nand-news-json>'+JSON.stringify({materials:payload.materials.map(m=>({id:m.id,relevance:'PASS',itemType:'product_launch',axes:{sig:8,nov:7,cred:6,reson:5,act:9},qualityFlags:[],scope:'unknown',subject:null,frame:null,category:'产品更新',tags:['产品更新'],titleZh:'产品上线',summaryZh:'产品增加了明确功能。',reason:'材料提供具体事实。',relations:m.candidates.map(c=>({kind:'UNRELATED',targetId:c.id,confidence:1}))}))})+'</nand-news-json>';
post('UserPromptSubmit');process.stdout.write('SCREEN_ONLY\\n');
if(payload.materials.some(m=>m.body.includes('WAIT_FOR_PERMISSION'))&&!fs.existsSync(path.join(cwd,'allow-retry')))post('PermissionRequest');
else post('Stop',{last_assistant_message:payload.materials.length>1?'invalid JSON':answer});
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',text=>{input+=text;if(input.includes('corrected')){input='';post('UserPromptSubmit');post('Stop',{last_assistant_message:answer});}});
setInterval(()=>{},1000);
`;
let runtime, connection;
const rows = [];
const check = (name, passed, detail) => { rows.push({ name, passed, ...(detail === undefined ? {} : { detail }) }); assert.ok(passed, name); };
const until = async expression => {
	const deadline = Date.now() + 30000;
	while (Date.now() < deadline) { if (await connection.evaluate(expression)) return; await delay(80); }
	throw Error(`Timed out: ${expression}`);
};
const bind = async () => {
	await connection.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'news',section:'all'})`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-news-view'))`);
	await connection.evaluate(`window.nv=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-news-view');nv.service.ready`);
};
const analyze = async () => {
	await connection.evaluate(`window.analysisResult=null;nv.service.analyze({run:(prompt,call)=>ac.prompts.run({agentId:'codex',prompt,purpose:'News native protocol acceptance',timeoutMs:20000,keepTerminal:call.keepTerminal,continueTerminalId:call.continueTerminalId}),close:id=>ac.prompts.close(id)}).then(r=>analysisResult=r).catch(e=>analysisResult={thrown:String(e)});true`);
	await until('!!analysisResult'); return connection.evaluate('analysisResult');
};
try {
	runtime = await launchFreshVault({ root: process.argv[2], port: 9254, files: { 'news-fixture.cjs': fixture }, settings: { version: 1, namespaces: {
		app: { language: 'en', introSeen: true, modules: { agent: true, news: false, home: false, archives: false, browser: false, sync: false, comments: false, notifications: false, automations: false, icons: false } },
		news: { enabled: true, analysisEnabled: true, dailyCallLimit: 2, sources: [{ id: 'fixture', name: 'Fixture', type: 'rss', url: 'https://example.invalid/rss', tier: 'T1', participation: 'editorial', intervalMinutes: 60, enabled: false }] },
	} } });
	connection = runtime.connection;
	await connection.evaluate(`app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();true`);
	await connection.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'terminal',section:'running'})`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-agent-page'))`);
	await connection.evaluate(`window.ac=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-agent-page').controller;ac.settings.update(d=>{d.agents.agents.codex.enabled=true;d.agents.agents.codex.cliPath=${JSON.stringify(process.execPath)};d.agents.agents.codex.accountId='news-probe';d.agents.agents.codex.permissionMode='manual';d.agents.agents.codex.extraArgs=${JSON.stringify('"' + path.join(runtime.vault, 'news-fixture.cjs') + '"')}})`);
	const device = (await fs.readdir(path.join(runtime.vault, '.nand/config/devices'))).find(name => name.endsWith('.json')).slice(0, -5);
	const directory = path.join(runtime.vault, '.nand/news', device);
	await fs.mkdir(directory, { recursive: true });
	const materials = Array.from({ length: 13 }, (_, i) => ({ id: `fixture:${i}`, sourceId: 'fixture', sourceItemId: String(i), originalUrl: `https://example.invalid/${i}`, canonicalKey: `https://example.invalid/${i}`, title: `Product ${i}`, bodyExcerpt: 'A concrete update.', revision: 1, contentHash: `hash-${i}`, discoveredAt: Date.now(), publishedAt: Date.now() }));
	await fs.writeFile(path.join(directory, 'materials.json'), JSON.stringify({ version: 1, items: materials }));
	await connection.evaluate(`app.plugins.plugins.nand.setModuleEnabled('news',true)`); await bind();
	const first = await analyze();
	check('same-terminal-repair-consumes-two-calls-and-stops-next-batch', first.status === 'budget' && first.calls === 2 && first.spent === 2 && first.analyses.length === 12, { status: first.status, calls: first.calls, spent: first.spent, count: first.analyses?.length });
	let probes = (await fs.readFile(path.join(runtime.vault, 'probe.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
	check('repair-did-not-spawn-another-process', probes.length === 1 && probes[0].ids.length === 12, probes);
	check('reservation-was-durable-before-spawn', probes[0].started);
	check('batch-ids-hide-source-identity', probes[0].ids.every(id => /^m\d+$/.test(id)));
	const runs = JSON.parse(await fs.readFile(path.join(directory, 'runs.json'), 'utf8'));
	check('raw-results-durable-with-unknown-usage-and-account-hash', runs.items.length === 2 && runs.items.every(run => run.receipt.state === 'applied' && run.receipt.usageKnown === false && /^[0-9a-f]{64}$/.test(run.receipt.accountIdentity)) && runs.items[1].receipt.result.text.includes('<nand-news-json>'));
	check('integer-score-and-native-account-persisted', first.analyses.every(item => item.score === 73 && /^[0-9a-f]{64}$/.test(item.accountIdentity) && item.samples[0].axes.act === 9));
	await connection.evaluate(`app.plugins.plugins.nand.settingsNamespace('news').update(d=>{d.weights.product_launch={sig:0,nov:0,cred:0,reson:0,act:10};d.interest='Changed interest'})`);
	check('reweighting-is-local-and-preserves-axes', await connection.evaluate(`nv.service.analyses().every(a=>a.score===90&&a.samples[0].axes.sig===8)`));
	check('completed-revisions-are-reused-at-exhausted-quota', (await analyze()).calls === 0);
	// Recreate the crash boundary after raw receipt persistence but before business apply.
	await connection.evaluate(`app.plugins.plugins.nand.setModuleEnabled('news',false)`);
	await fs.writeFile(path.join(directory, 'analyses.json'), JSON.stringify({ version: 1, items: [] }));
	for (const run of runs.items) { run.receipt.state = 'received'; run.status = 'received'; }
	await fs.writeFile(path.join(directory, 'runs.json'), JSON.stringify(runs));
	await connection.evaluate(`app.plugins.plugins.nand.setModuleEnabled('news',true)`); await bind();
	check('received-replies-apply-locally-on-activation', await connection.evaluate(`nv.service.analyses().length===12&&nv.service.analyses().every(a=>a.score===90)`));
	probes = (await fs.readFile(path.join(runtime.vault, 'probe.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
	check('received-recovery-sends-zero-prompts', probes.length === 1);
	await connection.evaluate(`app.plugins.plugins.nand.settingsNamespace('news').update(d=>{d.dailyCallLimit=3})`);
	const last = await analyze();
	check('unstarted-batch-continues-only-after-authorized-run', last.status === 'complete' && last.calls === 1 && last.spent === 3 && last.analyses.length === 13);
	await connection.evaluate(`nv.contentEl.querySelector('li button').click()`); await delay(100); await runtime.shot('analysis-detail');
	await delay(500);
	probes = (await fs.readFile(path.join(runtime.vault, 'probe.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
	check('completed-owned-processes-exit', probes.every(item => { try { process.kill(item.pid, 0); return false; } catch { return true; } }));
	await connection.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'settings',section:'news'})`);
	await until(`document.querySelectorAll('.nand-news-analysis-settings').length===2`);
	await connection.evaluate(`document.querySelectorAll('.nand-news-analysis-settings')[0].open=true;window.productRow=[...document.querySelectorAll('.nand-news-weight-row')].find(r=>r.querySelector('.setting-item-name').textContent==='Product launch');true`);
	await connection.evaluate(`(()=>{const input=productRow.querySelector('input');input.value='11';input.dispatchEvent(new Event('input',{bubbles:true}));const details=document.querySelector('.nand-news-analysis-settings');[...details.querySelectorAll('button')].find(b=>b.textContent==='Save changes').click()})()`);
	await until(`document.querySelector('.nand-news-settings').textContent.includes('each row must total 10')`);
	check('invalid-weight-draft-does-not-change-scores', await connection.evaluate(`nv.service.analyses().every(a=>a.score===90)`));
	await connection.evaluate(`(()=>{const inputs=productRow.querySelectorAll('input');[2,0,0,0,8].forEach((value,i)=>{inputs[i].value=String(value);inputs[i].dispatchEvent(new Event('input',{bubbles:true}))});[...document.querySelector('.nand-news-analysis-settings').querySelectorAll('button')].find(b=>b.textContent==='Save changes').click()})()`);
	await until(`nv.service.analyses().every(a=>a.score===88)`);
	check('native-weight-editor-recalculates-with-zero-calls', (await fs.readFile(path.join(runtime.vault, 'probe.jsonl'), 'utf8')).trim().split('\n').length === 2);
	await connection.evaluate(`(()=>{const details=document.querySelector('.nand-news-prompt-version').parentElement;details.open=true;const input=details.querySelector('textarea');input.value='{{unknown}}';input.dispatchEvent(new Event('input',{bubbles:true}));details.querySelector('button').click()})()`);
	await until(`document.querySelector('.nand-news-settings').textContent.includes('unknown variable')`);
	check('invalid-template-is-not-saved', await connection.evaluate(`!app.plugins.plugins.nand.settingsNamespace('news').get().templates.scoring.includes('{{unknown}}')`));
	await connection.evaluate(`app.plugins.plugins.nand.changeLanguage('zh')`);
	check('language-switch-preserves-template-draft-and-localizes-axes', await connection.evaluate(`document.querySelector('.nand-news-prompt-version').parentElement.querySelector('textarea').value==='{{unknown}}'&&productRow.querySelector('input').getAttribute('aria-label')==='实质份量'`));
	for (const preset of ['claude-code', 'codex', 'obsidian']) for (const mode of ['light', 'dark']) for (const width of [1200, 800, 420]) {
		await connection.evaluate(`app.plugins.plugins.nand.theme.update(d=>{d.preset=${JSON.stringify(preset)}})`);
		await connection.evaluate(`app.changeTheme(${JSON.stringify(mode === 'dark' ? 'obsidian' : 'moonstone')})`);
		await connection.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
		await connection.evaluate(`document.querySelector('.nand-news-analysis-settings').scrollIntoView({block:'start'})`); await delay(60);
		const geometry = await connection.evaluate(`(()=>{const el=document.querySelector('.nand-settings-page');return {width:el.clientWidth,scroll:el.scrollWidth}})()`);
		await runtime.shot(`analysis-settings-${preset}-${mode}-${width}`);
		check(`analysis-settings-width-${preset}-${mode}-${width}`, geometry.scroll <= geometry.width + 2, geometry);
	}
	await runtime.restart(); connection = runtime.connection; await bind();
	check('full-host-restart-preserves-analysis-and-quota', await connection.evaluate(`nv.service.analyses().length===13&&nv.service.analyses().every(a=>a.score===88)&&nv.service.journal.spent()===3`));
	await connection.evaluate(`app.plugins.plugins.nand.settingsNamespace('news').update(d=>{d.agentId='codex';d.cwd='';d.dailyCallLimit=5})`);
	const vaultSettings = JSON.parse(await fs.readFile(path.join(runtime.vault, '.nand/config/settings.json'), 'utf8'));
	const deviceSettings = JSON.parse(await fs.readFile(path.join(runtime.vault, '.nand/config/devices', device + '.json'), 'utf8'));
	check('agent-preference-is-device-scoped', vaultSettings.namespaces.news.agentId === undefined && deviceSettings.namespaces.news.agentId === 'codex');
	await connection.evaluate(`app.plugins.plugins.nand.setModuleEnabled('news',false)`);
	const waitingMaterial = { ...materials[0], id: 'fixture:waiting', sourceItemId: 'waiting', originalUrl: 'https://example.invalid/waiting', canonicalKey: 'https://example.invalid/waiting', title: 'Permission fixture', bodyExcerpt: 'WAIT_FOR_PERMISSION', contentHash: 'wait' };
	await fs.writeFile(path.join(directory, 'materials.json'), JSON.stringify({ version: 1, items: [...materials, waitingMaterial] }));
	await connection.evaluate(`app.plugins.plugins.nand.setModuleEnabled('news',true)`); await bind();
	await connection.evaluate(`[...nv.contentEl.querySelectorAll('header button')].find(b=>b.textContent==='分析').click()`);
	await until(`nv.service.analysisActivity().some(s=>s.status==='needs-attention')&&document.querySelector('.nand-news-runs').textContent.includes('打开终端')`);
	check('native-permission-state-has-terminal-action', true);
	await runtime.shot('permission-wait');
	await connection.evaluate(`[...document.querySelector('.nand-news-runs').querySelectorAll('button')].find(b=>b.textContent==='打开终端').click()`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-agent-page'))`);
	check('permission-action-opens-agent-terminal', true);
	await bind();
	await connection.evaluate(`[...document.querySelector('.nand-news-runs').querySelectorAll('button')].find(b=>b.textContent==='取消正在进行的调用').click()`);
	await until(`nv.service.analysisActivity().length===0&&nv.service.runHistory()[0]?.status==='cancelled'`);
	check('cancel-button-records-cancelled-and-clears-activity', true);
	// Simulate a crash at the started/unknown boundary, then retry through the visible action.
	await connection.evaluate(`app.plugins.plugins.nand.setModuleEnabled('news',false)`);
	const interrupted = JSON.parse(await fs.readFile(path.join(directory, 'runs.json'), 'utf8'));
	const unknown = interrupted.items.at(-1); unknown.status = 'started'; unknown.receipt.state = 'started'; delete unknown.receipt.result;
	await fs.writeFile(path.join(directory, 'runs.json'), JSON.stringify(interrupted));
	await fs.writeFile(path.join(runtime.vault, 'allow-retry'), 'ready');
	await connection.evaluate(`app.plugins.plugins.nand.setModuleEnabled('news',true)`); await bind();
	await until(`nv.service.runHistory()[0]?.status==='interrupted'`);
	await connection.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'news',section:'runs'})`);
	check('interrupted-has-explicit-retry-and-unknown-cost', await connection.evaluate(`document.querySelector('.nand-news-runs').textContent.includes('重试已中断的分析')&&document.querySelector('.nand-news-runs').textContent.includes('费用未知')`));
	await connection.evaluate(`document.querySelector('.nand-news-runs details').open=true;[...document.querySelector('.nand-news-runs').querySelectorAll('button')].find(b=>b.textContent==='重试已中断的分析').click()`);
	await until(`nv.service.analyses().length===14&&nv.service.journal.spent()===5`);
	check('visible-retry-sends-once-and-applies-result', true);
	await connection.evaluate(`app.plugins.plugins.nand.settingsNamespace('news').update(d=>{d.dailyCallLimit=6})`);
	await connection.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'news',section:'all'})`);
	await connection.evaluate(`nv.contentEl.querySelector('[data-news-material-id="fixture:0"] button').click()`);
	await until(`!![...nv.contentEl.querySelectorAll('button')].find(b=>b.textContent==='重新分析（消耗 CLI 额度）')`);
	await connection.evaluate(`[...nv.contentEl.querySelectorAll('button')].find(b=>b.textContent==='重新分析（消耗 CLI 额度）').click()`);
	await until(`nv.service.journal.spent()===6&&nv.service.analysisActivity().length===0&&nv.service.analyses().find(a=>a.materialId==='fixture:0').version!==${JSON.stringify(first.analyses[0].version)}`);
	check('explicit-reanalysis-uses-new-template-version-and-one-call', true);
	await delay(500);
	probes = (await fs.readFile(path.join(runtime.vault, 'probe.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
	check('cancel-and-retry-leave-no-owned-processes', probes.every(item => { try { process.kill(item.pid, 0); return false; } catch { return true; } }));
	const errors = await connection.evaluate('window.nandAcceptanceErrors');
	check('no-host-errors', errors.length === 0, errors);
} finally {
	if (runtime) {
		await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ method: 'Native Obsidian/private storage/published PTY helper with protocol fixture; no real-model quality claim', passed: rows.every(row => row.passed), rows }, null, 2));
		await runtime.stop();
	}
}
console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length }));
