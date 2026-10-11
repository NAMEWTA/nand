// Uninstrumented production workspace and three local provider fixtures in real Obsidian.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { exercisePanelLayout } from './workspace-panels.mjs';
import { exerciseWorkspaceDelivery } from './workspace-delivery.mjs';

const thirdProvider = process.argv[3] ?? 'chatgpt';
assert.ok(['chatgpt', 'claude', 'qwen', 'doubao', 'coze', 'minimax'].includes(thirdProvider));
const domOnly = ['coze', 'minimax'].includes(thirdProvider);
const p = 'app.plugins.plugins.nand', json = JSON.stringify, rows = [], hostErrors = [], providers = ['deepseek', 'kimi', thirdProvider];
const origins = ['https://chat.deepseek.com', 'https://www.kimi.com', thirdProvider === 'claude' ? 'https://claude.ai' : thirdProvider === 'qwen' ? 'https://www.qianwen.com' : thirdProvider === 'doubao' ? 'https://www.doubao.com' : thirdProvider === 'coze' ? 'https://www.coze.cn' : thirdProvider === 'minimax' ? 'https://agent.minimax.io' : 'https://chatgpt.com'];
const root = '[...document.querySelectorAll(".nand-browser-workspace")].find(e=>e.getBoundingClientRect().width>0)';
const row = index => root + '.querySelectorAll(".nand-browser-workspace-targets>section")[' + index + ']';
const button = (label, scope = root) => '[...' + scope + '.querySelectorAll("button")].find(e=>e.textContent===' + json(label) + ')';
let runtime, c, taskId, environment;
let panelLayout;
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
 for (const provider of providers.slice(1)) {
  await click(root + '.querySelector("select")'); for (let step = 0; step < (provider === 'minimax' ? 6 : provider === 'coze' ? 5 : provider === 'doubao' ? 4 : provider === 'qwen' ? 3 : provider === 'claude' ? 2 : 1); step++) await key('ArrowDown', 'ArrowDown', 40); await key('Enter', 'Enter', 13);
  await until(root + '.querySelector("select").value===' + json(provider)); await click(button('Add target'));
  await until('bw.snapshot().tasks[0].targets.length===' + (providers.indexOf(provider) + 1));
 }
 check('native-target-management-does-not-open-or-select-added-targets', await c.evaluate('bc.list().length===0&&bw.snapshot().tasks[0].selectedTargetIds.length===1&&bw.snapshot().tasks[0].visibleTargetIds.length===1'));
 await click(button('Select all targets')); await until('bw.snapshot().tasks[0].selectedTargetIds.length===3');
 const html = await Promise.all(providers.map(provider => fs.readFile('scripts/fixtures/' + provider + '-page.html', 'utf8')));
 await c.evaluate('(async()=>{window.fixtureHtml=' + json(html) + ';window.fixtureGuests=[];window.fixtureRequests=[];window.fixtureOrigins=' + json(origins) + ';const session=require("@electron/remote").session.fromPartition("persist:nand-browser-"+app.loadLocalStorage("nand.browser.vault-id"));await new Promise((resolve,reject)=>session.protocol.interceptBufferProtocol("https",(request,reply)=>{void(async()=>{const u=new URL(request.url),i=fixtureOrigins.indexOf(u.origin);if(i<0){reply({statusCode:403,data:Buffer.from("")});return}fixtureRequests.push({provider:i,path:u.pathname});if(u.pathname==="/im/chain/single"||u.pathname==="/api/v0/chat/history_messages"||u.pathname==="/apiv2/kimi.gateway.chat.v1.ChatService/ListMessages"||u.pathname.startsWith("/backend-api/conversation/")||u.pathname.startsWith("/api/organizations/fixture-org/chat_conversations/")||u.pathname.startsWith("/api/v2/conversation/")){const bodyData=i===1||u.pathname==="/im/chain/single"?JSON.parse(Buffer.concat((request.uploadData??[]).map(p=>p.bytes??Buffer.alloc(0))).toString()):{};const cursor=u.pathname==="/im/chain/single"?bodyData.anchor:bodyData.page_token;const body=await fixtureGuests[i].executeJavaScript("JSON.stringify(fixtureHistory("+JSON.stringify(cursor)+"))");reply({mimeType:"application/json",data:Buffer.from(body)})}else reply({mimeType:"text/html",data:Buffer.from(fixtureHtml[i])})})().catch(error=>{window.fixtureInterceptError=String(error);reply({statusCode:500,data:Buffer.from("")})})},error=>error?reject(error):resolve()));})()');
 for (let index = 0; index < 3; index++) {
  await click(button('Open official page', row(index))); await until('bc.list().length===' + (index + 1) + '&&bc.list().every(p=>!p.loading)');
  await c.evaluate('fixtureGuests[' + index + ']=require("@electron/remote").webContents.fromId(document.querySelectorAll(".nand-browser-workspace-pane webview")[' + index + '].getWebContentsId());true');
  await until('fixtureGuests[' + index + '].executeJavaScript("!!document.querySelector(\'.fixture-composer\')")');
  await guest(index, '(()=>{window.fixtureEvents=[];for(const type of ["focusin","keydown","beforeinput","input"])document.addEventListener(type,e=>fixtureEvents.push({type,key:e.key,inputType:e.inputType,value:document.querySelector(".fixture-composer").value??document.querySelector(".fixture-composer").innerText}),true)})()');
  await click(button('New website conversation', row(index)));
  await until('!bw.busy(taskId)&&bw.snapshot().tasks[0].targets[' + index + '].status==="ready"');
 }
 check('three-official-pages-have-distinct-bound-generations', await c.evaluate('new Set(bw.snapshot().tasks[0].targets.map(t=>t.page.generation)).size===3&&bc.list().length===3'));
 if (process.env.NAND_ACCEPT_PANELS === '1') panelLayout = await exercisePanelLayout({ c, p, root, runtime, check, click, type, until, button, row, key, counts });
 await type(root + '.querySelector("textarea")', 'First question\nSecond line');
 await guest(2, '(()=>{const e=document.createElement("button");e.dataset.testid="login-button";e.className="login-button";e.id="fixture-blocker";e.textContent="Log in";document.body.append(e);})()');
 await click(button('Preview send')); await until('!bw.busy(taskId)&&!!' + root + '.querySelector("[role=alert]")');
 check('one-login-blocker-default-preview-checks-all-with-zero-input', await c.evaluate('bw.snapshot().turns.length===0&&!' + root + '.querySelector(".nand-browser-workspace-preview")&&' + row(2) + '.textContent.includes("Login required")') && (await counts()).every(n => n === 0));
 await click(button('Preview ready targets only')); await until('!!' + root + '.querySelector(".nand-browser-workspace-preview")');
 check('ready-only-freezes-two-targets-without-changing-three-saved-recipients', await c.evaluate(root + '.querySelectorAll(".nand-browser-workspace-preview li").length===2&&bw.snapshot().tasks[0].selectedTargetIds.length===3'));
 if (panelLayout) {
  await c.send('Emulation.setDeviceMetricsOverride', { width:500,height:1000,deviceScaleFactor:1,mobile:false });
  await click(root+'.querySelector(".nand-browser-pane-focus").querySelectorAll("button")[2]');
  await until('!'+button('Maximize panel',root+'.querySelectorAll(".nand-browser-panel-slot")[2]')+'.disabled');
  await click(button('Maximize panel',root+'.querySelectorAll(".nand-browser-panel-slot")[2]'));
  await until('!!bw.snapshot().tasks[0].panelLayout.maximized&&!'+button('Send this preview')+'.disabled');
 }
 await send(1);
 check('ready-only-sends-exactly-two-and-saves-independent-complete-answers', json(await counts()) === '[2,2,0]' && await c.evaluate('bw.snapshot().turns[0].targets.length===2&&bw.snapshot().exchanges.every(e=>e.submitState==="submitted"&&e.acquisitionState==="complete"&&e.saveState==="saved")'));
 if (panelLayout) {
  check('explicit-native-send-reveals-only-its-bound-narrow-targets', await c.evaluate('!bw.snapshot().tasks[0].panelLayout.maximized&&bw.snapshot().tasks[0].panelLayout.focused===bw.snapshot().tasks[0].targets[1].id'));
  await c.send('Emulation.clearDeviceMetricsOverride');
 }
 await guest(2, 'document.querySelector("#fixture-blocker").remove();true');
 for (let index = 0; index < 3; index++) { await click(button('New website conversation', row(index))); await until('!bw.busy(taskId)&&!bw.snapshot().tasks[0].targets[' + index + '].conversationId'); }
 for (let round = 0; round < 3; round++) {
  await type(root + '.querySelector("textarea")', round === 1 ? 'Long follow up' : 'First question\nSecond line');
  for (let index = 1; index < 3; index++) await guest(index, 'window.fixtureLongAnswer=' + (round === 1) + ';true');
  await preview();
  check('round-' + round + '-preview-lists-three-without-staging', await c.evaluate(root + '.querySelectorAll(".nand-browser-workspace-preview li").length===3') && json(await counts()) === json([round * 2, round * 2, round * 2]));
  const started = Date.now(); await send(round + 2);
  const data = await c.evaluate('(()=>{const d=bw.snapshot(),t=d.turns.at(-1);return{turn:t,exchanges:d.exchanges.filter(e=>e.turnId===t.id)}})()');
  check('round-' + round + '-all-three-receipts-captures-and-save-states', data.exchanges.length === 3 && data.exchanges.every(e => e.submitState === 'submitted' && e.acquisitionState === (domOnly && e.targetId === data.turn.targets[2].id ? 'incomplete' : 'complete') && e.saveState === 'saved' && e.attempts.length === 1 && e.captures.length === 1), { elapsedMs: Date.now() - started, exchanges: data.exchanges });
  check('round-' + round + '-exact-native-submit-counts', json(await counts()) === json([(round + 1) * 2, (round + 1) * 2, (round + 1) * 2]));
  check('round-' + round + '-private-and-inactive-content-excluded', !/Private reasoning|Private tool|Inactive branch|fixture-only/.test(json(data)));
  if (round === 1) check('long-answers-remain-over60k', data.exchanges.slice(1).every(e => e.captures[0].markdown.length > 60000));
 }
 await runtime.shot('three-provider-answers');
 const comparison = root + '.querySelector(".nand-browser-workspace-turn .nand-browser-answer-comparison")';
 for (let index = 0; index < 3; index++) await click(comparison + '.querySelectorAll("input")[ ' + index + ']');
 await click(button('Compare answers', comparison));
 await until(comparison + '.querySelectorAll(".nand-browser-answer-grid>section").length===3');
 check('comparison-aligns-three-exact-captures-with-source-and-unknown-model', await c.evaluate('[...' + comparison + '.querySelectorAll(".nand-browser-answer-grid>section")].every(e=>e.textContent.includes("Capture 1")&&(e.textContent.includes("Website conversation data")||e.textContent.includes("Website copy control"))&&e.textContent.includes("Not verified")&&e.querySelector(".nand-browser-answer table"))'));
 const sourceRows = await c.evaluate('bw.snapshot().exchanges.filter(e=>e.turnId===bw.snapshot().turns.at(-1).id)');
 for (let index = 0; index < 3; index++) {
  const savedCapture = sourceRows[index].captures[0];
  await guest(index, 'window.scrollTo(0,0);true');
  const sourceButton = '[...' + root + '.querySelector(".nand-browser-workspace-turn").querySelectorAll("button")].filter(e=>e.textContent==="Open original answer")[' + index + ']';
  await click(sourceButton); await until('!' + sourceButton + '.disabled');
  check('original-answer-' + index + '-reveals-exact-public-message-without-submit', await guest(index, '(()=>{const e=document.querySelector("[data-message-id=\\"' + savedCapture.messageId + '\\"]"),r=e?.getBoundingClientRect();return !!r&&r.bottom>0&&r.top<innerHeight})()') && json(await counts()) === '[6,6,6]' && await c.evaluate('bc.list().length===3'));
 }
 const sourceId = sourceRows[0].captures[0].messageId;
 await guest(0, 'document.querySelector("[data-message-id=\\"' + sourceId + '\\"]").dataset.messageId="unrelated-public-answer";true');
 check('original-answer-missing-identity-does-not-guess-from-text', await c.evaluate('bw.openAnswer(' + json(sourceRows[0].id) + ',' + json(sourceRows[0].captures[0].id) + ').then(()=>false,e=>e.code==="browser_workspace_source_not_loaded")'));
 await guest(0, 'document.querySelector("[data-message-id=unrelated-public-answer]").dataset.messageId=' + json(sourceId) + ';true');
 for (const preset of ['system', 'claude-code', 'eye-care']) for (const dark of [false, true]) for (const width of [500, 800, 1500]) {
  await c.evaluate(p + '.theme.update(d=>{d.preset=' + json(preset) + '});app.changeTheme(' + json(dark ? 'obsidian' : 'moonstone') + ');true');
  await c.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false }); await delay(120);
  const layout = await c.evaluate('(()=>{const e=' + root + ';return{width:e.clientWidth,scroll:e.scrollWidth,small:[...e.querySelectorAll("button,select,input:not([type=checkbox])")].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().height<32).length}})()');
  check('multitarget-' + preset + '-' + (dark ? 'dark' : 'light') + '-' + width, layout.width > 0 && layout.scroll <= layout.width + 1 && layout.small === 0, layout);
  if (preset === 'system' && !dark && width === 500) await runtime.shot('multitarget-light-500');
 }
 await c.send('Emulation.setTouchEmulationEnabled', { enabled: true });
 await c.send('Emulation.setDeviceMetricsOverride', { width: 500, height: 1000, deviceScaleFactor: 1, mobile: true }); await delay(120);
 check('coarse-multitarget-controls-are44', await c.evaluate('matchMedia("(pointer:coarse)").matches&&[...' + root + '.querySelectorAll("button,select,.nand-browser-workspace-actions>label")].every(e=>!e.getClientRects().length||e.getBoundingClientRect().height>=44)'));
 await click(comparison + '.querySelectorAll(".nand-browser-comparison-focus button")[1]');
 check('narrow-comparison-shows-one-keyboard-accessible-target', await c.evaluate('(()=>{const e=' + comparison + ',rows=[...e.querySelectorAll(".nand-browser-answer-grid>section")];return rows.filter(r=>r.getClientRects().length).length===1&&rows[1].getClientRects().length>0&&e.querySelectorAll(".nand-browser-comparison-focus button")[1].getAttribute("aria-pressed")==="true"})()'));
 await runtime.shot('comparison-narrow');
 await c.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await c.send('Emulation.clearDeviceMetricsOverride');
 await c.evaluate(p + '.theme.update(d=>{d.preset="system"});app.changeTheme("moonstone");true');
 // Site behavior changes after preview: a pre-existing human draft must block the entire group.
 await type(root + '.querySelector("textarea")', 'Draft protection'); await preview();
 await guest(1, 'document.querySelector(".fixture-composer").textContent="Human draft";true');
 await send(5);
 check('draft-after-preview-blocks-all-native-submissions', json(await counts()) === '[6,6,6]' && await guest(1, 'document.querySelector(".fixture-composer").innerText==="Human draft"'));
 await guest(1, 'document.querySelector(".fixture-composer").replaceChildren();true');
 // Failure during second staging rolls back only the first owned draft; the changed second draft remains.
 await type(root + '.querySelector("textarea")', 'Stage failure'); await preview();
 await guest(1, 'document.querySelector(".fixture-composer").addEventListener("input",function(){this.textContent="Human replacement"},{once:true});true');
 await send(6);
 check('stage-failure-submits-none-and-keeps-human-replacement', json(await counts()) === '[6,6,6]' && await guest(0, 'document.querySelector(".fixture-composer").value===""') && await guest(1, 'document.querySelector(".fixture-composer").innerText==="Human replacement"'));
 await guest(1, 'document.querySelector(".fixture-composer").replaceChildren();true');
 await guest(2, 'window.fixtureSend=document.querySelector("#submit").onclick;document.querySelector("#submit").onclick=()=>{window.fixtureUnknownDispatches=(window.fixtureUnknownDispatches??0)+1;document.querySelector(".fixture-composer").replaceChildren()};true');
 await type(root + '.querySelector("textarea")', 'One unconfirmed website'); await preview(); await send(7);
 const partial = await c.evaluate('bw.snapshot().exchanges.filter(e=>e.turnId===bw.snapshot().turns.at(-1).id)');
 check('one-unknown-keeps-two-successes-with-no-group-resend', partial.slice(0, 2).every(e => e.submitState === 'submitted' && e.acquisitionState === 'complete' && e.attempts.length === 1) && partial[2].submitState === 'unknown' && partial[2].attempts.length === 1 && !partial[2].receipt && json(await counts()) === '[8,8,6]' && await guest(2, 'fixtureUnknownDispatches===1'), partial);
 check('unknown-exchange-cannot-be-recollected-by-guessing', await c.evaluate('bw.recollect(' + json(partial[2].id) + ').then(()=>false,e=>e.code==="browser_workspace_submission_identity")'));
 await guest(2, 'document.querySelector("#submit").onclick=window.fixtureSend;true');
 const retryTurn = root + '.querySelector(".nand-browser-workspace-turn")';
 await click(button('Review resend', retryTurn));
 await until('!!' + retryTurn + '.querySelector(".nand-browser-workspace-preview")');
 check('resend-preview-freezes-original-prompt-and-warns-about-duplicates-without-input', await c.evaluate(retryTurn + '.querySelector(".nand-browser-workspace-preview pre").textContent==="One unconfirmed website"&&' + retryTurn + '.querySelector(".nand-browser-workspace-preview").textContent.includes("Resending can create a duplicate")&&bw.snapshot().exchanges.find(e=>e.id===' + json(partial[2].id) + ').attempts.length===1') && json(await counts()) === '[8,8,6]');
 await type(root + '.querySelector("textarea")', 'A different next question');
 check('editing-task-clears-the-resend-preview', await c.evaluate('!' + retryTurn + '.querySelector(".nand-browser-workspace-preview")'));
 await click(button('Review resend', retryTurn)); await until('!!' + retryTurn + '.querySelector(".nand-browser-workspace-preview")');
 await c.send('Emulation.setTouchEmulationEnabled', { enabled: true });
 await c.send('Emulation.setDeviceMetricsOverride', { width: 500, height: 1000, deviceScaleFactor: 1, mobile: true }); await delay(120);
 check('resend-preview-fits-narrow-touch-layout', await c.evaluate('(()=>{const e=' + retryTurn + '.querySelector(".nand-browser-workspace-preview");return e.scrollWidth<=e.clientWidth+1&&e.querySelector("button").getBoundingClientRect().height>=44})()'));
 await runtime.shot('explicit-resend-500');
 await c.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await c.send('Emulation.clearDeviceMetricsOverride');
 await click(button('Resend to this target', retryTurn));
 await until('!bw.busy(taskId)&&bw.snapshot().exchanges.find(e=>e.id===' + json(partial[2].id) + ').attempts.length===2');
 const retried = await c.evaluate('bw.snapshot().exchanges.filter(e=>e.turnId===' + json(partial[2].turnId) + ')');
 assert.deepEqual(retried.slice(0, 2), partial.slice(0, 2), 'Successful targets remain unchanged after disk refresh');
 check('explicit-resend-creates-one-attempt-and-keeps-both-successful-targets', retried[2].attempts.length === 2 && retried[2].attempts[0].outcome === 'unknown' && retried[2].attempts[1].outcome === 'accepted' && retried[2].acquisitionState === (domOnly ? 'incomplete' : 'complete') && json(await counts()) === '[8,8,8]', retried);
 check('resend-keeps-seven-original-turns-and-next-draft', await c.evaluate('bw.snapshot().turns.length===7&&bw.snapshot().tasks[0].draft==="A different next question"&&bw.snapshot().turns.at(-1).finalPrompt==="One unconfirmed website"'));
 for (let index = 0; index < 3; index++) await guest(index, 'window.fixtureDelay=60000;true');
 await type(root + '.querySelector("textarea")', 'Pause and take over'); await preview(); await click(button('Send this preview'));
 await until('bw.snapshot().turns.length===8&&bw.snapshot().exchanges.filter(e=>e.turnId===bw.snapshot().turns.at(-1).id).every(e=>e.submitState==="submitted")&&bw.busy(taskId)');
 await click(row(0) + '.querySelectorAll("input[type=checkbox]")[1]');
 await until('!bw.snapshot().tasks[0].visibleTargetIds.includes(bw.snapshot().tasks[0].targets[0].id)');
 check('visibility-stays-editable-during-capture-with-recipients-unchanged', await c.evaluate('bw.busy(taskId)&&bw.snapshot().tasks[0].selectedTargetIds.length===3&&!bw.snapshot().tasks[0].visibleTargetIds.includes(bw.snapshot().tasks[0].targets[0].id)'));
 if (panelLayout) {
  const thirdSlot=root+'.querySelectorAll(".nand-browser-panel-slot")[2]';
  await click(button('Move panel earlier',thirdSlot));await until('!'+button('Move panel later',thirdSlot)+'.disabled');
  await click(button('Move panel later',thirdSlot));
  check('panel-reorder-during-capture-keeps-three-receipts-and-no-extra-input', await c.evaluate('bw.busy(taskId)&&bw.snapshot().tasks[0].selectedTargetIds.length===3')&&json(await counts())==='[9,9,9]');
 }
 const target = await c.evaluate('bw.snapshot().tasks[0].targets[0].page');
 await c.evaluate('window.focusSentinel=document.createElement("input");document.body.append(focusSentinel);focusSentinel.focus();true');
 await c.evaluate('bc.observe(' + json(target) + ')');
 check('background-read-during-task-keeps-host-focus', await c.evaluate('document.activeElement===focusSentinel'));
 for (const action of ['bc.act(' + json(target) + ',{kind:"reload"})', 'bc.activate(' + json(target) + ')', 'bc.close(' + json(target) + ')'])
  check('task-excludes-external-' + action.split('(')[0], await c.evaluate(action + '.then(()=>false,e=>e.code==="browser_workspace_busy")'));
 const blocked = await cli('reload', '--page', target.pageId, '--profileId', target.profileId, '--generation', target.generation);
 check('authenticated-bridge-mutation-shares-task-admission', blocked.ok === false && blocked.error?.code === 'browser_workspace_busy', blocked);
 await c.evaluate('focusSentinel.remove();true');
 await click(button('Pause and use page', row(0))); await until('!bw.busy(taskId)&&!document.querySelector(".nand-browser-workspace-pane").hidden');
 await delay(200);
 check('takeover-keeps-three-known-receipts-with-incomplete-acquisition', await c.evaluate('bw.snapshot().exchanges.filter(e=>e.turnId===bw.snapshot().turns.at(-1).id).every(e=>e.submitState==="submitted"&&e.acquisitionState==="incomplete"&&e.attempts.length===1)'));
 const observation = await c.evaluate('bc.observe(' + json(target) + ')'), composer = observation.refs.find(ref => ref.name === 'DeepSeek');
 assert.ok(composer, 'composer ref after takeover: ' + json(observation));
 await c.evaluate('bc.act(' + json(target) + ',{kind:"fill",ref:' + json({ revision: observation.revision, element: composer.ref }) + ',value:"Manual after takeover"})');
 await delay(700);
 check('manual-input-after-takeover-survives-old-task-cleanup', await guest(0, 'document.querySelector(".fixture-composer").value==="Manual after takeover"') && json(await counts()) === '[9,9,9]');
 const report = await c.evaluate('bw.resume(taskId)');
 check('resume-rechecks-three-without-resending-or-overwriting-draft', report.length === 3 && report.every(check => check.state !== 'ready') && json(await counts()) === '[9,9,9]' && await guest(0, 'document.querySelector(".fixture-composer").value==="Manual after takeover"'));
 const stopObservation = await c.evaluate('bc.observe(' + json(target) + ')'), stop = stopObservation.refs.find(ref => ref.name === 'Stop');
 await c.evaluate('bc.act(' + json(target) + ',{kind:"click",ref:' + json({ revision: stopObservation.revision, element: stop.ref }) + '})');
 const saved = await c.evaluate('(()=>{const d=bw.snapshot();return d.exchanges.find(e=>e.turnId===d.turns[3].id&&e.targetId===d.tasks[0].targets[0].id)})()');
 const earlierTurn = root + '.querySelectorAll(".nand-browser-workspace-turn")[4]';
 await click(button('Collect this answer again', earlierTurn));
 await until('!bw.busy(taskId)&&bw.snapshot().exchanges.find(e=>e.id===' + json(saved.id) + ').captures.length===2');
 const recollected = await c.evaluate('bw.snapshot().exchanges.find(e=>e.id===' + json(saved.id) + ')');
 check('native-recollect-keeps-old-complete-and-makes-new-partial-current', recollected.captures[0].complete && !recollected.captures[1].complete && recollected.acquisitionState === 'incomplete' && recollected.currentCaptureId === recollected.captures[1].id && json(recollected.receipt) === json(saved.receipt));
 check('recollect-adds-no-attempt-and-keeps-human-draft', recollected.attempts.length === saved.attempts.length && json(await counts()) === '[10,9,9]' && await guest(0, 'document.querySelector(".fixture-composer").value==="Manual after takeover"'));
 check('open-comparison-keeps-explicit-older-revision-when-current-becomes-partial', await c.evaluate(earlierTurn + '.querySelector(".nand-browser-answer-grid>section").textContent.includes("Earlier version")&&' + earlierTurn + '.querySelector(".nand-browser-answer-grid>section").textContent.includes("Capture 1")'));
 await click(earlierTurn + '.querySelector(".nand-browser-capture-history>summary")');
 await until('!!' + earlierTurn + '.querySelector(".nand-browser-capture-history .nand-browser-answer table")');
 check('earlier-complete-capture-is-explicitly-viewable', await c.evaluate(earlierTurn + '.querySelector(".nand-browser-capture-history").open&&' + earlierTurn + '.querySelector(".nand-browser-capture-history h5").textContent.includes("Complete")&&!!' + earlierTurn + '.querySelector(".nand-browser-capture-history .nand-browser-answer table")'));
 await key('Enter', 'Enter', 13, '\r'); await until('!' + earlierTurn + '.querySelector(".nand-browser-capture-history").open');
 check('capture-history-keyboard-collapse-unmounts-old-markdown', await c.evaluate('!' + earlierTurn + '.querySelector(".nand-browser-capture-history .nand-browser-answer")'));
 await key('Enter', 'Enter', 13, '\r'); await until('!!' + earlierTurn + '.querySelector(".nand-browser-capture-history .nand-browser-answer table")');
 await c.send('Emulation.setTouchEmulationEnabled', { enabled: true });
 await c.send('Emulation.setDeviceMetricsOverride', { width: 500, height: 1000, deviceScaleFactor: 1, mobile: true }); await delay(120);
 check('capture-history-has44px-touch-target', await c.evaluate(earlierTurn + '.querySelector(".nand-browser-capture-history>summary").getBoundingClientRect().height>=44'));
 await runtime.shot('capture-history-500');
 await c.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await c.send('Emulation.clearDeviceMetricsOverride');
 await c.evaluate('window.focusSentinel=document.createElement("input");document.body.append(focusSentinel);focusSentinel.focus();true');
 await c.evaluate('bw.recollect(' + json(saved.id) + ')');
 check('api-recollect-does-not-focus-guest-or-submit', await c.evaluate('document.activeElement===focusSentinel') && json(await counts()) === '[10,9,9]');
 await c.evaluate('focusSentinel.remove();true');
 const beforeFollowUp = await c.evaluate('bw.snapshot().tasks[0]');
 await click(button('Ask this target', earlierTurn));
 await until('bw.snapshot().tasks[0].selectedTargetIds.length===1&&document.activeElement===' + root + '.querySelector("textarea")');
 check('follow-up-selects-only-one-target-and-preserves-draft-without-sending', await c.evaluate('bw.snapshot().tasks[0].selectedTargetIds[0]===bw.snapshot().tasks[0].targets[0].id&&bw.snapshot().tasks[0].draft===' + json(beforeFollowUp.draft)) && json(await counts()) === '[10,9,9]');
 const clearObservation = await c.evaluate('bc.observe(' + json(target) + ')'), clearComposer = clearObservation.refs.find(ref => ref.name === 'DeepSeek');
 await c.evaluate('bc.act(' + json(target) + ',{kind:"fill",ref:' + json({ revision: clearObservation.revision, element: clearComposer.ref }) + ',value:""})');
 await guest(0, 'window.fixtureDelay=0;true');
 await type(root + '.querySelector("textarea")', 'Only DeepSeek follow-up'); await preview(); await send(9);
 check('native-follow-up-submits-once-to-selected-site-and-creates-one-exchange', await c.evaluate('(()=>{const d=bw.snapshot(),t=d.turns.at(-1),e=d.exchanges.filter(e=>e.turnId===t.id);return t.targets.length===1&&t.targets[0].id===d.tasks[0].targets[0].id&&t.finalPrompt==="Only DeepSeek follow-up"&&e.length===1&&e[0].submitState==="submitted"&&e[0].attempts.length===1})()') && json(await counts()) === '[12,9,9]');
 await guest(0, 'window.fixtureMarkdown="Thinking...";true');
 await type(root + '.querySelector("textarea")', 'Status-only quality check'); await preview(); await send(10);
 check('status-only-native-capture-keeps-body-but-is-incomplete', await c.evaluate('(()=>{const e=bw.snapshot().exchanges.at(-1),c=e.captures.at(-1);return e.submitState==="submitted"&&e.acquisitionState==="incomplete"&&c.markdown==="Thinking..."&&c.reasons.includes("status-only")})()'));
 await guest(0, 'window.fixtureMarkdown="# Conversation title";window.fixtureBaseHistory=window.fixtureHistory;window.fixtureHistory=()=>{const value=fixtureBaseHistory();value.data.biz_data.chat_session.title="Conversation title";return value};true');
 await type(root + '.querySelector("textarea")', 'Title-only quality check'); await preview(); await send(11);
 check('title-only-native-capture-keeps-body-but-is-incomplete', await c.evaluate('(()=>{const e=bw.snapshot().exchanges.at(-1),c=e.captures.at(-1);return e.submitState==="submitted"&&e.acquisitionState==="incomplete"&&c.markdown==="# Conversation title"&&c.reasons.includes("title-only")})()'));
 const turnCount = await c.evaluate('bw.snapshot().turns.length'), exchangeCount = await c.evaluate('bw.snapshot().exchanges.length');
 await click(button('Remove target', row(2))); await until('bw.snapshot().tasks[0].targets.length===2&&bc.list().length===2');
 check('removing-target-preserves-all-historical-exchanges', await c.evaluate('bw.snapshot().turns.length===' + turnCount + '&&bw.snapshot().exchanges.length===' + exchangeCount));
 await c.evaluate('app.workspace.requestSaveLayout();true'); await delay(600); await runtime.restart(); c = runtime.connection; await bind();
 await c.evaluate(p + '.openWorkbench({feature:"browser",section:"multi-ai",resourceId:' + json(taskId) + '},window)'); await until('!!bw.snapshot()&&!!' + root + '.querySelector("textarea")');
 check('restart-restores-independent-results-without-guests-or-resubmission', await c.evaluate('bc.list().length===0&&bw.snapshot().turns.length===' + turnCount + '&&bw.snapshot().exchanges.length===' + exchangeCount + '&&bw.snapshot().tasks[0].targets.length===2'));
 if (panelLayout) check('restart-preserves-panel-order-width-focus-and-prunes-removed-target', await c.evaluate('JSON.stringify(bw.snapshot().tasks[0].panelLayout)===' + json(json({ ...panelLayout, order: panelLayout.order.filter(id => id !== panelLayout.order[2]) }))));
 check('restart-preserves-recollection-history-and-current-partial', await c.evaluate('(()=>{const e=bw.snapshot().exchanges.find(e=>e.id===' + json(saved.id) + ');return e.captures.length===3&&e.captures[0].complete&&e.acquisitionState==="incomplete"&&e.currentCaptureId===e.captures[2].id})()'));
 if(process.argv.includes('--delivery'))c=await exerciseWorkspaceDelivery({c,p,root,click,type,until,button,check,runtime,taskId});
 const errors = [...hostErrors, ...await c.evaluate('window.nandAcceptanceErrors??[]')]; check('no-host-errors', errors.length === 0, errors);
 await fs.writeFile(path.join(runtime.evidence, 'result.json'), json({ method: 'Production UI/services/native input with three local HTTPS fixtures; no live provider account or real-site gate claim.', rows }, null, 2));
} catch (error) {
 if (runtime) {
  c=runtime.connection;
  await runtime.shot('failure').catch(() => undefined);
  await fs.writeFile(path.join(runtime.evidence, 'partial.json'), json({ rows, error: String(error), hostErrors,
   state: await c.evaluate('({data:window.bw?.snapshot(),body:document.body.innerText,active:document.activeElement?.outerHTML.slice(0,1000),interceptError:window.fixtureInterceptError,errors:window.nandAcceptanceErrors})').catch(String),
   guests: await c.evaluate('Promise.all((window.fixtureGuests??[]).map(g=>g.executeJavaScript("({events:window.fixtureEvents,count:fixtureCount(),value:document.querySelector(\'.fixture-composer\').value??document.querySelector(\'.fixture-composer\').innerText,html:document.querySelector(\'.fixture-composer\').outerHTML})").catch(String)))').catch(String) }, null, 2));
 }
 throw error;
} finally {
 if (runtime) { console.log(json({ evidence: runtime.evidence, checks: rows.length, failed: rows.filter(row => !row.passed) })); await runtime.stop(); }
}
