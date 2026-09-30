// Actual Obsidian leaves, both themes/languages, measured 320/480/800/1280px.
// No CSS width override: viewport adjustments must produce the requested leaf.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { connect } from './cdp.mjs';
import { authorize, openShell, cleanup, until, delay, screenshot, seedHistory } from './terminal-fixture.mjs';
import { language } from './common.mjs';

const c = await connect(), rows = [];
let current;
let authorized;
try {
  authorized = await authorize(c);
  const corpus = await seedHistory(authorized);
  const shell = await openShell(c);
  await c.evaluate(`window.nandWorkbenchAudit.originalTerminal=nandWorkbenchAudit.view.terminalInstance;window.nandWorkbenchAudit.originalXterm=nandWorkbenchAudit.view.contentEl.querySelector('.xterm');true`);
  for (const theme of ['light','dark']) for (const lang of ['zh','en']) for (const width of [320,480,800,1280]) {
    await language(c,lang);
    await c.evaluate(`if(document.body.classList.contains('theme-dark')!==${theme==='dark'})app.commands.executeCommandById('theme:toggle-light-dark');nandWorkbenchAudit.view.changeWorkbench({navigation:'running',showHistory:false,drawerOpen:false,wideSidebarOpen:true,historyQuery:${JSON.stringify(corpus.prefix)},historyOffset:0});true`);
    await until(c,`document.body.classList.contains('theme-dark')===${theme==='dark'}`,'real host theme command');
    let viewport=width+80;
    for (let n=0;n<5;n++) {
      await c.send('Emulation.setDeviceMetricsOverride',{width:Math.round(viewport),height:850,deviceScaleFactor:authorized.deviceScaleFactor,mobile:false});
      await delay(150);
      const actual = await c.evaluate(`nandWorkbenchAudit.view.contentEl.querySelector('.terminal-workbench-shell').getBoundingClientRect().width`);
      if (Math.abs(actual-width)<=1) break;
      viewport+=width-actual;
    }
    await delay(250);
    const row = await c.evaluate(`(()=>{const a=nandWorkbenchAudit,v=a.view,q=s=>v.contentEl.querySelector(s),rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}},root=q('.terminal-workbench-shell'),center=q('.nand-agent-center'),term=q('.terminal-container'),xt=v.terminalInstance.getXterm(),ctx=document.createElement('canvas').getContext('2d'),color=s=>{ctx.fillStyle=s;return ctx.fillStyle;};return {leaf:rect(root),center:rect(center),terminal:rect(term),resizer:rect(q('.terminal-sidebar-resizer')),wideCloseVisible:getComputedStyle(q('.terminal-drawer-close')).display!=='none',themeBackground:color(xt.options.theme.background),hostBackground:color(getComputedStyle(v.contentEl).getPropertyValue('--background-primary').trim()),fontSize:xt.options.fontSize,deviceScaleFactor:window.devicePixelRatio,grid:{cols:xt.cols,rows:xt.rows},canvases:[...term.querySelectorAll('canvas')].map(e=>({css:rect(e),width:e.width,height:e.height})),sameTerminal:a.originalTerminal===v.terminalInstance,sameXterm:a.originalXterm===q('.xterm'),sessions:a.service.getAllTerminals().length,headerScroll:q('.terminal-workbench-header').scrollWidth,headerWidth:q('.terminal-workbench-header').clientWidth,actions:[...q('.terminal-header-actions').querySelectorAll('button')].map(rect)}})()`);
    current={theme,lang,width,viewport,...row};
    assert.ok(Math.abs(row.leaf.width-width)<=1,`Actual leaf width: ${JSON.stringify(row)}`);
    assert.ok(row.sameTerminal&&row.sameXterm,'Resizing/theme/language must retain terminal and xterm');
    assert.equal(row.sessions,1);
    assert.equal(row.themeBackground,row.hostBackground,'Running xterm follows its owner document theme');
    if(width>=800){assert.equal(row.wideCloseVisible,false,'Drawer-only close must be hidden on wide leaves');assert.ok(row.resizer.height>=row.leaf.height-2,'Sidebar separator spans the pane height');}
    assert.ok(row.terminal.width>=100&&row.terminal.height>=120,JSON.stringify(row));
    assert.ok(row.headerScroll<=row.headerWidth+2,`Header overflow: ${JSON.stringify(row)}`);
    for (const action of row.actions) assert.ok(action.x>=row.leaf.x-1&&action.right<=row.leaf.right+1,`Action clipped: ${JSON.stringify(action)}`);
    await screenshot(c,authorized.dir,`terminal-${theme}-${lang}-${width}-running`);
    if (width<800) {
      await c.evaluate(`nandWorkbenchAudit.view.contentEl.querySelector('.terminal-navigation-toggle').click()`);
      await until(c,`nandWorkbenchAudit.view.contentEl.querySelector('.nand-agent-sidebar').getAttribute('aria-modal')==='true'`,'compact navigation drawer');
      if(theme==='light'&&lang==='zh'&&width===320){
        await delay(100);
        row.drawerFocus=[];
        current.drawerFocus=row.drawerFocus;
        for(let n=0;n<16;n++){
          row.drawerFocus.push(await c.evaluate(`({tag:document.activeElement.tagName,cls:document.activeElement.className,text:document.activeElement.textContent?.trim().slice(0,80),summary:document.activeElement.matches('.terminal-usage-details summary')})`));
          for(const type of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type,key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
        }
        assert.ok(row.drawerFocus.some(e=>e.summary),'Keyboard drawer reaches the vault usage summary');
      }
      await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await until(c,`!nandWorkbenchAudit.view.workbenchState.drawerOpen`,'Escape closes drawer');
      await c.evaluate(`nandWorkbenchAudit.view.contentEl.querySelector('.terminal-navigation-toggle').click()`);
    }
    await c.evaluate(`nandWorkbenchAudit.view.contentEl.querySelectorAll('.terminal-navigation-tabs button')[1].click()`);
    await until(c,`nandWorkbenchAudit.view.workbenchState.navigation==='history'&&nandWorkbenchAudit.view.contentEl.querySelectorAll('.nand-history-row').length===100&&!nandWorkbenchAudit.view.contentEl.querySelector('.nand-history-status')`,'100-row isolated history page');
    await c.evaluate(`nandWorkbenchAudit.view.contentEl.querySelector('.nand-history-row button').click()`);
    await until(c,`nandWorkbenchAudit.view.contentEl.querySelector('.nand-history-transcript')?.textContent.includes('FINAL_${corpus.prefix}')`,'complete long transcript in main preview');
    assert.equal(await c.evaluate(`nandWorkbenchAudit.service.getAllTerminals().length`),1);
    await screenshot(c,authorized.dir,`terminal-${theme}-${lang}-${width}-history`);
    rows.push({theme,lang,width,viewport,shell,...row,passed:true});
  }
  await fs.writeFile(path.join(authorized.dir,'terminal.json'),JSON.stringify({passed:true,runtime:authorized.runtime,rows},null,2));
  console.log(JSON.stringify({passed:true,cases:rows.length}));
} catch(error) {
  if (authorized) { await fs.writeFile(path.join(authorized.dir,'terminal-error.json'),JSON.stringify({passed:false,error:String(error),current,rows},null,2)); await screenshot(c,authorized.dir,'terminal-error'); }
  throw error;
} finally { try { if(authorized)await cleanup(c); } finally { c.close(); } }
