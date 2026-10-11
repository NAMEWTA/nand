// Real Obsidian, published PTY/helper and native Stop hooks; the CLI is an explicit local fixture.
// Verifies reader/receipt/note/notification behavior, not model editorial quality.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const fixture = String.raw`const fs=require('fs'),path=require('path'),cp=require('child_process');
const cwd=process.cwd(),prompt=process.argv.at(-1),home=process.env.CODEX_HOME;
const hooks=JSON.parse(fs.readFileSync(path.join(home,'hooks.json'),'utf8')).hooks;
const script=/"([^"]+nand-automation-hook.cjs)"/.exec(hooks.Stop[0].hooks[0].command)[1];
const post=(event,data={})=>cp.spawnSync(process.execPath,[script,event],{input:JSON.stringify(data),env:process.env,windowsHide:true});
const payload=JSON.parse(prompt.slice(prompt.lastIndexOf('\n\n')+2));
const probe=path.join(cwd,'brief-probe.jsonl');
fs.appendFileSync(probe,JSON.stringify({pid:process.pid,urls:payload.sources.map(s=>s.url),promptChars:prompt.length})+'\n');
const count=fs.readFileSync(probe,'utf8').trim().split('\n').length;
const body='## 背景\n这是第 '+count+' 次生成的简报。\n'+payload.sources.map(s=>'[来源](<'+s.url+'>)').join('\n')+'\n## 影响\n功能影响可以追溯到来源。\n## 时间线\n今天发布，随后更新。';
post('UserPromptSubmit');process.stdout.write('SCREEN_ONLY\n');
post('Stop',{last_assistant_message:fs.existsSync(path.join(cwd,'invalid-answer'))?'只有背景、影响和时间线关键词':body});
setInterval(()=>{},1000);`;
const receiver = String.raw`const fs=require('fs'),path=require('path');process.stdin.setRawMode(true);process.stdin.setEncoding('utf8');process.stdout.write('\x1b[?2004hREADY\n');process.stdin.on('data',text=>fs.appendFileSync(path.join(process.cwd(),'received-input.txt'),text));setInterval(()=>{},1000);`;
let runtime, connection, completed = false;
const rows = [];
const check = (name, passed, detail) => { rows.push({ name, passed, ...(detail === undefined ? {} : { detail }) }); assert.ok(passed, name); };
const until = async expression => { const end = Date.now() + 30000; while (Date.now() < end) { if (await connection.evaluate(expression)) return; await delay(80); } throw new Error(`Timed out: ${expression}`); };
const bind = async () => {
	await connection.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'news',section:'all',resourceId:'m0'})`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-news-view'))`);
	await connection.evaluate(`window.nv=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-news-view');nv.service.ready`);
};
const click = async (selector, label) => { await connection.evaluate(`[...nv.contentEl.querySelectorAll(${JSON.stringify(selector)})].find(b=>b.textContent===${JSON.stringify(label)}).click()`); await delay(120); };
const inbox = async () => {
	await connection.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'notifications',section:'all'})`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-notification-surface'))`);
	await connection.evaluate(`window.iv=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-notification-surface');true`);
};
try {
	runtime = await launchFreshVault({ root: process.argv[2], port: 9258, files: { 'brief-fixture.cjs': fixture, 'receiver.cjs': receiver }, settings: { version: 1, namespaces: {
		app: { language: 'en', introSeen: true, modules: { agent: true, notifications: true, news: false, home: false, archives: false, browser: false, sync: false, comments: false, automations: false, icons: false } },
		news: { enabled: true, analysisEnabled: true, autoRefresh: false, refreshOnStartup: false, refreshWhenStale: false, agentId: 'codex', dailyCallLimit: 20,
			sources: [{ id: 'fixture', name: 'Fixture', url: 'https://example.invalid/feed', type: 'rss', tier: 'T1', participation: 'editorial', enabled: false }] },
	} } });
	connection = runtime.connection;
	await connection.evaluate(`app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();true`);
	await connection.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'terminal',section:'running'})`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-agent-page'))`);
	await connection.evaluate(`window.ac=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-agent-page').controller;ac.settings.update(d=>{d.agents.agents.codex.enabled=true;d.agents.agents.codex.cliPath=${JSON.stringify(process.execPath)};d.agents.agents.codex.accountId='brief-probe';d.agents.agents.codex.permissionMode='manual';d.agents.agents.codex.extraArgs=${JSON.stringify('"' + path.join(runtime.vault, 'brief-fixture.cjs') + '"')}})`);
	const device = await connection.evaluate(`app.loadLocalStorage('nand.device-id')`), directory = path.join(runtime.vault, '.nand/news', device);
	await fs.mkdir(directory, { recursive: true });
	const now = Date.now();
	const materials = [0, 1].map(i => ({ id: `m${i}`, sourceId: 'fixture', sourceItemId: `m${i}`, originalUrl: `https://example.invalid/report${i}`, canonicalKey: `m${i}`, title: `Original report ${i}`, summary: 'Original source summary', bodyExcerpt: 'Company released a model.', revision: 1, contentHash: `h${i}`, discoveredAt: now - i * 1000, publishedAt: now - i * 1000 }));
	const frame = { title: 'Release', subject: 'Company', action: 'released', object: 'model', occurredAt: null, evidence: materials[0].bodyExcerpt, conditions: [] };
	const analyses = materials.map(m => ({ materialId: m.id, revision: 1, contentHash: m.contentHash, version: 'fixture', createdAt: now, relevance: 'PASS', scope: 'single', subject: 'Company', frame, itemType: 'model_release', axes: { sig: 8, nov: 8, cred: 8, reson: 8, act: 8 }, qualityFlags: [], samples: [{ itemType: 'model_release', axes: { sig: 8, nov: 8, cred: 8, reson: 8, act: 8 }, qualityFlags: [] }], sampleScores: [80], groupConfirmed: true, accepted: true, score: 80, target: 'featured', category: '模型', tags: ['发布'], titleZh: '中文发布', summaryZh: '可追溯的中文摘要。', reason: '材料有具体事实。', relations: [] }));
	const events = { stories: [{ id: 'story', title: 'Release', materialIds: ['m0', 'm1'], occurrenceIds: ['occ'], firstSeenAt: now, latestAt: now, rootOccurrenceId: 'occ', aliases: [] }], occurrences: [{ id: 'occ', storyId: 'story', title: 'Release', materialIds: ['m0', 'm1'], firstSeenAt: now, latestAt: now, kind: 'report', frame }], records: analyses.map(a => ({ materialId: a.materialId, revision: 1, contentHash: a.contentHash, version: 'fixture', analyzedAt: now, confirmed: true })), mentions: [], proposals: [], reviews: [] };
	for (const [name, items] of Object.entries({ materials, analyses, events })) await fs.writeFile(path.join(directory, `${name}.json`), JSON.stringify({ version: 1, items }));
	await connection.evaluate(`app.plugins.plugins.nand.setModuleEnabled('news',true)`); await bind();
	check('reader-shows-current-chinese-analysis-reason-and-original-source', await connection.evaluate(`nv.contentEl.textContent.includes('可追溯的中文摘要')&&nv.contentEl.textContent.includes('材料有具体事实')&&nv.contentEl.textContent.includes('Original report 0')&&nv.contentEl.textContent.includes('https://example.invalid/report0')`));
	await click('.nand-news-brief button', 'Read in depth');
	await until(`nv.service.runHistory()[0]?.status==='complete'`);
	await until(`nv.contentEl.querySelectorAll('.nand-news-brief-preview h2').length===4`);
	check('native-stop-result-saved-and-markdown-rendered-with-source-links', await connection.evaluate(`nv.service.callBudget().used===1&&nv.contentEl.querySelectorAll('.nand-news-brief-preview a.external-link').length===2&&nv.contentEl.textContent.includes('Brief saved')`));
	await inbox();
	check('successful-brief-sends-no-notification-by-default', await connection.evaluate(`iv.service.records.length===0`));
	await bind();
	const originalPath = await connection.evaluate(`nv.service.brief('story').path`);
	const renamedPath = 'NAND/新闻/简报/reader-renamed.md';
	await connection.evaluate(`app.vault.rename(app.vault.getAbstractFileByPath(${JSON.stringify(originalPath)}),${JSON.stringify(renamedPath)})`);
	await connection.evaluate(`app.vault.process(app.vault.getAbstractFileByPath(${JSON.stringify(renamedPath)}),text=>text+${JSON.stringify('\nReader annotation survives\n')})`);
	await until(`nv.service.brief('story')?.path===${JSON.stringify(renamedPath)}`);
	await connection.evaluate(`(async()=>{window.cleanBrief=await app.vault.read(app.vault.getAbstractFileByPath(${JSON.stringify(renamedPath)}));await app.vault.process(app.vault.getAbstractFileByPath(${JSON.stringify(renamedPath)}),text=>text.replace('这是第 1 次','Reader correction 第 1 次'))})()`);
	await click('.nand-news-brief button', 'Regenerate brief (uses quota)');
	await until(`nv.service.runHistory()[0]?.status==='needs-attention'`);
	check('edited-note-is-not-overwritten-and-reply-remains-recoverable', await connection.evaluate(`nv.service.runHistory()[0].receipt.state==='received'&&nv.service.callBudget().used===2&&nv.service.brief('story').body.includes('Reader correction')&&nv.contentEl.textContent.includes('Retry saving (no CLI call)')`));
	await inbox();
	await until(`iv.contentEl.querySelectorAll('.nand-inbox-item-actions button').length>0`);
	check('failure-notification-has-working-opener-without-automation-fields', await connection.evaluate(`iv.service.records.length===1&&!iv.service.records[0].target&&!iv.service.records[0].source&&[...iv.contentEl.querySelectorAll('button')].some(b=>b.textContent==='Open')`));
	await connection.evaluate(`[...iv.contentEl.querySelectorAll('button')].find(b=>b.textContent==='Open').click()`);
	await until(`nv.getState().selected==='m1'`);
	check('notification-opens-news-detail', await connection.evaluate(`nv.getState().selected==='m1'&&!!nv.contentEl.querySelector('[data-news-selected-id="m1"]')`));
	await bind();
	await connection.evaluate(`app.vault.process(app.vault.getAbstractFileByPath(${JSON.stringify(renamedPath)}),()=>cleanBrief)`);
	await click('.nand-news-brief button', 'Retry saving (no CLI call)');
	await until(`nv.service.runHistory()[0]?.status==='complete'`);
	check('local-save-retry-keeps-quota-file-identity-and-annotation', await connection.evaluate(`nv.service.callBudget().used===2&&nv.service.brief('story').path===${JSON.stringify(renamedPath)}&&nv.service.brief('story').body.includes('第 2 次')&&nv.service.brief('story').body.includes('Reader annotation survives')&&app.vault.getMarkdownFiles().filter(f=>f.path.includes('/简报/')).length===1`));
	await connection.evaluate(`nv.actions.publish(nv.service.runHistory()[0].id)`); await inbox();
	check('repeated-publish-is-idempotent-and-success-stays-quiet', await connection.evaluate(`iv.service.records.length===1`));
	await bind();
	await fs.writeFile(path.join(runtime.vault, 'invalid-answer'), 'yes');
	await click('.nand-news-brief button', 'Regenerate brief (uses quota)');
	await until(`nv.service.runHistory()[0]?.status==='failed'`);
	check('invalid-sections-reject-answer-without-replacing-saved-brief', await connection.evaluate(`nv.service.callBudget().used===3&&nv.service.runHistory()[0].receipt.errorCode==='briefInvalid'&&nv.service.brief('story').body.includes('第 2 次')`));
	await fs.unlink(path.join(runtime.vault, 'invalid-answer'));
	await connection.evaluate(`app.plugins.plugins.nand.setModuleEnabled('notifications',false)`);
	await click('.nand-news-brief button', 'Regenerate brief (uses quota)');
	await until(`nv.service.runHistory()[0]?.status==='complete'`);
	check('notifications-disabled-does-not-block-durable-brief', await connection.evaluate(`nv.service.callBudget().used===4&&nv.service.brief('story').body.includes('第 4 次')`));
	await connection.evaluate(`(async()=>{window.receiver=await ac.start({file:${JSON.stringify(process.execPath)},args:[${JSON.stringify(path.join(runtime.vault, 'receiver.cjs'))}],cwd:${JSON.stringify(runtime.vault)},env:{},title:'Reader receiver',agentId:'codex'})})()`);
	await until(`receiver.inputReady()`); await bind();
	const receiverTitle = await connection.evaluate(`nv.actions.sessions().then(sessions=>sessions.find(s=>s.id===receiver.id)?.title)`);
	check('new-interactive-session-is-discoverable-after-reader-mounted', !!receiverTitle, receiverTitle);
	await connection.evaluate(`nv.contentEl.querySelector('.nand-news-event details').open=true`);
	await until(`[...nv.contentEl.querySelectorAll('.nand-news-event button')].some(b=>b.textContent===${JSON.stringify('Send to agent ' + receiverTitle)})`);
	await click('.nand-news-event button', 'Send to agent ' + receiverTitle); await delay(350);
	const pasted = await fs.readFile(path.join(runtime.vault, 'received-input.txt'), 'utf8');
	check('existing-agent-receives-one-unsent-bracketed-paste', pasted.startsWith('\x1b[200~') && pasted.endsWith('\x1b[201~') && pasted.includes('https://example.invalid/report0') && pasted.includes('可追溯的中文摘要'), { chars: pasted.length, bracketed: pasted.startsWith('\x1b[200~'), tail: [...pasted.slice(-8)].map(c => c.charCodeAt(0)) });
	await bind(); await connection.evaluate(`window.systemUrls=[];window.savedOpen=nv.contentEl.win.open;nv.contentEl.win.open=(url)=>{systemUrls.push(String(url));return null}`);
	await click('.nand-news-event button', 'Open original');
	check('original-opens-only-on-explicit-click-and-falls-back-when-browser-disabled', await connection.evaluate(`systemUrls.length===1&&systemUrls[0]==='https://example.invalid/report0'`));
	await connection.evaluate(`nv.contentEl.win.open=savedOpen;true`);
	await click('button', 'Save');
	await until(`!!nv.service.favoriteLocation('m0')`);
	check('favorite-note-uses-chinese-summary-and-original-url', await connection.evaluate(`(async()=>{const text=await app.vault.read(app.vault.getAbstractFileByPath(nv.service.favoriteLocation('m0')));return text.includes('可追溯的中文摘要')&&text.includes('https://example.invalid/report0')})()`));
	await click('.nand-news-brief button', 'Open saved note');
	check('open-saved-note-uses-native-markdown-leaf', await connection.evaluate(`app.workspace.getLeavesOfType('markdown').some(l=>l.view.file?.path===${JSON.stringify(renamedPath)})`));
	await bind();
	await connection.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
	for (const preset of ['claude-code', 'codex', 'obsidian']) for (const mode of ['light', 'dark']) for (const width of [1200, 800, 420]) {
		await connection.evaluate(`app.plugins.plugins.nand.theme.update(d=>{d.preset=${JSON.stringify(preset)}})`);
		await connection.evaluate(`app.changeTheme(${JSON.stringify(mode === 'dark' ? 'obsidian' : 'moonstone')})`);
		await connection.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false }); await delay(80);
		await connection.evaluate(`nv.contentEl.querySelector('.nand-news-brief').scrollIntoView({block:'start'})`);
		const geometry = await connection.evaluate(`(()=>{const el=nv.contentEl.querySelector('.nand-news-page');return {width:el.clientWidth,scroll:el.scrollWidth}})()`);
		await runtime.shot(`brief-${preset}-${mode}-${width}`); check(`width-${preset}-${mode}-${width}`, geometry.scroll <= geometry.width + 2, geometry);
	}
	await connection.evaluate(`nv.service.clearCache()`);
	check('cache-clear-retains-readable-brief-and-favorite', await connection.evaluate(`!!nv.service.brief('story')&&nv.service.favorites().length===1&&nv.service.callBudget().used===4`));
	const beforeRestartErrors = await connection.evaluate('window.nandAcceptanceErrors'); check('no-host-errors-before-restart', beforeRestartErrors.length === 0, beforeRestartErrors);
	await runtime.restart(); connection = runtime.connection; await bind();
	check('restart-rediscovers-renamed-visible-notes-without-cache-or-cli', await connection.evaluate(`nv.service.materials().length===0&&nv.service.brief('story').path===${JSON.stringify(renamedPath)}&&nv.service.favorites().length===1&&nv.service.callBudget().used===4`));
	const probes = (await fs.readFile(path.join(runtime.vault, 'brief-probe.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
	check('four-real-process-calls-and-each-prompt-cites-two-source-urls', probes.length === 4 && probes.every(p => p.urls.length === 2 && p.promptChars <= 22000));
	check('owned-brief-processes-have-exited', probes.every(p => { try { process.kill(p.pid, 0); return false; } catch { return true; } }));
	const errors = await connection.evaluate('window.nandAcceptanceErrors'); check('no-host-errors-after-restart', errors.length === 0, errors);
	completed = true;
} finally {
	if (runtime) {
		if (!completed) {
			await runtime.shot('failure').catch(() => undefined);
			const diagnostic = await connection.evaluate(`({text:window.nv?.contentEl.textContent,errors:window.nandAcceptanceErrors,sessions:window.ac?.sessions.list().map(s=>({id:s.id,title:s.title,running:s.running,automated:s.automated}))})`).catch(error => String(error));
			await fs.writeFile(path.join(runtime.evidence, 'failure.json'), JSON.stringify(diagnostic, null, 2));
		}
		await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ method: 'Native Obsidian + published PTY + local Node CLI/native-hook fixture; no model/provider calls', passed: completed && rows.every(row => row.passed), rows }, null, 2)); await runtime.stop();
	}
}
console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length }));
