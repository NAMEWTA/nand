// Real Electron guest input and passive response observation; local fixtures, no provider-account claim.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { build } from 'esbuild';
import { launchFreshVault } from './fresh-vault.mjs';

const rows = [], hostErrors = [], p = 'app.plugins.plugins.nand', json = JSON.stringify; let runtime, c;
const server = createServer((request, response) => {
 if (request.url === '/history') { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(json({ message: 'Public answer', access_token: 'fixture-private-token' })); return; }
 response.writeHead(200, { 'Content-Type': 'text/html' });
 response.end('<!doctype html><title>Provider fixture</title><textarea id="composer" aria-label="Composer"></textarea><button id="send">Send</button><output></output><div id="shield" style="display:none;position:fixed;inset:0"></div><script>window.sent=0;window.guardReady=true;send.onclick=()=>{sent++;document.querySelector("output").textContent=composer.value};send.onmousemove=()=>{if(window.changeOnHover)guardReady=false}</script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = 'http://127.0.0.1:' + server.address().port + '/';
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
const guest = expression => c.evaluate('fixtureGuest.executeJavaScript(' + json(expression) + ')');
const input = (request, error) => c.evaluate('pa.providerInput(' + json(request) + ',admission)' + (error ? '.then(()=>false,e=>e.code===' + json(error) + ')' : ''));
try {
 runtime = await launchFreshVault({ root: process.argv[2], port: 9276, settings: { version: 1, namespaces: { app: { language: 'en', introSeen: true, modules: { browser: true, home: false, agent: false, news: false, archives: false, sync: false, comments: false, notifications: false, automations: false, icons: false } } } } }); c = runtime.connection;
 c.on('Runtime.exceptionThrown', event => hostErrors.push(event.exceptionDetails?.exception?.description ?? event.exceptionDetails?.text));
 await c.send('Runtime.enable');
 const bundle = path.join(runtime.evidence, 'provider-fixture.cjs');
 await build({ stdin: { contents: 'export { BrowserAutomation } from "./src/modules/browser/platform/desktop/automation.ts"; export { ProviderResponses } from "./src/modules/browser/platform/desktop/provider-responses.ts"; export { DEEPSEEK_DOM_READ } from "./src/modules/browser/platform/desktop/deepseek-dom.ts";', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', outfile: bundle, external: ['obsidian'], logLevel: 'silent' });
 await c.evaluate('(async()=>{window.bc=' + p + '.services.peek({owner:"browser",id:"control"});window.target=await bc.open({url:' + json(url) + '});window.wv=document.querySelector("[data-page-id=\\""+target.pageId+"\\"] webview");window.fixtureGuest=require("@electron/remote").webContents.fromId(wv.getWebContentsId());window.fixtureClasses=require(' + json(bundle) + ');window.pa=new fixtureClasses.BrowserAutomation(fixtureGuest,{webview:wv,disposed:false,state:{id:target.pageId}});window.admitted=true;window.admission=()=>{if(!admitted)throw Error("stale-fixture-target")};})()');
 check('queued-provider-dom-read', await c.evaluate('pa.readProviderDom("document.title",admission)') === 'Provider fixture');
 const prompt = 'First line\nSecond line', guard = 'window.guardReady===true&&document.querySelector("#composer").value===' + json(prompt);
 await input({ selector: '#composer', kind: 'fill', value: prompt, guard: 'document.querySelector("#composer").value===""' });
 check('native-staging-preserves-multiline', await guest('composer.value') === prompt);
 await input({ selector: '#send', kind: 'click', guard });
 check('one-native-submit', await guest('sent') === 1 && await guest('document.querySelector("output").textContent') === prompt);
 await guest('window.guardReady=false;true');
 check('changed-draft-guard-rejects-before-input', await input({ selector: '#send', kind: 'click', guard }, 'browser_workspace_draft_changed'));
 check('guard-rejection-does-not-submit', await guest('sent') === 1);
 await guest('window.guardReady=true;document.querySelector("#shield").style.display="block";true');
 check('overlay-rejects-coordinate-click', await input({ selector: '#send', kind: 'click', guard }, 'browser_workspace_control_changed'));
 check('overlay-rejects-native-editor-focus-before-fill', await input({ selector: '#composer', kind: 'fill', value: 'Must not replace', guard }, 'browser_workspace_control_changed'));
 check('blocked-editor-focus-preserves-draft-and-submit-count', await guest('composer.value') === prompt && await guest('sent') === 1);
 await guest('document.querySelector("#shield").style.display="none";window.changeOnHover=true;true');
 check('send-stop-state-rechecked-after-hover', await input({ selector: '#send', kind: 'click', guard }, 'browser_workspace_draft_changed'));
 check('late-control-change-does-not-submit', await guest('sent') === 1);
 await guest('window.changeOnHover=false;window.guardReady=true;document.body.append(document.querySelector("#send").cloneNode(true));true');
 check('ambiguous-provider-control-rejected', await input({ selector: '#send', kind: 'click', guard }, 'browser_workspace_control_missing'));
 await c.evaluate('window.scopeAbort=new AbortController();window.responses=new fixtureClasses.ProviderResponses(fixtureGuest,{signal:scopeAbort.signal,admit:admission,allow:u=>u.origin===' + json(url.slice(0, -1)) + '&&u.pathname==="/history"?"fixture-conversation":undefined,readBody:id=>pa.readProviderResponse(id,admission),project:(data,conversationId)=>({conversationId,message:data.message})});true');
 await guest('fetch("/history").then(r=>r.json()).then(()=>true)');
 for (let index = 0; index < 100 && !await c.evaluate('responses.values().length'); index++) await delay(50);
 const captured = await c.evaluate('responses.values()');
 check('native-network-response-projects-public-content', captured.length === 1 && captured[0].message === 'Public answer' && !json(captured).includes('fixture-private'));
 await c.evaluate('scopeAbort.abort();true'); check('scope-abort-clears-retained-response', await c.evaluate('responses.values().length') === 0);
 const domFixture = '<textarea id="chat-input">Reviewed prompt</textarea><button aria-label="Send">Send</button><button aria-label="New chat">New chat</button><div data-message-id="user" data-role="user">Reviewed prompt</div><div data-message-id="answer" data-parent-id="user" data-role="assistant"><h1>Heading</h1><table><tr><td>A</td><td>B</td></tr></table><pre><code>const a = 1;</code></pre><span class="katex"><annotation encoding="application/x-tex">x^2</annotation></span><div class="ds-think-content">Private reasoning fixture</div><button>Copy</button></div>';
 await guest('document.body.innerHTML=' + json(domFixture) + ';true');
 const dom = await c.evaluate('pa.readProviderDom(fixtureClasses.DEEPSEEK_DOM_READ,admission)');
 check('deepseek-dom-reads-only-explicit-message-identities', dom.messages.length === 2 && dom.messages[1].id === 'answer' && dom.messages[1].parentId === 'user' && dom.composer.value === 'Reviewed prompt');
 check('deepseek-dom-preserves-structure-math-and-excludes-reasoning', dom.messages[1].html.includes('<table>') && dom.messages[1].html.includes('<pre>') && dom.messages[1].text.includes('$x^2$') && !dom.messages[1].html.includes('Private reasoning') && !dom.messages[1].html.includes('Copy'));
 await guest('document.querySelector("[data-message-id=answer]").removeAttribute("data-parent-id");true');
 const withoutParent = await c.evaluate('pa.readProviderDom(fixtureClasses.DEEPSEEK_DOM_READ,admission)');
 check('deepseek-dom-never-invents-a-parent-from-visual-order', !withoutParent.messages[1].parentId);
 await c.evaluate('window.lateRead="pending";pa.readProviderDom("new Promise(r=>setTimeout(()=>r(7),250))",admission).then(v=>lateRead=v,e=>lateRead=e.message);true');
 await delay(50); await c.evaluate('window.admitted=false;true'); await delay(350);
 check('late-read-rejected-after-generation-admission-change', await c.evaluate('lateRead') === 'stale-fixture-target');
 await c.evaluate('pa.dispose();pa.dispose();true');
 check('closed-helper-rejects-queued-read', await c.evaluate('pa.readProviderDom("1",()=>{}).then(()=>false,e=>e.code==="browser_page_closed")'));
 const errors = [...hostErrors, ...await c.evaluate('window.nandAcceptanceErrors??[]')];
 check('no-host-errors', errors.length === 0, errors);
 await fs.writeFile(path.join(runtime.evidence, 'result.json'), json({ method: 'Current source helpers bundled in disposable evidence directory, exercised against a real Obsidian Electron guest. Local fixture only; not a registered provider/workspace UI acceptance.', rows }, null, 2));
} catch (error) {
 if (runtime) await fs.writeFile(path.join(runtime.evidence, 'partial.json'), json({ rows, error: String(error), errors: await c.evaluate('window.nandAcceptanceErrors??[]') }, null, 2));
 throw error;
} finally {
 if (runtime) { console.log(json({ evidence: runtime.evidence, checks: rows.length, failed: rows.filter(row => !row.passed) })); await runtime.stop(); }
 server.closeAllConnections(); server.close();
}
