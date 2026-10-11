// Clipboard permission probe in an owned real Obsidian guest. Never prints clipboard contents.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { launchFreshVault } from './fresh-vault.mjs';

const rows = [], json = JSON.stringify, plugin = 'app.plugins.plugins.nand'; let runtime, c;
const server = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html' });
 response.end('<!doctype html><title>Clipboard boundary</title><button id="copy">Copy fixture answer</button><output></output><script>window.copyResult="idle";copy.onclick=()=>navigator.clipboard.writeText("NAND disposable copy boundary").then(()=>copyResult="allowed",e=>copyResult=e.name)</script>'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); assert.ok(passed, name); };
try {
 runtime = await launchFreshVault({ root: process.argv[2], port: 9276, settings: { version: 1, namespaces: { app: { language: 'en', introSeen: true,
  modules: { browser: true, home: false, agent: false, news: false, archives: false, sync: false, comments: false, notifications: false, automations: false, icons: false } } } } }); c = runtime.connection;
 await c.evaluate('(async()=>{window.bc=' + plugin + '.services.peek({owner:"browser",id:"control"});window.target=await bc.open({url:' + json('http://127.0.0.1:' + server.address().port + '/') + '});const wv=document.querySelector("[data-page-id=\\""+target.pageId+"\\"] webview");window.copyGuest=require("@electron/remote").webContents.fromId(wv.getWebContentsId());window.hostClipboard=require("@electron/remote").clipboard;window.clipboardSnapshot=()=>JSON.stringify(hostClipboard.availableFormats().sort().map(format=>[format,hostClipboard.readBuffer(format).toString("base64")]));window.clipboardBefore=clipboardSnapshot();})()');
 const guest = expression => c.evaluate('copyGuest.executeJavaScript(' + json(expression) + ')');
 check('modern-clipboard-write-without-activation-is-denied', await guest('navigator.clipboard.writeText("NAND disposable boundary").then(()=>"allowed",e=>e.name)') === 'NotAllowedError');
 check('denied-write-preserves-every-host-clipboard-format', await c.evaluate('clipboardSnapshot()===clipboardBefore'));
 const observation = await c.evaluate('bc.observe(target)'), copy = observation.refs.find(ref => ref.name === 'Copy fixture answer');
 assert.ok(copy);
 await c.evaluate('bc.act(target,{kind:"click",ref:' + json({ revision: observation.revision, element: copy.ref }) + '})');
 check('modern-clipboard-write-from-native-click-is-denied', await guest('new Promise(resolve=>setTimeout(()=>resolve(copyResult),100))') === 'NotAllowedError');
 check('native-click-preserves-every-host-clipboard-format', await c.evaluate('clipboardSnapshot()===clipboardBefore'));
 await guest('new Promise(resolve=>{const timer=setInterval(()=>{if(!navigator.userActivation.isActive){clearInterval(timer);resolve(true)}},100)})');
 const legacy = await guest('(()=>{const input=document.createElement("textarea");input.value="NAND disposable legacy boundary";document.body.append(input);input.select();const copied=document.execCommand("copy");input.remove();return copied})()');
 check('legacy-copy-without-user-activation-is-denied', legacy === false);
 check('legacy-denial-preserves-every-host-clipboard-format', await c.evaluate('clipboardSnapshot()===clipboardBefore'));
 const bundle = path.join(runtime.evidence, 'copy-fixture.cjs');
 await build({ stdin: { contents: 'export { websiteCopyProgram } from "./src/modules/browser/platform/desktop/provider-copy.ts";', resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'cjs', outfile: bundle, logLevel: 'silent' });
 await c.evaluate('window.copyProgram=require(' + json(bundle) + ').websiteCopyProgram;window.focusSentinel=document.createElement("input");document.body.append(focusSentinel);focusSentinel.focus();true');
 await guest('(()=>{document.body.innerHTML="<textarea id=human>Human draft</textarea><article id=answer data-message-id=answer><button id=copyAnswer>Copy answer</button></article>";window.copyReady=true;window.copyCalls=0;window.originalWriteText=navigator.clipboard.writeText;window.originalWrite=navigator.clipboard.write;window.originalExec=document.execCommand;copyAnswer.onclick=()=>{copyCalls++;return navigator.clipboard.writeText("# Exact answer\\n\\n$x^2$")};return true})()');
 const capture = () => c.evaluate('copyGuest.executeJavaScript(copyProgram({root:"#answer",button:"#copyAnswer"},"window.copyReady===true&&document.querySelector(\\"#answer\\").dataset.messageId===\\"answer\\""))');
 let captured = await capture();
 check('scoped-copy-captures-one-synchronous-website-write', captured?.mime === 'text/plain' && captured.text === '# Exact answer\n\n$x^2$');
 check('copy-keeps-system-clipboard-human-draft-and-host-focus', await c.evaluate('clipboardSnapshot()===clipboardBefore&&document.activeElement===focusSentinel') && await guest('human.value==="Human draft"'));
 check('copy-restores-every-patched-method', await guest('navigator.clipboard.writeText===originalWriteText&&navigator.clipboard.write===originalWrite&&document.execCommand===originalExec'));
 await guest('copyAnswer.onclick=()=>navigator.clipboard.write([new ClipboardItem({"text/html":new Blob(["<h1>HTML answer</h1>"],{type:"text/html"})})]);true');
 captured = await capture(); check('clipboard-item-html-is-bounded-and-captured-without-os-write', captured?.mime === 'text/html' && captured.text === '<h1>HTML answer</h1>' && await c.evaluate('clipboardSnapshot()===clipboardBefore'));
 await guest('copyAnswer.onclick=()=>{navigator.clipboard.writeText("First");navigator.clipboard.writeText("Different longer content")};true');
 check('different-copy-writes-are-ambiguous', await capture() === undefined);
 await guest('window.copyLate="pending";copyAnswer.onclick=()=>{setTimeout(()=>navigator.clipboard.writeText("Late unsupported copy").then(()=>copyLate="allowed",e=>copyLate=e.name),30)};true');
 check('asynchronous-write-is-not-claimed-by-selected-click', await capture() === undefined);
 check('late-write-after-hook-removal-is-denied', await guest('new Promise(resolve=>setTimeout(()=>resolve(copyLate),100))') === 'NotAllowedError' && await c.evaluate('clipboardSnapshot()===clipboardBefore'));
 await guest('copyAnswer.onclick=()=>{window.legacyResult=document.execCommand("copy")};true');
 check('legacy-copy-is-blocked-without-guessing-selected-text', await capture() === undefined && await guest('legacyResult===false') && await c.evaluate('clipboardSnapshot()===clipboardBefore'));
 await guest('copyAnswer.onclick=()=>navigator.clipboard.write([{types:["text/plain"],getType:()=>new Promise(resolve=>setTimeout(()=>{copyReady=false;resolve(new Blob(["Late changed identity"]))},30))}]);true');
 check('changed-message-guard-discards-delayed-blob', await capture() === undefined);
 check('failed-copy-restores-methods-and-focus', await guest('navigator.clipboard.writeText===originalWriteText&&navigator.clipboard.write===originalWrite&&document.execCommand===originalExec') && await c.evaluate('document.activeElement===focusSentinel&&clipboardSnapshot()===clipboardBefore'));
 const versions = await c.evaluate('({electron:process.versions.electron,chrome:process.versions.chrome})');
 await fs.writeFile(path.join(runtime.evidence, 'result.json'), json({ versions, rows, scope: 'Real production guest policy and source helper bundled into disposable evidence. Strict synchronous copy capture, ClipboardItem data, ambiguity/late/legacy/identity guards, clipboard formats and focus. Not yet a registered provider/workspace capture path or real provider compatibility claim.' }, null, 2));
} catch (error) {
 if (runtime) await fs.writeFile(path.join(runtime.evidence, 'partial.json'), json({ rows, error: String(error) }, null, 2));
 throw error;
} finally {
 if (runtime) { await c.evaluate('window.focusSentinel?.remove();delete window.clipboardBefore;delete window.clipboardSnapshot;delete window.hostClipboard;true').catch(() => undefined);
  console.log(json({ evidence: runtime.evidence, checks: rows.length, failed: rows.filter(row => !row.passed) })); await runtime.stop(); }
 server.closeAllConnections(); server.close();
}
