// All official-origin responses are intercepted and fulfilled with local fixtures. No real DeepSeek account.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { launchFreshVault } from './fresh-vault.mjs';
import { pluginBuildOptions } from '../esbuild-options.mjs';

const p = 'app.plugins.plugins.nand', json = JSON.stringify, rows = [], hostErrors = [];
let runtime, c;
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
try {
 runtime = await launchFreshVault({ root: process.argv[2], port: 9276, settings: { version: 1, namespaces: { app: { language: 'en', introSeen: true, modules: { browser: true, home: false, agent: false, news: false, archives: false, sync: false, comments: false, notifications: false, automations: false, icons: false } } } } });
 c = runtime.connection; c.on('Runtime.exceptionThrown', event => hostErrors.push(event.exceptionDetails?.exception?.description ?? event.exceptionDetails?.text)); await c.send('Runtime.enable');
 const html = await fs.readFile('scripts/fixtures/deepseek-page.html', 'utf8');
 // Only this fresh fixture vault receives the instrumented entry. Obsidian supplies its real Markdown converter.
 await build({ ...pluginBuildOptions({ production: true }), entryPoints: undefined,
  stdin: { contents: 'export { default } from "./src/app/main.ts"; import { BrowserAutomation } from "./src/modules/browser/platform/desktop/automation.ts"; import { deepseekProviderFactory } from "./src/modules/browser/platform/desktop/deepseek-session.ts"; globalThis.__deepseekFixture={BrowserAutomation,deepseekProviderFactory};', resolveDir: process.cwd() },
  outfile: path.join(runtime.vault, '.obsidian/plugins/nand/main.js'), logLevel: 'silent' });
 await c.evaluate('(async()=>{await app.plugins.disablePlugin("nand");await app.plugins.enablePlugin("nand")})()');
 await c.evaluate('(async()=>{window.bc=' + p + '.services.peek({owner:"browser",id:"control"});window.target=await bc.open({url:"about:blank"});window.wv=document.querySelector("[data-page-id=\\""+target.pageId+"\\"] webview");window.fixtureGuest=require("@electron/remote").webContents.fromId(wv.getWebContentsId());await bc.observe(target);window.fixtureHtml=' + json(html) + ';window.fixtureIntercept=(_event,method,params)=>{if(method!=="Fetch.requestPaused")return;void(async()=>{const u=new URL(params.request.url);let body="";let mime="text/html";if(u.pathname==="/api/v0/chat/history_messages"){body=await fixtureGuest.executeJavaScript("JSON.stringify(fixtureHistory())");mime="application/json"}else if(u.pathname!=="/favicon.ico")body=fixtureHtml;await fixtureGuest.debugger.sendCommand("Fetch.fulfillRequest",{requestId:params.requestId,responseCode:200,responseHeaders:[{name:"Content-Type",value:mime}],body:Buffer.from(body).toString("base64")})})().catch(e=>window.fixtureInterceptError=String(e))};fixtureGuest.debugger.on("message",fixtureIntercept);await fixtureGuest.debugger.sendCommand("Fetch.enable",{patterns:[{urlPattern:"https://chat.deepseek.com/*"}]});await bc.act(target,{kind:"navigate",url:"https://chat.deepseek.com/"});window.classes=window.__deepseekFixture;window.nativePage={webview:wv,disposed:false,state:{id:target.pageId,url:"https://chat.deepseek.com/"},profileId:target.profileId,generation:target.generation,guest:fixtureGuest};nativePage.automation=new classes.BrowserAutomation(fixtureGuest,nativePage);window.factory=classes.deepseekProviderFactory({enabled:()=>true,page:()=>nativePage,activate:()=>bc.activate(target)});window.binding={id:"fixture-target",provider:"deepseek",profileId:target.profileId,accountLabel:"Fixture",page:target,status:"ready"};})()');
 check('official-origin-is-local-intercepted-fixture', await c.evaluate('fixtureGuest.executeJavaScript("location.origin")') === 'https://chat.deepseek.com');
 await c.evaluate('(async()=>{window.abort=new AbortController();window.session=await factory.connect(binding,"fixture-task",abort.signal);window.ready=await session.newConversation(abort.signal);})()');
 check('explicit-new-conversation-verifies-empty-context', await c.evaluate('ready.state==="ready"&&ready.messageIds.length===0&&ready.draft===""'));
 await c.evaluate('session.dispose();true');
 const prompts = ['Structured answer please', 'Follow up in this conversation', 'Structured answer please'];
 const receipts = [];
 for (let index = 0; index < prompts.length; index++) {
  await c.evaluate('(async()=>{window.abort=new AbortController();window.session=await factory.connect(binding,"fixture-task",abort.signal);window.ready=await session.inspect(abort.signal);window.staged=await session.stage(' + json(prompts[index]) + ',ready,abort.signal);window.submission=await session.commit(' + json(prompts[index]) + ',staged,abort.signal);})()');
  const submitted = await c.evaluate('submission'); receipts.push(submitted);
  check('turn-' + index + '-accepted-stable-user-message', submitted.status === 'accepted' && submitted.message.text === prompts[index] && !!submitted.message.messageId && !!submitted.message.conversationId);
  const capture = await c.evaluate('session.capture(submission.message,abort.signal)');
  check('turn-' + index + '-current-api-answer-complete', capture.complete && capture.source === 'provider-api' && capture.parentId === submitted.message.messageId && capture.terminalEvidence.includes('observed-generation-ended'), capture);
  check('turn-' + index + '-preserves-markdown-and-excludes-private-fields', capture.markdown === await c.evaluate('fixtureGuest.executeJavaScript("fixtureMarkdown")') && !json(capture).includes('fixture-only-secret') && !json(capture).includes('Private reasoning'));
  await c.evaluate('binding.conversationId=submission.message.conversationId;session.dispose();true');
 }
 check('repeated-question-has-distinct-user-message', receipts[0].message.messageId !== receipts[2].message.messageId && receipts.every(row => row.message.conversationId === receipts[0].message.conversationId));
 await c.evaluate('(async()=>{await fixtureGuest.executeJavaScript("window.fixtureNoHistory=true;true");window.session=await factory.connect(binding,"fixture-task",abort.signal);window.ready=await session.inspect(abort.signal);window.staged=await session.stage("DOM fallback",ready,abort.signal);window.submission=await session.commit("DOM fallback",staged,abort.signal);})()');
 const partial = await c.evaluate('session.capture(submission.message,abort.signal)');
 check('unverified-dom-coverage-remains-partial', !partial.complete && partial.source === 'scoped-dom' && partial.reasons.includes('scoped-dom-coverage-unverified') && partial.markdown.includes('Heading'));
 await c.evaluate('session.dispose();true');
 await c.evaluate('(async()=>{window.session=await factory.connect(binding,"fixture-task",abort.signal);await fixtureGuest.executeJavaScript("document.querySelector(\\"#chat-input\\").value=\\"User draft\\";true");})()');
 check('new-conversation-preserves-a-user-draft', await c.evaluate('session.newConversation(abort.signal).then(()=>false,e=>e.code==="browser_workspace_new_conversation")') && await c.evaluate('fixtureGuest.executeJavaScript("document.querySelector(\\"#chat-input\\").value")') === 'User draft');
 await c.evaluate('nativePage.generation="replacement";true');
 check('replacement-guest-rejects-old-session', await c.evaluate('session.inspect(abort.signal).then(()=>false,e=>e.code==="browser_stale_target")'));
 await c.evaluate('session.dispose();nativePage.automation.dispose();fixtureGuest.debugger.removeListener("message",fixtureIntercept);true');
 check('interception-completed-without-error', !await c.evaluate('window.fixtureInterceptError'));
 const errors = [...hostErrors, ...await c.evaluate('window.nandAcceptanceErrors??[]')]; check('no-host-errors', errors.length === 0, errors);
 await fs.writeFile(path.join(runtime.evidence, 'result.json'), json({ method: 'Actual ProviderSession source and real Electron input/network, with official HTTPS origin fulfilled only by local fixtures. No actual provider login or public workspace UI integration claim.', rows }, null, 2));
} catch (error) {
 if (runtime) await fs.writeFile(path.join(runtime.evidence, 'partial.json'), json({ rows, error: String(error), hostErrors, interceptError: await c.evaluate('window.fixtureInterceptError') }, null, 2));
 throw error;
} finally {
 if (runtime) { console.log(json({ evidence: runtime.evidence, checks: rows.length, failed: rows.filter(row => !row.passed) })); await runtime.stop(); }
}
