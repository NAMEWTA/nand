import { connect } from './cdp.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const c=await connect(); const results=[];
const out='/srv/nand/speculo/.speculo/specdev/changes/2026-09-28-issue-39-widget-source/evidence/implementation';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function snap(name){const r=await c.send('Page.captureScreenshot',{format:'png'});await fs.writeFile(`${out}/${name}.png`,Buffer.from(r.data,'base64'));}
async function clickInbox(name){return c.evaluate(`(async()=>{const p=app.plugins.plugins.nand;p.automationHost.inbox();await new Promise(r=>setTimeout(r,150));const row=[...document.querySelectorAll('.modal .setting-item')].find(e=>e.querySelector('.setting-item-name')?.textContent.includes(${JSON.stringify('Widget test '+name)}));if(!row)throw Error('Missing notification ${name}');row.querySelector('button').click();await new Promise(r=>setTimeout(r,400));return {active:document.activeElement?.dataset.widgetKey,view:app.workspace.activeLeaf.view.getViewType(),dashboard:p.settings.dashboardFile,modals:[...document.querySelectorAll('.modal-content')].map(e=>({key:e.dataset.widgetKey,text:e.textContent.slice(0,120)})),notices:[...document.querySelectorAll('.notice')].map(e=>e.textContent)};})()`);}
async function closeModals(){for(let i=0;i<6 && await c.evaluate("document.querySelectorAll('.modal-container').length");i++){await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await pause(300);}}
try{
 await closeModals();
 for(const language of ['zh','en','zh']){
  await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand;p.settings.language='${language}';await p.saveSettings();await p.loadSettings();await p.automationHost.open();})()`);
  await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:850,deviceScaleFactor:1,mobile:false});await pause(200);
  const legacy=await clickInbox('legacy');results.push({language,case:'legacy inbox',...legacy});
  assert.equal(legacy.active,'countdown-count-100');assert.equal(legacy.modals.length,0);assert.equal(legacy.dashboard,'dashboard');
  await snap(`${language}-${results.length}-wide-inbox`);
  const nested=await clickInbox('nested');results.push({language,case:'nested inbox',...nested});
  assert.equal(nested.active,'anniversary-ann-target');assert.equal(nested.dashboard,'Boards/Nested');assert.equal(nested.modals.length,0);
  for(const key of ['deletedWidget','deletedFile']){
   const failure=await clickInbox(key);results.push({language,case:key,...failure});assert.equal(failure.modals.length,1);assert.ok(failure.notices.length);assert.ok(!failure.notices.at(-1).includes('Error:'));assert.ok(!/任务标识|task IDs/.test(failure.notices.at(-1)));await closeModals();
  }
  await c.evaluate(`(()=>{app.plugins.plugins.nand.settings.modules.dashboard=false;})()`);
  const disabled=await clickInbox('disabled');results.push({language,case:'disabled',...disabled});assert.equal(disabled.modals.length,1);assert.ok(/Enable Dashboard|启用看板/.test(disabled.notices.at(-1)));await closeModals();
  await c.evaluate(`(()=>{app.plugins.plugins.nand.settings.modules.dashboard=true;})()`);
  // Real automation row and source button after reordering; the identity remains stable.
  await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand;p.settings.countdowns.reverse();await p.saveSettings();await p.automationHost.service.refresh();await p.automationHost.open();await new Promise(r=>setTimeout(r,100));const row=[...document.querySelectorAll('.nand-automation-list button')].find(e=>e.textContent.startsWith('Countdown 100'));row.click();await new Promise(r=>setTimeout(r,50));document.querySelector('.nand-automation-detail button').click();})()`);await pause(400);
  assert.equal(await c.evaluate('document.activeElement?.dataset.widgetKey'),'countdown-count-100');results.push({language,case:'reordered automation source',pass:true});
  for(const [width,theme] of [[800,'theme-light'],[500,'theme-dark']]){
   await c.send('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:false});
   await c.evaluate(`(()=>{document.body.classList.remove('theme-light','theme-dark');document.body.classList.add('${theme}');})()`);await pause(200);
   const narrow=await clickInbox('legacy');results.push({language,case:`${width} ${theme}`, ...narrow});assert.equal(narrow.active,'countdown-count-100');assert.equal(narrow.modals.length,width<640?1:0);if(width<640)assert.equal(narrow.modals[0].key,'countdown-count-100');await snap(`${language}-${results.length}-${width}-${theme}`);await closeModals();
  }
 }
 await c.send('Emulation.clearDeviceMetricsOverride');
 await c.evaluate(`(()=>{document.body.classList.remove('theme-dark');document.body.classList.add('theme-light');})()`);
 await fs.writeFile(`${out}/widget-acceptance.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({passed:results.length,results},null,2));
}finally{c.close();}
