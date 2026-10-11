// Native host fuzzy search and safe file-card deletion in library/folder grid, gallery and kanban.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { connect } from './cdp.mjs';
const runtime=await launchFreshVault({root:process.argv[2],port:9276,files:{'Board.md':'---\nwidgets: []\n---\n## Notes\n'},settings:{version:1,namespaces:{app:{language:'en',introSeen:true,modules:{home:true,agent:false,browser:false,news:false,archives:false,automations:false,sync:false,icons:false,comments:false,notifications:false}},home:{dashboardFile:'Board',workspaceFiles:['Board'],workspaceNames:['Board']}}}});
let c=runtime.connection;const rows=[];
const check=(name,passed,detail)=>{rows.push({name,passed,detail});};
const until=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await c.evaluate(expression))return;await delay(70);}throw Error(expression);};
const click=async expression=>{await c.send('Page.bringToFront');await c.evaluate(`window.focus();${expression}.scrollIntoView({block:'center',inline:'center'});true`);await delay(150);const hover=await c.evaluate(`(()=>{const r=${expression}.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...hover});await until(`(()=>{const e=${expression},r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()`);const p=await c.evaluate(`(()=>{const r=${expression}.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});};
const key=async(value,modifiers=0)=>{const windowsVirtualKeyCode={Enter:13,Escape:27,Tab:9,' ':32,ArrowDown:40,ArrowUp:38,ArrowLeft:37,ArrowRight:39}[value];await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:value,code:value===' '?'Space':value,windowsVirtualKeyCode,modifiers,...(['Enter',' '].includes(value)?{text:value==='Enter'?'\r':' '}:{})});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:value,windowsVirtualKeyCode});await delay(100);};


try {
 await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard',resourceId:'Board'},window)`);await until(`!!document.querySelector('.nand-shell')`);
 const ids=new Set((await(await fetch(process.env.NAND_CDP_URL+'/json')).json()).map(t=>t.id));
 await c.evaluate(`window.original=app.workspace.getLeavesOfType('nand-workbench-view')[0];app.workspace.moveLeafToPopout(original,{width:1200,height:900});true`);await until(`original.view.containerEl.win!==window`);
 const target=(await(await fetch(process.env.NAND_CDP_URL+'/json')).json()).find(t=>t.type==='page'&&!ids.has(t.id));assert.ok(target);
 const popup=await connect(target.url,target.id);
 const state=()=>c.evaluate(`(()=>{const leaves=[];app.workspace.iterateAllLeaves(l=>leaves.push({type:l.view.getViewType(),main:l.view.containerEl.win===window,root:l.getRoot().constructor.name,parent:l.parent.constructor.name}));return{leaves,ribbons:[...document.querySelectorAll('.side-dock-ribbon-action')].map(e=>({label:e.getAttribute('aria-label'),html:e.outerHTML.slice(0,300)})),active:app.workspace.getMostRecentLeaf()?.view.getViewType(),body:document.body.innerText.slice(-1000)}})()`);
 rows.push({name:'before-main-ribbon',detail:await state()});
 await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard',resourceId:'Board'},window)`);await delay(400);check('explicit-main-window-open',await c.evaluate(`!!document.querySelector('.nand-shell')`),await state());
 await click(`[...document.querySelectorAll('.side-dock-ribbon-action')].find(e=>e.getAttribute('aria-label')==='Open workbench')`);await delay(1500);
 check('native-main-ribbon-creates-workbench',await c.evaluate(`!!document.querySelector('.nand-shell')`),await state());
 check('original-popup-remains',await popup.evaluate(`!!document.querySelector('.nand-shell')`));
 await popup.evaluate(`app.workspace.setActiveLeaf(app.workspace.getLeavesOfType('nand-workbench-view').find(l=>l.view.containerEl.win===window),{focus:false});true`);
 await c.evaluate(`app.plugins.plugins.nand.workbench.openFocus({feature:'dashboard',resourceId:'Board'},{},window)`);await delay(250);check('main-focus-tab-respects-explicit-owner',await c.evaluate(`app.workspace.getLeavesOfType('nand-workbench-view').filter(l=>l.view.containerEl.win===window&&l.view.focusMode).length===1`));
 await popup.evaluate(`app.plugins.plugins.nand.workbench.openFocus({feature:'dashboard',resourceId:'Board'},{},window)`);await delay(250);check('popup-focus-tab-respects-explicit-owner',await popup.evaluate(`app.workspace.getLeavesOfType('nand-workbench-view').filter(l=>l.view.containerEl.win===window&&l.view.focusMode).length===1`));
 await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard',resourceId:'Board'},window)`);await delay(150);check('main-reuses-full-workbench',await c.evaluate(`app.workspace.getLeavesOfType('nand-workbench-view').filter(l=>l.view.containerEl.win===window&&!l.view.focusMode).length===1`));check('no-window-errors',await c.evaluate('nandAcceptanceErrors.length')===0,await c.evaluate('nandAcceptanceErrors'));

 await runtime.shot('main-after-ribbon');
 await fs.writeFile(path.join(runtime.evidence,'review.json'),JSON.stringify(rows,null,2));
}catch(error){await fs.writeFile(path.join(runtime.evidence,'partial.json'),JSON.stringify({rows,error:String(error),body:await c.evaluate(`document.body.innerText`)},null,2));throw error;}finally{console.log(JSON.stringify({evidence:runtime.evidence,checks:rows.filter(r=>r.passed!==undefined).length,failed:rows.filter(r=>r.passed===false)}));await runtime.stop();}
