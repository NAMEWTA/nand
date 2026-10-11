// Actual Obsidian: ordered templates, creation/cancellation and persistence.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { connect } from './cdp.mjs';

const templates = ['Templates/A.md', 'Templates/B.md'];
const longPath = `Templates/${'Long-file-name-'.repeat(12)}.md`;
const names = ['Library0','Library1','Library2','Folder0','Folder1','Folder2'];
const columns = names.map(name => ({name, type:name.startsWith('Folder')?'folder':'library', library:{filters:[{property:'channel',values:['local']}],folders:[`Work/${name}`],viewMode:'list',sortBy:'title',sortDesc:false,...(name.endsWith('1')?{templatePath:templates[0]}:{templatePaths:name.endsWith('2')?templates:[]})}}));
const board = `---\nlayout: stacked\nwidgets: []\ncolumns: ${JSON.stringify(columns)}\ncustom: retain # author\n---\n${names.map(name=>`## ${name}\nAuthor prose.\n`).join('\n')}`;
const files = {'Board.md':board, ...Object.fromEntries(names.map(name=>[`Work/${name}/Existing.md`,'---\nchannel: local\n---\nExisting.\n'])),...Object.fromEntries(templates.map((file,i)=>[file,`---\nchannel: template\ncustom: retain\n---\n# {{title}}\nTemplate ${i?'B':'A'}\n{{date:YYYY-MM-DD}}\n`]))};
const runtime = await launchFreshVault({root:process.argv[2],port:9270,files,settings:{version:1,namespaces:{app:{language:'en',introSeen:true,modules:{home:true,agent:false,automations:false,news:false,browser:false,archives:false,notifications:false,sync:false,comments:false,icons:false}},home:{dashboardFile:'Board',workspaceFiles:['Board'],workspaceNames:['Board'],widgetLunarEnabled:false,widgetWeatherEnabled:false,widgetMusicEnabled:false,pomodoroEnabled:false}}}});
let c=runtime.connection; const rows=[];
const check=(name,passed,detail)=>{rows.push({name,passed,detail});assert.ok(passed,name);};
const until=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await c.evaluate(expression))return;await delay(70);}throw Error(expression);};
const click=async expression=>{await c.send('Page.bringToFront');await c.evaluate(`window.focus();${expression}.scrollIntoView({block:'center',inline:'center'});true`);await delay(150);await until(`(()=>{const e=${expression},r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()`);const p=await c.evaluate(`(()=>{const r=${expression}.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});};
const key=async value=>{const windowsVirtualKeyCode={ArrowDown:40,ArrowUp:38,Enter:13,Escape:27,Tab:9}[value];await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:value,code:value,windowsVirtualKeyCode,...(value==='Enter'?{text:'\r'}:{})});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:value,code:value,windowsVirtualKeyCode});await delay(80);};
const section=name=>`document.querySelector('[data-column="${name}"]')`;
const read=file=>fs.readFile(path.join(runtime.vault,file),'utf8');
const button=(text,scope="document.querySelector('.nand-template-list')")=>`[...${scope}.querySelectorAll('button')].find(e=>e.textContent===${JSON.stringify(text)})`;
const home=async()=>{await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard',resourceId:'Board'})`);await until(`document.querySelectorAll('.dashboard-library-newnote-btn').length===6`);await c.evaluate(`window.hs=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-dashboard-view');true`);};
const title=async(name,value)=>{await click(`${section(name)}.querySelector('.dashboard-library-newnote-btn')`);await until(`!!document.querySelector('.dashboard-prompt-input')`);await c.evaluate(`document.querySelector('.dashboard-prompt-input').value=${JSON.stringify(value)};true`);await click(`document.querySelector('.dashboard-confirm-confirm')`);};
const config=async name=>{await click(`${section(name)}.querySelector('.dashboard-library-config-btn')`);await until(`!!document.querySelector('.nand-template-list')`);};
const cancel=async()=>{await click(`document.querySelector('.dashboard-library-config-modal .dashboard-modal-footer .dashboard-modal-btn--cancel')`);await until(`!document.querySelector('.nand-template-list')`);};
const paths=()=>c.evaluate(`[...document.querySelectorAll('[data-template-path]')].map(e=>e.dataset.templatePath)`);
const input=async value=>{await c.evaluate(`(()=>{const e=document.querySelector('.nand-template-list input');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));e.focus()})()`);await delay(100);};
try {
 await c.evaluate(`app.workspace.leftSplit.collapse();true`);await c.send('Emulation.setDeviceMetricsOverride',{width:1500,height:1000,deviceScaleFactor:1,mobile:false});await home();
 check('legacy-read-does-not-write',await read('Board.md')===board);
 for(const name of ['Library1','Folder1']) {await config(name);check(`${name}-legacy-projected-single`,JSON.stringify(await paths())===JSON.stringify([templates[0]]));await cancel();check(`${name}-config-cancel-preserves-bytes`,await read('Board.md')===board);}
 for(const name of names) {
  await title(name,'Existing');
  if(name.endsWith('2')) {await until(`document.querySelectorAll('.suggestion-item').length===2`);await key('ArrowDown');await key('Enter');}
  await until(`!!app.vault.getFileByPath('Work/${name}/Existing-2.md')`);const raw=await read(`Work/${name}/Existing-2.md`);
  check(`${name}-creates-selected-content-filter-and-unique-path`,raw.includes('"channel": "local"')&&(name.endsWith('0')?!raw.includes('Template '):raw.includes(`# Existing\nTemplate ${name.endsWith('2')?'B':'A'}\n`) && /\d{4}-\d{2}-\d{2}/.test(raw) && raw.includes('custom: retain')),raw);await home();
 }
 for(const name of ['Library2','Folder2']) {
  const before=await c.evaluate(`app.vault.getMarkdownFiles().length`);await title(name,'Cancelled');await until(`!!document.querySelector('.suggestion-item')`);await key('Escape');await delay(150);
  check(`${name}-chooser-cancel-creates-nothing`,await c.evaluate(`app.vault.getMarkdownFiles().length`)===before&&!await c.evaluate(`!!document.querySelector('.dashboard-prompt-input')`));
  await click(`${section(name)}.querySelector('.dashboard-library-newnote-btn')`);await until(`!!document.querySelector('.dashboard-prompt-input')`);await key('Escape');check(`${name}-title-cancel-creates-nothing`,await c.evaluate(`app.vault.getMarkdownFiles().length`)===before);
  await config(name);const unchanged=await read('Board.md');await c.evaluate(`document.querySelectorAll('[data-template-path]')[1].querySelector('button').focus()`);await key('Enter');check(`${name}-keyboard-reorder`,JSON.stringify(await paths())===JSON.stringify([...templates].reverse()));await cancel();check(`${name}-reordered-draft-cancel-zero-writes`,await read('Board.md')===unchanged);
  await config(name);await click(`document.querySelectorAll('[data-template-path]')[1].querySelector('button')`);await click(`document.querySelector('.dashboard-library-config-modal .dashboard-modal-footer .dashboard-modal-btn--confirm')`);await until(`hs.sync.getSaveState().status==='saved'&&!document.querySelector('.nand-template-list')`);check(`${name}-ordered-list-and-first-mirror-saved`,await c.evaluate(`(()=>{const cfg=hs.data.columns.find(c=>c.name==='${name}').libraryConfig;return JSON.stringify(cfg.templatePaths)===${JSON.stringify(JSON.stringify([...templates].reverse()))}&&cfg.templatePath==='Templates/B.md'})()`));
 }
 for(const name of ['Library2','Folder2']) {
  await config(name);const before=await read('Board.md');
  await click(`document.querySelector('[data-template-path] button:last-child')`);check(`${name}-remove-draft`,JSON.stringify(await paths())===JSON.stringify([templates[0]]));
  await input(' Templates/B.md ');await key('Enter');await input('Templates/B.md');await click(button('Add'));check(`${name}-add-trims-and-deduplicates`,JSON.stringify(await paths())===JSON.stringify(templates));
  await click(`document.querySelector('[data-template-path] button:last-child')`);await click(button('Browse'+String.fromCodePoint(8230)));await until(`!!document.querySelector('.dashboard-pathpicker')`);
  await click(`[...document.querySelectorAll('.dashboard-pathpicker-item')].find(e=>e.querySelector('.dashboard-pathpicker-name').textContent==='A')`);await until(`!document.querySelector('.dashboard-pathpicker')`);check(`${name}-browse-appends-existing-template`,JSON.stringify(await paths())===JSON.stringify([...templates].reverse()));
  await cancel();check(`${name}-add-remove-browse-cancel-zero-writes`,await read('Board.md')===before);
 }
 await config('Library2');const beforeMatrix=await read('Board.md');await input(longPath);await key('Enter');
 for(const preset of ['system','claude-code','eye-care'])for(const dark of [false,true])for(const width of [500,800,1500]){
  await c.evaluate(`app.plugins.plugins.nand.theme.update(d=>{d.preset=${JSON.stringify(preset)}});app.changeTheme(${JSON.stringify(dark?'obsidian':'moonstone')});true`);await c.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await delay(250);await c.evaluate(`document.querySelector('.nand-template-list').scrollIntoView({block:'center'});true`);await delay(100);
  const bounds=await c.evaluate(`(()=>{const list=document.querySelector('.nand-template-list'),buttons=[...list.querySelectorAll('button')];return {width:list.clientWidth,scroll:list.scrollWidth,controls:buttons.every(b=>{const r=b.getBoundingClientRect();return r.width>=32&&r.height>=32})}})()`);
  check(`templates-${preset}-${dark?'dark':'light'}-${width}`,bounds.scroll<=bounds.width+1&&bounds.controls,bounds);await runtime.shot(`templates-${preset}-${dark?'dark':'light'}-${width}`);
 }await cancel();check('themes-and-resize-never-save-draft',await read('Board.md')===beforeMatrix);
 await c.send('Emulation.setDeviceMetricsOverride',{width:1500,height:1000,deviceScaleFactor:1,mobile:false});
 for(const kind of ['config','title','chooser']) {
  const before=await c.evaluate('app.vault.getMarkdownFiles().length');
  if(kind==='config'){await config('Library2');await click(button('Browse'+String.fromCodePoint(8230)));await until(`!!document.querySelector('.dashboard-pathpicker')`);}
  else if(kind==='title'){await click(`${section('Library2')}.querySelector('.dashboard-library-newnote-btn')`);await until(`!!document.querySelector('.dashboard-prompt-input')`);}
  else {await title('Library2','Cancelled navigation');await until(`!!document.querySelector('.suggestion-item')`);}
  await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'settings',section:'general'})`);await until(`!document.querySelector('.nand-template-list,.dashboard-prompt-input,.suggestion-item,.dashboard-pathpicker')`);check(`${kind}-page-hide-closes-owned-dialog-and-creates-nothing`,await c.evaluate('app.vault.getMarkdownFiles().length')===before);await home();
 }
 check('no-native-errors-before-restart',await c.evaluate('nandAcceptanceErrors.length')===0,await c.evaluate('nandAcceptanceErrors'));
 await runtime.restart();c=runtime.connection;await c.send('Emulation.setDeviceMetricsOverride',{width:1500,height:1000,deviceScaleFactor:1,mobile:false});await home();
 for(const name of ['Library2','Folder2']) {await config(name);check(`${name}-restart-preserves-order`,JSON.stringify(await paths())===JSON.stringify([...templates].reverse()));await c.evaluate(`document.querySelector('.nand-template-list').scrollIntoView({block:'center'});true`);await runtime.shot(`templates-${name}`);await cancel();}
 await c.evaluate(`${section('Library2')}.querySelector('.dashboard-library-newnote-btn').focus()`);await key('Enter');await until(`!!document.querySelector('.dashboard-prompt-input')`);check('new-note-entry-keyboard-operable',true);await key('Escape');
 await c.evaluate(`${section('Folder2')}.querySelector('.dashboard-library-config-btn').focus()`);await key('Enter');await until(`!!document.querySelector('.nand-template-list')`);check('config-entry-keyboard-operable',true);await cancel();
 const main=c,beforePopout=new Set((await(await fetch(process.env.NAND_CDP_URL+'/json')).json()).map(t=>t.id));await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`app.workspace.moveLeafToPopout(hs.leaf,{width:1500,height:1000});true`);await until(`hs.contentEl.win!==window`);
 const pop=(await(await fetch(process.env.NAND_CDP_URL+'/json')).json()).find(t=>t.type==='page'&&!beforePopout.has(t.id));assert.ok(pop);c=await connect(pop.url,pop.id);await c.send('Emulation.setDeviceMetricsOverride',{width:1500,height:1000,deviceScaleFactor:1,mobile:false});await until(`document.querySelectorAll('.dashboard-library-newnote-btn').length===6`);
 await title('Library2','Popout cancelled');await until(`!!document.querySelector('.suggestion-item')`);check('template-choice-owned-by-popout',!await main.evaluate(`!!document.querySelector('.suggestion-item')`));await key('Escape');await config('Folder2');check('template-config-owned-by-popout',!await main.evaluate(`!!document.querySelector('.nand-template-list')`));await c.evaluate(`document.querySelector('.nand-template-list').scrollIntoView({block:'center'});true`);const shot=await c.send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(runtime.evidence,'templates-popout.png'),Buffer.from(shot.data,'base64'));
 await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('home',false)`);await until(`!document.querySelector('.nand-template-list,.dashboard-library-newnote-btn')`);check('module-disable-closes-config-and-unmounts-page',true);c=main;
 check('no-native-errors',await c.evaluate('nandAcceptanceErrors.length')===0,await c.evaluate('nandAcceptanceErrors'));
 await fs.writeFile(path.join(runtime.evidence,'review.json'),JSON.stringify({rows,unverified:['Actual phone hardware']},null,2));
}catch(error){await fs.writeFile(path.join(runtime.evidence,'partial-review.json'),JSON.stringify(rows,null,2));await fs.writeFile(path.join(runtime.evidence,'diagnostic.json'),JSON.stringify(await c.evaluate(`({errors:nandAcceptanceErrors,body:document.body.innerText})`).catch(e=>String(e)),null,2));await runtime.shot('failure').catch(()=>{});throw error;}finally{console.log(JSON.stringify({evidence:runtime.evidence,checks:rows.length,failed:rows.filter(r=>!r.passed)}));await runtime.stop();}
