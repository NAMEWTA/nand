// Retained native element reads, captures, viewport and module lifecycle.
import fs from 'node:fs/promises';
import path from 'node:path';
import { browserFixture } from './browser-fixture.mjs';

await browserFixture(async ({ runtime, url, p, evaluate, until, check, delay }) => {
 const rail = await evaluate(`Array.from(document.querySelectorAll('.nand-rail [data-feature]'),e=>e.dataset.feature)`);
 check('rail-has-only-current-modules', rail.length > 0 && rail.every(id=>['dashboard','terminal','browser','contacts','automations','notifications','icons','comments','sync','content','settings'].includes(id)), rail);
 const panel = await evaluate(`document.querySelector('.nand-panel')?.innerText ?? ''`);
 check('browser-sidebar-contains-only-pages', !/AI workspace|Web assistant|Browser workflows|Local browser access/.test(panel), panel);
 await runtime.shot('browser-sidebar');
 // Create a guest through the same host used by the old page, without restoring removed service facades.
 await evaluate(`window.captureMount=surface.contentEl.createDiv();captureMount.style.cssText='position:fixed;top:220px;left:380px;width:600px;height:400px;z-index:1000';window.capture=host.createPage({...surface.state,id:'capture-fixture',url:${JSON.stringify(url)}},captureMount,()=>{});await capture.ready;await capture.initialLoad;true`);
 const observed = await evaluate(`capture.automation.execute('snapshot',{})`);
 check('native-snapshot-reads-page', observed.snapshot.includes('Browser fixture'));
 const ref = observed.refs.find(row => row.name === 'Read me');
 check('native-element-value', (await evaluate(`capture.automation.execute('get',${JSON.stringify({ revision: observed.revision, element: ref.ref })})`)).text === 'Read me');
 const sensitive = observed.refs.find(row => row.name === 'Password');
 check('password-is-not-returned', !JSON.stringify(await evaluate(`capture.automation.execute('get',${JSON.stringify({ revision: observed.revision, element: sensitive.ref })})`)).includes('fixture-secret'));
 await evaluate(`await capture.automation.design(grab=>{window.picked=grab});true`);
 const point = await evaluate(`capture.guest.executeJavaScript("(()=>{const r=document.querySelector('button').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()")`);
 const offset = await evaluate(`(()=>{const r=capture.webview.getBoundingClientRect();return{x:r.x,y:r.y}})()`);
 for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
  await runtime.connection.send('Input.dispatchMouseEvent', { type, x:point.x+offset.x, y:point.y+offset.y, ...(type === 'mouseMoved' ? {} : { button: 'left', clickCount: 1 }) });
  await delay(100);
 }
 await until('!!window.picked');
 check('native-element-pick-captures-context-and-image', await evaluate(`picked.text==='Read me'&&picked.selector.includes('button')&&picked.screenshot.startsWith('data:image/png;base64,')`));
 const shot = await evaluate('capture.screenshot()');
 check('visible-screenshot', shot.startsWith('data:image/png;base64,'));
 const paths = await evaluate(`host.saveImage(${JSON.stringify(shot)},'Local capture context')`);
 check('capture-files-are-managed-content', paths.every(file => file.startsWith(path.join(runtime.vault, '.nand/content') + path.sep)));
 check('capture-image-bytes-retained', (await fs.readFile(paths.find(file => file.endsWith('.png')))).equals(Buffer.from(shot.split(',')[1], 'base64')));
 check('capture-context-retained', await fs.readFile(paths.find(file => file.endsWith('.txt')), 'utf8') === 'Local capture context');
 await evaluate(`capture.automation.execute('viewport',{width:640,height:480})`);
 check('viewport-simulation', await evaluate(`capture.guest.executeJavaScript('innerWidth')`) === 640);
 await evaluate(`capture.automation.execute('viewport',{})`);
 await evaluate(`await capture.automation.design();host.releasePage('capture-fixture');captureMount.remove();true`);
 check('released-guest-is-disposed', await evaluate('capture.disposed'));
 await evaluate(`${p}.openWorkbench({feature:'automations'})`);
 await until(`!!document.querySelector('.nand-automations')||document.body.innerText.includes('New automation')`);
 const newButton = `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='New automation')`;
 await until(`!!${newButton}`); await evaluate(`${newButton}.click();true`);
 await until(`!!document.querySelector('.nand-automation-editor-body')`);
 const choices = await evaluate(`Array.from(document.querySelectorAll('.nand-automation-editor select option'),o=>o.textContent)`);
 check('automation-has-no-removed-action', choices.length > 0 && !choices.includes('Browser workflow'), choices);
 await runtime.shot('automation-action-choices');
 await evaluate(`${p}.setModuleEnabled('browser',false)`);
 check('module-disable-releases-guests', await evaluate(`!document.querySelector('webview')&&!${p}.services.peek({owner:'browser',id:'open'})`));
});
