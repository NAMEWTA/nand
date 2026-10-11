// Native reader acceptance with explicitly seeded historical observations; no network/model calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

let runtime, connection;
let completed = false;
const rows = [];
const check = (name, passed, detail) => { rows.push({ name, passed, ...(detail === undefined ? {} : { detail }) }); assert.ok(passed, name); };
const until = async expression => { const end = Date.now() + 20000; while (Date.now() < end) { if (await connection.evaluate(expression)) return; await delay(80); } throw new Error(`Timed out: ${expression}`); };
const bind = async () => {
	await connection.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'news',section:'hot'})`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-news-view'))`);
	await connection.evaluate(`window.nv=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-news-view');nv.service.ready`);
};
try {
	const hour = 3_600_000, now = Date.now(), base = Math.floor(now / hour) * hour;
	const sources = ['alpha', 'beta', 'community', 'late'].map(id => ({ id, name: id, type: 'rss', url: `https://example.invalid/${id}`, tier: 'T2', participation: ['alpha', 'beta'].includes(id) ? 'editorial' : 'signal', ...(['alpha', 'beta'].includes(id) ? { ownerEntityId: 'company' } : {}), intervalMinutes: 60, enabled: true }));
	runtime = await launchFreshVault({ root: process.argv[2], port: 9256, settings: { version: 1, namespaces: {
		app: { language: 'zh', introSeen: true, modules: { news: false, agent: false, home: false, archives: false, browser: false, sync: false, comments: false, notifications: false, automations: false, icons: false } },
		news: { enabled: true, analysisEnabled: false, autoRefresh: false, refreshOnStartup: false, refreshOnVisible: false, sources },
	} } });
	connection = runtime.connection;
	await connection.evaluate(`app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();true`);
	const device = await connection.evaluate(`(()=>{let id=app.loadLocalStorage('nand.device-id');if(!id){id=crypto.randomUUID();app.saveLocalStorage('nand.device-id',id)}return id})()`);
	const directory = path.join(runtime.vault, '.nand/news', device); await fs.mkdir(directory, { recursive: true });
	const materials = [];
	const add = (sourceId, ago) => { const id = `${sourceId}-${ago}`; materials.push({ id, sourceId, sourceItemId: id, originalUrl: `https://example.invalid/${id}`, canonicalKey: id, title: '模型事件的公开报道', bodyExcerpt: 'Company released a model and follow-up data.', revision: 1, contentHash: id, discoveredAt: now, publishedAt: base - ago * hour }); };
	for (const ago of [140, 120, 24, 12, 7, 1]) { add('alpha', ago); add('community', ago); }
	add('beta', 1); add('late', 0.5);
	const frame = { title: '模型事件', subject: 'Company', action: 'released', object: 'model', occurredAt: null, evidence: materials[0].bodyExcerpt, conditions: [] };
	const analyses = materials.map(material => ({ materialId: material.id, revision: 1, contentHash: material.contentHash, version: 'fixture', createdAt: now, relevance: 'PASS', scope: 'single', subject: 'Company', frame, itemType: 'model_release', axes: { sig: 8, nov: 8, cred: 8, reson: 8, act: 8 }, qualityFlags: [], samples: [{ itemType: 'model_release', axes: { sig: 8, nov: 8, cred: 8, reson: 8, act: 8 }, qualityFlags: [] }], sampleScores: [80], groupConfirmed: true, accepted: true, score: 80, target: 'featured', category: '模型发布', tags: ['模型发布'], titleZh: material.title, summaryZh: material.bodyExcerpt, reason: '', relations: [] }));
	const events = { stories: [{ id: 'event-main', title: '模型事件', materialIds: materials.map(item => item.id), occurrenceIds: ['occ-main'], firstSeenAt: base - 140 * hour, latestAt: base, rootOccurrenceId: 'occ-main', aliases: [] }], occurrences: [{ id: 'occ-main', storyId: 'event-main', materialIds: materials.map(item => item.id), firstSeenAt: base - 140 * hour, latestAt: base, kind: 'report', title: frame.title, frame }], records: analyses.map(item => ({ materialId: item.materialId, revision: 1, contentHash: item.contentHash, version: 'fixture', analyzedAt: now, confirmed: true })), mentions: [], proposals: [], reviews: [] };
	const heat = [140, 120, 24, 12, 7, 1, 0].map(ago => ({ eventId: 'event-main', hour: base - ago * hour, observedAt: base - ago * hour, score: 999, participants: 2, cohortSize: 1, cohort: 'fixture', complete: ago !== 0, ruleVersion: 'heat-v1' }));
	const reader = { health: Object.fromEntries(sources.map(source => [source.id, { initializedAt: source.id === 'late' ? now - 10 * hour : 0, lastSuccess: base - hour / 2, failureCount: 0, configHash: 'fixture' }])) };
	for (const [name, items] of Object.entries({ materials, analyses, events, heat, 'reader-state': reader })) await fs.writeFile(path.join(directory, `${name}.json`), JSON.stringify({ version: 1, items }));
	await connection.evaluate(`app.plugins.plugins.nand.setModuleEnabled('news',true)`); await bind();
	check('owner-channels-deduplicate-and-late-source-does-not-create-growth', await connection.evaluate(`nv.service.hot()[0].participants===3&&nv.service.hot()[0].editorial===1&&nv.service.hot()[0].trend==='flat'`));
	check('history-recomputes-a-common-cohort-and-omits-incomplete-hour', await connection.evaluate(`(()=>{const points=[...nv.contentEl.querySelectorAll('[data-hour]')];return points.length===6&&points.every(point=>point.textContent==='20')&&points.every(point=>Number(point.dataset.hour)!==${base})})()`));
	check('isolated-observations-are-dots-without-lines-across-gaps', await connection.evaluate(`nv.contentEl.querySelectorAll('.nand-news-heat circle').length===6&&nv.contentEl.querySelectorAll('.nand-news-heat polyline').length===0`));
	await connection.evaluate(`window.chart=nv.contentEl.querySelector('.nand-news-heat-chart');chart.focus();chart.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));true`); await delay(80);
	check('keyboard-point-is-visible-and-announced', await connection.evaluate(`nv.contentEl.querySelector('.nand-news-heat-selected').textContent.includes('20')&&!!nv.contentEl.querySelector('.nand-news-heat-selected').getBoundingClientRect().height`));
	const selected = await connection.evaluate(`nv.contentEl.querySelector('.nand-news-heat-selected').textContent`);
	await connection.evaluate(`chart.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));true`); await delay(80);
	check('right-arrow-selects-next-real-observation', await connection.evaluate(`nv.contentEl.querySelector('.nand-news-heat-selected').textContent`) !== selected);
	await connection.evaluate(`chart.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));true`); await delay(80);
	check('left-arrow-restores-previous-observation', await connection.evaluate(`nv.contentEl.querySelector('.nand-news-heat-selected').textContent`) === selected);
	await connection.evaluate(`chart.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));true`); await delay(80);
	check('escape-clears-selected-point', await connection.evaluate(`nv.contentEl.querySelector('.nand-news-heat-selected').textContent===''`));
	for (const [label, count] of [['24 小时', 3], ['3 天', 4], ['7 天', 6]]) {
		await connection.evaluate(`[...nv.contentEl.querySelectorAll('.nand-news-heat button')].find(button=>button.textContent===${JSON.stringify(label)}).click()`); await delay(80);
		check(`history-range-${count}-observations`, await connection.evaluate(`nv.contentEl.querySelectorAll('[data-hour]').length===${count}`));
	}
	await connection.evaluate(`app.plugins.plugins.nand.settingsNamespace('news').update(d=>{d.sources.find(s=>s.id==='beta').ownerEntityId='different-company'})`);
	check('source-owner-change-recalculates-without-cli', await connection.evaluate(`nv.service.hot()[0].participants===4&&nv.service.callBudget().used===0`));
	await connection.evaluate(`app.plugins.plugins.nand.settingsNamespace('news').update(d=>{d.sources.find(s=>s.id==='beta').ownerEntityId='company'})`);
	await connection.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
	for (const preset of ['claude-code', 'codex', 'obsidian']) for (const mode of ['light', 'dark']) for (const width of [1200, 800, 420]) {
		await connection.evaluate(`app.plugins.plugins.nand.theme.update(d=>{d.preset=${JSON.stringify(preset)}})`);
		await connection.evaluate(`app.changeTheme(${JSON.stringify(mode === 'dark' ? 'obsidian' : 'moonstone')})`);
		await connection.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
		await connection.evaluate(`nv.contentEl.querySelector('.nand-news-hot').scrollIntoView({block:'start'})`); await delay(60);
		const geometry = await connection.evaluate(`(()=>{const el=nv.contentEl.querySelector('.nand-news-page');return {width:el.clientWidth,scroll:el.scrollWidth}})()`);
		await runtime.shot(`heat-${preset}-${mode}-${width}`); check(`heat-width-${preset}-${mode}-${width}`, geometry.scroll <= geometry.width + 2, geometry);
	}
	await runtime.restart(); connection = runtime.connection; await bind();
	check('restart-does-not-invent-hours-or-send-cli', await connection.evaluate(`nv.service.heat().length===7&&nv.service.callBudget().used===0`));
	check('no-network-refresh-cursor-was-advanced', JSON.stringify(JSON.parse(await fs.readFile(path.join(directory, 'reader-state.json'), 'utf8')).items.health) === JSON.stringify(reader.health));
	const errors = await connection.evaluate('window.nandAcceptanceErrors'); check('no-host-errors', errors.length === 0, errors);
	completed = true;
} finally {
	if (runtime) { await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ method: 'Native Obsidian reader with explicitly seeded observation/evidence fixtures; no historical-monitoring claim', passed: completed && rows.every(row => row.passed), rows }, null, 2)); await runtime.stop(); }
}
console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length }));
