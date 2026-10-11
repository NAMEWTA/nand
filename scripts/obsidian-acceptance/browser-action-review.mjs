// Native submission review on an inert local form. No provider account or external submission.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { launchFreshVault } from './fresh-vault.mjs';

const server = createServer((_request, response) => {
 response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
 response.end(`<!doctype html><title>Reviewed action fixture</title><h1>Local review form</h1>
 <form action="/publish" method="post"><label>Destination<input name="destination" value="Local test audience"></label><label>Content<textarea name="content">Reviewed content</textarea></label><button type="submit">Publish locally</button><output>0</output></form>
 <script>window.submissions=0;document.querySelector('form').onsubmit=e=>{e.preventDefault();document.querySelector('output').textContent=String(++submissions)}</script>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`, p = 'app.plugins.plugins.nand', rows = [];
let runtime, c;
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
const guest = id => `document.querySelector('[data-page-id="${id}"] webview')`;
const script = (id, expression) => c.evaluate(`${guest(id)}.executeJavaScript(${JSON.stringify(expression)})`);
try {
 runtime = await launchFreshVault({ root: process.argv[2], port: 9276, settings: { version: 1, namespaces: { app: { language: 'en', introSeen: true, modules: { browser: true, home: false, agent: false, news: false, archives: false, sync: false, comments: false, notifications: false, automations: false, icons: false } } } } }); c = runtime.connection;
 await c.evaluate(`window.bc=${p}.services.peek({owner:'browser',id:'control'});true`);
 check('typed-review-service-registered', await c.evaluate(`typeof bc.reviewAction==='function'&&typeof bc.actReviewed==='function'`));
 await c.evaluate(`(async()=>{window.a=await bc.open({url:${JSON.stringify(url)}});window.b=await bc.open({url:${JSON.stringify(url)}});await bc.activate(a)})()`);
 const a = await c.evaluate('a'), b = await c.evaluate('b');
 await c.evaluate(`window.review=async()=>{const o=await bc.observe(a);return bc.reviewAction(a,{kind:'click',ref:{revision:o.revision,element:o.refs.find(r=>r.name==='Publish locally').ref}})};true`);
 const material = await c.evaluate('review().then(value=>window.pending=value)');
 check('review-shows-concrete-content', material.fields.some(row => row.name === 'Content' && row.value === 'Reviewed content') && material.object.name === 'Publish locally', material);
 check('review-binds-real-destination', material.destination === url + 'publish' && material.method === 'post' && material.target.pageId === a.pageId);
 check('review-is-read-only', await script(a.pageId, 'submissions') === 0);
 await script(a.pageId, `document.querySelector('textarea').value='Manual edit';true`);
 check('manual-edit-rejects-confirmation', await c.evaluate(`bc.actReviewed(a,pending.id).then(()=>false,e=>e.code==='browser_action_review_changed')`));
 check('changed-confirmation-no-submit', await script(a.pageId, 'submissions') === 0);
 await c.evaluate('review().then(value=>{window.pending=value;return true})');
 await script(a.pageId, `document.querySelector('form').action='/other';true`);
 check('destination-change-rejects-confirmation', await c.evaluate(`bc.actReviewed(a,pending.id).then(()=>false,e=>e.code==='browser_action_review_changed')`));
 await c.evaluate('review().then(value=>{window.pending=value;return true})');
 check('other-page-cannot-use-confirmation', await c.evaluate(`bc.actReviewed(b,pending.id).then(()=>false,e=>['browser_action_review_changed','browser_input_not_visible'].includes(e.code))`));
 await c.evaluate('bc.actReviewed(a,pending.id)');
 check('one-native-submit-on-exact-page', await script(a.pageId, 'submissions') === 1 && await script(b.pageId, 'submissions') === 0);
 check('confirmation-cannot-repeat', await c.evaluate(`bc.actReviewed(a,pending.id).then(()=>false,e=>e.code==='browser_action_review_changed')`));
 await c.evaluate('review().then(value=>{window.pending=value;return true})');
 await script(a.pageId, `document.querySelector('form').insertAdjacentHTML('beforeend','<input type="password" name="password" value="fixture-private">');true`);
 check('sensitive-form-requires-manual-control', await c.evaluate(`bc.actReviewed(a,pending.id).then(()=>false,e=>e.code==='browser_element_action_failed')`));
 check('sensitive-value-not-published', await c.evaluate(`review().then(()=>false,e=>e.code==='browser_element_action_failed'&&!e.message.includes('fixture-private'))`));
 await script(a.pageId, `document.querySelector('[type=password]').remove();true`);
 await c.evaluate('(async()=>{window.pending=await review();await bc.observe(a);return true})()');
 check('fresh-observation-invalidates-reviewed-ref', await c.evaluate(`bc.actReviewed(a,pending.id).then(()=>false,e=>e.code==='browser_stale_ref')`));
 await c.evaluate('review().then(value=>{window.pending=value;return true})');
 await c.evaluate(`${p}.setModuleEnabled('browser',false)`);
 check('module-off-invalidates-review', await c.evaluate(`Promise.resolve().then(()=>bc.actReviewed(a,pending.id)).then(()=>false,e=>e.code==='browser_disabled')`));
 await c.evaluate(`${p}.setModuleEnabled('browser',true)`);
 await c.evaluate(`window.bc=${p}.services.peek({owner:'browser',id:'control'});true`);
 check('reenable-cannot-reuse-old-target', await c.evaluate(`bc.actReviewed(a,pending.id).then(()=>false,e=>e.code==='browser_stale_target')`));
 check('no-host-errors', await c.evaluate('nandAcceptanceErrors.length') === 0, await c.evaluate('nandAcceptanceErrors'));
 await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ method: 'Production bundle, real Obsidian and two local Electron guests, inert form; native typed control boundary only. No assistant UI or real agent account acceptance.', rows }, null, 2));
} catch (error) {
 if (runtime) await fs.writeFile(path.join(runtime.evidence, 'partial.json'), JSON.stringify({ rows, error: String(error), errors: await c.evaluate('window.nandAcceptanceErrors??[]') }, null, 2));
 throw error;
} finally {
 if (runtime) { console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length, failed: rows.filter(r => !r.passed) })); await runtime.stop(); }
 server.closeAllConnections(); server.close();
}
