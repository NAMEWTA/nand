// Production module/API/UI in real Obsidian. The provider's entire HTTPS partition is served locally.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { createPromptFixtures, editPromptFixtures } from './prompt-library.mjs';
import { exerciseWorkspaceHistory } from './workspace-history.mjs';
import { exerciseSelectionGuidance } from './selection-guidance.mjs';
import { exerciseUserAdapters } from './user-adapters.mjs';

const p = 'app.plugins.plugins.nand', json = JSON.stringify, rows = [], hostErrors = [], debuggerErrors = [];
const provider = process.argv[3] ?? 'deepseek';
assert.ok(['deepseek', 'kimi', 'chatgpt', 'claude', 'qwen', 'doubao', 'coze', 'minimax'].includes(provider));
const kimi = provider === 'kimi', chatgpt = provider === 'chatgpt', claude = provider === 'claude', qwen = provider === 'qwen', doubao = provider === 'doubao', coze = provider === 'coze', minimax = provider === 'minimax', domOnly = coze || minimax, richtext = kimi || chatgpt || claude || qwen || doubao || domOnly;
const origin = kimi ? 'https://www.kimi.com' : chatgpt ? 'https://chatgpt.com' : claude ? 'https://claude.ai' : qwen ? 'https://www.qianwen.com' : doubao ? 'https://www.doubao.com' : coze ? 'https://www.coze.cn' : minimax ? 'https://agent.minimax.io' : 'https://chat.deepseek.com';
const allowedOrigins = coze ? [origin, 'https://coze.cn'] : minimax ? [origin, 'https://chat.minimax.io', 'https://agent.minimax.cn'] : [origin];
const endpoint = doubao ? '/im/chain/single' : kimi ? '/apiv2/kimi.gateway.chat.v1.ChatService/ListMessages' : '/api/v0/chat/history_messages';
let runtime, c, acceptedTurns = 3;
const testPrompts = process.env.NAND_ACCEPT_PROMPTS === '1';
let promptFixtures;
const firstQuestion = 'First question\nSecond line';
const root = '[...document.querySelectorAll(".nand-browser-workspace")].find(e=>e.getBoundingClientRect().width>0)';
const button = (label, scope = root) => '[...' + scope + '.querySelectorAll("button")].find(e=>e.textContent===' + json(label) + ')';
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
const until = async expression => {
 const end = Date.now() + 25000; let last;
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
const bind = () => c.evaluate('window.bw=' + p + '.services.peek({owner:"browser",id:"workspace"});window.bc=' + p + '.services.peek({owner:"browser",id:"control"});true');
try {
 runtime = await launchFreshVault({ root: process.argv[2], port: 9276, settings: { version: 1, namespaces: {
  app: { language: 'en', introSeen: true, modules: { browser: true, home: false, agent: false, news: false, archives: false, sync: false, comments: false, notifications: false, automations: false, icons: false } },
 } } });
 c = runtime.connection; c.on('Runtime.exceptionThrown', event => hostErrors.push({ lastCheck: rows.at(-1)?.name, details: event.exceptionDetails })); await c.send('Runtime.enable');
 if (process.env.NAND_TRACE_NATIVE_EXCEPTIONS === '1') {
  c.on('Debugger.paused', event => { debuggerErrors.push({ lastCheck: rows.at(-1)?.name, reason: event.reason, data: event.data, frames: event.callFrames.map(frame => ({ name: frame.functionName, url: frame.url, location: frame.location })) }); void c.send('Debugger.resume').catch(() => undefined); });
  await c.send('Debugger.enable'); await c.send('Debugger.setPauseOnExceptions', { state: 'uncaught' });
 }
 await bind(); await c.evaluate('app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();true');
 check('registered-workspace-stays-lazy-on-browser-startup', await c.evaluate('!!bw&&bw.snapshot()===undefined&&bc.list().length===0'));
 await c.evaluate(p + '.openWorkbench({feature:"browser",section:"multi-ai"},window)');
 await until('!!' + root + '&&!!bw.snapshot()');
 check('workspace-route-and-local-initialization-open-no-guests', await c.evaluate('bc.list().length===0&&bw.snapshot().tasks.length===0'));
 await type(root + '.querySelector("input[type=text]")', 'Fixture research');
 if (richtext) {
  await click(root + '.querySelector("select")');
  for (let step = 0; step < (minimax ? 7 : coze ? 6 : doubao ? 5 : qwen ? 4 : claude ? 3 : chatgpt ? 2 : 1); step++) for (const type of ['keyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type, key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  for (const type of ['keyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await until(root + '.querySelector("select").value===' + json(provider));
 }
 await click(button('Create task'));
 await until('bw.snapshot().tasks.length===1&&!!' + root + '.querySelector("textarea")');
 const taskId = await c.evaluate('bw.snapshot().tasks[0].id');
 await c.evaluate('window.taskId=' + json(taskId) + ';true');
 check('task-created-through-native-ui-without-opening-provider', await c.evaluate('bw.snapshot().tasks[0].title==="Fixture research"&&bc.list().length===0'));
 await type(root + '.querySelector("textarea")', 'First question\nSecond line');
 await until('bw.snapshot().tasks[0].draft===' + json(firstQuestion) + '&&' + root + '.textContent.includes("Draft saved")');
 check('native-draft-is-written-to-readable-markdown', (await fs.readFile(path.join(runtime.vault, 'NAND/AI Workspace', taskId, '任务.md'), 'utf8')).includes('First question\nSecond line'));
 const html = await fs.readFile('scripts/fixtures/' + provider + '-page.html', 'utf8');
 await c.evaluate('(async()=>{window.fixtureHtml=' + json(html) + ';window.fixtureRequests=[];window.fixtureSession=require("@electron/remote").session.fromPartition("persist:nand-browser-"+app.loadLocalStorage("nand.browser.vault-id"));await new Promise((resolve,reject)=>fixtureSession.protocol.interceptBufferProtocol("https",(request,reply)=>{fixtureRequests.push(request.url);void(async()=>{const u=new URL(request.url);if(!' + json(allowedOrigins) + '.includes(u.origin)){reply({statusCode:403,data:Buffer.from("")});return}if((' + json(chatgpt) + '?u.pathname.startsWith("/backend-api/conversation/"):' + json(claude) + "?u.pathname.startsWith(\"/api/organizations/fixture-org/chat_conversations/\"):" + json(qwen) + '?u.pathname.startsWith("/api/v2/conversation/"):u.pathname===' + json(endpoint) + ')){const bodyData=' + json(kimi || doubao) + '?JSON.parse(Buffer.concat((request.uploadData??[]).map(part=>part.bytes??Buffer.alloc(0))).toString()):{};const cursor=' + json(doubao) + '?bodyData.anchor:bodyData.page_token;const body=await fixtureGuest.executeJavaScript("JSON.stringify(fixtureHistory("+JSON.stringify(cursor)+"))");reply({mimeType:"application/json",data:Buffer.from(body)})}else reply({mimeType:"text/html",data:Buffer.from(fixtureHtml)})})().catch(e=>{window.fixtureInterceptError=String(e);reply({statusCode:500,data:Buffer.from("")})})},error=>error?reject(error):resolve()));})()');
 await click(button('Open official page'));
 await until('bc.list().length===1&&!bc.list()[0].loading&&!!document.querySelector(".nand-browser-workspace-pane webview")');
 await c.evaluate('window.wv=document.querySelector(".nand-browser-workspace-pane webview");window.fixtureGuest=require("@electron/remote").webContents.fromId(wv.getWebContentsId());true');
 await until('wv.executeJavaScript("!!document.querySelector(\'.fixture-composer\')")');
 check('explicit-open-uses-module-owned-page-and-fixed-account', await c.evaluate('bc.list().length===1&&bc.list()[0].target.profileId==="default"&&!document.querySelector(".nand-browser-workspace-pane .nand-browser-profile")'));
 if (domOnly) await c.evaluate('window.clipboardFingerprint=()=>{const clipboard=require("@electron/remote").clipboard,hash=require("node:crypto").createHash("sha256");for(const format of clipboard.availableFormats().sort())hash.update(format).update(clipboard.readBuffer(format));return hash.digest("hex")};window.clipboardBefore=clipboardFingerprint();true');
 if (chatgpt || claude || qwen || doubao || domOnly) {
  await c.evaluate('wv.executeJavaScript(' + json('(()=>{const root=document.createElement("article");root.id="fixture-anonymous";root.dataset.testid="conversation-turn-99";const message=document.createElement("div");message.dataset.messageAuthorRole="user";message.dataset.role="user";message.dataset.testid="user-message";message.textContent="No stable identity";root.append(message);document.querySelector("#messages").append(root);})()') + ')');
  await click(button('Use current conversation')); await until('!bw.busy(taskId)&&bw.snapshot().tasks[0].targets[0].status==="needs-attention"');
  check(provider + '-role-or-numbered-turn-is-not-invented-as-message-identity', await c.evaluate('bw.snapshot().turns.length===0&&bw.preview(taskId).then(()=>false,e=>e.code==="browser_workspace_target_not_ready")'));
  await c.evaluate('wv.executeJavaScript(' + json('document.querySelector("#fixture-anonymous").remove();true') + ')');
  for (const mode of ['login', 'challenge']) {
   const setup = mode === 'login' ? 'const e=document.createElement("button");e.dataset.testid="login-button";e.className="login-button";e.textContent="Log in";e.id="fixture-blocker";document.body.append(e);true' : 'const e=document.createElement("div");e.dataset.testid="captcha";e.textContent="Manual verification";e.id="fixture-blocker";document.body.append(e);true';
   await c.evaluate('wv.executeJavaScript(' + json('(()=>{' + setup + '})()') + ')');
   await click(button('Use current conversation'));
   await until('!bw.busy(taskId)&&bw.snapshot().tasks[0].targets[0].status===' + json(mode === 'login' ? 'login-required' : 'needs-attention'));
   check(provider + '-' + mode + '-leaves-page-open-and-blocks-send', await c.evaluate('bc.list().length===1&&bw.snapshot().turns.length===0&&bw.preview(taskId).then(()=>false,e=>e.code==="browser_workspace_target_not_ready")'));
   check(provider + '-' + mode + '-does-not-click-or-bypass-blocker', await c.evaluate('wv.executeJavaScript(' + json('!!document.querySelector("#fixture-blocker")&&fixtureCount()===0') + ')'));
   await c.evaluate('wv.executeJavaScript(' + json('document.querySelector("#fixture-blocker").remove();true') + ')');
  }
 }
 await click(button('New website conversation'));
 await until('bw.snapshot().tasks[0].targets[0].status==="ready"&&!bw.busy(taskId)');
 check('explicit-new-conversation-binds-actual-generation', await c.evaluate('bw.snapshot().tasks[0].targets[0].page.generation===bc.list()[0].target.generation'));
 if (qwen) {
  const emptySlate=()=>{const c=document.querySelector('.fixture-composer');c.innerHTML='<p data-slate-node="element"><span data-slate-zero-width="n">&#xfeff;<br></span><span data-slate-placeholder="true" contenteditable="false">Ask a question</span></p>';const search=document.createElement('aside');search.role='search';search.id='fixture-search';search.innerHTML='<textarea placeholder="Search conversations">Human search draft</textarea>';document.body.append(search);const dormant=document.createElement('div');dormant.className='nc-container';dormant.id='fixture-dormant';document.body.append(dormant);return true};
  await c.evaluate('wv.executeJavaScript('+json('('+emptySlate.toString()+')()')+')');
  await click(button('Recheck targets'));await until('!bw.busy(taskId)');
  check('qwen-empty-slate-placeholder-and-occupied-search-do-not-become-a-chat-draft',await c.evaluate('bw.preview(taskId).then(()=>true,()=>false)'));
  await c.evaluate('wv.executeJavaScript('+json('document.querySelector(".fixture-composer").innerText="Human chat draft";true')+')');
  check('qwen-real-human-chat-draft-stays-protected',await c.evaluate('bw.preview(taskId).then(()=>false,e=>e.code==="browser_workspace_target_not_ready")')&&await c.evaluate('wv.executeJavaScript('+json('document.querySelector(".fixture-composer").innerText==="Human chat draft"&&document.querySelector("#fixture-search textarea").value==="Human search draft"')+')'));
  await c.evaluate('wv.executeJavaScript('+json('document.querySelector(".fixture-composer").replaceChildren();true')+')');
  await click(button('New website conversation'));await until('!bw.busy(taskId)');
 }
 if (testPrompts) promptFixtures = await createPromptFixtures({ c, root, click, type, until, button, check });
 for (let index = 0; index < 3; index++) {
  if (qwen) await c.evaluate('wv.executeJavaScript(' + json('window.fixtureEnvelope=' + json(index === 1 ? 'alternate' : 'detail') + ';true') + ')');
  if (richtext) await c.evaluate('wv.executeJavaScript("window.fixtureLongAnswer=' + (index === 1) + ';true")');
  if (index === 1) await type(root + '.querySelector("textarea")', 'Follow up');
  if (index === 2) await type(root + '.querySelector("textarea")', 'First question\nSecond line');
  const question = (promptFixtures?.prefix ?? '') + await c.evaluate('bw.snapshot().tasks[0].draft');
  await click(button('Preview send'));
  await until('!!' + root + '.querySelector(".nand-browser-workspace-composer > .nand-browser-workspace-preview")');
  check('turn-' + index + '-preview-freezes-visible-prompt-without-input', await c.evaluate(root + '.querySelector(".nand-browser-workspace-composer > .nand-browser-workspace-preview pre").textContent') === question &&
   await c.evaluate('wv.executeJavaScript("document.querySelector(\'.fixture-composer\').' + (richtext ? 'innerText' : 'value') + '")') === '');
  await click(button('Send this preview'));
  await until('bw.snapshot().turns.length===' + (index + 1) + '&&!bw.busy(taskId)&&bw.snapshot().exchanges.length===' + (index + 1) + '&&(!' + button('Preview send') + '?.disabled)&&bw.snapshot().exchanges.at(-1).submitState!=="idle"');
  const exchange = await c.evaluate('bw.snapshot().exchanges.at(-1)');
  check('turn-' + index + '-public-send-captures-and-saves-current-answer', exchange.submitState === 'submitted' && exchange.acquisitionState === (domOnly ? 'incomplete' : 'complete') && exchange.saveState === 'saved' && (!domOnly || exchange.captures[0]?.source === 'native-copy'), exchange);
  if (richtext && index === 1) check(provider + '-long-answer-is-saved-without-truncation', exchange.captures.at(-1)?.markdown.length > 60000);
  check('turn-' + index + '-renders-real-markdown-table', await c.evaluate('!!' + root + '.querySelector(".nand-browser-answer table")'));
 }
 const data = await c.evaluate('bw.snapshot()');
 if (domOnly) {
  check(provider + '-capture-uses-no-history-request', await c.evaluate('fixtureRequests.every(url=>new URL(url).pathname==="/")'));
  check(provider + '-copy-keeps-host-clipboard-unchanged-and-excludes-code-copy', await c.evaluate('clipboardFingerprint()===clipboardBefore&&wv.executeJavaScript("fixtureCopyCalls===3")'));
  check(provider + '-unverified-coverage-stays-partial-with-repeated-paragraphs', data.exchanges.every(exchange => exchange.captures[0].reasons.includes('native-copy-coverage-unverified') && (exchange.captures[0].markdown.match(/Repeated paragraph/g) ?? []).length === 2));
  await c.evaluate('wv.executeJavaScript(' + json('window.savedConversationId=document.querySelector("#messages").dataset.conversationId;delete document.querySelector("#messages").dataset.conversationId;true') + ')');
  check(provider + '-missing-conversation-identity-blocks-staging', await c.evaluate('bw.preview(taskId).then(()=>false,e=>e.code==="browser_workspace_target_not_ready"||e.code==="browser_workspace_identity_changed")') && await c.evaluate('wv.executeJavaScript(' + json('fixtureCount()===6&&document.querySelector(".fixture-composer").innerText===""') + ')'));
  await c.evaluate('wv.executeJavaScript(' + json('document.querySelector("#messages").dataset.conversationId=savedConversationId;true') + ')');
 }
 if (qwen) check('qwen-target-and-answer-use-translated-provider-name', await c.evaluate(root + '.textContent.includes("Qianwen")&&[...' + root + '.querySelectorAll("h4")].some(e=>e.textContent.startsWith("Qianwen"))'));
 if (chatgpt || claude || qwen || doubao || domOnly) check(provider + '-public-current-branch-excludes-private-and-inactive-text', !/Private reasoning|Private tool|Inactive branch/.test(json(data.exchanges)));
 check('same-conversation-follow-up-and-identical-question-have-distinct-receipts', new Set(data.exchanges.map(row => row.receipt.messageId)).size === 3 && new Set(data.exchanges.map(row => row.receipt.conversationId)).size === 1);
 check('binding-url-is-canonical-and-transient-provider-secrets-are-not-saved', (domOnly ? data.tasks[0].targets[0].officialUrl === origin + '/' : data.tasks[0].targets[0].officialUrl === origin + (kimi || claude || doubao ? '/chat/' : chatgpt ? '/c/' : qwen ? '/conversation/' : '/a/chat/s/') + data.exchanges[0].receipt.conversationId) && !json(data).includes('fixture-only-secret'));
 const answerFiles = await fs.readdir(path.join(runtime.vault, 'NAND/AI Workspace', taskId, '回答'));
 check('three-readable-answer-documents-exist', answerFiles.length === 3);
 await c.evaluate(root + '.querySelector(".nand-browser-workspace-turns").scrollIntoView({block:"start"});true');
 await runtime.shot('workspace-answer');
 if(process.env.NAND_ACCEPT_GUIDANCE==='1')await exerciseSelectionGuidance({c,p,root,click,until,button,check,runtime});
 if(process.env.NAND_ACCEPT_ADAPTER==='1')c=await exerciseUserAdapters({c,p,root,click,type,until,button,check,runtime,taskId});
 else {
 if (testPrompts) {
  await editPromptFixtures({ c, root, click, type, until, button, check, fixtures: promptFixtures });
  const deleted = await fs.readFile(path.join(runtime.vault, 'NAND/AI Workspace', '提示词', promptFixtures.first + '.md'), 'utf8');
  check('prompt-removal-marks-owned-markdown-without-erasing-body', deleted.includes('nand-deleted: true') && deleted.includes('New instructions'));
  await click(root + '.querySelector(".nand-browser-workspace-turns > article > details > summary")');
  check('historical-template-details-show-the-original-body-after-removal', await c.evaluate(root + '.querySelector(".nand-browser-workspace-turns > article > details").textContent.includes("First instructions")&&!' + root + '.querySelector(".nand-browser-workspace-turns > article > details").textContent.includes("New instructions")'));
  await runtime.shot('prompt-historical-snapshot');
  await c.evaluate(root + '.querySelector(".nand-browser-workspace-prompts").scrollIntoView({block:"start"});true');
 }
 for (const preset of ['system', 'claude-code', 'eye-care']) for (const dark of [false, true]) for (const width of [500, 800, 1500]) {
  await c.evaluate(p + '.theme.update(d=>{d.preset=' + json(preset) + '});app.changeTheme(' + json(dark ? 'obsidian' : 'moonstone') + ');true');
  await c.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false }); await delay(120);
  const layout = await c.evaluate('(()=>{const e=' + root + ';return{width:e.clientWidth,scroll:e.scrollWidth,small:[...e.querySelectorAll("button,select,input:not([type=checkbox])")].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().height<32).length}})()');
  check('workspace-' + preset + '-' + (dark ? 'dark' : 'light') + '-' + width, layout.width > 0 && layout.scroll <= layout.width + 1 && layout.small === 0, layout);
  if (preset === 'system' && !dark || preset === 'eye-care' && dark && width === 1500) await runtime.shot('workspace-' + preset + '-' + (dark ? 'dark' : 'light') + '-' + width);
 }
 await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
 await c.send('Emulation.setDeviceMetricsOverride', { width: 500, height: 1000, deviceScaleFactor: 1, mobile: true }); await delay(120);
 check('coarse-task-controls-and-checkbox-labels-are44', await c.evaluate('matchMedia("(pointer:coarse)").matches&&[...' + root + '.querySelectorAll("button,select,.nand-browser-workspace-actions>label")].every(e=>!e.getClientRects().length||e.getBoundingClientRect().height>=44)'));
 await c.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await c.send('Emulation.clearDeviceMetricsOverride');
 await c.evaluate(p + '.theme.update(d=>{d.preset="system"});app.changeTheme("moonstone");true');
 check('layout-and-theme-changes-do-not-add-turns-or-native-submissions', await c.evaluate('bw.snapshot().turns.length===3&&wv.executeJavaScript("fixtureCount()").then(n=>n===6)'));
 if (testPrompts) await click(root + '.querySelector(".nand-browser-workspace-prompts > summary")');
 if (richtext) {
  for (const mode of (domOnly ? ['no-copy', 'wrong-copy'] : doubao ? ['missing-page', 'missing-parent', 'unfinished', 'no-history', 'stale-branch'] : kimi ? ['missing-page', 'unfinished', 'no-history'] : ['missing-parent', 'unfinished', 'no-history', 'stale-branch'])) {
   await c.evaluate('wv.executeJavaScript(' + json('window.fixtureMode=' + json(mode) + ';window.fixtureNoHistory=' + json(mode === 'no-history') + ';true') + ')');
   await type(root + '.querySelector("textarea")', 'Boundary: ' + mode);
   await click(button('Preview send')); await until('!!' + root + '.querySelector(".nand-browser-workspace-composer > .nand-browser-workspace-preview")');
   await click(button('Send this preview')); acceptedTurns++;
   await until('bw.snapshot().turns.length===' + acceptedTurns + '&&!bw.busy(taskId)&&!' + button('Preview send') + '?.disabled');
   const result = await c.evaluate('bw.snapshot().exchanges.at(-1)'), capture = result.captures.at(-1);
   const reason = mode === 'missing-page' ? 'missing-page' : mode === 'missing-parent' ? 'missing-parent-message' : mode === 'unfinished' ? 'unfinished-assistant' : 'scoped-dom-coverage-unverified';
   check(provider + '-' + mode + '-preserves-accepted-receipt-and-partial-answer', result.submitState === 'submitted' && result.acquisitionState === 'incomplete' && result.saveState === 'saved' && capture?.reasons.includes(reason), result);
   check(provider + '-' + mode + '-does-not-leak-private-fragments-or-secrets', !/Private reasoning|Private tool|Inactive branch|fixture-only/.test(json(result)));
   const explanation = ['missing-page', 'missing-parent'].includes(mode) ? 'Some conversation history is missing' : mode === 'unfinished' ? 'The website has not provided enough evidence' : 'Only loaded page content was captured';
   check(provider + '-' + mode + '-explains-incompleteness-in-the-answer-ui', await c.evaluate(root + '.querySelector(".nand-browser-workspace-turn").textContent.includes(' + json(explanation) + ')'));
  }
  await c.evaluate('wv.executeJavaScript("window.fixtureNoHistory=false;window.fixtureMode=undefined;true")');
  const oldConversation = await c.evaluate('bw.snapshot().tasks[0].targets[0].conversationId');
  if (domOnly) {
   await click(button('Close page')); await until('bc.list().length===0');
   await click(button('Open official page')); await until('bc.list().length===1&&!bc.list()[0].loading');
   await c.evaluate('window.wv=document.querySelector(".nand-browser-workspace-pane webview");window.fixtureGuest=require("@electron/remote").webContents.fromId(wv.getWebContentsId());true');
   await until('fixtureGuest.executeJavaScript(' + json('!!document.querySelector(".fixture-composer")') + ')');
   check(provider + '-closed-conversation-can-reopen-official-home-without-guessing-a-permalink', await c.evaluate('fixtureGuest.executeJavaScript(' + json('fixtureCount()===0&&location.origin===' + json(origin)) + ')') && await c.evaluate('bw.snapshot().turns.length===' + acceptedTurns));
  }
  await click(button('New website conversation'));
  await until('!bw.busy(taskId)&&!bw.snapshot().tasks[0].targets[0].conversationId');
  check(provider + '-new-conversation-clears-native-context-and-preserves-all-old-turns', await c.evaluate('wv.executeJavaScript(' + json('fixtureCount()===0&&document.querySelector(".fixture-composer").innerText===""') + ')') &&
   await c.evaluate('bw.snapshot().turns.length===' + acceptedTurns + '&&bw.snapshot().exchanges[0].receipt.conversationId===' + json(oldConversation)));
  await runtime.shot(provider + '-partial-reasons-and-new-conversation');
  if (domOnly) for (const targetOrigin of allowedOrigins.slice(1)) {
   await c.evaluate('fixtureGuest.loadURL(' + json(targetOrigin + '/') + ')');
   await until('!bc.list()[0].loading&&fixtureGuest.executeJavaScript(' + json('location.origin===' + json(targetOrigin) + '&&!!document.querySelector(".fixture-composer")') + ')');
   check(provider + '-host-switch-requires-explicit-recheck-before-staging-' + targetOrigin, await c.evaluate('bw.preview(taskId).then(()=>false,()=>true)') && await c.evaluate('fixtureGuest.executeJavaScript("fixtureCount()===0")'));
   await click(button('Use current conversation')); await until('!bw.busy(taskId)&&bw.snapshot().tasks[0].targets[0].status==="ready"');
   check(provider + '-secondary-official-host-can-be-bound-with-the-original-account-' + targetOrigin, await c.evaluate('bw.snapshot().tasks[0].targets[0].page.generation===bc.list()[0].target.generation&&bc.list()[0].target.profileId==="default"&&bw.snapshot().tasks[0].targets[0].officialUrl===' + json(targetOrigin + '/')));
  } }
 const recipient = root + '.querySelector(".nand-browser-workspace-target input[type=checkbox]")';
 const visible = root + '.querySelectorAll(".nand-browser-workspace-target input[type=checkbox]")[1]';
 await click(visible);
 await until('bw.snapshot().tasks[0].visibleTargetIds.length===0');
 check('hiding-page-preserves-recipient-and-owned-guest', await c.evaluate('bw.snapshot().tasks[0].selectedTargetIds.length===1&&bc.list().length===1&&document.querySelector(".nand-browser-workspace-pane").hidden'));
 await click(recipient);
 await until('bw.snapshot().tasks[0].selectedTargetIds.length===0');
 await click(visible);
 await until('bw.snapshot().tasks[0].visibleTargetIds.length===1');
 check('showing-page-does-not-select-recipient', await c.evaluate('bw.snapshot().tasks[0].selectedTargetIds.length===0&&bc.list().length===1'));
 await click(recipient);
 await until('bw.snapshot().tasks[0].selectedTargetIds.length===1');
 await c.evaluate('wv.executeJavaScript("window.fixtureDelay=60000;true")');
 await type(root + '.querySelector("textarea")', 'Pause this accepted question');
 await click(button('Preview send')); await until('!!' + root + '.querySelector(".nand-browser-workspace-composer > .nand-browser-workspace-preview")');
 await click(button('Send this preview'));
 await until('bw.snapshot().exchanges.at(-1).submitState==="submitted"&&bw.snapshot().turns.length===' + (acceptedTurns + 1) + '&&bw.busy(taskId)');
 await click(button('Pause task'));
 await until('!bw.busy(taskId)&&!' + button('Preview send') + '?.disabled');
 const paused = await c.evaluate('bw.snapshot().exchanges.at(-1)');
 check('native-pause-keeps-accepted-receipt-and-incomplete-answer', paused.submitState === 'submitted' && paused.acquisitionState === 'incomplete' && paused.attempts.length === 1, paused);
 check('pause-does-not-resubmit-or-mutate-website-draft', await c.evaluate('wv.executeJavaScript("fixtureCount()===' + (richtext ? 1 : 7) + '&&document.querySelector(\'.fixture-composer\').' + (richtext ? 'innerText' : 'value') + '===\'\'")'));
 await c.evaluate('window.migratedLeaf=app.workspace.getLeavesOfType("nand-workbench-view").find(leaf=>leaf.view.getNativeSurfaces().some(surface=>surface.taskId===taskId));app.workspace.moveLeafToPopout(migratedLeaf,{width:1000,height:900});true');
 await until('migratedLeaf.view.containerEl.win!==window&&bc.list().length===0');
 check('popout-migration-releases-guest-and-keeps-service-draft', await c.evaluate('bw.snapshot().tasks[0].draft==="Pause this accepted question"&&migratedLeaf.view.contentEl.querySelector(".nand-browser-workspace textarea").value==="Pause this accepted question"'));
 await c.evaluate(p + '.openWorkbench({feature:"browser",section:"multi-ai",resourceId:taskId},window)');
 await until('!!' + root + '.querySelector("textarea")');
 await c.evaluate('migratedLeaf.detach();true');
 check('another-window-presentation-reads-same-task-without-opening-provider', await c.evaluate('bc.list().length===0&&bw.snapshot().tasks.length===1&&bw.snapshot().turns.length===' + (acceptedTurns + 1) + ''));
 await c.evaluate(p + '.changeLanguage("zh")');
 await until(root + '.textContent.includes("预览发送")');
 if (qwen) check('qwen-provider-name-translates-with-the-task', await c.evaluate('[...' + root + '.querySelectorAll("h4")].some(e=>e.textContent.startsWith("千问"))'));
 check('language-refresh-keeps-saved-question-without-opening-page', await c.evaluate('bc.list().length===0&&' + root + '.querySelector("textarea").value==="Pause this accepted question"'));
 await c.evaluate('app.workspace.requestSaveLayout();true'); await delay(600);
 await runtime.restart(); c = runtime.connection; await bind();
 await c.evaluate(p + '.openWorkbench({feature:"browser",section:"multi-ai",resourceId:' + json(taskId) + '},window)');
 await until('!!bw.snapshot()&&!!' + root + '.querySelector("textarea")');
 check('restart-restores-task-draft-answers-without-website-or-resubmission', await c.evaluate('bc.list().length===0&&bw.snapshot().turns.length===' + (acceptedTurns + 1) + '&&bw.snapshot().exchanges.every(e=>e.submitState==="submitted")&&' + root + '.querySelector("textarea").value==="Pause this accepted question"'));
 if (testPrompts) check('restart-preserves-selected-template-and-frozen-copies-without-website', await c.evaluate('bw.snapshot().templates.length===1&&bw.snapshot().templates[0].id===' + json(promptFixtures.second) + '&&bw.snapshot().templates[0].order===0&&bw.snapshot().tasks[0].promptTemplateIds[0]===' + json(promptFixtures.second) + '&&bw.snapshot().turns.filter(t=>t.sequence<=3).every(t=>t.templates.length===2&&t.finalPrompt.startsWith(' + json(promptFixtures.prefix) + '))&&bc.list().length===0'));
 check('restored-task-renders-answer-markdown', await c.evaluate('!!' + root + '.querySelector(".nand-browser-answer table")'));
 check('restored-binding-shows-disconnected-until-page-is-verified', await c.evaluate(root + '.textContent.includes("已断开")'));
 await c.evaluate(p + '.setModuleEnabled("browser",false)');
 check('module-off-removes-workspace-service-and-guests', await c.evaluate('!' + p + '.services.peek({owner:"browser",id:"workspace"})&&!document.querySelector("webview")'));
 check('retained-public-facade-rejects-after-off', await c.evaluate('bw.initialize().then(()=>false,e=>e.code==="browser_disabled")'));
 await c.evaluate(p + '.setModuleEnabled("browser",true)'); await bind();
 await c.evaluate(p + '.openWorkbench({feature:"browser",section:"multi-ai",resourceId:' + json(taskId) + '},window)');
 await until('!!bw.snapshot()&&!!' + root + '.querySelector("textarea")');
 check('reenable-restores-local-content-without-page-or-send', await c.evaluate('bc.list().length===0&&bw.snapshot().turns.length===' + (acceptedTurns + 1) + ''));
 if (process.env.NAND_ACCEPT_HISTORY === '1') {
  await exerciseWorkspaceHistory({ c, p, root, click, type, until, button, check, runtime, taskId });
  await runtime.restart(); c = runtime.connection; await bind();
  await c.evaluate(p + '.openWorkbench({feature:"browser",section:"multi-ai"},window)');
  await until('!!bw.snapshot()&&!!' + root + '.querySelector(".nand-browser-workspace-history")');
  check('deleted-task-stays-deleted-after-restart-without-journal-replay', await c.evaluate('bw.snapshot().tasks.length===1&&bw.snapshot().tasks[0].title==="Keep this task"&&bw.snapshot().turns.length===0&&bc.list().length===0'));
 }
 }
 const errors = [...hostErrors, ...await c.evaluate('window.nandAcceptanceErrors??[]')];
 check('no-host-errors', errors.length === 0, errors);
 await fs.writeFile(path.join(runtime.evidence, 'result.json'), json({ provider, method: 'Uninstrumented production build, registered BROWSER_WORKSPACE service, real task UI, guest ownership and native input. HTTPS provider traffic intercepted at Electron session and fulfilled locally; no real provider account claim.' + (process.env.NAND_ACCEPT_HISTORY === '1' ? ' History copy destination is temporarily observed at the module clipboard boundary without changing the OS clipboard; deletion failure uses an actual Windows read-sharing lock on an owned turn document.' : ''), rows, debuggerErrors }, null, 2));
} catch (error) {
 if (runtime) {
  await runtime.shot('failure').catch(() => undefined);
  await fs.writeFile(path.join(runtime.evidence, 'partial.json'), json({ rows, error: String(error), hostErrors, debuggerErrors,
   state: await c.evaluate('({data:window.bw?.snapshot(),body:document.body.innerText,interceptError:window.fixtureInterceptError,errors:window.nandAcceptanceErrors})').catch(String) }, null, 2));
 }
 throw error;
} finally {
 if (runtime) { console.log(json({ evidence: runtime.evidence, checks: rows.length, failed: rows.filter(row => !row.passed) })); await runtime.stop(); }
}
