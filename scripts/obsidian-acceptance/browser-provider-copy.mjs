// Production workspace website-copy capture with three local HTTPS fixtures. No real provider accounts.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const p = 'app.plugins.plugins.nand', json = JSON.stringify, rows = [], hostErrors = [], providers = ['deepseek', 'kimi', 'chatgpt'];
const origins = ['https://chat.deepseek.com', 'https://www.kimi.com', 'https://chatgpt.com'];
const root = '[...document.querySelectorAll(".nand-browser-workspace")].find(e=>e.getBoundingClientRect().width>0)';
const row = index => root + '.querySelectorAll(".nand-browser-workspace-targets>section")[' + index + ']';
const button = (label, scope = root) => '[...' + scope + '.querySelectorAll("button")].find(e=>e.textContent===' + json(label) + ')';
let runtime, c, taskId, environment;
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
const until = async expression => {
 const end = Date.now() + 30000; let last;
 while (Date.now() < end) { try { if (await c.evaluate(expression)) return; } catch (error) { last = error; } await delay(80); }
 throw Error(expression + (last ? ' ' + String(last) : ''));
};
const click = async expression => {
 await c.send('Page.bringToFront');
 await c.evaluate('window.focus();' + expression + '.scrollIntoView({block:"center",inline:"center"});true'); await delay(150);
 const point = await c.evaluate('(()=>{const r=' + expression + '.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
 await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
 await until('(()=>{const e=' + expression + ',r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()');
 for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
};
const type = async (expression, text) => {
 await click(expression);
 for (const type of ['keyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
 await c.send('Input.insertText', { text });
};
const key = async (key, code, windowsVirtualKeyCode, text) => {
 for (const type of ['keyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode, ...(type === 'keyDown' && text ? { text } : {}) });
};
const guest = (index, expression) => c.evaluate('fixtureGuests[' + index + '].executeJavaScript(' + json(expression) + ')');
const counts = () => c.evaluate('Promise.all(fixtureGuests.map(g=>g.executeJavaScript("fixtureCount()")))');
const bind = () => c.evaluate('window.bw=' + p + '.services.peek({owner:"browser",id:"workspace"});window.bc=' + p + '.services.peek({owner:"browser",id:"control"});true');
const preview = async () => { await click(button('Preview send')); await until('!!' + root + '.querySelector(".nand-browser-workspace-preview")'); };
const send = async count => {
 await click(button('Send this preview'));
 await until('bw.snapshot().turns.length===' + count + '&&!bw.busy(taskId)&&!' + button('Preview send') + '?.disabled');
};
const cli = async (...args) => {
 try {
  const { stdout } = await promisify(execFile)(process.execPath, [environment.NAND_BROWSER_CLI, ...args], { env: { ...process.env, ...environment } });
  return JSON.parse(stdout);
 } catch (error) { if (error.stdout) return JSON.parse(error.stdout); throw error; }
};
try {
 runtime = await launchFreshVault({ root: process.argv[2], port: 9276, settings: { version: 1, namespaces: {
  app: { language: 'en', introSeen: true, modules: { browser: true, home: false, agent: false, news: false, archives: false, sync: false, comments: false, notifications: false, automations: false, icons: false } }, browser: { agentAccess: true },
 } } }); c = runtime.connection;
 c.on('Runtime.exceptionThrown', event => hostErrors.push({ lastCheck: rows.at(-1)?.name, details: event.exceptionDetails })); await c.send('Runtime.enable');
 await bind(); await c.evaluate('app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();true');
 environment = await c.evaluate(p + '.services.peek({owner:"browser",id:"agent-bridge"}).environment()');
 await c.evaluate(p + '.openWorkbench({feature:"browser",section:"multi-ai"},window)'); await until('!!' + root + '&&!!bw.snapshot()');
 await type(root + '.querySelector("input[type=text]")', 'Three provider research'); await click(button('Create task'));
 await until('bw.snapshot().tasks.length===1&&!!' + root + '.querySelector("textarea")');
 taskId = await c.evaluate('bw.snapshot().tasks[0].id'); await c.evaluate('window.taskId=' + json(taskId) + ';true');
 for (const provider of ['kimi', 'chatgpt']) {
  await click(root + '.querySelector("select")'); await key('ArrowDown', 'ArrowDown', 40); await key('Enter', 'Enter', 13);
  await until(root + '.querySelector("select").value===' + json(provider)); await click(button('Add target'));
  await until('bw.snapshot().tasks[0].targets.length===' + (providers.indexOf(provider) + 1));
 }
 check('native-target-management-does-not-open-or-select-added-targets', await c.evaluate('bc.list().length===0&&bw.snapshot().tasks[0].selectedTargetIds.length===1&&bw.snapshot().tasks[0].visibleTargetIds.length===1'));
 await click(button('Select all targets')); await until('bw.snapshot().tasks[0].selectedTargetIds.length===3');
 const html = await Promise.all(providers.map(provider => fs.readFile('scripts/fixtures/' + provider + '-page.html', 'utf8')));
 await c.evaluate('(async()=>{window.fixtureHtml=' + json(html) + ';window.fixtureGuests=[];window.fixtureRequests=[];window.fixtureOrigins=' + json(origins) + ';const session=require("@electron/remote").session.fromPartition("persist:nand-browser-"+app.loadLocalStorage("nand.browser.vault-id"));await new Promise((resolve,reject)=>session.protocol.interceptBufferProtocol("https",(request,reply)=>{void(async()=>{const u=new URL(request.url),i=fixtureOrigins.indexOf(u.origin);if(i<0){reply({statusCode:403,data:Buffer.from("")});return}fixtureRequests.push({provider:i,path:u.pathname});if(u.pathname==="/api/v0/chat/history_messages"||u.pathname==="/apiv2/kimi.gateway.chat.v1.ChatService/ListMessages"||u.pathname.startsWith("/backend-api/conversation/")){const cursor=i===1?JSON.parse(Buffer.concat((request.uploadData??[]).map(p=>p.bytes??Buffer.alloc(0))).toString()).page_token:undefined;const body=await fixtureGuests[i].executeJavaScript("JSON.stringify(fixtureHistory("+JSON.stringify(cursor)+"))");reply({mimeType:"application/json",data:Buffer.from(body)})}else reply({mimeType:"text/html",data:Buffer.from(fixtureHtml[i])})})().catch(error=>{window.fixtureInterceptError=String(error);reply({statusCode:500,data:Buffer.from("")})})},error=>error?reject(error):resolve()));})()');
 for (let index = 0; index < 3; index++) {
  await click(button('Open official page', row(index))); await until('bc.list().length===' + (index + 1) + '&&bc.list().every(p=>!p.loading)');
  await c.evaluate('fixtureGuests[' + index + ']=require("@electron/remote").webContents.fromId(document.querySelectorAll(".nand-browser-workspace-pane webview")[' + index + '].getWebContentsId());true');
  await until('fixtureGuests[' + index + '].executeJavaScript("!!document.querySelector(\'.fixture-composer\')")');
  await guest(index, '(()=>{window.fixtureEvents=[];for(const type of ["focusin","keydown","beforeinput","input"])document.addEventListener(type,e=>fixtureEvents.push({type,key:e.key,inputType:e.inputType,value:document.querySelector(".fixture-composer").value??document.querySelector(".fixture-composer").innerText}),true)})()');
  await click(button('New website conversation', row(index)));
  await until('!bw.busy(taskId)&&bw.snapshot().tasks[0].targets[' + index + '].status==="ready"');
 }
 check('three-official-pages-have-distinct-bound-generations', await c.evaluate('new Set(bw.snapshot().tasks[0].targets.map(t=>t.page.generation)).size===3&&bc.list().length===3'));

 await c.evaluate('window.hostClipboard=require("@electron/remote").clipboard;window.clipboardSnapshot=()=>JSON.stringify(hostClipboard.availableFormats().sort().map(format=>[format,hostClipboard.readBuffer(format).toString("base64")]));window.clipboardBefore=clipboardSnapshot();true');
 const copyHtml = '<h1>Heading</h1><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table><pre><code class="language-ts">const a = 1;</code></pre><p>$x^2$</p>';
 for (let index = 0; index < 3; index++) await guest(index, '(()=>{window.fixtureNoHistory=true;window.copyMode="valid";window.copyCalls=0;window.copyHtml='+json(copyHtml)+';window.originalWriteText=navigator.clipboard.writeText;window.originalWrite=navigator.clipboard.write;window.originalExec=document.execCommand;window.copyObserver=new MutationObserver(()=>{for(const button of document.querySelectorAll("#messages button")){if(button.dataset.bound)continue;button.dataset.bound="true";button.onclick=()=>{copyCalls++;if(copyMode==="delayed"){window.copyAwaiting=true;return navigator.clipboard.write([{types:["text/html"],getType:()=>new Promise(resolve=>setTimeout(()=>resolve(new Blob([copyHtml],{type:"text/html"})),600))}])}return navigator.clipboard.write([new ClipboardItem({"text/html":new Blob([copyHtml+(copyMode==="wrong"?"<p>Private unrelated content</p>":"")],{type:"text/html"})})])}}});copyObserver.observe(document.querySelector("#messages"),{childList:true,subtree:true});return true})()');
 await type(root + '.querySelector("textarea")', 'Copy current answer'); await preview(); await send(1);
 const first = await c.evaluate('bw.snapshot().exchanges');
 if(first.some(e=>e.captures[0]?.source!=='native-copy')){
  const diagnostic=path.join(runtime.evidence,'copy-diagnostic.cjs');
  await build({stdin:{contents:'export {DEEPSEEK_DOM_READ} from "./src/modules/browser/platform/desktop/deepseek-dom.ts";export {websiteCopyProgram} from "./src/modules/browser/platform/desktop/provider-copy.ts";',resolveDir:process.cwd()},bundle:true,minify:true,platform:'node',format:'cjs',outfile:diagnostic,logLevel:'silent'});
  await c.evaluate('window.copyDiagnostic=require('+json(diagnostic)+');true');
  const data=await c.evaluate('(async()=>{const d=await fixtureGuests[0].executeJavaScript(copyDiagnostic.DEEPSEEK_DOM_READ),row=d.messages.find(m=>m.role==="assistant");return{dom:d,activation:await fixtureGuests[0].executeJavaScript("navigator.userActivation.isActive"),capture:row?.copy?await fixtureGuests[0].executeJavaScript(copyDiagnostic.websiteCopyProgram(row.copy,"true")):undefined}})()');
  await fs.writeFile(path.join(runtime.evidence,'diagnostic.json'),json(data,null,2));
 }

 check('three-copy-captures-have-current-message-identity-and-explicit-coverage-limit', first.length === 3 && first.every(e=>e.submitState==='submitted'&&e.saveState==='saved'&&e.acquisitionState==='incomplete'&&e.captures[0]?.source==='native-copy'&&e.captures[0].reasons.includes('native-copy-coverage-unverified')&&e.captures[0].parentId===e.receipt.messageId), first);
 const fence=String.fromCharCode(96).repeat(3), expected='# Heading\n\n|A|B|\n|---|---|\n|1|2|\n\n'+fence+'ts\nconst a = 1;\n'+fence+'\n\n$x^2$';
 check('one-source-copy-keeps-headings-tables-code-math-and-excludes-private-content', first.every(e=>e.captures[0].markdown===expected)&&!/Private reasoning|Private unrelated/.test(json(first)));
 check('copy-attempts-once-per-answer-and-keeps-system-clipboard', json(await counts())==='[2,2,2]' && json(await c.evaluate('Promise.all(fixtureGuests.map(g=>g.executeJavaScript("copyCalls")))'))==='[1,1,1]' && await c.evaluate('clipboardSnapshot()===clipboardBefore'));

 await c.evaluate('window.originalCopyDescriptor=Object.getOwnPropertyDescriptor(hostClipboard,"writeText");window.explicitCopyText=undefined;window.copySink=text=>{window.explicitCopyText=text};Object.defineProperty(hostClipboard,"writeText",{configurable:true,writable:true,value:copySink});true');
 try {
  assert.ok(await c.evaluate('hostClipboard.writeText===copySink'));
  await click(button('Copy answer Markdown'));
  await until('window.explicitCopyText!==undefined');
  check('native-explicit-answer-copy-dispatches-exact-current-markdown', await c.evaluate('explicitCopyText')===first[0].captures[0].markdown && await c.evaluate('clipboardSnapshot()===clipboardBefore'));
 } finally { await c.evaluate('if(originalCopyDescriptor)Object.defineProperty(hostClipboard,"writeText",originalCopyDescriptor);else delete hostClipboard.writeText;delete window.copySink;delete window.originalCopyDescriptor;true'); }
 await guest(0,'document.querySelector(".fixture-composer").value="Human draft";true');
 await c.evaluate('window.focusSentinel=document.createElement("input");document.body.append(focusSentinel);focusSentinel.focus();true');
 await c.evaluate('bw.recollect('+json(first[0].id)+')');
 check('production-copy-recollection-keeps-human-draft-focus-and-submit-count', await c.evaluate('document.activeElement===focusSentinel&&clipboardSnapshot()===clipboardBefore&&bw.snapshot().exchanges[0].captures.at(-1).source==="native-copy"') && await guest(0,'copyCalls===2&&document.querySelector(".fixture-composer").value==="Human draft"') && json(await counts())==='[2,2,2]');
 await guest(0,'window.copyMode="wrong";true'); await c.evaluate('bw.recollect('+json(first[0].id)+')');
 check('extra-copy-content-is-rejected-without-concatenation-or-older-complete-fallback', await c.evaluate('(()=>{const e=bw.snapshot().exchanges[0],c=e.captures.at(-1);return c.source==="scoped-dom"&&!c.complete&&!c.markdown.includes("Private unrelated")&&e.captures.length===3})()'));
 await guest(0,'(()=>{window.copyMode="valid";const button=document.querySelector("#messages button"),duplicate=button.cloneNode(true);duplicate.id="ambiguous-copy";button.parentElement.append(duplicate);return true})()');
 await c.evaluate('bw.recollect('+json(first[0].id)+')');
 check('ambiguous-message-copy-controls-are-never-clicked', await guest(0,'copyCalls===3') && await c.evaluate('bw.snapshot().exchanges[0].captures.at(-1).source==="scoped-dom"'));
 await guest(0,'document.querySelector("#ambiguous-copy").remove();window.copyMode="delayed";true');
 await c.evaluate('window.pendingCopy=bw.recollect('+json(first[0].id)+').catch(error=>({error:error.code}));true');
 await until('fixtureGuests[0].executeJavaScript("window.copyAwaiting===true")');
 await c.evaluate('bw.pause(taskId);true'); await c.evaluate('pendingCopy'); await delay(800);
 check('pause-does-not-accept-late-copy-or-alter-known-submission', await c.evaluate('(()=>{const e=bw.snapshot().exchanges[0],c=e.captures.at(-1);return e.submitState==="submitted"&&e.attempts.length===1&&!c.complete&&c.source==="scoped-dom"&&c.reasons.includes("interrupted")})()') && json(await counts())==='[2,2,2]');
 check('production-copy-restores-methods-and-preserves-host-clipboard-after-cancel', (await Promise.all(providers.map((_,i)=>guest(i,'navigator.clipboard.writeText===originalWriteText&&navigator.clipboard.write===originalWrite&&document.execCommand===originalExec')))).every(Boolean) && await c.evaluate('clipboardSnapshot()===clipboardBefore&&document.activeElement===focusSentinel'));
 const errors=[...hostErrors,...await c.evaluate('window.nandAcceptanceErrors??[]')];check('no-host-errors',errors.length===0,errors);
 await fs.writeFile(path.join(runtime.evidence,'result.json'),json({method:'Unmodified production main.js, real workspace/provider/ownership/input/save paths and local HTTPS fixtures. Strict native copy remains partial. Explicit Copy answer Markdown uses a temporary host clipboard sink to verify exact UI payload without changing the user clipboard. No actual website/account coverage claim.',rows},null,2));
} catch(error) {
 if(runtime) await fs.writeFile(path.join(runtime.evidence,'partial.json'),json({rows,error:String(error),hostErrors,state:await c.evaluate('bw.snapshot()').catch(String),copy:await c.evaluate('Promise.all(fixtureGuests.map(g=>g.executeJavaScript("({calls:window.copyCalls,mode:window.copyMode})")))').catch(String)},null,2));
 throw error;
} finally {
 if(runtime){await c.evaluate('window.focusSentinel?.remove();delete window.clipboardBefore;delete window.clipboardSnapshot;delete window.hostClipboard;true').catch(()=>undefined);console.log(json({evidence:runtime.evidence,checks:rows.length,failed:rows.filter(row=>!row.passed)}));await runtime.stop();}
}
