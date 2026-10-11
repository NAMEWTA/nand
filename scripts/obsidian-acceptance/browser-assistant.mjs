// Real production UI, documents, run-context resolver, local bridge and Electron guests.
// The public agent owner is an explicit fixture; no real CLI/account interoperability claim.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { inspectLayout } from './workspace-history.mjs';

const server = createServer((request, response) => {
 response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
 response.end(`<!doctype html><title>Form ${request.url === '/b' ? 'B' : 'A'}</title><h1>Local assistant form</h1><form action="/publish" method="post"><label>Draft<textarea name="draft">Original draft</textarea></label><button type="submit">Publish locally</button><output>0</output></form><script>window.submissions=0;document.querySelector('form').onsubmit=e=>{e.preventDefault();document.querySelector('output').textContent=String(++submissions)}</script>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`, p = 'app.plugins.plugins.nand', rows = [], errors = [], json = JSON.stringify;
const root = '[...document.querySelectorAll(".nand-browser-assistant")].find(e=>e.getBoundingClientRect().width>0)';
const banner = '[...document.querySelectorAll(".nand-browser-assistant-banner")].find(e=>e.getBoundingClientRect().width>0)';
const button = (label, scope = root) => '[...' + scope + '.querySelectorAll("button")].find(e=>e.textContent===' + json(label) + ')';
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
let runtime, c;
const until = async expression => { const end = Date.now() + 25000; while (Date.now() < end) { try { if (await c.evaluate(expression)) return; } catch {} await delay(70); } throw Error(expression); };
const click = async expression => {
 await c.send('Page.bringToFront'); await c.evaluate('window.focus();' + expression + '.scrollIntoView({block:"center",inline:"center"});true'); await delay(150);
 const point = await c.evaluate('(()=>{const r=' + expression + '.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
 await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
 await until('(()=>{const e=' + expression + ',r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()');
 for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
};
const type = async (expression, text) => { await click(expression); for (const type of ['keyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 }); await c.send('Input.insertText', { text }); };
const select = async expression => { await click(expression); for (const [key, code] of [['ArrowDown', 40], ['Enter', 13]]) for (const type of ['keyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type, key, windowsVirtualKeyCode: code }); };
const bind = async () => { c = runtime.connection; c.on('Runtime.exceptionThrown', value => errors.push(value.exceptionDetails)); await c.send('Runtime.enable'); await c.evaluate(`window.ba=${p}.services.peek({owner:'browser',id:'assistant'});window.bc=${p}.services.peek({owner:'browser',id:'control'});app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();true`); };
const guest = (id, expression) => c.evaluate(`document.querySelector('[data-page-id="${id}"] webview').executeJavaScript(${json(expression)})`);

async function installOwner() {
 const plugin = app.plugins.plugins.nand, services = plugin.registry.services, original = services.peek;
 window.ownerCalls = []; window.ownerPastes = []; window.ownerChecks = []; window.ownerBefore = []; window.ownerMode = 'fill-wait'; window.ownerPhase = '';
 const providers = await plugin.registry.contributionAccess.collect({ owner: 'agent', id: 'run-contexts' });
 const provider = providers.find(row => row.module === 'browser')?.value;
 if (!provider) throw Error('Browser context provider not registered');
 window.unknownContext = await provider.resolve('unknown-handle', { runId: 'unknown', cwd: '/fixture', signal: new AbortController().signal });
 const runner = { run: async request => {
  ownerCalls.push({ prompt: request.prompt, agentId: request.agentId, purpose: request.purpose, channel: request.resultChannel, context: request.runContext });
  ownerPhase = 'context'; const lease = await provider.resolve(request.runContext.handle, { runId: 'fixture-' + ownerCalls.length, cwd: app.vault.adapter.getBasePath(), signal: request.signal });
  if (!lease) throw Error('Missing context lease');
  const env = lease.env, meta = JSON.parse(require('node:fs').readFileSync(env.NAND_BROWSER_CONTEXT, 'utf8'));
  window.scopeToken = env.NAND_BROWSER_TOKEN;
  ownerChecks.push({ oneUse: await provider.resolve(request.runContext.handle, { runId: 'replay', cwd: '/', signal: new AbortController().signal }) === undefined,
   noPromptCredential: !request.prompt.includes(env.NAND_BROWSER_TOKEN) });
  const rpc = (method, params) => new Promise((resolve, reject) => {
   const socket = require('node:net').createConnection(meta.endpoint); let data = '', settled = false;
   const finish = (error, value) => { if (settled) return; settled = true; socket.destroy(); if (error) reject(error); else resolve(value); };
   socket.setEncoding('utf8'); socket.setTimeout(70000, () => finish(Error('fixture RPC timeout')));
   socket.on('error', error => finish(error)); socket.on('close', () => { if (!settled) finish(Error('fixture connection closed')); });
   socket.on('connect', () => socket.write(JSON.stringify({ id: 'fixture', token: env.NAND_BROWSER_TOKEN, method, params }) + '\n'));
   socket.on('data', chunk => { data += chunk; if (!data.includes('\n')) return; const reply = JSON.parse(data.split('\n')[0]);
    if (reply.ok) finish(undefined, reply.result); else finish(Object.assign(Error(reply.error.message), { code: reply.error.code })); });
  });
  window.lastScopedTool = rpc;
  try {
   request.onState?.({ status: 'running', terminalId: 'fixture-terminal' });
   const rejected = [];
   for (const [method, params] of [['snapshot', { page: outside.pageId }], ['snapshot', { page: allowed.pageId, profileId: 'wrong-account' }], ['eval', { page: allowed.pageId }]])
    rejected.push(await rpc(method, params).then(() => false, error => error.code === 'browser_scoped_grant_scope'));
   ownerChecks.push({ rejected });
   await rpc('tab.switch', { page: allowed.pageId });
   const before = await rpc('snapshot', { page: allowed.pageId }), input = before.refs.find(ref => ref.name === 'Draft');
   ownerBefore.push((await rpc('get', { page: allowed.pageId, revision: before.revision, element: input.ref })).value);
   await rpc('fill', { page: allowed.pageId, revision: before.revision, element: input.ref, value: 'Agent reviewed draft ' + ownerCalls.length });
   const after = await rpc('snapshot', { page: allowed.pageId }); ownerPhase = 'filled';
   if (ownerMode === 'fill-wait') {
    request.onState?.({ status: 'needs-attention', terminalId: 'fixture-terminal' });
    await new Promise(resolve => { if (request.signal.aborted) resolve(); else request.signal.addEventListener('abort', resolve, { once: true }); });
    return { status: 'cancelled', text: 'Draft was filled. Control returned to the user.' };
   }
   if (ownerMode === 'confirm') {
    ownerPhase = 'confirming';
    try { await rpc('click', { page: allowed.pageId, revision: after.revision, element: after.refs.find(ref => ref.name === 'Publish locally').ref }); }
    catch (error) { if (error.code !== 'browser_action_denied') throw error; return { status: 'succeeded', text: 'User declined; no submission was sent.' }; }
    const result = await rpc('snapshot', { page: allowed.pageId });
    return { status: 'succeeded', text: '# Observed native result\n\n' + result.snapshot };
   }
   if (ownerMode === 'save-failure') window.failAssistantWrite = true;
   return { status: 'succeeded', text: 'Draft filled and observed. Complete native fixture result ' + ownerCalls.length, usage: { input: 21, output: 8, cacheRead: 0, cacheWrite: 0, cost: null, known: true } };
  } catch (error) { return { status: request.signal.aborted ? 'cancelled' : 'failed', text: '', errorCode: error.code ?? 'fixture-error' }; }
  finally { await lease.dispose(); ownerPhase = 'done'; }
 }, open: async () => {} };
 const capabilities = { directory: { list: () => [{ id: 'codex', title: 'Codex fixture', enabled: true, installed: true }] },
  sessions: { list: async () => [{ id: 'manual', title: 'Existing fixture', agentId: 'codex' }], attachMaterial: async () => {} },
  'prompt-runner': runner, dispatch: { dispatch: async request => { ownerPastes.push(request); return { invocationId: request.invocationId, delivery: 'pasted', terminalId: 'manual' }; } } };
 services.peek = key => key.owner === 'agent' ? capabilities[key.id] : original(key); return true;
}

try {
 runtime = await launchFreshVault({ root: process.argv[2], port: 9276, settings: { version: 1, namespaces: { app: { language: 'en', introSeen: true, modules: { browser: true, home: false, agent: false, news: false, archives: false, sync: false, comments: false, notifications: false, automations: false, icons: false } } } } }); await bind();
 check('assistant-facade-is-registered-but-not-initialized', await c.evaluate('!!ba&&ba.snapshot()===undefined'));
 await c.evaluate(`(async()=>{window.allowed=await bc.open({url:${json(url + '/a')}});window.outside=await bc.open({url:${json(url + '/b')}})})()`);
 const allowed = await c.evaluate('allowed'), outside = await c.evaluate('outside');
 await click('[...document.querySelectorAll(".nand-panel .nand-list-item")].find(e=>e.textContent.trim()==="Web assistant"&&e.getClientRects().length)'); await until('!!' + root + '&&!!ba.snapshot()');
 check('registered-navigation-opens-opt-in-off', await c.evaluate('!' + root + '.querySelector("input[type=checkbox]").checked&&!' + root + '.querySelector("select")'));
 await click(root + '.querySelector("input[type=checkbox]").closest("label")'); await until(root + '.textContent.includes("Enable the Agent module")');
 await c.evaluate('(' + installOwner.toString() + ')()'); check('unknown-context-does-not-mint-authority', await c.evaluate('unknownContext===undefined'));
 await click(button('Refresh pages and agents')); await until(root + '.querySelectorAll("select")[1].options.length===2'); await select(root + '.querySelectorAll("select")[1]');
 await type(root + '.querySelector("input[type=text]")', 'Native assistant draft'); await type(root + '.querySelector("textarea")', 'Fill the selected local form and wait for takeover.');
 await click('[...' + root + '.querySelector("fieldset").querySelectorAll("label")].find(e=>e.textContent.includes(' + json(url + '/a') + '))');
 await click(button('Review task and scope')); await until('!!' + root + '.querySelector("[data-assistant-preview]")');
 check('scope-preview-has-only-selected-page-and-no-owner-call', await c.evaluate('ownerCalls.length===0&&' + root + '.querySelector("[data-assistant-preview]").textContent.includes(' + json(url + '/a') + ')&&!' + root + '.querySelector("[data-assistant-preview]").textContent.includes(' + json(url + '/b') + ')'));
 await inspectLayout({ c, p, root, runtime, check }, 'assistant-preview', root + '.querySelector("[data-assistant-preview]")');
 await click(button('Authorize and start once')); await until('ownerPhase==="filled"&&!!' + banner);
 check('actual-scoped-bridge-filled-only-selected-guest', await guest(allowed.pageId, 'document.querySelector("textarea").value') === 'Agent reviewed draft 1' && await guest(outside.pageId, 'document.querySelector("textarea").value') === 'Original draft');
 check('run-handle-is-one-use-and-scope-rejects-other-page-account-and-eval', await c.evaluate('ownerChecks.every(row=>row.rejected?row.rejected.every(Boolean):row.oneUse&&row.noPromptCredential)'));
 check('ordinary-control-cannot-steal-active-page-lease', await c.evaluate(`(async()=>{const o=await bc.observe(allowed);return bc.act(allowed,{kind:'fill',ref:{revision:o.revision,element:o.refs.find(r=>r.name==='Draft').ref},value:'Must not happen'}).then(()=>false,e=>e.code==='browser_workspace_busy')})()`));
 await click(button('Take over this page', banner)); await until('ownerPhase==="done"&&ba.snapshot()[0].status==="paused"');
 check('takeover-revokes-run-credential', await c.evaluate(`lastScopedTool('snapshot',{page:allowed.pageId}).then(()=>false,e=>e.code==='browser_unauthorized')`));
 await c.evaluate(`(async()=>{const o=await bc.observe(allowed);await bc.act(allowed,{kind:'fill',ref:{revision:o.revision,element:o.refs.find(r=>r.name==='Draft').ref},value:'Manual takeover draft'})})()`);
 const firstId = await c.evaluate('ba.snapshot()[0].id');
 await c.evaluate(`${p}.openWorkbench({feature:'browser',section:'assistant',resourceId:${json(firstId)}},window)`); await until('!!' + button('Review a new run'));
 await click(button('Review a new run')); await until('!!' + button('Review task and scope') + '&&!'+button('Review task and scope')+'.disabled');
 await click('[...' + root + '.querySelectorAll("fieldset")[1].querySelectorAll("label")].find(e=>e.textContent==="Click after confirmation")');
 await c.evaluate('window.ownerMode="confirm";true'); await click(button('Review task and scope')); await until('!!' + button('Authorize and start once')); await click(button('Authorize and start once'));
 await until('!!' + banner + '&&!!' + banner + '.querySelector("[data-action-review]")');
 check('new-reviewed-run-reobserves-manual-draft', await c.evaluate('ownerCalls.length===2&&ownerBefore[1]==="Manual takeover draft"'));
 check('consequence-shows-exact-current-content-and-destination', await c.evaluate(banner + '.textContent.includes("Agent reviewed draft 2")&&' + banner + '.textContent.includes(' + json(url + '/publish') + ')'));
 await inspectLayout({ c, p, root: banner, runtime, check }, 'assistant-consequence', banner + '.querySelector("[data-action-review]")');
 await click(button('Decline this action', banner)); await until('ownerPhase==="done"&&ba.snapshot().some(t=>t.status==="succeeded")');
 check('declined-consequence-has-zero-page-submissions', await guest(allowed.pageId, 'submissions') === 0);
 check('declined-action-saved-with-exact-native-step-state', await c.evaluate('ba.snapshot().some(task=>task.steps.some(step=>step.state==="denied"))'));
 const taskFiles = (await fs.readdir(path.join(runtime.vault, 'NAND/AI Workspace/网页助手'))).filter(file => file.endsWith('.md'));
 const markdown = await Promise.all(taskFiles.map(file => fs.readFile(path.join(runtime.vault, 'NAND/AI Workspace/网页助手', file), 'utf8')));
 check('tasks-and-results-live-in-independent-markdown', markdown.length === 2 && markdown.some(text => text.includes('Manual takeover draft')) && markdown.every(text => text.includes('<!-- nand:goal -->')));
 check('credentials-absent-from-visible-task-files', await c.evaluate('(async()=>{const files=app.vault.getMarkdownFiles().filter(file=>file.path.includes("网页助手/"));return(await Promise.all(files.map(file=>app.vault.read(file)))).every(text=>!text.includes(scopeToken))})()'));
 await c.evaluate(`${p}.openWorkbench({feature:'browser',section:'assistant'},window)`); await until('!!' + root);
 await inspectLayout({ c, p, root, runtime, check }, 'assistant-result', root + '.querySelector("[data-assistant-record]")');
 const startAnother = async mode => {
  await c.evaluate(`(async()=>{ownerMode=${json(mode)};const last=ba.snapshot().find(t=>t.operations.includes('click'));window.nextReview=await ba.review({title:'Native lifecycle '+(ownerCalls.length+1),goal:'Fill the local test draft and report.',targets:[allowed],operations:last.operations,maxOperations:40,timeoutMs:600000,destination:{kind:'automatic',agentId:'codex'}});void ba.start(nextReview.id).catch(e=>{window.expectedSaveError=e.code??e.message})})()`);
  await until('ownerPhase==="filled"||ownerPhase==="confirming"||ownerPhase==="done"');
  return c.evaluate('nextReview.id');
 };
 const acceptedId = await startAnother('confirm'); await until('!!'+banner+'&&!!'+banner+'.querySelector("[data-action-review]")');
 const acceptedReview = await c.evaluate('ba.confirmation(nextReview.id).review.id');
 await click(button('Confirm this action once',banner)); await until('!ba.busy('+json(acceptedId)+')');
 check('confirmed-exact-action-submits-once-and-collects-native-observation',await guest(allowed.pageId,'submissions')===1&&await c.evaluate('ba.snapshot().find(t=>t.id==='+json(acceptedId)+').steps.some(s=>s.operation==="click"&&s.state==="returned")'));
 check('completed-confirmation-cannot-be-replayed',await c.evaluate('(()=>{try{ba.decide('+json(acceptedId)+','+json(acceptedReview)+',true);return false}catch(e){return e.code==="browser_action_review_changed"}})()'));
 const changedId = await startAnother('confirm'); await until('!!'+banner+'&&!!'+banner+'.querySelector("[data-action-review]")');
 await guest(allowed.pageId,'document.querySelector("textarea").value="Changed by the human after review"');
 await click(button('Confirm this action once',banner)); await until('!ba.busy('+json(changedId)+')');
 check('changed-material-is-rejected-before-native-submission',await guest(allowed.pageId,'submissions')===1&&await c.evaluate('ba.snapshot().find(t=>t.id==='+json(changedId)+').steps.some(s=>s.errorCode==="browser_action_review_changed")'));
 const beforeManual = await c.evaluate('ownerCalls.length');
 await c.evaluate(`(async()=>{const r=await ba.review({title:'Manual planning only',goal:'Inspect the local draft.',targets:[allowed],operations:['snapshot'],maxOperations:10,timeoutMs:60000,destination:{kind:'existing',agentId:'codex',sessionId:'manual',sessionTitle:'Existing fixture'}});await ba.start(r.id)})()`);
 check('existing-session-remains-pasted-without-owner-run',await c.evaluate('ownerCalls.length==='+beforeManual+'&&ownerPastes.length===1&&ba.snapshot().some(t=>t.status==="pasted"&&t.steps.length===0)'));
 await c.evaluate('window.originalProcess=app.vault.process;app.vault.process=function(file,...args){if(window.failAssistantWrite&&file.path.includes("/网页助手/"))throw Error("Fixture assistant output write failure");return originalProcess.call(this,file,...args)};true');
 const failedId = await startAnother('save-failure'); await until('!ba.busy('+json(failedId)+')&&!!window.expectedSaveError');
 const callsAtFailure = await c.evaluate('ownerCalls.length');
 await c.evaluate(`${p}.openWorkbench({feature:'browser',section:'assistant',resourceId:${json(failedId)}},window)`); await until('!!'+button('Retry saving'));
 check('failed-result-save-keeps-native-output-and-usage-visible',await c.evaluate(root+'.textContent.includes("Complete native fixture result '+callsAtFailure+'")&&'+root+'.textContent.includes("21")'));
 await c.evaluate('window.failAssistantWrite=false;true');await click(button('Retry saving'));await until('!'+button('Retry saving'));
 check('retry-only-saves-without-replaying-native-actions',await c.evaluate('ownerCalls.length==='+callsAtFailure+'&&ba.snapshot().find(t=>t.id==='+json(failedId)+').usage.output===8'));
 await c.evaluate('window.expectedSaveError=undefined;true');const crashId=await startAnother('save-failure');await until('!ba.busy('+json(crashId)+')&&!!window.expectedSaveError');
 const lateText=await c.evaluate('ba.snapshot().find(t=>t.id==='+json(crashId)+').text');
 await c.evaluate(`${p}.openWorkbench({feature:'browser',section:'assistant'},window)`);await until('!!'+root);
 await runtime.crashRestart();await bind();await c.evaluate(`${p}.openWorkbench({feature:'browser',section:'assistant'},window)`);await until('!!'+root+'&&!!ba.snapshot()');
 const restarted=await c.evaluate('({status:ba.snapshot().find(t=>t.id==='+json(crashId)+').status,busy:ba.snapshot().some(t=>ba.busy(t.id)),fixtureRuns:typeof ownerCalls!=="undefined",pages:bc.list().map(p=>p.target.pageId)})');
 check('crash-restart-interrupts-unfinished-intent-without-task-replay',restarted.status==='interrupted'&&!restarted.busy&&!restarted.fixtureRuns,restarted);
 const recovery='document.querySelector("[data-assistant-recovery]")';await click(button('Review local recovery',recovery));await until('!!'+recovery+'.querySelector("[data-recovery-id] button")');
 const recoveryId=await c.evaluate(`(async()=>{const dirs=(await app.vault.adapter.list('.nand/recovery/drafts')).folders.filter(f=>f.includes('browser-assistant-'));for(const dir of dirs)for(const file of(await app.vault.adapter.list(dir)).files){const r=JSON.parse(await app.vault.adapter.read(file));if(r.draft.tasks.some(t=>t.id===${json(crashId)}&&t.text===${json(lateText)}))return file.split('/').pop().replace('.json','')}})()`);
 await click(recovery+'.querySelector('+json('[data-recovery-id="'+recoveryId+'"] button')+')');await until('!!'+button('Restore reviewed draft',recovery));
 await click('[...'+recovery+'.querySelectorAll("summary")].find(e=>e.textContent==="Read recovery draft")');
 check('independent-recovery-reader-preserves-late-result-and-step-evidence',await c.evaluate(recovery+'.textContent.includes('+json(lateText)+')&&'+recovery+'.textContent.includes("Native lifecycle")'));
 await runtime.shot('assistant-recovery');await click(button('Restore reviewed draft',recovery));await until('ba.snapshot().find(t=>t.id==='+json(crashId)+').text==='+json(lateText));
 check('reviewed-recovery-restores-result-without-owner-or-native-replay',await c.evaluate('ba.snapshot().find(t=>t.id==='+json(crashId)+').status==="succeeded"&&!ba.snapshot().some(t=>ba.busy(t.id))&&JSON.stringify(bc.list().map(p=>p.target.pageId))==='+json(JSON.stringify(restarted.pages))+'&&typeof ownerCalls==="undefined"'));
 await c.evaluate('('+installOwner.toString()+')()');await c.evaluate(`(async()=>{window.allowed=await bc.open({url:${json(url+'/a')}});window.outside=await bc.open({url:${json(url+'/b')}})})()`);
 const offId=await startAnother('fill-wait');await until('ownerPhase==="filled"&&!!'+banner);
 await c.evaluate(`${p}.setModuleEnabled('browser',false)`);await until('ownerPhase==="done"');
 check('module-off-disconnects-scoped-credential-and-owner',await c.evaluate(`lastScopedTool('snapshot',{page:allowed.pageId}).then(()=>false,()=>true)`));
 await c.evaluate(`${p}.setModuleEnabled('browser',true)`);await bind();await c.evaluate('ba.initialize()');
 const reenabled=await c.evaluate('({calls:ownerCalls.length,status:ba.snapshot().find(t=>t.id==='+json(offId)+').status,busy:ba.busy('+json(offId)+')})');
 check('module-reenable-keeps-page-lease-pause-without-new-owner-run',reenabled.calls===1&&reenabled.status==='paused'&&!reenabled.busy,reenabled);
 check('reenabling-module-does-not-revive-old-run-token',await c.evaluate(`lastScopedTool('snapshot',{page:allowed.pageId}).then(()=>false,()=>true)`));
 await c.evaluate(`${p}.openWorkbench({feature:'browser',section:'assistant'},window)`);await until('!!'+root);
 await c.evaluate(`${p}.changeLanguage('zh')`); await until(root + '.textContent.includes("网页助手")');
 check('chinese-task-status-and-controls', await c.evaluate(root + '.textContent.includes("已暂停，控制权已交还")&&' + root + '.textContent.includes("智能体已结束，请核对证据")')); await runtime.shot('assistant-zh');
 check('no-host-errors', await c.evaluate('nandAcceptanceErrors.length') === 0 && errors.length === 0, { host: await c.evaluate('nandAcceptanceErrors'), protocol: errors });
 await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ method: 'Actual production UI/Markdown/AGENT_RUN_CONTEXTS/local named-pipe bridge/native Electron guests, with fixture public agent runner and directory. No real CLI-account claim.', rows }, null, 2));
} catch (error) {
 if (runtime) await fs.writeFile(path.join(runtime.evidence, 'partial.json'), JSON.stringify({ rows, error: String(error), hostErrors: await c.evaluate('window.nandAcceptanceErrors??[]'), protocolErrors: errors,
  body: await c.evaluate('document.body.innerText'), tasks: await c.evaluate('window.ba?.snapshot()'), phase: await c.evaluate('window.ownerPhase') }, null, 2));
 throw error;
} finally {
 if (runtime) { console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length, failed: rows.filter(row => !row.passed) })); await runtime.stop(); }
 server.closeAllConnections(); server.close();
}
