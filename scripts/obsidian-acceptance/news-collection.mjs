// News collection and visible Markdown in a fresh, owned Obsidian profile.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const requests = [];
const server = createServer((request, response) => {
	requests.push({ url: request.url, etag: request.headers['if-none-match'] });
	const now = new Date().toISOString();
	const base = `http://127.0.0.1:${server.address().port}`;
	const feeds = {
		'/rss': `<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item><!-- safe comment --><title>RSS &amp; source</title><guid>rss-1</guid><link>${base}/article?x=1&amp;y=2</link><pubDate>${new Date().toUTCString()}</pubDate><description><![CDATA[<p>A <b>short</b> excerpt.</p>]]></description><content:encoded><![CDATA[<p>FULL ARTICLE TEXT</p>]]></content:encoded></item></channel></rss>`,
		'/atom': `<feed xmlns="http://www.w3.org/2005/Atom" xml:base="${base}/root/"><entry xml:base="nested/"><id>atom-1</id><title>Atom title</title><link rel="alternate" href="../atom?x=1&amp;y=2"/><published>${now}</published><content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">Before <b>middle</b> after</div></content></entry></feed>`,
		'/json': JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', items: [{ id: 'json-1', url: base + '/json-item', content_text: 'Titleless JSON material', date_published: now, authors: [{ name: 'Fixture author' }] }] }),
		'/list': `<div class="releases"><article data-kind="stable"><h2>Static one</h2><a class="title" href="/release#one">Read</a><time datetime="${now}">Today</time><script>window.fixtureScriptExecuted = true</script></article><article data-kind="stable"><h2>Static two</h2><a class="title" href="/release#two">Read</a></article></div>`,
	};
	if (!feeds[request.url]) { response.writeHead(503); response.end('unavailable'); return; }
	response.writeHead(200, { 'Content-Type': request.url === '/json' ? 'application/feed+json' : request.url === '/list' ? 'text/html' : 'application/xml', ETag: 'fixture-etag' });
	response.end(feeds[request.url]);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
let runtime, c;
const rows = [];
const check = (name, passed, detail) => { rows.push({ name, passed, ...(detail === undefined ? {} : { detail: structuredClone(detail) }) }); assert.ok(passed, `${name}: ${JSON.stringify(detail)}`); };
const until = async expression => {
	const deadline = Date.now() + 20000;
	while (Date.now() < deadline) { if (await c.evaluate(expression)) return; await delay(60); }
	throw Error(`Condition timed out: ${expression}`);
};
const bind = async () => {
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-news-view'))`);
	await c.evaluate(`window.nv=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-news-view');nv.service.ready`);
};
const clickText = async (scope, text) => {
	const point = await c.evaluate(`(()=>{const b=[...document.querySelector(${JSON.stringify(scope)}).querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(text)});if(!b)throw Error('Button missing: '+${JSON.stringify(text)});b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
	await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
	await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
};
try {
	runtime = await launchFreshVault({ root: process.argv[2], port: 9251, files: { 'Welcome.md': '# News review\n' }, settings: { version: 1, namespaces: {
		app: { language: 'en', introSeen: true, modules: { home: false, agent: false, browser: false, archives: false, automations: false, notifications: false, icons: false, comments: false, sync: false } },
	} } });
	c = runtime.connection;
	await c.evaluate(`app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();true`);
	check('news-default-off', await c.evaluate(`!app.plugins.plugins.nand.moduleEnabled('news')`));
	await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('news',true)`);
	await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'news',section:'sources'})`);
	await bind();
	check('opening-does-not-fetch', requests.length === 0, requests);
	check('empty-state-action', await c.evaluate(`!!nv.contentEl.querySelector('form input')`));
	await c.evaluate(`(()=>{const input=nv.contentEl.querySelector('form input');input.value=${JSON.stringify(base + '/rss')};input.dispatchEvent(new InputEvent('input',{bubbles:true}));})()`);
	await delay(50); await clickText('.nand-news-page', 'Add source');
	await until(`nv.service.sources().length===1`);
	const sources = [
		{ id: 'atom', name: 'Atom fixture', type: 'atom', url: base + '/atom' },
		{ id: 'json', name: 'JSON fixture', type: 'jsonfeed', url: base + '/json' },
		{ id: 'static', name: 'Static fixture', type: 'web-list', url: base + '/list', selectors: { item: '.releases > article[data-kind="stable"]', link: 'a.title', title: 'h2', date: 'time', preserveFragment: true } },
		{ id: 'failed', name: 'Failed fixture', type: 'rss', url: base + '/failed' },
	].map(source => ({ ...source, enabled: true, tier: 'T1', participation: 'editorial', intervalMinutes: 30 }));
	for (const source of sources) await c.evaluate(`nv.actions.saveSource(${JSON.stringify(source)})`);
	check('saving-sources-does-not-fetch', requests.length === 0);
	const trial = await c.evaluate(`nv.actions.previewSource(nv.service.sources().find(s=>s.id==='static'))`);
	check('native-static-preview', trial.length === 2 && trial[0].originalUrl.endsWith('#one') && trial[1].originalUrl.endsWith('#two'), trial);
	check('preview-has-no-cache-or-script-effects', await c.evaluate(`nv.service.materials().length===0 && !window.fixtureScriptExecuted`));
	await clickText('.nand-news-page', 'Refresh');
	await until(`nv.service.materials().length===5 && nv.service.health('failed').failureCount===1`);
	const materials = await c.evaluate(`nv.service.materials()`);
	check('native-feed-formats', materials.some(m=>m.title==='RSS & source'&&m.summary==='A short excerpt.') && materials.some(m=>m.sourceItemId==='atom-1'&&m.originalUrl===base + '/root/atom?x=1&y=2'&&m.body==='Before middle after') && materials.some(m=>m.sourceItemId==='json-1'&&m.author==='Fixture author'), materials);
	check('initial-import-not-today', await c.evaluate(`nv.service.today().length===0&&nv.service.materials().every(m=>m.backfillReason==='initial-import')`));
	check('failed-source-visible-health', await c.evaluate(`nv.service.health('failed').lastError==='news.http.503'`));
	const fetched = requests.length;
	await c.evaluate(`Promise.all([nv.service.refresh(),nv.service.refresh(),nv.service.refresh('atom')])`);
	check('not-due-does-not-fetch', requests.length === fetched);
	await c.evaluate(`window.favoriteMaterial=nv.service.materials().find(m=>m.sourceItemId==='rss-1');nv.service.saveFavorite(favoriteMaterial,${JSON.stringify('First annotation\n\n## Notes\nSecond annotation')})`);
	const notePath = await c.evaluate(`nv.service.favoriteLocation(favoriteMaterial.id)`);
	const note = await fs.readFile(path.join(runtime.vault, notePath), 'utf8');
	check('visible-favorite-format', notePath.startsWith('NAND/新闻/收藏/') && note.includes('nand-type: news') && note.includes('First annotation') && !note.includes('FULL ARTICLE TEXT'), { notePath, note });
	await c.evaluate(`app.vault.process(app.vault.getAbstractFileByPath(${JSON.stringify(notePath)}),text=>text.replace(${JSON.stringify('---\n')},${JSON.stringify('---\ncustom: reader # keep\n')})+${JSON.stringify('\n## Appendix\nUser prose\n')})`);
	await c.evaluate(`nv.service.saveFavorite({...favoriteMaterial,title:'Revised title'},'')`);
	const revised = await fs.readFile(path.join(runtime.vault, notePath), 'utf8');
	check('reader-sections-and-yaml-preserved', revised.includes('custom: reader # keep') && revised.includes('Second annotation') && revised.includes('User prose') && revised.includes('Revised title'));
	const renamed = 'NAND/新闻/收藏/My renamed note.md';
	await c.evaluate(`app.fileManager.renameFile(app.vault.getAbstractFileByPath(${JSON.stringify(notePath)}),${JSON.stringify(renamed)})`);
	await c.evaluate(`nv.service.saveFavorite(favoriteMaterial,'')`);
	check('renamed-favorite-reused', await c.evaluate(`nv.service.favoriteLocation(favoriteMaterial.id)===${JSON.stringify(renamed)} && nv.service.favorites().length===1`));
	const editorResult = await c.evaluate(`(async()=>{const file=app.vault.getAbstractFileByPath(${JSON.stringify(renamed)});const original=await app.vault.read(file);const leaf=app.workspace.getLeaf('tab');await leaf.openFile(file);leaf.view.editor.setValue(original+' UNSAVED EDIT');let error='';try{await nv.service.saveFavorite(favoriteMaterial,'')}catch(e){error=e.message}leaf.view.editor.setValue(original);leaf.detach();return error;})()`);
	check('native-unsaved-editor-protected', editorResult === 'news.note.unsaved', editorResult);
	await c.evaluate(`nv.service.clearCache()`);
	check('cache-clear-retains-favorites', await c.evaluate(`nv.service.materials().length===0&&nv.service.favorites().length===1`));
	await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'settings',section:'news'})`);
	await until(`document.querySelectorAll('.nand-settings-page .nand-news-source').length===5`);
	await c.evaluate(`document.querySelectorAll('.nand-settings-page .nand-news-source')[3].open=true`);
	await clickText('.nand-settings-page .nand-news-source:nth-of-type(4)', 'Try fetching');
	await until(`document.querySelectorAll('.nand-settings-page .nand-news-source')[3].textContent.includes('Found 2 items')`);
	check('native-settings-trial-result', true);
	await clickText('.nand-settings-page', 'Export OPML');
	await clickText('.nand-settings-page', 'Import OPML');
	await until(`document.querySelector('.nand-news-settings').textContent.includes('Added 0; skipped 5; invalid 0.')`);
	check('native-opml-roundtrip', true);
	await c.evaluate(`document.querySelectorAll('.nand-settings-page .nand-news-source')[3].open=true;(()=>{const d=document.querySelectorAll('.nand-settings-page .nand-news-source')[3];const e=d.querySelector('input[type=text]');e.value='Unsaved source name';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
	await c.evaluate(`app.plugins.plugins.nand.changeLanguage('zh')`);
	check('source-language-preserves-draft', await c.evaluate(`document.querySelectorAll('.nand-settings-page .nand-news-source')[3].querySelector('input[type=text]').value==='Unsaved source name'&&document.querySelectorAll('.nand-settings-page .nand-news-source')[3].textContent.includes('信源等级')`));
	for (const preset of ['claude-code', 'codex', 'obsidian']) for (const mode of ['light','dark']) for (const width of [1200, 800, 420]) {
		await c.evaluate(`app.plugins.plugins.nand.theme.update(d=>{d.preset=${JSON.stringify(preset)}})`);
		await c.evaluate(`app.changeTheme(${JSON.stringify(mode === 'dark' ? 'obsidian' : 'moonstone')})`);
		await c.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
		await delay(100);
		const geometry = await c.evaluate(`(()=>{const e=document.querySelector('.nand-settings-page');return {client:e.clientWidth,scroll:e.scrollWidth}})()`);
		await runtime.shot(`sources-${preset}-${mode}-${width}`);
		check(`source-settings-width-${preset}-${mode}-${width}`, geometry.scroll <= geometry.client + 2, geometry);
	}
	await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('news',false)`);
	check('module-stopped', await c.evaluate(`app.plugins.plugins.nand.moduleState('news')==='off'&&nv.service.stopped`));
	await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('news',true)`);
	await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'news'})`); await bind();
	check('reenable-rediscovers-visible-favorite', await c.evaluate(`nv.service.favorites().length===1&&nv.service.materials().length===0`));
	await runtime.restart(); c = runtime.connection;
	await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'news'})`); await bind();
	check('restart-rediscovers-visible-favorite', await c.evaluate(`nv.service.favorites().length===1&&nv.service.materials().length===0`));
	const errors = await c.evaluate(`window.nandAcceptanceErrors`);
	check('host-errors-empty', errors.length === 0, errors);
} finally {
	if (runtime) {
		await fs.writeFile(path.join(runtime.evidence, 'news-review.json'), JSON.stringify({ host: 'Obsidian 1.13.7 / Windows', rows, requests }, null, 2));
		await runtime.stop();
	}
	server.close();
}
console.log(JSON.stringify({ checks: rows.length, evidence: runtime.evidence }));
