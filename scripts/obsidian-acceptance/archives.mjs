// Real archive acceptance in a fresh, owned Obsidian vault. Pass a NEW absolute directory.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { connect } from './cdp.mjs';

await build({ stdin: { contents: `export {newRecord} from './src/modules/archives/core/model'; export {createMarkdown} from './src/modules/archives/core/persist/markdown';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', outfile: 'scripts/tmp/archives-fixtures.cjs', alias: { obsidian: './scripts/obsidian-stub.ts' } });
const { newRecord, createMarkdown } = createRequire(import.meta.url)('../tmp/archives-fixtures.cjs');
const files = {}, records = [];
for (let i = 0; i < 1000; i++) {
	const record = newRecord(i % 2 ? 'company' : 'person');
	record.fields.name = `Archive ${String(i).padStart(4, '0')}`;
	record.fields.emails = i === 0 ? ['shared@example.com', 'second@example.com'] : i === 2 ? ['shared@example.com'] : [];
	record.fields.tags = [`group-${i % 10}`];
	record.prose.notes = `Note needle-${i}-end`;
	record.path = `档案/${record.kind === 'person' ? '个人档案' : '企业档案'}/${record.fields.name}/基本信息.md`;
	const prefix = `Body body-${i}-end\n`, remaining = 2048 - Buffer.byteLength(prefix);
	const body = prefix + '甲'.repeat(Math.floor(remaining / 3)) + 'a'.repeat(remaining % 3);
	assert.equal(Buffer.byteLength(body), 2048);
	files[record.path] = `${createMarkdown(record)}\n${body}`;
	records.push(record);
}
const special = records[42], freeBody = files[special.path].slice(createMarkdown(special).length);
special.employments = [{ id: crypto.randomUUID(), company: { id: records[1].id, label: records[1].fields.name, link: '' }, department: 'Research', title: 'Engineer', start: '', end: '', status: 'current', keyRole: '', notes: 'employment-only-token' }];
special.relations = [{ id: crypto.randomUUID(), person: { id: records[2].id, label: records[2].fields.name, link: '' }, company: { id: '', label: '', link: '' }, kind: 'friend', notes: 'relation-only-token' }];
files[special.path] = createMarkdown(special) + freeBody;
const root = process.argv[2];
assert.ok(root && path.isAbsolute(root));
const runtime = await launchFreshVault({ root, port: 9247, files, settings: { version: 1, namespaces: {
	app: { language: 'en', introSeen: true, modules: { home: false, agent: false, browser: false, archives: true, automations: false, notifications: false, icons: false, comments: false, news: false, sync: false } },
} } });
let c = runtime.connection;
const rows = [];
const until = async (expression) => {
	const deadline = Date.now() + 20000;
	while (Date.now() < deadline) { if (await c.evaluate(expression)) return; await delay(80); }
	throw Error(`Condition timed out: ${expression}`);
};
const bind = async () => {
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-contacts-view'))`);
	await c.evaluate(`window.av=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-contacts-view');av.controller.ensureLoaded()`);
};
const paths = () => c.evaluate(`[...av.contentEl.querySelectorAll('[data-path]')].map(e=>e.dataset.path)`);
const search = async (value) => { await c.evaluate(`(()=>{const e=av.contentEl.querySelector('input[type=search]');e.value=${JSON.stringify(value)};e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}))})()`); await delay(30); };
try {
	const firstScreenAt = performance.now();
	await c.evaluate(`app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();app.plugins.plugins.nand.openWorkbench({feature:'contacts'})`);
	await bind();
	await c.evaluate(`new Promise(r=>av.contentEl.win.requestAnimationFrame(()=>av.contentEl.win.requestAnimationFrame(r)))`);
	rows.push({ name: 'first-archive-screen', ms: performance.now()-firstScreenAt, records: 1000, bodyBytesPerRecord: 2048 });
	assert.equal(await c.evaluate(`av.controller.index.byPath.size`), 1000);
	assert.deepEqual(await c.evaluate(`av.state.layout`), { person: 'list', company: 'card' });
	// Count host file reads while exercising query and layout paths.
	await c.evaluate(`window.archiveReads=0;for(const key of ['read','cachedRead']){const fn=app.vault[key].bind(app.vault);app.vault[key]=(...args)=>{archiveReads++;return fn(...args)}}`);
	await c.evaluate(`av.page(2)`);
	const listed = await paths();
	await c.evaluate(`av.contentEl.querySelectorAll('.nand-contacts-layout button')[1].click()`);
	assert.deepEqual(await paths(), listed);
	assert.equal(await c.evaluate(`av.state.page`), 2);
	await c.evaluate(`av.contentEl.querySelector('[data-path]').click();av.back()`);
	assert.deepEqual(await paths(), listed);
	await c.evaluate(`av.contentEl.querySelectorAll('.nand-contacts-layout button')[0].click()`);
	await c.evaluate(`av.contentEl.querySelectorAll('[data-path]')[25].scrollIntoView({block:'start'})`);
	await delay(100);
	const anchor = await c.evaluate(`av.firstVisible()`);
	await c.evaluate(`av.layout('card');av.contentEl.querySelectorAll('[data-path]')[40].scrollIntoView({block:'start'})`);
	await delay(100);
	await c.evaluate(`av.layout('list')`);
	await delay(100);
	assert.equal(await c.evaluate(`av.firstVisible()`), anchor);
	rows.push({ name: 'layout-order-page-detail-return', passed: true });
	await search('shared@example.com');
	assert.equal((await paths()).length, 2);
	assert.ok((await c.evaluate(`av.contentEl.textContent`)).includes('+1'));
	await c.evaluate(`av.contentEl.querySelector('.nand-contacts-row-copy').click()`);
	assert.equal(await c.evaluate(`av.state.selectedPath`), '');
	assert.equal(await c.evaluate(`navigator.clipboard.readText()`), 'shared@example.com');
	rows.push({ name: 'email-identity-and-copy', passed: true });
	await search('body-42-end');
	assert.deepEqual(await paths(), [records[42].path]);
	await c.evaluate(`av.contentEl.querySelector('.nand-contacts-scope').click()`);
	assert.equal((await paths()).length, 0);
	await c.evaluate(`av.contentEl.querySelector('.nand-contacts-scope').click()`);
	assert.equal((await paths()).length, 1);
	rows.push({ name: 'body-and-basic-scope', passed: true });
	await search('');
	await c.evaluate(`(()=>{const e=av.contentEl.querySelector('input[type=search]');e.focus();e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.value='组词';e.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));})()`);
	assert.equal(await c.evaluate(`av.state.query.search`), '');
	assert.equal(await c.evaluate(`document.activeElement===av.contentEl.querySelector('input[type=search]')`), true);
	await c.evaluate(`(()=>{const e=av.contentEl.querySelector('input[type=search]');e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'组词'}))})()`);
	assert.equal(await c.evaluate(`av.state.query.search`), '组词');
	rows.push({ name: 'composition-event-focus', passed: true, limitation: 'Synthetic composition sequence, not a physical IME.' });
	const render = await c.evaluate(`(async()=>{const samples=[];for(let i=0;i<30;i++){const at=performance.now();av.search('needle-'+(i*2)+'-end');await new Promise(r=>av.contentEl.win.requestAnimationFrame(()=>av.contentEl.win.requestAnimationFrame(r)));samples.push(performance.now()-at)}samples.sort((a,b)=>a-b);return {p50Ms:samples[14],p95Ms:samples[28],samples:samples.length,heap:performance.memory?.usedJSHeapSize,reads:archiveReads}})()`);
	assert.equal(render.reads, 0);
	rows.push({ name: 'host-query-through-two-animation-frames', ...render });
	const switching = await c.evaluate(`(async()=>{av.search('');const samples=[];for(let i=0;i<20;i++){const at=performance.now();av.layout(i%2?'list':'card');await new Promise(r=>av.contentEl.win.requestAnimationFrame(()=>av.contentEl.win.requestAnimationFrame(r)));samples.push(performance.now()-at)}samples.sort((a,b)=>a-b);return {p50Ms:samples[9],p95Ms:samples[18],samples:samples.length,reads:archiveReads}})()`);
	assert.equal(switching.reads, 0);
	rows.push({ name: 'host-layout-through-two-animation-frames', ...switching });
	await search('group-0');
	await c.evaluate(`av.page(1)`);
	assert.equal(await c.evaluate(`av.state.page`), 1);
	await c.evaluate(`app.workspace.requestSaveLayout()`);
	await delay(1600);
	await runtime.restart(); c = runtime.connection;
	await bind();
	assert.equal(await c.evaluate(`av.state.query.search`), 'group-0');
	assert.equal(await c.evaluate(`av.state.page`), 1);
	rows.push({ name: 'restart-retains-query-page-layout', passed: true });
	for (const term of ['employment-only-token', 'relation-only-token']) {
		await search(term);
		assert.deepEqual(await paths(), [special.path]);
		await c.evaluate(`av.contentEl.querySelector('button.nand-contacts-hit').click()`);
		assert.ok(await c.evaluate(`[...av.contentEl.querySelectorAll('.nand-contacts-section')].some(s=>s.querySelector('[aria-expanded=true]')&&s.textContent.includes(${JSON.stringify(term)}))`), `Hit section did not expand: ${term}`);
		await c.evaluate(`av.back()`);
	}
	rows.push({ name: 'employment-and-relation-hit-expansion', passed: true });
	await search('body-42-end');
	await c.evaluate(`av.contentEl.querySelector('button.nand-contacts-hit').click();av.contentEl.querySelector('p.nand-contacts-hit button').click()`);
	await until(`app.workspace.getLeavesOfType('markdown').some(l=>l.view.file?.path===${JSON.stringify(special.path)})`);
	await until(`app.workspace.activeLeaf?.view.file?.path===${JSON.stringify(special.path)}`);
	await delay(250);
	const opened = await c.evaluate(`(()=>{const v=app.workspace.getLeavesOfType('markdown').find(l=>l.view.file?.path===${JSON.stringify(special.path)}).view;return {mode:v.getMode(),state:v.getEphemeralState(),cursor:v.editor?.getCursor()}})()`);
	assert.equal(opened.cursor?.line, files[special.path].split('\n').findIndex(line => line.includes('body-42-end')), JSON.stringify(opened));
	await c.evaluate(`app.workspace.getLeavesOfType('markdown').filter(l=>l.view.file?.path===${JSON.stringify(special.path)}).forEach(l=>l.detach());app.workspace.revealLeaf(av.leaf);app.workspace.requestSaveLayout()`);
	await delay(1600);
	await runtime.restart(); c = runtime.connection; await bind();
	assert.equal(await c.evaluate(`av.state.query.search`), 'body-42-end');
	await c.evaluate(`av.back()`);
	assert.deepEqual(await paths(), [special.path]);
	rows.push({ name: 'original-note-line-and-detail-restart-return', passed: true });
	await c.evaluate(`av.setState({query:{kind:'person'},page:0},{});`);
	// Explicit user preference (list) wins over a legacy state without layout.
	assert.equal(await c.evaluate(`av.state.layout.person`), 'list');
	await c.evaluate(`av.host.settings.update(d=>{d.layouts={}},{persist:'immediate'})`);
	await c.evaluate(`av.setState({query:{kind:'person'},page:0},{});`);
	assert.equal(await c.evaluate(`av.state.layout.person`), 'card');
	rows.push({ name: 'legacy-layout-and-explicit-preference', passed: true });
	for (const preset of ['system', 'claude-code', 'eye-care']) for (const dark of [false, true]) for (const language of ['en', 'zh']) {
		await c.evaluate(`app.plugins.plugins.nand.theme.update(d=>{d.preset=${JSON.stringify(preset)}},{persist:'immediate'});app.changeTheme(${JSON.stringify(dark ? 'obsidian' : 'moonstone')});app.plugins.plugins.nand.changeLanguage(${JSON.stringify(language)})`);
		for (const width of [1400, 850, 390]) {
			await c.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
			await c.evaluate(`av.layout(${JSON.stringify(width >= 850 ? 'list' : 'card')})`);
			await delay(100);
			await c.evaluate(`av.contentEl.scrollTop=0`);
			assert.equal(await c.evaluate(`av.contentEl.querySelector('.nand-contacts-tabs button').textContent`), language === 'zh' ? '联系人' : 'People');
			const layout = await c.evaluate(`({width:av.contentEl.clientWidth,overflow:av.contentEl.scrollWidth-av.contentEl.clientWidth,rows:av.contentEl.querySelectorAll('[data-path]').length})`);
			assert.ok(layout.overflow <= 1, JSON.stringify(layout));
			assert.equal(await c.evaluate(`[...av.contentEl.querySelectorAll('.nand-contacts-row-wide > span')].filter(e=>e.getBoundingClientRect().width).every(e=>e.scrollWidth<=e.clientWidth+1)`), true, 'List columns overlap');
			assert.equal(layout.rows, 60);
			rows.push({ name: 'layout', preset, dark, language, viewport: width, ...layout });
			await runtime.shot(`archives-${preset}-${dark?'dark':'light'}-${language}-${width}`);
		}
	}
	await c.evaluate(`app.plugins.plugins.nand.changeLanguage('en')`);
	await c.evaluate(`av.changeKind('company')`);
	assert.equal(await c.evaluate(`av.state.layout.company`), 'card');
	assert.equal((await paths()).length, 60);
	await c.evaluate(`av.changeKind('person');av.layout('list');av.contentEl.scrollTop=0`);
	const initial = await fs.readFile(path.join(runtime.vault, special.path), 'utf8');
	await search('body-42-end');
	await c.evaluate(`av.contentEl.querySelector('.nand-contacts-row-name').click();av.contentEl.querySelector('.nand-contacts-profile-actions button').click()`);
	await until(`!!av.contentEl.querySelector('.nand-contacts-editor-page input[required]')`);
	await c.evaluate(`(()=>{const e=av.contentEl.querySelector('.nand-contacts-editor-page input[required]');e.value='Edited archive';e.dispatchEvent(new Event('input',{bubbles:true}));av.contentEl.querySelector('.nand-contacts-form-footer button.mod-cta').click()})()`);
	await until(`!av.contentEl.querySelector('.nand-contacts-form-footer')`);
	const edited = await fs.readFile(path.join(runtime.vault, special.path), 'utf8');
	assert.ok(edited.includes('Edited archive'));
	assert.ok(edited.endsWith(freeBody));
	assert.notEqual(edited, initial);
	await c.evaluate(`av.back();av.search('');window.archiveRead=app.vault.cachedRead.bind(app.vault);app.vault.cachedRead=f=>f.path===${JSON.stringify(special.path)}?Promise.reject(Error('acceptance read failure')):archiveRead(f);av.controller.reload()`);
	for (const mode of ['list', 'card']) {
		await c.evaluate(`av.layout(${JSON.stringify(mode)})`);
		assert.equal(await c.evaluate(`av.controller.index.byPath.size`), 999);
		assert.equal(await c.evaluate(`!!av.contentEl.querySelector('[role=alert]')`), true);
	}
	await c.evaluate(`app.vault.cachedRead=archiveRead;av.controller.reload()`);
	assert.equal(await c.evaluate(`av.controller.error`), '');
	rows.push({ name: 'company-edit-and-partial-read-recovery', passed: true });
	assert.deepEqual(await c.evaluate(`window.nandAcceptanceErrors`), [], 'Host errors before popout');
	await c.send('Emulation.clearDeviceMetricsOverride');
	const priorTargets = new Set((await (await fetch(process.env.NAND_CDP_URL + '/json')).json()).map(t=>t.id));
	await c.evaluate(`app.workspace.moveLeafToPopout(av.leaf,{width:700,height:850});true`);
	await until(`av.contentEl.win!==window && av.contentEl.querySelectorAll('[data-path]').length===60`);
	await c.evaluate(`av.contentEl.querySelectorAll('.nand-contacts-layout button')[0].click()`);
	assert.equal(await c.evaluate(`av.state.layout.person`), 'list');
	assert.equal(await c.evaluate(`av.contentEl.scrollWidth-av.contentEl.clientWidth<=1`), true);
	assert.equal(await c.evaluate(`[...av.contentEl.querySelectorAll('.nand-contacts-row-wide > span')].filter(e=>e.getBoundingClientRect().width).every(e=>e.scrollWidth<=e.clientWidth+1)`), true, 'Popout columns overlap');
	await c.evaluate(`av.contentEl.scrollTop=0`);
	const targets = await (await fetch(process.env.NAND_CDP_URL + '/json')).json();
	const target = targets.find(t=>t.type==='page' && !priorTargets.has(t.id));
	assert.ok(target, JSON.stringify(targets));
	const popout = await connect(target.url, target.id);
	const shot = await popout.send('Page.captureScreenshot', { format: 'png' });
	await fs.writeFile(path.join(runtime.evidence, 'archives-popout.png'), Buffer.from(shot.data, 'base64'));
	popout.close();
	rows.push({ name: 'popout-migration-and-layout', passed: true });
	const errors = await c.evaluate(`window.nandAcceptanceErrors`);
	assert.deepEqual(errors, []);
	const mainSha256 = createHash('sha256').update(await fs.readFile('main.js')).digest('hex');
	await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ passed: true, mainSha256, rows }, null, 2));
	console.log(JSON.stringify({ passed: true, evidence: runtime.evidence, checks: rows.length }));
} catch (error) {
	await runtime.shot('failure').catch(() => {});
	await fs.writeFile(path.join(runtime.evidence, 'page-failure.json'), JSON.stringify(await c.evaluate(`({errors:window.nandAcceptanceErrors,body:document.body.innerText,state:window.av?.state})`).catch(() => null), null, 2));
	await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ passed: false, rows, error: String(error) }, null, 2));
	throw error;
} finally { await runtime.stop(); }
