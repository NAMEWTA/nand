// Native local-day edition, saved-view and per-leaf state acceptance. No network or model calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

let runtime, connection, completed = false;
const rows = [];
const check = (name, passed, detail) => { rows.push({ name, passed, ...(detail === undefined ? {} : { detail }) }); assert.ok(passed, name); };
const until = async expression => { const end = Date.now() + 20000; while (Date.now() < end) { if (await connection.evaluate(expression)) return; await delay(80); } throw new Error(`Timed out: ${expression}`); };
const bind = async () => {
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-news-view'))`);
	await connection.evaluate(`window.nv=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-news-view');nv.service.ready`);
};
const click = async label => { await connection.evaluate(`[...nv.contentEl.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`); await delay(120); };
const input = async (label, value) => { await connection.evaluate(`(()=>{const label=[...nv.contentEl.querySelectorAll('label')].find(e=>e.querySelector('.nand-field-label')?.textContent===${JSON.stringify(label)});const input=label.querySelector('input');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('input',{bubbles:true}));})()`); await delay(80); };
try {
	const now = Date.now(), start = new Date(now); start.setHours(0, 0, 0, 0);
	const at = Math.max(+start, now - 60_000);
	const sources = Array.from({ length: 12 }, (_, index) => ({ id: `s${index}`, name: `Source ${index}`, url: `https://example.invalid/feed${index}`, type: 'rss', tier: 'T1', participation: 'editorial', intervalMinutes: 60, enabled: true }));
	runtime = await launchFreshVault({ root: process.argv[2], port: 9257, settings: { version: 1, namespaces: {
		app: { language: 'en', introSeen: true, modules: { news: false, agent: false, home: false, archives: false, browser: false, sync: false, comments: false, notifications: false, automations: false, icons: false } },
		news: { enabled: true, analysisEnabled: false, autoRefresh: false, refreshOnStartup: false, refreshWhenStale: false, sources },
	} } });
	connection = runtime.connection;
	await connection.evaluate(`app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();true`);
	const device = await connection.evaluate(`(()=>{let id=app.loadLocalStorage('nand.device-id');if(!id){id=crypto.randomUUID();app.saveLocalStorage('nand.device-id',id)}return id})()`);
	const directory = path.join(runtime.vault, '.nand/news', device); await fs.mkdir(directory, { recursive: true });
	const materials = Array.from({ length: 24 }, (_, index) => ({ id: `m${index}`, sourceId: `s${Math.floor(index / 2)}`, sourceItemId: `m${index}`, originalUrl: `https://example.invalid/m${index}`, canonicalKey: `m${index}`, title: index === 0 ? 'Alpha release' : index === 1 ? 'Beta release' : `Release ${index}`, bodyExcerpt: 'Company released a model.', revision: 1, contentHash: `m${index}`, discoveredAt: at, publishedAt: at }));
	const frame = { title: 'Model release', subject: 'Company', action: 'released', object: 'model', occurredAt: null, evidence: materials[0].bodyExcerpt, conditions: [] };
	const analyses = materials.map(material => ({ materialId: material.id, revision: 1, contentHash: material.contentHash, version: 'fixture', createdAt: at, relevance: 'PASS', scope: 'single', subject: 'Company', frame, itemType: 'model_release', axes: { sig: 8, nov: 8, cred: 8, reson: 8, act: 8 }, qualityFlags: [], samples: [{ itemType: 'model_release', axes: { sig: 8, nov: 8, cred: 8, reson: 8, act: 8 }, qualityFlags: [] }], sampleScores: [80], groupConfirmed: true, accepted: true, score: 80, target: 'featured', category: 'Model', tags: ['agents', 'models'], titleZh: material.title, summaryZh: material.bodyExcerpt, reason: 'Fixture evidence', relations: [] }));
	const events = { stories: materials.map(material => ({ id: `story-${material.id}`, title: material.title, materialIds: [material.id], occurrenceIds: [`occ-${material.id}`], firstSeenAt: at, latestAt: at, rootOccurrenceId: `occ-${material.id}`, aliases: [] })), occurrences: materials.map(material => ({ id: `occ-${material.id}`, storyId: `story-${material.id}`, materialIds: [material.id], firstSeenAt: at, latestAt: at, kind: 'report', title: material.title, frame })), records: analyses.map(item => ({ materialId: item.materialId, revision: 1, contentHash: item.contentHash, version: 'fixture', analyzedAt: at, confirmed: true })), mentions: [], proposals: [], reviews: [] };
	for (const [name, items] of Object.entries({ materials, analyses, events })) await fs.writeFile(path.join(directory, `${name}.json`), JSON.stringify({ version: 1, items }));
	await connection.evaluate(`app.plugins.plugins.nand.setModuleEnabled('news',true)`);
	await connection.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'news',section:'today'})`); await bind();
	check('local-natural-day-twelve-main-ten-flashes-with-source-cap', await connection.evaluate(`(()=>{const e=nv.actions.edition(),counts={};for(const r of e.main){const source=nv.service.materials().find(m=>m.id===r.materialId).sourceId;counts[source]=(counts[source]??0)+1;}return e.main.length===12&&e.flashes.length===10&&Math.max(...Object.values(counts))<=2&&new Date(e.startAt).getHours()===0&&!!e.timeZone})()`));
	check('opening-daily-edition-does-not-write-visible-markdown', await connection.evaluate(`app.vault.getMarkdownFiles().length===0&&nv.service.callBudget().used===0`));
	await click('Rebuild edition');
	check('compile-with-writing-off-persists-memory-only', await connection.evaluate(`app.vault.getMarkdownFiles().length===0&&nv.actions.edition().main.length===12`));
	await connection.evaluate(`app.plugins.plugins.nand.settingsNamespace('news').update(d=>{d.writeDailyNote=true})`); await click('Rebuild edition');
	await until(`app.vault.getMarkdownFiles().length===1`);
	await connection.evaluate(`app.vault.process(app.vault.getMarkdownFiles()[0],text=>text+${JSON.stringify('\n## Reader notes\nKeep my annotation\n')})`); await click('Rebuild edition');
	check('one-daily-file-preserves-annotation', await connection.evaluate(`(async()=>{const files=app.vault.getMarkdownFiles();const text=await app.vault.read(files[0]);return files.length===1&&text.includes('Keep my annotation')&&text.includes('window-start:')&&text.includes('news-edition')})()`));
	await connection.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'news',section:'all'})`); await delay(100);
	await input('Search news', 'Alpha ');
	check('query-keeps-space-while-typing-and-filters', await connection.evaluate(`nv.getState().filter.query==='Alpha '&&nv.contentEl.querySelectorAll('[data-news-material-id]').length===1`));
	await connection.evaluate(`nv.contentEl.querySelector('[data-news-material-id="m0"] button').click();nv.contentEl.querySelector('.nand-news-filter details').open=true`); await delay(100);
	await input('Tags, separated by commas', 'agents, '); await input('Tags, separated by commas', 'agents, models');
	check('tag-comma-input-keeps-both-tags', await connection.evaluate(`nv.getState().filter.tags.join(',')==='agents,models'&&nv.contentEl.querySelectorAll('[data-news-material-id]').length===1`));
	await input('View name', 'Alpha view'); await click('Save view');
	await until(`nv.getState().section==='views'&&!!nv.getState().view`);
	const viewId = await connection.evaluate(`nv.getState().view`);
	const savedView = await connection.evaluate(`({state:nv.getState(),views:nv.service.views()})`);
	check('saved-view-has-stable-id-and-selected-item', !!viewId && savedView.state.section === 'views' && savedView.state.selected === 'm0' && savedView.views[0]?.id === viewId, savedView);
	await input('View name', 'Alpha view renamed'); await click('Update view');
	await until(`nv.service.views()[0]?.name==='Alpha view renamed'`);
	check('updating-view-keeps-identity', await connection.evaluate(`nv.service.views().length===1&&nv.service.views()[0].id===${JSON.stringify(viewId)}&&nv.service.views()[0].name==='Alpha view renamed'`));
	await connection.evaluate(`(async()=>{window.otherLeaf=app.workspace.getLeaf('split');await otherLeaf.setViewState({type:'nand-workbench-view',active:true,state:{focus:true,target:{feature:'news',section:'all',resourceId:'m1'},pages:[{target:{feature:'news',section:'all',resourceId:'m1'},state:{section:'all',selected:'m1',filter:{query:'Beta'},order:'asc'}}]}})})()`);
	await until(`otherLeaf.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-news-view')`);
	await connection.evaluate(`window.other=otherLeaf.view.getNativeSurfaces().find(s=>s.getViewType()==='nand-news-view');true`);
	check('two-leaves-isolate-query-selection-order-and-section', await connection.evaluate(`nv.getState().section==='views'&&nv.getState().selected==='m0'&&nv.getState().order==='desc'&&other.getState().section==='all'&&other.getState().selected==='m1'&&other.getState().filter.query==='Beta'&&other.getState().order==='asc'`));
	await connection.evaluate(`app.workspace.requestSaveLayout();true`); await delay(1200);
	await runtime.restart(); connection = runtime.connection;
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).filter(s=>s.getViewType()==='nand-news-view').length===2`);
	await connection.evaluate(`window.newsSurfaces=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).filter(s=>s.getViewType()==='nand-news-view');window.nv=newsSurfaces.find(s=>s.getState().section==='views');window.other=newsSurfaces.find(s=>s!==nv);true`);
	check('restart-restores-both-leaf-states-and-saved-view', await connection.evaluate(`nv.getState().view===${JSON.stringify(viewId)}&&nv.getState().selected==='m0'&&nv.getState().filter.query==='Alpha '&&other.getState().selected==='m1'&&other.getState().filter.query==='Beta'&&other.getState().order==='asc'&&nv.service.callBudget().used===0`));
	check('restart-keeps-edition-memory-without-self-suppression', await connection.evaluate(`nv.actions.edition().main.length===12&&app.vault.getMarkdownFiles().length===1`));
	await connection.evaluate(`other.leaf.detach();app.workspace.setActiveLeaf(nv.leaf);nv.navigate({feature:'news',section:'all'});true`); await delay(150);
	for (const section of ['featured', 'all', 'hot', 'today', 'favorites', 'sources', 'runs']) {
		await connection.evaluate(`nv.navigate({feature:'news',section:${JSON.stringify(section)}});true`); await delay(80);
		check(`section-${section}-visible`, await connection.evaluate(`nv.getState().section===${JSON.stringify(section)}&&!!nv.contentEl.querySelector('h1').textContent`));
	}
	await connection.evaluate(`nv.navigate({feature:'news',section:'views',resourceId:${JSON.stringify(viewId)}});true`); await delay(80);
	check('returning-to-saved-view-reapplies-its-filter', await connection.evaluate(`nv.getState().filter.query==='Alpha '&&nv.contentEl.querySelectorAll('[data-news-material-id]').length===1`));
	await connection.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
	for (const preset of ['claude-code', 'codex', 'obsidian']) for (const mode of ['light', 'dark']) for (const width of [1200, 800, 420]) {
		await connection.evaluate(`app.plugins.plugins.nand.theme.update(d=>{d.preset=${JSON.stringify(preset)}})`);
		await connection.evaluate(`app.changeTheme(${JSON.stringify(mode === 'dark' ? 'obsidian' : 'moonstone')})`);
		await connection.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false }); await delay(80);
		const geometry = await connection.evaluate(`(()=>{const el=nv.contentEl.querySelector('.nand-news-page');return {width:el.clientWidth,scroll:el.scrollWidth}})()`);
		await runtime.shot(`edition-${preset}-${mode}-${width}`); check(`width-${preset}-${mode}-${width}`, geometry.scroll <= geometry.width + 2, geometry);
	}
	const errors = await connection.evaluate('window.nandAcceptanceErrors'); check('no-host-errors', errors.length === 0, errors);
	check('all-edition-and-view-work-used-zero-cli-calls', await connection.evaluate(`nv.service.callBudget().used===0`));
	completed = true;
} finally {
	if (runtime) { await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ method: 'Native Obsidian with explicit analyzed-material fixtures; no network/model calls', passed: completed && rows.every(row => row.passed), rows }, null, 2)); await runtime.stop(); }
}
console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length }));
