// Exercise the real authenticated bridge; only generated fixture secrets enter the test guest.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const server = createServer((request, response) => {
 if (request.url.startsWith('/fail')) { request.socket.destroy(); return; }
 response.writeHead(200, { 'Content-Type': 'text/html' });
 response.end('<!doctype html><title>Diagnostics fixture</title><h1>Diagnostics fixture</h1><input aria-label="Message">');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`, secret = 'fixture-private-marker-73184', p = 'app.plugins.plugins.nand', rows = [];
let runtime, c, environment;
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
const cli = async (...args) => {
 const { stdout } = await promisify(execFile)(process.execPath, [environment.NAND_BROWSER_CLI, ...args], { env: { ...process.env, ...environment } });
 const value = JSON.parse(stdout); assert.equal(value.ok, true); return value.result;
};
try {
 runtime = await launchFreshVault({ root: process.argv[2], port: 9276, settings: { version: 1, namespaces: { app: { language: 'en', introSeen: true, modules: { browser: true, home: false, agent: false, news: false, archives: false, sync: false, comments: false, notifications: false, automations: false, icons: false } }, browser: { agentAccess: true } } } }); c = runtime.connection;
 await c.evaluate(`window.bc=${p}.services.peek({owner:'browser',id:'control'});true`);
 environment = await c.evaluate(`${p}.services.peek({owner:'browser',id:'agent-bridge'}).environment()`);
 check('bridge-explicitly-enabled', !!environment.NAND_BROWSER_CLI && !!environment.NAND_BROWSER_TOKEN);
 const a = await c.evaluate(`bc.open({url:${JSON.stringify(url)}})`), b = await c.evaluate(`bc.open({url:${JSON.stringify(url)}})`);
 const guest = `document.querySelector('[data-page-id="${a.pageId}"] webview')`;
 await c.evaluate(`window.foreground=document.querySelector('[data-page-id="${b.pageId}"] .nand-browser-address');foreground.focus();true`);
 const list = await cli('tab', 'list');
 check('bridge-list-exposes-frozen-live-identity', list.tabs.some(row => row.id === a.pageId && row.profileId === a.profileId && row.generation === a.generation));
 const observation = await cli('snapshot', '--page', a.pageId, '--profileId', a.profileId, '--generation', a.generation);
 check('bridge-background-read-is-bound', observation.page === a.pageId && observation.snapshot.includes('Diagnostics fixture'));
 check('bridge-background-read-keeps-focus', await c.evaluate('document.activeElement===foreground'));
 await c.evaluate(`${guest}.executeJavaScript(${JSON.stringify(`console.log('${secret}',{token:'${secret}',cookie:'${secret}',password:'${secret}'});fetch('/fail?token=${secret}',{headers:{Authorization:'Bearer ${secret}'}}).catch(()=>{});true`)})`);
 let network;
 for (let i = 0; i < 50; i++) { network = await cli('network', '--page', a.pageId); if (network.length) break; await delay(50); }
 const consoleRows = await cli('console', '--page', a.pageId);
 check('console-keeps-useful-event-and-type-summary', consoleRows.some(row => row.type === 'log' && row.arguments?.[0]?.type === 'string' && row.arguments?.[1]?.type === 'object'));
 check('network-keeps-symbolic-failure-summary', network.some(row => row.type === 'Fetch' && /^net::ERR_/.test(row.error)));
 check('diagnostics-exclude-raw-arguments-and-request-secrets', !JSON.stringify({ consoleRows, network }).includes(secret) && consoleRows.every(row => !('args' in row)) && network.every(row => !('requestId' in row) && !('request' in row) && !('url' in row)));
 await c.evaluate(`${guest}.executeJavaScript('for(let i=0;i<110;i++)console.log(i);true')`);
 check('diagnostics-history-bounded-at-100', (await cli('console', '--page', a.pageId, '--limit', '100')).length === 100);
 await cli('tab', 'close', '--page', a.pageId);
 check('closed-guest-destroyed-without-reveal', await c.evaluate(`!${guest}&&document.activeElement===foreground`));
 await c.evaluate(`${p}.setModuleEnabled('browser',false)`);
 check('module-off-removes-bridge-service', await c.evaluate(`!${p}.services.peek({owner:'browser',id:'agent-bridge'})&&!document.querySelector('webview')`));
 // Guest fixture errors stay in the guest and do not enter host diagnostics.
 check('no-host-errors', await c.evaluate('nandAcceptanceErrors.length') === 0, await c.evaluate('nandAcceptanceErrors'));
 await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ method: 'Real Obsidian Electron guest, real authenticated generated CLI, fixture console values and failed authenticated fetch; no real secrets.', rows }, null, 2));
} catch (error) {
 if (runtime) await fs.writeFile(path.join(runtime.evidence, 'partial.json'), JSON.stringify({ rows, error: String(error) }, null, 2));
 throw error;
} finally {
 if (runtime) { console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length, failed: rows.filter(row => !row.passed) })); await runtime.stop(); }
 server.closeAllConnections(); server.close();
}
