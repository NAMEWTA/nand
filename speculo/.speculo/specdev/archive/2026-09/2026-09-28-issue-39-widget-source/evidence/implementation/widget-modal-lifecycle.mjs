import {connect} from './cdp.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const c=await connect();const out='/srv/nand/speculo/.speculo/specdev/changes/2026-09-28-issue-39-widget-source/evidence/implementation';
try{
await c.send('Emulation.setDeviceMetricsOverride',{width:500,height:850,deviceScaleFactor:1,mobile:false});
await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand;document.body.classList.remove('theme-dark');document.body.classList.add('theme-light');await p.automationHost.open();p.automationHost.inbox();await new Promise(r=>setTimeout(r,100));const row=[...document.querySelectorAll('.modal .setting-item')].find(e=>e.querySelector('.setting-item-name')?.textContent.includes('Widget test nested'));row.querySelector('button').click();})()`);
await new Promise(r=>setTimeout(r,6500));
const before=await c.evaluate(`(()=>({key:document.activeElement?.dataset.widgetKey,modal:document.querySelectorAll('.modal-container').length,text:document.querySelector('.modal-content')?.textContent}))()`);assert.equal(before.key,'anniversary-ann-target');assert.equal(before.modal,1);
const shot=await c.send('Page.captureScreenshot',{format:'png'});await fs.writeFile(`${out}/anniversary-narrow-light.png`,Buffer.from(shot.data,'base64'));
await c.evaluate(`(async()=>{await app.workspace.getLeavesOfType('nand-dashboard-view')[0].detach();})()`);await new Promise(r=>setTimeout(r,400));assert.equal(await c.evaluate("document.querySelectorAll('.modal-container').length"),0);
await fs.writeFile(`${out}/widget-modal-lifecycle.json`,JSON.stringify({before,afterCloseModals:0,passed:true},null,2));console.log('Anniversary native panel focused; closing its owning leaf removes the modal');
await c.send('Emulation.clearDeviceMetricsOverride');
}finally{c.close();}
