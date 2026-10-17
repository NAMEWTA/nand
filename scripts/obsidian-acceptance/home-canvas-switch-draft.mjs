// Acceptance: a quick capture that finishes on board A after the page switched to B must not clear the draft typed on B.
// HOME / CLI homes / XDG dirs point into the fixture (fresh-vault.mjs). Run from the repo root after `pnpm build`:
//   NAND_OBSIDIAN_EXECUTABLE=/opt/Obsidian/obsidian xvfb-run -a node scripts/obsidian-acceptance/home-canvas-switch-draft.mjs /tmp/nand-canvas-switch-draft-01
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {launchFreshVault} from './fresh-vault.mjs';
const A='.nand/content/A',B='.nand/content/B';
const board=body=>'---\ncanvas: 1\nlayout: immersive\nwidgets: []\n---\n## Notes\n### Kept\n'+body+'\n';
const runtime=await launchFreshVault({root:process.argv[2],port:Number(process.env.NAND_CANVAS_PORT||9286),files:{[A+'.md']:board('A text'),[B+'.md']:board('B text'),'.nand/content/Template.md':'template body'},settings:{version:1,namespaces:{app:{language:'en',introSeen:true,modules:{home:true,agent:false,browser:false,navigator:false,archives:false,automations:false,notifications:false,icons:false,comments:false,sync:false}},home:{dashboardFile:A,workspaceFiles:[A,B],quickNotesEnabled:true,quickCaptureEnabled:true,quickCaptureMode:'capture',quickCaptureTarget:'',quickCaptureTemplate:'.nand/content/Template.md',quickCaptureFolder:'Captured'}}}});
const c=runtime.connection;const rows=[];
const until=async(expression)=>{for(let i=0;i<150;i++){if(await c.evaluate(expression).catch(()=>false))return;await delay(100)}throw Error('Timeout '+expression)};
const setDraft=(value)=>c.evaluate(`(()=>{const input=document.querySelector('textarea[aria-label="Quick capture"]')??document.querySelector('.dashboard-capture textarea');const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));return input.value})()`);
try{
 await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await c.evaluate(`app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();app.plugins.plugins.nand.openWorkbench({feature:'dashboard',resourceId:'${A}'});true`);
 await until(`!!document.querySelector('.dashboard-capture textarea')`);
 await c.evaluate(`(()=>{app.workspace.iterateAllLeaves(l=>{const s=l.view.getNativeSurfaces?.().find(s=>s.getViewType()==='nand-dashboard-view');if(s)window.revSurface=s});const a=app.vault.adapter;window.revRead=a.read;window.revBlocked=false;a.read=async function(p,...rest){if(p==='.nand/content/Template.md'&&!window.revBlocked){window.revBlocked=true;await new Promise(r=>window.revRelease=r)}return window.revRead.call(this,p,...rest)};return true})()`);
 await setDraft('A submitted');
 await c.evaluate(`document.querySelector('.dashboard-capture textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));true`);
 await until('window.revBlocked');
 await c.evaluate(`window.revSurface.plugin.switchWorkspace('${B}')`);
 await delay(250);
 await setDraft('B unsaved draft');
 const before=await c.evaluate(`({path:window.revSurface.plugin.settings.dashboardFile,draft:document.querySelector('.dashboard-capture textarea').value})`);
 await runtime.shot('B-draft-before-A-save');
 await c.evaluate('window.revRelease();true');await delay(800);
 const after=await c.evaluate(`({path:window.revSurface.plugin.settings.dashboardFile,draft:document.querySelector('.dashboard-capture textarea').value})`);
 const captured=await fs.readdir(path.join(runtime.vault,'.nand/content/Captured'));const saved=await fs.readFile(path.join(runtime.vault,'.nand/content/Captured',captured[0]),'utf8');
 const result={before,after,saved,passed:after.draft==='B unsaved draft'};
 await runtime.shot('B-draft-after-A-save');
 await fs.writeFile(path.join(runtime.evidence,'review.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 assert.equal(result.passed,true);
}finally{await c.evaluate('window.revRelease?.();if(window.revRead)app.vault.adapter.read=window.revRead;true').catch(()=>{});await runtime.stop()}
