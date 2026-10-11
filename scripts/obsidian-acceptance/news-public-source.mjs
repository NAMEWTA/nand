// Explicit public, unauthenticated static-page collection through Obsidian requestUrl.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

let runtime, connection, completed = false;
const rows = [];
const check = (name, passed, detail) => { rows.push({ name, passed, ...(detail === undefined ? {} : { detail }) }); assert.ok(passed, name); };
const until = async expression => { const end = Date.now() + 75000; while (Date.now() < end) { if (await connection.evaluate(expression)) return; await delay(100); } throw new Error(`Timed out: ${expression}`); };
const click = async label => { await connection.evaluate(`[...nv.contentEl.querySelectorAll('.nand-news-source button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`); await delay(100); };
const input = async (label, value) => { await connection.evaluate(`(()=>{const row=[...nv.contentEl.querySelectorAll('.setting-item')].find(r=>r.querySelector('.setting-item-name')?.textContent===${JSON.stringify(label)});const input=row.querySelector('input');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('input',{bubbles:true}))})()`); await delay(60); };
try {
	runtime = await launchFreshVault({ root: process.argv[2], port: 9259, settings: { version: 1, namespaces: {
		app: { language: 'en', introSeen: true, modules: { news: true, agent: false, notifications: false, home: false, archives: false, browser: false, sync: false, comments: false, automations: false, icons: false } },
		news: { enabled: true, analysisEnabled: false, autoRefresh: false, refreshOnStartup: false, refreshWhenStale: false, sources: [] },
	} } });
	connection = runtime.connection;
	await connection.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'news',section:'sources'})`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-news-view'))`);
	await connection.evaluate(`window.nv=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-news-view');nv.service.ready`);
	await connection.evaluate(`(()=>{const input=nv.contentEl.querySelector('form input');input.value='https://go.dev/blog/';input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
	await delay(80);
	await connection.evaluate(`nv.contentEl.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
	await until(`nv.service.sources().length===1&&!!nv.contentEl.querySelector('.nand-news-source')`);
	await connection.evaluate(`nv.contentEl.querySelector('.nand-news-source').open=true;(()=>{const control=nv.contentEl.querySelector('.nand-news-source select');control.value='web-list';control.dispatchEvent(new Event('change',{bubbles:true}))})()`);
	await input('Item selector', 'p.blogtitle'); await input('Link selector', 'a'); await input('Title selector', 'a'); await input('Date selector (optional)', '.date');
	await click('Try fetching');
	await until(`nv.contentEl.querySelector('.nand-news-source [role="status"]').textContent.includes('Showing the first ten')`);
	check('public-static-preview-displays-titles-absolute-links-and-dates', await connection.evaluate(`(()=>{const text=nv.contentEl.querySelector('.nand-news-source').textContent;return text.includes('https://go.dev/blog/')&&text.includes('2026')&&text.includes('Found ')})()`));
	check('preview-does-not-store-materials-health-or-call-cli', await connection.evaluate(`nv.service.materials().length===0&&!nv.service.health(nv.service.sources()[0].id)?.lastSuccess&&nv.service.callBudget().used===0`));
	await click('Save source');
	await until(`nv.service.sources()[0].type==='web-list'`);
	await click('Refresh saved source');
	await until(`nv.service.materials().length>0`);
	const actual = await connection.evaluate(`nv.service.materials().map(m=>({title:m.title,url:m.originalUrl,publishedAt:m.publishedAt,backfill:m.backfillReason,revision:m.revision}))`);
	check('public-list-uses-normal-material-identity-and-initial-import-policy', actual.length >= 10 && actual.every(m => m.url.startsWith('https://go.dev/blog/') && m.revision === 1 && m.backfill), { count: actual.length, sample: actual.slice(0, 2) });
	check('public-list-publication-dates-parse-and-health-is-healthy', await connection.evaluate(`nv.service.materials().filter(m=>m.publishedAt!==undefined).length>=10&&nv.service.health(nv.service.sources()[0].id).lastSuccess>0&&nv.actions.edition().materialIds.length===0`));
	await click('Refresh saved source');
	await until(`nv.contentEl.querySelector('.nand-news-source [role="status"]').textContent==='Checked due sources.'`);
	check('repeat-fetch-does-not-duplicate-identities-or-revisions', await connection.evaluate(`nv.service.materials().length===${actual.length}&&nv.service.materials().every(m=>m.revision===1)`));
	await input('Item selector', '.nand-no-such-item'); await click('Try fetching');
	await until(`nv.contentEl.querySelector('.nand-news-source [role="status"]').textContent.includes('No matching items')`);
	check('no-matches-preview-gives-actionable-selector-message-and-keeps-stored-data', await connection.evaluate(`nv.contentEl.querySelector('.nand-news-source [role="status"]').textContent.includes('Check the item, link and title selectors')&&nv.service.materials().length===${actual.length}`));
	await input('Item selector', '['); await click('Try fetching');
	await until(`nv.contentEl.querySelector('.nand-news-source [role="status"]').textContent.includes('CSS selector is invalid')`);
	check('invalid-selector-is-visible', true);
	await input('Item selector', 'p.blogtitle'); await click('Save source');
	await connection.evaluate(`window.opml=nv.actions.exportOpml();window.beforeSource=JSON.stringify(nv.service.sources()[0]);nv.actions.importOpml(opml)`);
	check('static-source-opml-round-trip-preserves-selectors-and-deduplicates', await connection.evaluate(`nv.service.sources().length===1&&JSON.stringify(nv.service.sources()[0])===beforeSource&&opml.includes('p.blogtitle')`));
	await connection.evaluate(`nv.contentEl.querySelector('.nand-news-source').open=true`); await delay(80);
	await runtime.shot('public-static-source');
	check('no-cli-or-visible-note-created-by-preview-and-collection', await connection.evaluate(`nv.service.callBudget().used===0&&app.vault.getMarkdownFiles().length===0`));
	const errors = await connection.evaluate('window.nandAcceptanceErrors'); check('no-host-errors', errors.length === 0, errors);
	completed = true;
} finally {
	if (runtime) {
		if (!completed) {
			await runtime.shot('failure').catch(() => undefined);
			const diagnostic = await connection.evaluate(`({text:window.nv?.contentEl.textContent,errors:window.nandAcceptanceErrors})`).catch(error => String(error));
			await fs.writeFile(path.join(runtime.evidence, 'failure.json'), JSON.stringify(diagnostic, null, 2));
		}
		await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ method: 'Native Obsidian requestUrl, public https://go.dev/blog/, no model/provider calls', passed: completed && rows.every(row => row.passed), rows }, null, 2));
		await runtime.stop();
	}
}
console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length }));
