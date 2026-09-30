// Real Obsidian + native PowerShell acceptance, executed only by the exclusive GUI tester.
// Guards: terminal-fixture authorize() requires the exact isolated vault nonce, an empty
// service, offline native binary, disabled agents and redirected temporary provider homes.
// Business actions use real DOM mouse events, registered commands and xterm input/paste.
// Direct APIs are limited to fixture settings/second-leaf preparation, fixture labels,
// observation, public buffer inspection, one owned client-WebSocket fault and cleanup.
// No session.write/paint injection. The default Windows shell is temporarily pwsh with
// empty arguments, restored in finally without saveSettings or persistent configuration.
// Chinese coverage uses CDP Input.insertText and an actual DOM paste event. It does not
// exercise an OS IME candidate window, OS clipboard integration or clipboard permissions.
// Buffer equality covers text/wrapping/cursor/grid, not pixel glyphs or theme colors.
// Only at the fully trimmed scrollback origin, row 0's orphan isWrapped flag is
// canonicalized. All text, other rows' wrapping, cursor and grid stay strictly equal.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { connect } from './cdp.mjs';
import { authorize, openShell, cleanup, until, delay, screenshot } from './terminal-fixture.mjs';

const c = await connect(), tag = randomUUID().slice(0, 8), rows = [];
let authorized, step = 'authorize', failure, cleanupResult;
const limits = { input: 'CDP committed Unicode text and synthetic DOM paste', screen: 'strict public VT text, wrapping, cursor and grid; only the orphan wrap flag of row 0 at fully trimmed scrollback is normalized (SerializeAddon cannot encode a lost predecessor)', scroll: 'follow-bottom or saved distance from bottom; no text-anchor claim', reconnect: 'real client WebSocket close and automatic recovery; logical page/session retained, native PTY ID and PowerShell PID replaced by current server policy', fixture: 'temporarily preselect pwsh and empty shellArgs in memory; restore without saveSettings' };
const js = value => JSON.stringify(value);

async function command(id) {
  assert.equal(await c.evaluate(`app.commands.executeCommandById(${js(id)})`), true, `Registered command ${id}`);
}
async function key(key, code, windowsVirtualKeyCode, modifiers = 0) {
  for (const type of ['rawKeyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode, modifiers });
}
async function click(expression, label) {
  const point = await until(c, `(()=>{const e=${expression};if(!e)return false;const r=e.getBoundingClientRect(),s=e.ownerDocument.defaultView.getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'?{x:r.x+r.width/2,y:r.y+r.height/2}:false})()`, label);
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
}
async function observeOwned() {
  return c.evaluate(`(()=>{const a=nandWorkbenchAudit,leaves=[];app.workspace.iterateAllLeaves(l=>leaves.push(l));for(const s of a.service.getAllTerminals())if(!a.owned.includes(s.id))a.owned.push(s.id);for(const l of leaves){if(!a.flow.initialLeaves.has(l)&&!a.flow.createdLeaves.includes(l))a.flow.createdLeaves.push(l);if(l.view?.getViewType?.()==='terminal-view'&&a.owned.includes(l.view.getTerminalInstance?.()?.id)&&!a.leaves.includes(l))a.leaves.push(l);}return {sessions:a.service.getAllTerminals().map(s=>({id:s.id,alive:s.isAlive(),shellType:s.shellType})),leaves:leaves.filter(l=>l.view?.getViewType?.()==='terminal-view').map(l=>({id:l.id,terminal:l.view.getTerminalInstance?.()?.id}))}})()`);
}
async function active(id) {
  await until(c, `(()=>{const a=nandWorkbenchAudit,l=app.workspace.getMostRecentLeaf();if(l?.view?.getTerminalInstance?.()?.id!==${js(id)})return false;a.leaf=l;a.view=l.view;return a.view.contentEl.ownerDocument.visibilityState==='visible'&&a.view.terminalInstance.ownerVisible})()`, `active visible session ${id}`);
  await observeOwned();
}
async function sidebar(id) {
  await click(`nandWorkbenchAudit.view.contentEl.querySelector(${js(`.nand-session-row > .nand-ui-list-item[data-terminal-id="${id}"]`)})`, `sidebar session ${id}`);
  await active(id);
}
async function focusInput() {
  assert.equal(await c.evaluate(`(()=>{const e=nandWorkbenchAudit.view.contentEl.querySelector('.xterm-helper-textarea');if(!e)throw Error('xterm input missing');e.focus();return e.ownerDocument.activeElement===e})()`), true);
}
async function input(text, method = 'insertText') {
  await focusInput();
  if (method === 'paste') {
    await c.evaluate(`(()=>{const e=nandWorkbenchAudit.view.contentEl.querySelector('.xterm-helper-textarea'),d=new DataTransfer();d.setData('text/plain',${js(text)});e.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:d}));return true})()`);
  } else await c.send('Input.insertText', { text });
  await key('Enter', 'Enter', 13);
}
async function prompt(id) {
  await until(c, `(()=>{const s=nandWorkbenchAudit.service.getTerminal(${js(id)}),b=s?.emulator?.buffer.active;if(!b)return false;return /^PS .*>\\s*$/.test(b.getLine(b.baseY+b.cursorY)?.translateToString(true)||'')})()`, `PowerShell prompt ${id}`, 30000);
}
async function line(id, expected, timeout = 30000) {
  return until(c, `nandWorkbenchAudit.flow.lines(${js(id)}).some(l=>l.trim()===${js(expected)})`, `native output ${expected}`, timeout);
}
async function shellMarker(id, marker, method = 'insertText') {
  const cut = Math.floor(marker.length / 2);
  await input(`Write-Output ('${marker.slice(0, cut)}' + '${marker.slice(cut)}')`, method);
  await line(id, marker);
  await prompt(id);
}
async function compare(id) {
  return until(c, `(()=>{const a=nandWorkbenchAudit,r=a.flow.screen(${js(id)});a.flow.lastComparison=r;return r.equal?r:false})()`, `headless/browser screen ${id}`, 30000);
}
async function quickSwitch(id, title) {
  await command('nand:terminal-quick-switch');
  await until(c, `!!document.querySelector('.prompt-input')&&!!document.querySelector('.suggestion-item')`, 'recent-session suggestion modal');
  await c.evaluate(`document.querySelector('.prompt-input').focus()`);
  await c.send('Input.insertText', { text: title });
  await until(c, `[...document.querySelectorAll('.suggestion-item')].some(e=>e.textContent.includes(${js(title)}))`, `recent-session result ${title}`);
  await click(`[...document.querySelectorAll('.suggestion-item')].find(e=>e.textContent.includes(${js(title)}))`, `choose recent session ${id}`);
  await until(c, `!document.querySelector('.prompt-input')`, 'recent modal closes');
  await active(id);
}
async function record(name, details) {
  rows.push({ name, ...details, passed: true });
  await fs.writeFile(path.join(authorized.dir, 'terminal-session-flows-progress.json'), JSON.stringify({ runtime: authorized.runtime, tag, step, limits, rows }, null, 2));
}

async function readPowerShellPid(id, prefix) {
  await input(`Write-Output ('${prefix}' + $PID)`);
  const result = await until(c, `(()=>{const a=nandWorkbenchAudit,l=a.flow.lines(${js(id)}).find(l=>new RegExp('^${prefix}[0-9]+$').test(l.trim()));return l?{pid:Number(l.trim().slice(${prefix.length})),nativeSession:a.service.getTerminal(${js(id)}).sessionId}:false})()`, 'real PowerShell process id');
  await prompt(id);
  return result;
}

try {
  authorized = await authorize(c);
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: authorized.deviceScaleFactor, mobile: false });
  await c.evaluate(`(()=>{const a=nandWorkbenchAudit,initialLeaves=new Set();app.workspace.iterateAllLeaves(l=>initialLeaves.add(l));a.flow={initialLeaves,createdLeaves:[],observers:[],output:{},renderers:{},refs:{},lastComparison:null};a.flow.lines=id=>{const b=a.service.getTerminal(id)?.emulator?.buffer.active;if(!b)return [];return Array.from({length:b.length},(_,i)=>b.getLine(i)?.translateToString(true)||'');};a.flow.screen=id=>{const s=a.service.getTerminal(id),r=a.flow.renderers[id];if(!s||!r)return {equal:false,reason:'missing owned process or renderer'};const read=(term)=>{const b=term.buffer.active;return {cols:term.cols,rows:term.rows,type:b.type,cursorX:b.cursorX,cursorY:b.cursorY,baseY:b.baseY,lines:Array.from({length:b.length},(_,i)=>{const l=b.getLine(i);return [l?.translateToString(false)||'',!!l?.isWrapped];})};};const h=read(s.emulator),v=read(r.getXterm()),originWrap={headless:h.lines[0]?.[1]??false,browser:v.lines[0]?.[1]??false,normalized:false};if(originWrap.headless!==originWrap.browser&&h.baseY>0&&v.baseY>0&&h.baseY===s.emulator.options.scrollback&&v.baseY===r.getXterm().options.scrollback){h.lines[0][1]=false;v.lines[0][1]=false;originWrap.normalized=true;}const crypto=window.require('crypto'),hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex'),headless=hash(h),browser=hash(v),b=r.getXterm().buffer.active;let firstDifference=-1;for(let i=0;i<Math.max(h.lines.length,v.lines.length);i++)if(JSON.stringify(h.lines[i])!==JSON.stringify(v.lines[i])){firstDifference=i;break;}return {equal:headless===browser,headless,browser,originWrap,grid:{headless:[h.cols,h.rows],browser:[v.cols,v.rows]},cursor:{headless:[h.cursorX,h.cursorY],browser:[v.cursorX,v.cursorY]},lineCount:{headless:h.lines.length,browser:v.lines.length},firstDifference,difference:firstDifference<0?null:{headless:h.lines[firstDifference],browser:v.lines[firstDifference]},scroll:{baseY:b.baseY,viewportY:b.viewportY,bottomDistance:b.baseY-b.viewportY},subscriptions:s.outputs.size};};true})()`);
  await c.evaluate(`(()=>{const a=nandWorkbenchAudit,s=a.host.settings;if(a.service.settings!==s)throw Error('Fixture requires shared host/service settings');a.flow.oldShell={windows:s.platformShells.windows,args:s.shellArgs};s.platformShells.windows='pwsh';s.shellArgs=[];return true})()`);

  step = 'initial PowerShell through NAND command';
  const first = await openShell(c);
  await observeOwned();
  await active(first.id); await prompt(first.id);
  const titleA = `FLOW_A_${tag}`, titleB = `FLOW_B_${tag}`;
  await c.evaluate(`(()=>{const a=nandWorkbenchAudit,s=a.service.getTerminal(${js(first.id)});s.setTitle(${js(titleA)});a.flow.renderers[s.id]=a.view.terminalInstance;a.flow.firstLeaf=a.leaf;return true})()`);
  await shellMarker(first.id, `START_${tag}`);
  await record('initial-native-shell', { ...first, inputPath: 'registered PowerShell command, CDP insertText/Enter', screen: await compare(first.id) });

  step = 'real New conversation menu';
  await click(`nandWorkbenchAudit.view.contentEl.querySelector('.nand-agent-new-btn')`, 'New conversation button');
  await until(c, `!![...document.querySelectorAll('.menu-item')].find(e=>/^(Shell|普通终端)$/.test(e.textContent.trim()))`, 'real Shell menu entry');
  await click(`[...document.querySelectorAll('.menu-item')].find(e=>/^(Shell|普通终端)$/.test(e.textContent.trim()))`, 'Shell menu action');
  const second = await until(c, `(()=>{const a=nandWorkbenchAudit;for(const s of a.service.getAllTerminals())if(!a.owned.includes(s.id))a.owned.push(s.id);const s=a.service.getAllTerminals().find(s=>s.id!==${js(first.id)});return s?.isAlive()&&a.view.terminalInstance?.id===s.id?{id:s.id,shellType:s.shellType}:false})()`, 'menu-created session');
  await active(second.id); await prompt(second.id);
  assert.match(second.shellType, /^(powershell|pwsh|default)$/, 'Isolated fixture default Shell must be PowerShell');
  await c.evaluate(`(()=>{const a=nandWorkbenchAudit,s=a.service.getTerminal(${js(second.id)});s.setTitle(${js(titleB)});a.flow.renderers[s.id]=a.view.terminalInstance;return true})()`);
  assert.equal((await observeOwned()).sessions.length, 2);
  await sidebar(first.id); await sidebar(second.id);
  await record('new-menu-and-sidebar-navigation', { first: first.id, second: second.id, sessionCount: 2, actions: 'real New conversation menu and session-row mouse clicks' });

  step = 'Chinese committed input and DOM paste';
  await shellMarker(second.id, `中文输入_${tag}`);
  await shellMarker(second.id, `中文粘贴_${tag}`, 'paste');
  await record('chinese-input-and-paste', { insertText: `中文输入_${tag}`, pasteEvent: `中文粘贴_${tag}`, osImeCandidateWindow: 'not tested', osClipboard: 'not changed', screen: await compare(second.id) });

  step = 'existing-leaf routing through recent-session command';
  // Fixture-only native second leaf: product onOpen chooses the already running,
  // unowned A session. We do not manually transfer/adopt a renderer.
  await c.evaluate(`(async()=>{const a=nandWorkbenchAudit,l=app.workspace.getLeaf('tab');a.flow.createdLeaves.push(l);a.leaves.push(l);await l.setViewState({type:'terminal-view',active:true});await app.workspace.revealLeaf(l);})()`);
  await active(first.id);
  await until(c, `app.workspace.getLeavesOfType('terminal-view').length===2`, 'two actual native terminal leaves');
  await c.evaluate(`(()=>{const a=nandWorkbenchAudit;a.flow.secondLeaf=a.leaf;a.flow.refs={a:a.flow.renderers[${js(first.id)}],b:a.flow.renderers[${js(second.id)}],aView:a.view,bView:a.flow.firstLeaf.view};return true})()`);
  await quickSwitch(second.id, titleB);
  const routing = await c.evaluate(`(()=>{const a=nandWorkbenchAudit,f=a.flow;return {activeLeaf:a.leaf.id,expectedLeaf:f.firstLeaf.id,leaves:app.workspace.getLeavesOfType('terminal-view').length,sessions:a.service.getAllTerminals().length,aId:f.secondLeaf.view.getTerminalInstance()?.id,bId:f.firstLeaf.view.getTerminalInstance()?.id,aSame:f.secondLeaf.view.getTerminalInstance()===f.refs.a,bSame:f.firstLeaf.view.getTerminalInstance()===f.refs.b,aOwner:f.refs.a.displayOwner===f.secondLeaf.view,bOwner:f.refs.b.displayOwner===f.firstLeaf.view,aContainer:f.refs.a.getXterm().element.parentElement===f.secondLeaf.view.terminalContainer,bContainer:f.refs.b.getXterm().element.parentElement===f.firstLeaf.view.terminalContainer}})()`);
  assert.equal(routing.activeLeaf, routing.expectedLeaf);
  assert.equal(routing.leaves, 2); assert.equal(routing.sessions, 2);
  assert.equal(routing.aId, first.id); assert.equal(routing.bId, second.id);
  for (const field of ['aSame', 'bSame', 'aOwner', 'bOwner', 'aContainer', 'bContainer']) assert.equal(routing[field], true, `Recent switch preserves ${field}`);
  await record('recent-command-prefers-existing-leaf', { trigger: 'registered recent-session command, real SuggestModal selection', ...routing });

  step = 'closing a leaf keeps its native shell alive';
  const pidPrefix = `PID_${tag}_`, backgroundMarker = `BACKGROUND_${tag}`;
  await input(`Write-Output ('${pidPrefix}' + $PID)`);
  const processBefore = await until(c, `(()=>{const a=nandWorkbenchAudit,l=a.flow.lines(${js(second.id)}).find(l=>new RegExp('^${pidPrefix}[0-9]+$').test(l.trim()));return l?{pid:Number(l.trim().slice(${pidPrefix.length})),nativeSession:a.service.getTerminal(${js(second.id)}).sessionId}:false})()`, 'real PowerShell process id');
  await prompt(second.id);
  await input(`Start-Sleep -Seconds 2; Write-Output ('BACKGROUND_' + '${tag}')`);
  await command('workspace:close');
  await until(c, `(()=>{const a=nandWorkbenchAudit,s=a.service.getTerminal(${js(second.id)});return !app.workspace.getLeavesOfType('terminal-view').includes(a.flow.firstLeaf)&&s?.isAlive()&&s.outputs.size===0})()`, 'closed leaf releases browser but preserves native session');
  await line(second.id, backgroundMarker);
  await active(first.id);
  await quickSwitch(second.id, titleB);
  const processAfter = await c.evaluate(`(()=>{const a=nandWorkbenchAudit,s=a.service.getTerminal(${js(second.id)});return {nativeSession:s.sessionId,alive:s.isAlive(),sameRenderer:a.view.terminalInstance===a.flow.refs.b,leafCount:app.workspace.getLeavesOfType('terminal-view').length,backgroundOutput:a.flow.lines(s.id).some(l=>l.trim()===${js(backgroundMarker)})}})()`);
  assert.equal(processAfter.nativeSession, processBefore.nativeSession);
  assert.equal(processAfter.alive, true); assert.equal(processAfter.sameRenderer, true);
  assert.equal(processAfter.backgroundOutput, true); assert.equal(processAfter.leafCount, 1);
  await prompt(second.id);
  await input(`Write-Output ('PID_AGAIN_${tag}_' + $PID)`);
  await line(second.id, `PID_AGAIN_${tag}_${processBefore.pid}`);
  await record('leaf-close-background-and-reattach', { before: processBefore, after: processAfter, screen: await compare(second.id), closingAction: 'actual workspace close command' });

  step = 'real PowerShell output above 2 MB while hidden';
  await prompt(second.id);
  await c.evaluate(`(()=>{const a=nandWorkbenchAudit,s=a.service.getTerminal(${js(second.id)});a.flow.output[s.id]={chars:0,utf8Bytes:0,chunks:0,maxChunkChars:0};a.flow.observers.push(s.observeAutomation(e=>{if(e.kind!=='data')return;const n=a.flow.output[s.id];n.chars+=e.text.length;n.utf8Bytes+=new TextEncoder().encode(e.text).length;n.chunks++;n.maxChunkChars=Math.max(n.maxChunkChars,e.text.length);}));return true})()`);
  const largeEnd = `LARGE_END_${tag}`;
  await input(`Start-Sleep -Seconds 2; [Console]::Write((('长输出_${tag}_' + ('x' * 1800) + [Environment]::NewLine) * 1300)); [Console]::WriteLine(('LARGE_END_' + '${tag}'))`);
  await sidebar(first.id);
  assert.equal(await c.evaluate(`nandWorkbenchAudit.service.getTerminal(${js(second.id)}).outputs.size`), 0);
  await line(second.id, largeEnd, 60000);
  const nativeOutput = await c.evaluate(`nandWorkbenchAudit.flow.output[${js(second.id)}]`);
  assert.ok(nativeOutput.chars > 2_000_000 && nativeOutput.utf8Bytes > 2_000_000, JSON.stringify(nativeOutput));
  assert.equal(await c.evaluate(`nandWorkbenchAudit.service.getTerminal(${js(second.id)}).outputs.size`), 0);
  await sidebar(second.id); await prompt(second.id);
  const restored = await compare(second.id);
  assert.equal(restored.scroll.bottomDistance, 0, 'A following terminal stays at the bottom after hidden output');
  assert.equal(restored.subscriptions, 1);
  await screenshot(c, authorized.dir, 'session-flow-hidden-large-restored');
  await record('native-long-output-hidden-screen-replay', { nativeOutput, hiddenBrowserSubscriptions: 0, restored, source: 'real PowerShell Console stdout, no synthetic paint injection' });

  step = 'non-following scroll intent survives a hidden interval';
  const scrollEnd = `SCROLL_END_${tag}`;
  await input(`Start-Sleep -Seconds 2; [Console]::Write((('scroll_${tag}_' + ('y' * 90) + [Environment]::NewLine) * 100)); [Console]::WriteLine(('SCROLL_END_' + '${tag}'))`);
  const wheelPoint = await c.evaluate(`(()=>{const r=nandWorkbenchAudit.view.contentEl.querySelector('.xterm-screen').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', deltaX: 0, deltaY: -700, ...wheelPoint });
  const beforeScroll = await until(c, `(()=>{const b=nandWorkbenchAudit.view.terminalInstance.getXterm().buffer.active;return b.baseY-b.viewportY>3?{baseY:b.baseY,viewportY:b.viewportY,bottomDistance:b.baseY-b.viewportY}:false})()`, 'real wheel scrolls away from bottom');
  await sidebar(first.id);
  await line(second.id, scrollEnd);
  assert.equal(await c.evaluate(`nandWorkbenchAudit.service.getTerminal(${js(second.id)}).outputs.size`), 0);
  await sidebar(second.id);
  const afterScroll = await compare(second.id);
  assert.ok(afterScroll.scroll.bottomDistance > 0, 'Reading scrollback must not be forced to the bottom');
  assert.ok(Math.abs(afterScroll.scroll.bottomDistance - beforeScroll.bottomDistance) <= 1, `Scroll distance: ${JSON.stringify({ beforeScroll, after: afterScroll.scroll })}`);
  await screenshot(c, authorized.dir, 'session-flow-scroll-restored');
  await record('non-following-scroll-intent', { before: beforeScroll, after: afterScroll.scroll, screen: afterScroll, trigger: 'real wheel, DOM session switch, native delayed stdout' });

  step = 'real client WebSocket close and automatic native recovery';
  const reconnectProcessBefore = await readPowerShellPid(second.id, `WS_BEFORE_${tag}_`);
  const connectionBefore = await c.evaluate(`(()=>{const a=nandWorkbenchAudit,m=a.service.serverManager,ws=m.ws,sessions=a.service.getAllTerminals();if(!m.isConnected()||!m.isServerRunning()||!ws||ws.readyState!==WebSocket.OPEN||!sessions.length||sessions.some(s=>!a.owned.includes(s.id)||s.automationManaged||!s.isAlive()))throw Error('Reconnect fault requires only live owned interactive fixture sessions');const url=new URL(ws.url);if(url.protocol!=='ws:'||url.hostname!=='127.0.0.1'||url.port!==String(m.getServerPort()))throw Error('Fault is limited to the owned loopback socket');const r={manager:m,ws,process:m.process,leaf:a.leaf,view:a.view,renderer:a.view.terminalInstance,logical:new Map(sessions.map(s=>[s.id,s])),startedAt:performance.now(),events:[]};a.flow.reconnect=r;for(const name of ['ws-disconnected','ws-reconnecting','ws-connected','ws-reconnect-failed']){const listener=(...args)=>r.events.push({name,args,at:new Date().toISOString(),elapsedMs:performance.now()-r.startedAt});m.on(name,listener);a.flow.observers.push(()=>m.off(name,listener));}const before={serverPid:m.process?.pid,port:m.getServerPort(),generation:m.generation,logicalId:a.view.terminalInstance.id,leaf:a.leaf.id,wsUrl:ws.url,sessions:sessions.map(s=>({id:s.id,nativeSession:s.sessionId}))};if(!before.serverPid)throw Error('Owned native server process missing');ws.close(4000,'NAND isolated acceptance ${tag}');return before})()`);
  await until(c, `nandWorkbenchAudit.flow.reconnect.events.some(e=>e.name==='ws-disconnected')`, 'actual native socket disconnect event');
  const recovered = await until(c, `(()=>{const a=nandWorkbenchAudit,r=a.flow.reconnect,m=r.manager,sessions=a.service.getAllTerminals();if(!r.events.some(e=>e.name==='ws-connected')||!m.isConnected()||m.ws===r.ws||sessions.some(s=>!s.isAlive()||s.needsRecovery||s.recovering))return false;return {serverPid:m.process?.pid,port:m.getServerPort(),generation:m.generation,sameServerProcess:m.process===r.process,sameLeaf:a.leaf===r.leaf,sameView:a.view===r.view,sameRenderer:a.view.terminalInstance===r.renderer,sameLogicalObjects:sessions.length===r.logical.size&&sessions.every(s=>r.logical.get(s.id)===s),logicalId:a.view.terminalInstance.id,leaf:a.leaf.id,ownerVisible:a.view.terminalInstance.ownerVisible,subscriptions:a.service.getTerminal(${js(second.id)}).outputs.size,sessions:sessions.map(s=>({id:s.id,nativeSession:s.sessionId}))}})()`, 'automatic WebSocket recovery and new native shells', 30000);
  for (const field of ['sameServerProcess', 'sameLeaf', 'sameView', 'sameRenderer', 'sameLogicalObjects', 'ownerVisible']) assert.equal(recovered[field], true, `Recovery preserves ${field}`);
  for (const field of ['serverPid', 'port', 'generation', 'logicalId', 'leaf']) assert.equal(recovered[field], connectionBefore[field], `Recovery preserves ${field}`);
  assert.equal(recovered.subscriptions, 1);
  assert.deepEqual(recovered.sessions.map(s => s.id).sort(), connectionBefore.sessions.map(s => s.id).sort());
  for (const session of recovered.sessions) {
    assert.ok(session.nativeSession);
    assert.notEqual(session.nativeSession, connectionBefore.sessions.find(s => s.id === session.id).nativeSession, 'Current native policy creates a replacement PTY after WebSocket close');
  }
  await prompt(second.id);
  const reconnectProcessAfter = await readPowerShellPid(second.id, `WS_AFTER_${tag}_`);
  assert.notEqual(reconnectProcessAfter.nativeSession, reconnectProcessBefore.nativeSession);
  assert.notEqual(reconnectProcessAfter.pid, reconnectProcessBefore.pid, 'PowerShell process is replaced; this is not process-survival coverage');
  await shellMarker(second.id, `RECONNECTED_${tag}`);
  const reconnectEvents = await c.evaluate('nandWorkbenchAudit.flow.reconnect.events');
  assert.equal(reconnectEvents.some(e => e.name === 'ws-reconnect-failed'), false);
  assert.ok(reconnectEvents.some(e => e.name === 'ws-reconnecting'));
  await record('real-websocket-close-and-auto-recovery', { fault: 'close only the owned loopback client WebSocket; no manual reconnect or server kill', semantics: 'logical session/page/renderer retained; native PTY and PowerShell process replaced', connectionBefore, recovered, powershellBefore: reconnectProcessBefore, powershellAfter: reconnectProcessAfter, events: reconnectEvents, inputPath: 'CDP insertText/Enter through xterm to recovered real PowerShell', screen: await compare(second.id) });
  step = 'complete';
} catch (error) {
  failure = error;
  if (authorized) {
    try { await screenshot(c, authorized.dir, 'session-flow-error'); } catch {}
    try { rows.push({ name: 'failure-diagnostics', step, owned: await observeOwned(), lastScreen: await c.evaluate('nandWorkbenchAudit.flow.lastComparison'), passed: false }); } catch {}
  }
} finally {
  try {
    if (authorized) {
      await key('Escape', 'Escape', 27);
      await observeOwned();
      await c.evaluate(`(()=>{const a=nandWorkbenchAudit,live=new Set();app.workspace.iterateAllLeaves(l=>live.add(l));for(const off of a.flow.observers)off();if(a.flow.oldShell){a.host.settings.platformShells.windows=a.flow.oldShell.windows;a.host.settings.shellArgs=a.flow.oldShell.args;}for(const l of a.flow.createdLeaves)if(live.has(l)&&l.view?.getViewType?.()!=='terminal-view')l.detach();a.leaves=a.leaves.filter(l=>live.has(l));return true})()`);
      await cleanup(c);
      cleanupResult = await c.evaluate(`(async()=>{const s=await app.plugins.plugins.nand.terminalHost.getTerminalService();return {sessions:s.getAllTerminals().length,auditRemoved:!window.nandWorkbenchAudit}})()`);
      assert.deepEqual(cleanupResult, { sessions: 0, auditRemoved: true }, 'All owned native sessions and fixture state must be cleaned');
      await c.send('Emulation.clearDeviceMetricsOverride');
    }
  } catch (error) { cleanupResult = { error: String(error) }; failure ??= error; }
  finally {
    if (authorized) await fs.writeFile(path.join(authorized.dir, 'terminal-session-flows.json'), JSON.stringify({ passed: !failure, error: failure ? String(failure) : undefined, step, tag, runtime: authorized.runtime, limits, rows, cleanup: cleanupResult }, null, 2));
    c.close();
  }
}
if (failure) throw failure;
console.log(JSON.stringify({ passed: true, cases: rows.length, evidence: path.join(authorized.dir, 'terminal-session-flows.json'), cleanup: cleanupResult }));
