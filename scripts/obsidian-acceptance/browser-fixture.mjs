// Local-only native browser fixture shared by the retained capture/lifecycle probes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

export async function browserFixture(run) {
 const server = createServer((request, response) => {
  if (request.url === '/failure') { response.destroy(); return; }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end('<!doctype html><title>Browser fixture</title><h1>Browser fixture</h1><button>Read me</button><input aria-label="Password" type="password" value="fixture-secret"><div style="height:1800px">Scrollable content</div>');
 });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const url = `http://127.0.0.1:${server.address().port}/`, rows = [], p = 'app.plugins.plugins.nand';
 let runtime;
 const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
 const evaluate = expression => runtime.connection.evaluate(/\bawait\b/.test(expression) ? `(async()=>{${expression}})()` : expression);
 const until = async expression => {
  const end = Date.now() + 25000;
  while (Date.now() < end) { if (await evaluate(expression)) return; await delay(80); }
  throw Error(expression);
 };
 try {
  runtime = await launchFreshVault({ root: process.argv[2], port: 9276, settings: { version: 1, namespaces: { app: { language: 'en', introSeen: true, modules: { browser: true, automations: true, home: false, agent: false, archives: false, notifications: false, icons: false, comments: false, sync: false } } } } });
  await evaluate(`app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();true`);
  await evaluate(`window.pageId=await ${p}.services.peek({owner:'browser',id:'open'}).open({url:${JSON.stringify(url)}})`);
  const bind = () => evaluate(`window.surface=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.state?.id===pageId);window.host=surface.host;true`);
  await bind();
  await run({ runtime, url, p, evaluate, until, check, bind, delay });
  check('no-host-errors', await evaluate('nandAcceptanceErrors.length') === 0, await evaluate('nandAcceptanceErrors'));
  await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ rows }, null, 2));
 } catch (error) {
  if (runtime) { await runtime.shot('failure').catch(() => {}); await fs.writeFile(path.join(runtime.evidence, 'partial.json'), JSON.stringify({ rows, error: String(error), body: await evaluate('document.body.innerText').catch(String) }, null, 2)); }
  throw error;
 } finally {
  if (runtime) { console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length })); await runtime.stop(); }
  server.closeAllConnections(); server.close();
 }
}
