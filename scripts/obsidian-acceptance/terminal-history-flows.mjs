// Real Obsidian controls and native history; generated transcripts and CLI only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { connect } from './cdp.mjs';
import { authorize, seedHistory, openShell, cleanup, until, delay, screenshot } from './terminal-fixture.mjs';
import { language } from './common.mjs';

const c=await connect(), rows=[];
let auth, stage='authorize', failed=false;
const q=s=>`nandWorkbenchAudit.view.contentEl.querySelector(${JSON.stringify(s)})`;
async function ready(count){await until(c,`nandWorkbenchAudit.view.contentEl.querySelectorAll('.nand-history-row').length===${count}&&!${q('.nand-history-status')}`,'history page ready');}
async function input(selector,value){await c.evaluate(`(()=>{const e=${q(selector)};e.value=${JSON.stringify(value)};e.dispatchEvent(new e.ownerDocument.defaultView.Event('input',{bubbles:true}));})()`);}
async function action(index){await c.evaluate(`nandWorkbenchAudit.view.contentEl.querySelectorAll('.nand-history-actions button')[${index}].click()`);}
try {
  auth=await authorize(c);
  await language(c,'en');
  const corpus=await seedHistory(auth);
  await c.send('Emulation.setDeviceMetricsOverride',{width:1324,height:900,deviceScaleFactor:auth.deviceScaleFactor,mobile:false});
  await openShell(c);
  await c.evaluate(`nandWorkbenchAudit.view.contentEl.querySelectorAll('.terminal-navigation-tabs button')[1].click()`);
  stage='search-pagination';
  await input('.nand-history-controls input',corpus.prefix);
  await ready(100);
  const first=await c.evaluate(`({range:${q('.nand-history-range')}.textContent,offset:nandWorkbenchAudit.view.workbenchState.historyOffset})`);
  assert.ok(first.range.includes('125'));
  await c.evaluate(`${q('.nand-history-page-next')}.click()`);
  await ready(25);
  assert.equal(await c.evaluate('nandWorkbenchAudit.view.workbenchState.historyOffset'),100);
  rows.push({name:stage,first,secondCount:25,passed:true});

  stage='selected-transcript-refresh';
  await c.evaluate(`${q('.nand-history-row button')}.click()`);
  await until(c,`${q('.nand-history-transcript')}?.textContent.includes('FINAL_${corpus.prefix}')`,'selected complete transcript');
  const selected=await c.evaluate('nandWorkbenchAudit.view.workbenchState.selectedHistory');
  assert.equal(path.dirname(selected.transcriptPath).toLowerCase(),corpus.source.toLowerCase(),'Only generated fixture transcript can be changed');
  const refreshMarker=`REFRESH_${corpus.prefix}`;
  await fs.appendFile(selected.transcriptPath,JSON.stringify({type:'response_item',payload:{type:'message',role:'assistant',content:[{text:refreshMarker}]}})+'\n');
  await c.evaluate(`${q('.terminal-history-filter-row button')}.click()`);
  await until(c,`${q('.nand-history-transcript')}?.textContent.includes(${JSON.stringify(refreshMarker)})`,'refresh updates selected full transcript');
  assert.equal(await c.evaluate('nandWorkbenchAudit.view.workbenchState.selectedHistory.key'),selected.key);
  rows.push({name:stage,key:selected.key,fullTextLength:await c.evaluate(`${q('.nand-history-transcript')}.textContent.length`),passed:true});

  stage='two-window-migration';
  await c.evaluate('nandWorkbenchAudit.primaryLeaf=nandWorkbenchAudit.leaf;nandWorkbenchAudit.primaryView=nandWorkbenchAudit.view;nandWorkbenchAudit.primaryTerminal=nandWorkbenchAudit.view.terminalInstance;true');
  await c.evaluate(`(async()=>{const a=nandWorkbenchAudit,leaf=app.workspace.getLeaf('tab');a.leaves.push(leaf);await leaf.setViewState({type:'terminal-view',active:true});a.mainView=leaf.view;a.mainLeaf=leaf;})()`);
  await until(c,`(()=>{const a=nandWorkbenchAudit;for(const s of a.service.getAllTerminals())if(!a.owned.includes(s.id))a.owned.push(s.id);return a.mainView.terminalInstance?.session.isAlive()&&a.mainView!==a.primaryView})()`,'separate initialized terminal leaf');
  await c.evaluate(`(()=>{const a=nandWorkbenchAudit;a.mainView.changeWorkbench({navigation:'history',historyQuery:${JSON.stringify(corpus.prefix)},selectedHistory:${JSON.stringify(selected)},showHistory:true});const pop=app.workspace.moveLeafToPopout(a.primaryLeaf,{size:{width:1000,height:800}});a.popWindow=pop.win;const native=a.host.getBrowserWindowForDomWindow(pop.win);native.show();native.restore();native.focus();a.view=a.primaryView;a.leaf=a.primaryLeaf;})()`);
  await until(c,`(()=>{const a=nandWorkbenchAudit;return a.view.contentEl.ownerDocument!==a.mainView.contentEl.ownerDocument&&a.view.terminalInstance===a.primaryTerminal&&a.view.contentEl.querySelector('.nand-history-transcript')?.textContent.includes(${JSON.stringify(refreshMarker)})})()`,'native popout migration preserves terminal/history');
  assert.equal(await c.evaluate('nandWorkbenchAudit.service.getAllTerminals().length'),2);
  rows.push({name:stage,terminalRetained:true,selectedKey:await c.evaluate('nandWorkbenchAudit.view.workbenchState.selectedHistory.key'),passed:true});

  stage='metadata-cross-window';
  const title=`Renamed 中文 ${corpus.prefix}`,tags='review, 中文标签';
  await action(2);
  await until(c,`[nandWorkbenchAudit.view.contentEl.ownerDocument,nandWorkbenchAudit.mainView.contentEl.ownerDocument].some(d=>d.querySelector('.nand-agent-dialog input'))`,'rename dialog');
  await c.evaluate(`(()=>{const a=nandWorkbenchAudit,d=[a.view.contentEl.ownerDocument,a.mainView.contentEl.ownerDocument].find(d=>d.querySelector('.nand-agent-dialog input')),modal=d.querySelector('.nand-agent-dialog'),inputs=modal.querySelectorAll('input');for(const [i,value] of ${JSON.stringify([title,tags])}.entries()){inputs[i].value=value;inputs[i].dispatchEvent(new d.defaultView.Event('input',{bubbles:true}));}modal.querySelector('button').click()})()`);
  await until(c,`[nandWorkbenchAudit.view,nandWorkbenchAudit.mainView].every(v=>v.contentEl.querySelector('.terminal-history-title')?.textContent===${JSON.stringify(title)})`,'rename subscription across windows');
  await action(3);
  await until(c,`[nandWorkbenchAudit.view,nandWorkbenchAudit.mainView].every(v=>v.contentEl.querySelectorAll('.nand-history-actions button')[3]?.getAttribute('aria-pressed')==='true')`,'favorite subscription across windows');
  await action(4);
  await until(c,`[nandWorkbenchAudit.view,nandWorkbenchAudit.mainView].every(v=>v.contentEl.querySelectorAll('.nand-history-actions button')[4]?.getAttribute('aria-pressed')==='true')`,'archive subscription across windows');
  await c.evaluate(`(()=>{for(const v of [nandWorkbenchAudit.view,nandWorkbenchAudit.mainView]){const e=v.contentEl.querySelector('.nand-history-controls select');e.value='archived';e.dispatchEvent(new e.ownerDocument.defaultView.Event('change',{bubbles:true}));}})()`);
  await until(c,`[nandWorkbenchAudit.view,nandWorkbenchAudit.mainView].every(v=>v.contentEl.querySelector('.nand-history-row')?.textContent.includes(${JSON.stringify(title)}))`,'archived filter in both windows');
  rows.push({name:stage,title,tags,favorite:true,archived:true,passed:true});

  stage='export-complete-transcript';
  await action(5);
  const exportPath=`NAND Exports/codex-${selected.sessionId}.md`;
  await until(c,`!!app.vault.getAbstractFileByPath(${JSON.stringify(exportPath)})`,'Markdown export created');
  const exported=await c.evaluate(`app.vault.adapter.read(${JSON.stringify(exportPath)})`);
  assert.ok(exported.startsWith(`# ${title}\n`));
  assert.ok(exported.includes(refreshMarker));
  assert.ok(exported.includes(`FINAL_${corpus.prefix}`));
  rows.push({name:stage,path:exportPath,bytes:Buffer.byteLength(exported),fullTranscript:true,passed:true});

  stage='hidden-owner-theme-and-custom-colors';
  await c.evaluate(`app.commands.executeCommandById('theme:toggle-light-dark');true`);
  // Both renderers are hidden by history/export. Reopen their actual leaves.
  await c.evaluate(`(async()=>{const a=nandWorkbenchAudit;for(const v of [a.mainView,a.view]){v.contentEl.querySelector('.terminal-history-back').click();const win=v.contentEl.ownerDocument.defaultView,native=a.host.getBrowserWindowForDomWindow(win);native.show();native.restore();native.focus();app.workspace.setActiveLeaf(v.leaf,{focus:true});await app.workspace.revealLeaf(v.leaf);}})()`);
  await until(c,`(()=>{const a=nandWorkbenchAudit;return [a.view,a.mainView].every(v=>{const ctx=v.contentEl.ownerDocument.createElement('canvas').getContext('2d'),color=s=>{ctx.fillStyle=s;return ctx.fillStyle};return v.workbenchVisible&&!v.workbenchState.showHistory&&color(v.terminalInstance.getXterm().options.theme.background)===color(v.contentEl.ownerDocument.defaultView.getComputedStyle(v.contentEl).getPropertyValue('--background-primary').trim())})})()`,'visible xterm theme in both owner documents');
  await c.evaluate(`app.commands.executeCommandById('theme:toggle-light-dark');true`);
  await until(c,`(()=>{const a=nandWorkbenchAudit;return [a.view,a.mainView].every(v=>{const ctx=v.contentEl.ownerDocument.createElement('canvas').getContext('2d'),color=s=>{ctx.fillStyle=s;return ctx.fillStyle};return color(v.terminalInstance.getXterm().options.theme.background)===color(v.contentEl.ownerDocument.defaultView.getComputedStyle(v.contentEl).getPropertyValue('--background-primary').trim())})})()`,'theme command while both windows remain visible');
  await c.evaluate(`(()=>{const a=nandWorkbenchAudit;a.originalTerminalOptions=a.view.terminalInstance.getOptions();a.view.terminalInstance.updateOptions({useObsidianTheme:false,backgroundColor:'#102030',foregroundColor:'#f1f2f3'});app.commands.executeCommandById('theme:toggle-light-dark')})()`);
  await delay(250);
  assert.deepEqual(await c.evaluate(`({background:nandWorkbenchAudit.view.terminalInstance.getXterm().options.theme.background,foreground:nandWorkbenchAudit.view.terminalInstance.getXterm().options.theme.foreground})`),{background:'#102030',foreground:'#f1f2f3'});
  await c.evaluate(`nandWorkbenchAudit.view.terminalInstance.updateOptions(nandWorkbenchAudit.originalTerminalOptions);nandWorkbenchAudit.view.changeWorkbench({showHistory:true});true`);
  rows.push({name:stage,ownerDocumentTheme:true,customColorsRetained:true,passed:true});

  stage='duplicate-resume-fixture-cli';
  // This executable is a local CLI substitute: no real provider or authentication.
  const cli=path.join(auth.fixture,'fixture-codex.cmd'),log=path.join(auth.fixture,'resume-args.txt');
  await fs.writeFile(cli,`@echo off\r\necho %*>>"${log}"\r\necho NAND_ISOLATED_CLI_RESUME\r\ntimeout /t 2 /nobreak >nul\r\nexit /b 0\r\n`);
  await c.evaluate(`(()=>{const a=nandWorkbenchAudit;a.originalCodex={...a.host.settings.agentSettings.agents.codex};Object.assign(a.host.settings.agentSettings.agents.codex,{enabled:true,showUsage:false,cliPath:${JSON.stringify(cli)},permissionMode:'manual'});a.originalResume=a.host.resumeSession.bind(a.host);a.resumeCalls=0;a.host.resumeSession=async session=>{a.resumeCalls++;return a.originalResume(session)}})()`);
  await action(4); // Unarchive through the visible action before resuming.
  await c.evaluate(`(()=>{const a=nandWorkbenchAudit,b=a.view.contentEl.querySelector('.nand-history-resume');b.click();b.click();})()`);
  await until(c,`(()=>{const a=nandWorkbenchAudit;for(const s of a.service.getAllTerminals())if(!a.owned.includes(s.id))a.owned.push(s.id);for(const l of app.workspace.getLeavesOfType('terminal-view'))if(a.owned.includes(l.view.terminalInstance?.id)&&!a.leaves.includes(l))a.leaves.push(l);return a.service.getAllTerminals().length===3&&!a.view.workbenchState.resumeKey})()`,'one resumed terminal from duplicate click');
  await until(c,`window.require('fs').existsSync(${JSON.stringify(log)})`,'fixture CLI executed');
  const args=(await fs.readFile(log,'utf8')).trim().split(/\r?\n/);
  assert.equal(args.length,1,'Duplicate click must execute the CLI once');
  assert.ok(args[0].includes(`resume ${selected.sessionId}`));
  assert.equal(await c.evaluate('nandWorkbenchAudit.resumeCalls'),1);
  rows.push({name:stage,cli:'isolated generated cmd substitute (no provider authentication)',calls:1,args:args[0],passed:true});
  await screenshot(c,auth.dir,'history-cross-window-main');
  await fs.writeFile(path.join(auth.dir,'terminal-history-flows.json'),JSON.stringify({passed:true,runtime:auth.runtime,rows},null,2));
  console.log(JSON.stringify({passed:true,cases:rows.length}));
} catch(error) {
  failed=true;
  if(auth){const state=await c.evaluate(`(()=>{const a=window.nandWorkbenchAudit;if(!a)return null;return {sessions:a.service.getAllTerminals().map(s=>({id:s.id,alive:s.isAlive()})),differentDocument:a.mainView&&a.view.contentEl.ownerDocument!==a.mainView.contentEl.ownerDocument,sameTerminal:a.view.terminalInstance===a.primaryTerminal,primaryLeafViewSame:a.primaryLeaf?.view===a.view,leafAttached:!!a.view.contentEl.isConnected,themes:[a.view,a.mainView].filter(Boolean).map(v=>({dark:v.contentEl.ownerDocument.body.classList.contains('theme-dark'),host:v.contentEl.ownerDocument.defaultView.getComputedStyle(v.contentEl.ownerDocument.body).getPropertyValue('--background-primary'),terminal:v.terminalInstance?.getXterm().options.theme.background,visible:v.workbenchVisible,showHistory:v.workbenchState.showHistory,documentVisibility:v.contentEl.ownerDocument.visibilityState,isShown:v.containerEl.isShown(),activeLeaf:app.workspace.activeLeaf?.id,leaf:v.leaf.id,nativeId:a.host.getBrowserWindowForDomWindow(v.contentEl.ownerDocument.defaultView).id,nativeVisible:a.host.getBrowserWindowForDomWindow(v.contentEl.ownerDocument.defaultView).isVisible(),rect:{width:v.contentEl.getBoundingClientRect().width,height:v.contentEl.getBoundingClientRect().height}})),selectedKey:a.view.workbenchState.selectedHistory?.key,text:a.view.contentEl.querySelector('.nand-history-transcript')?.textContent.slice(-400),leafIds:app.workspace.getLeavesOfType('terminal-view').map(l=>({id:l.id,term:l.view.terminalInstance?.id,main:l.view.contentEl.ownerDocument===document}))}})()`);await fs.writeFile(path.join(auth.dir,'terminal-history-flows-error.json'),JSON.stringify({passed:false,stage,error:String(error),state,rows},null,2));}
  throw error;
} finally {
  try {
    if(auth){await c.evaluate(`(()=>{const a=window.nandWorkbenchAudit;if(a?.originalCodex)a.host.settings.agentSettings.agents.codex=a.originalCodex;if(a?.originalResume)a.host.resumeSession=a.originalResume;})()`);if(!(failed&&process.env.NAND_KEEP_FAILURE==='1'))await cleanup(c);}
  } finally {c.close();}
}
