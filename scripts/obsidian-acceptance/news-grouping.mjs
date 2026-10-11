// Native host + published helper protocol fixture. This does not evaluate a model provider.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const fixture = `const fs=require('fs'),path=require('path'),cp=require('child_process');
const home=process.env.CODEX_HOME,prompt=process.argv.at(-1),cwd=process.cwd();
const hooks=JSON.parse(fs.readFileSync(path.join(home,'hooks.json'),'utf8')).hooks;
const script=/"([^\\"]+nand-automation-hook.cjs)"/.exec(hooks.Stop[0].hooks[0].command)?.[1];
const post=(event,data={})=>cp.spawnSync(process.execPath,[script,event],{input:JSON.stringify(data),env:process.env,windowsHide:true});
const payload=JSON.parse(prompt.slice(prompt.lastIndexOf('\\n\\n')+2));
const device=fs.readdirSync(path.join(cwd,'.nand/news'))[0],runs=JSON.parse(fs.readFileSync(path.join(cwd,'.nand/news',device,'runs.json'),'utf8')).items;
fs.appendFileSync(path.join(cwd,'group-probe.jsonl'),JSON.stringify({pid:process.pid,kind:payload.roots?'review':'analysis',started:runs.at(-1).receipt.state==='started'})+'\\n');
const marker=title=>/\\[([^\\]]+)\\]/.exec(title)?.[1];
const kind=(a,b)=>a==='BRIDGE'&&['DUP_A','DUP_B'].includes(b)?'SAME_OCCURRENCE':a==='ROUNDUP'&&['LEAK','INDEPENDENT'].includes(b)?'ROUNDUP':a==='OFFICIAL'&&b==='LEAK'?'SAME_STORY':a==='MEDIA'&&b==='OFFICIAL'?'SAME_OCCURRENCE':a==='REVIEW'&&b==='LEAK'?'SAME_STORY':a==='LOW'&&b==='OFFICIAL'?'SAME_OCCURRENCE':'UNRELATED';
const answer=payload.roots?'<nand-news-merge>{"kind":"SAME_OCCURRENCE","confidence":0.75}</nand-news-merge>':'<nand-news-json>'+JSON.stringify({materials:payload.materials.map(m=>({id:m.id,relevance:'PASS',itemType:'model_release',axes:{sig:8,nov:8,cred:8,reson:8,act:8},qualityFlags:[],scope:marker(m.title)==='ROUNDUP'?'composite':'single',subject:'Company',frame:marker(m.title)==='ROUNDUP'?null:{title:m.title.slice(0,30),subject:'Company',action:'release',object:'Model',occurredAt:null,evidence:m.body,conditions:[]},category:'模型发布',tags:['模型发布'],titleZh:m.title,summaryZh:m.body,reason:'材料提供具体事件。',relations:m.candidates.map(c=>({kind:kind(marker(m.title),marker(c.title)),targetId:c.id,confidence:marker(m.title)==='LOW'&&marker(c.title)==='OFFICIAL'?0.79:1}))}))})+'</nand-news-json>';
post('UserPromptSubmit');post('Stop',{last_assistant_message:answer});setInterval(()=>{},1000);
`;
let runtime, connection;
const rows = [];
const check = (name, passed, detail) => { rows.push({ name, passed, ...(detail === undefined ? {} : { detail }) }); assert.ok(passed, name); };
const until = async expression => { const end = Date.now() + 30000; while (Date.now() < end) { if (await connection.evaluate(expression)) return; await delay(80); } throw new Error(`Timed out: ${expression}`); };
const bind = async () => {
	await connection.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'news',section:'all'})`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-news-view'))`);
	await connection.evaluate(`window.nv=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-news-view');nv.service.ready`);
};
const analyze = async () => {
	await connection.evaluate(`window.groupResult=null;nv.actions.analyze().then(r=>groupResult=r).catch(e=>groupResult=String(e));true`);
	await until('groupResult!==null'); return connection.evaluate('groupResult');
};
try {
	const names = ['LEAK', 'OFFICIAL', 'MEDIA', 'REVIEW', 'INDEPENDENT', 'ROUNDUP', 'LOW', 'DUP_A', 'DUP_B'];
	const sources = [...names, 'BRIDGE'].map(id => ({ id: id.toLowerCase().replace('_', '-'), name: id, type: 'rss', url: `https://example.invalid/${id}`, tier: id === 'OFFICIAL' ? 'T1' : 'T2', participation: 'editorial', intervalMinutes: 60, enabled: false }));
	runtime = await launchFreshVault({ root: process.argv[2], port: 9255, files: { 'group-fixture.cjs': fixture }, settings: { version: 1, namespaces: {
		app: { language: 'zh', introSeen: true, modules: { agent: true, news: false, home: false, archives: false, browser: false, sync: false, comments: false, notifications: false, automations: false, icons: false } },
		news: { enabled: true, analysisEnabled: true, dailyCallLimit: 20, sources },
	} } });
	connection = runtime.connection;
	await connection.evaluate(`app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();app.plugins.plugins.nand.openWorkbench({feature:'terminal',section:'running'})`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-agent-page'))`);
	await connection.evaluate(`window.ac=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-agent-page').controller;ac.settings.update(d=>{d.agents.agents.codex.enabled=true;d.agents.agents.codex.cliPath=${JSON.stringify(process.execPath)};d.agents.agents.codex.accountId='group-probe';d.agents.agents.codex.permissionMode='manual';d.agents.agents.codex.extraArgs=${JSON.stringify('"' + path.join(runtime.vault, 'group-fixture.cjs') + '"')}})`);
	const device = (await fs.readdir(path.join(runtime.vault, '.nand/config/devices'))).find(name => name.endsWith('.json')).slice(0, -5);
	const directory = path.join(runtime.vault, '.nand/news', device);
	await fs.mkdir(directory, { recursive: true });
	const now = Date.now();
	const makeMaterial = (name, index) => ({ id: `fixture:${name}`, sourceId: name.toLowerCase().replace('_', '-'), sourceItemId: name, originalUrl: `https://example.invalid/${name}`, canonicalKey: `https://example.invalid/${name}`, title: `[${name}] 模型发布与进展`, bodyExcerpt: 'Company released a model with clear capabilities and availability.', revision: 1, contentHash: `hash-${name}`, discoveredAt: now, publishedAt: now - (12 - index) * 3600000 });
	const materials = names.map(makeMaterial);
	await fs.writeFile(path.join(directory, 'materials.json'), JSON.stringify({ version: 1, items: materials }));
	await connection.evaluate(`app.plugins.plugins.nand.setModuleEnabled('news',true)`); await bind();
	check('analysis-completes-through-native-helper', await analyze() === 'complete');
	const state = await connection.evaluate(`({stories:nv.service.stories(),occurrences:nv.service.occurrences(),analyses:nv.service.analyses(),events:nv.service.events()})`);
	const story = state.stories.find(item => item.materialIds.includes('fixture:LEAK'));
	check('same-batch-duplicate-folds-and-root-has-three-occurrences', story.materialIds.length === 4 && story.occurrenceIds.length === 3, story);
	check('most-covered-occurrence-selects-official-representative', story.representativeId === 'fixture:OFFICIAL');
	check('roundup-only-mentions-two-independent-events', state.events.mentions.filter(item => item.materialId === 'fixture:ROUNDUP').length === 2 && !state.stories.some(item => item.materialIds.includes('fixture:ROUNDUP')));
	check('low-confidence-is-unconfirmed-and-not-featured', state.analyses.some(item => item.materialId === 'fixture:LOW' && !item.groupConfirmed && item.target !== 'featured'));
	check('confirmed-high-score-becomes-featured', state.analyses.some(item => item.materialId === 'fixture:OFFICIAL' && item.groupConfirmed && item.target === 'featured'));
	const oldId = state.stories.find(item => item.materialIds.includes('fixture:DUP_B')).id;
	await connection.evaluate(`nv.contentEl.querySelector('[data-news-material-id="fixture:OFFICIAL"] button').click()`);
	await until(`!!nv.contentEl.querySelector('.nand-news-event')`);
	check('reader-shows-fold-count-progress-and-report-timeline', await connection.evaluate(`nv.contentEl.textContent.includes('+3 个其他来源')&&nv.contentEl.querySelector('.nand-news-event ol').children.length===3&&nv.contentEl.querySelector('.nand-news-event ul').children.length===4`));
	const beforeOrder = await connection.evaluate(`[...nv.contentEl.querySelectorAll('.nand-news-event ol time')].map(el=>el.dateTime)`);
	await connection.evaluate(`nv.contentEl.querySelector('.nand-news-event>button').click()`); await delay(100);
	check('timeline-order-reverses', JSON.stringify(await connection.evaluate(`[...nv.contentEl.querySelectorAll('.nand-news-event ol time')].map(el=>el.dateTime)`)) === JSON.stringify(beforeOrder.toReversed()));
	for (const preset of ['claude-code', 'codex', 'obsidian']) for (const mode of ['light', 'dark']) for (const width of [1200, 800, 420]) {
		await connection.evaluate(`app.plugins.plugins.nand.theme.update(d=>{d.preset=${JSON.stringify(preset)}})`);
		await connection.evaluate(`app.changeTheme(${JSON.stringify(mode === 'dark' ? 'obsidian' : 'moonstone')})`);
		await connection.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
		await connection.evaluate(`nv.contentEl.querySelector('.nand-news-event').scrollIntoView({block:'start'})`); await delay(60);
		const geometry = await connection.evaluate(`(()=>{const el=nv.contentEl.querySelector('.nand-news-page');return {width:el.clientWidth,scroll:el.scrollWidth}})()`);
		await runtime.shot(`event-${preset}-${mode}-${width}`);
		check(`event-width-${preset}-${mode}-${width}`, geometry.scroll <= geometry.width + 2, geometry);
	}
	await connection.evaluate(`app.plugins.plugins.nand.setModuleEnabled('news',false)`);
	materials.push(makeMaterial('BRIDGE', 10));
	await fs.writeFile(path.join(directory, 'materials.json'), JSON.stringify({ version: 1, items: materials }));
	await connection.evaluate(`app.plugins.plugins.nand.setModuleEnabled('news',true)`); await bind();
	const used = await connection.evaluate('nv.service.callBudget().used');
	check('bridge-and-independent-review-complete', await analyze() === 'complete');
	check('merge-review-counts-one-extra-durable-call', await connection.evaluate(`nv.service.callBudget().used===${used + 2}&&nv.service.runHistory()[0].receipt.kind==='grouping'&&nv.service.runHistory()[0].receipt.state==='applied'`));
	check('old-event-alias-resolves-to-merged-occurrence', await connection.evaluate(`nv.service.story(${JSON.stringify(oldId)}).materialIds.includes('fixture:DUP_A')&&nv.service.story(${JSON.stringify(oldId)}).materialIds.includes('fixture:DUP_B')`));
	await connection.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'news',section:'all',resourceId:${JSON.stringify(oldId)}});true`);
	await until(`!!nv.contentEl.querySelector('[data-news-selected-id="fixture:DUP_A"] .nand-news-event')`);
	check('legacy-event-deep-link-opens-merged-reader', true);
	await runtime.shot('merged-alias');
	await runtime.restart(); connection = runtime.connection; await bind();
	check('restart-preserves-alias-membership-and-quota', await connection.evaluate(`nv.service.story(${JSON.stringify(oldId)}).materialIds.length===3&&nv.service.callBudget().used===${used + 2}`));
	const callsBefore = await connection.evaluate('nv.service.callBudget().used');
	check('repeated-analysis-does-not-repeat-root-review', await analyze() === 'complete' && await connection.evaluate(`nv.service.callBudget().used===${callsBefore}`));
	await delay(500);
	const probes = (await fs.readFile(path.join(runtime.vault, 'group-probe.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
	check('review-reservation-exists-before-separate-process', probes.filter(item => item.kind === 'review').length === 1 && probes.every(item => item.started));
	check('owned-processes-exited', probes.every(item => { try { process.kill(item.pid, 0); return false; } catch { return true; } }));
	const errors = await connection.evaluate('window.nandAcceptanceErrors');
	check('no-host-errors', errors.length === 0, errors);
} finally {
	if (runtime) { await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ method: 'Native Obsidian/published helper protocol fixture; no model-provider quality claim', passed: rows.every(row => row.passed), rows }, null, 2)); await runtime.stop(); }
}
console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length }));
