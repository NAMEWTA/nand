// Real Obsidian host and guest keyboard input on a disposable local HTTP page.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { connect } from './cdp.mjs';

const baseline=process.argv.includes('--baseline'),rows=[],p='app.plugins.plugins.nand';
const server=createServer((request,response)=>{response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end('<!doctype html><title>Browser shortcut fixture</title><h1>domain fixture</h1><input aria-label="Guest editor"><p>domain domain</p>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/`;
let runtime,c;
const check=(name,passed,detail)=>{rows.push({name,passed,detail});if(!baseline)assert.ok(passed,name);};
const until=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await c.evaluate(expression))return;await delay(80);}throw Error(expression);};
const click=async expression=>{await c.send('Page.bringToFront');await c.evaluate(`window.focus();${expression}.scrollIntoView({block:'center',inline:'center'});true`);await delay(150);const point=await c.evaluate(`(()=>{const r=${expression}.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await until(`(()=>{const e=${expression},r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()`);await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});};
const key=async(value,modifiers=0,connection=c)=>{const vk={Escape:27,Tab:9,Enter:13}[value]??value.toUpperCase().charCodeAt(0);for(const type of ['keyDown','keyUp'])await connection.send('Input.dispatchKeyEvent',{type,key:value,code:value.length===1?'Key'+value.toUpperCase():value,windowsVirtualKeyCode:vk,modifiers});await delay(100);};
const panel=`(document.querySelector('.nand-browser-modal .nand-browser-panel')??[...document.querySelectorAll('.nand-browser-panel')].find(e=>e.getBoundingClientRect().width>0))`;
const address=`${panel}.querySelector('.nand-browser-address')`;
const snapshot=()=>c.evaluate(`({find:!!${panel}.querySelector('.nand-browser-find'),findValue:${panel}.querySelector('.nand-browser-find input')?.value,address:${address}.value,active:document.activeElement?.outerHTML.slice(0,400)})`);
try{
 runtime=await launchFreshVault({root:process.argv[2],port:9276,files:{'Note.md':'# Editor\n\nOriginal note.\n'},settings:{version:1,namespaces:{app:{language:'en',introSeen:true,modules:{browser:true,home:false,agent:false,news:false,archives:false,sync:false,comments:false,notifications:false,automations:false,icons:false}},browser:{enabled:true}}}});c=runtime.connection;
 await c.evaluate(`app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();window.reviewScopes=new Set();const pushScope=app.keymap.pushScope.bind(app.keymap),popScope=app.keymap.popScope.bind(app.keymap);app.keymap.pushScope=s=>{reviewScopes.add(s);pushScope(s)};app.keymap.popScope=s=>{reviewScopes.delete(s);popScope(s)};window.openerService=${p}.services.peek({owner:'browser',id:'open'});openerService.open({url:${JSON.stringify(url)}})`);
 await until(`!!${panel}?.querySelector('webview')&&${address}.value===${JSON.stringify(url)}`);
 for(let i=1;i<=3;i++){
  await click(address);await key('f',2);await c.send('Input.insertText',{text:`domain${i}`});await delay(120);const s=await snapshot();check(`address-find-native-${i}`,s.findValue===`domain${i}`&&s.address===url,s);
  await key('Escape');await click(address);await key('a',2);await c.send('Input.insertText',{text:url});
 }
 await click(address);await key('l',2);check('address-mod-l-selects-all',await c.evaluate(`${address}.selectionStart===0&&${address}.selectionEnd===${address}.value.length`),await snapshot());
 if(!baseline){
  await c.evaluate('window.firstBrowserScope=[...reviewScopes].at(-1);true');
  await key('Tab',8);check('native-tab-focuses-toolbar-button',await c.evaluate(`document.activeElement?.tagName==='BUTTON'&&!!document.activeElement.closest('.nand-browser-toolbar')`),await snapshot());
  await key('f',2);await c.send('Input.insertText',{text:'toolbar'});check('toolbar-find-receives-native-text',(await snapshot()).findValue==='toolbar');
  await key('f',2);await c.send('Input.insertText',{text:'replaced'});check('repeated-find-selects-query',(await snapshot()).findValue==='replaced');
  await key('l',2);check('find-mod-l-focuses-address',await c.evaluate(`document.activeElement===${address}&&${address}.selectionEnd===${address}.value.length`));
  await key('Escape');check('escape-closes-find',!(await snapshot()).find);
  await click(address);await key('l',6);check('extra-alt-is-not-browser-mod-l',await c.evaluate(`${address}.selectionStart===${address}.selectionEnd`));
  const guest=await connect(url);
  await guest.evaluate(`window.keyLog=[];document.addEventListener('keydown',e=>keyLog.push({key:e.key,ctrl:e.ctrlKey}));true`);
  await click(`${panel}.querySelector('webview')`);
  await guest.send('Input.dispatchMouseEvent',{type:'mousePressed',x:40,y:90,button:'left',clickCount:1});await guest.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:40,y:90,button:'left',clickCount:1});
  await key('f',2,guest);await key('l',2,guest);
  check('guest-keeps-native-mod-f-and-l',await guest.evaluate(`keyLog.some(k=>k.key==='f'&&k.ctrl)&&keyLog.some(k=>k.key==='l'&&k.ctrl)`)&&!(await snapshot()).find);
  check('scope-released-for-guest',await c.evaluate('!reviewScopes.has(firstBrowserScope)'));guest.close();
  await click(address);await c.evaluate(`(async()=>{window.firstId=${panel}.dataset.pageId;window.secondId=await openerService.open({url:${JSON.stringify(url+'two')}});return true})()`);
  await until(`${panel}?.dataset.pageId===secondId`);check('hidden-first-pane-releases-scope',await c.evaluate('!reviewScopes.has(firstBrowserScope)'));
  await click(address);await key('f',2);await c.send('Input.insertText',{text:'second-only'});
  check('two-pages-have-one-find-owner',await c.evaluate(`document.querySelector('[data-page-id="'+firstId+'"] .nand-browser-find')===null&&${panel}.querySelector('.nand-browser-find input').value==='second-only'`));await key('Escape');
  await c.evaluate(`window.mainBrowserLeaf=app.workspace.getLeavesOfType('nand-workbench-view')[0];window.noteLeaf=app.workspace.createLeafBySplit(mainBrowserLeaf,'vertical');noteLeaf.openFile(app.vault.getFileByPath('Note.md'))`);await until(`!!document.querySelector('.cm-content')`);await click(`document.querySelector('.cm-content')`);await key('f',2);
  check('note-keeps-host-search',await c.evaluate(`!!noteLeaf.view.containerEl.querySelector('.document-search-container')&&![...document.querySelectorAll('.nand-browser-find')].some(e=>e.getBoundingClientRect().width>0)`));await key('Escape');
  await c.evaluate(`noteLeaf.detach();app.workspace.setActiveLeaf(mainBrowserLeaf,{focus:true});true`);
  await c.evaluate(`openerService.open({url:${JSON.stringify(url+'modal')},target:'modal'})`);await until(`!!document.querySelector('.nand-browser-modal')`);
  await click(address);await key('f',2);await c.send('Input.insertText',{text:'modal'});check('modal-find-uses-local-scope',(await snapshot()).findValue==='modal');
  await key('Escape');check('modal-escape-closes-find-first',await c.evaluate(`!!document.querySelector('.nand-browser-modal')&&!document.querySelector('.nand-browser-modal .nand-browser-find')`));
  await click(address);await key('Escape');check('unhandled-escape-closes-modal',await c.evaluate(`!document.querySelector('.nand-browser-modal')`),await c.evaluate(`Object.fromEntries(Object.getOwnPropertyNames(Object.getPrototypeOf(app.scope)).filter(k=>k!=='constructor').map(k=>[k,String(app.scope[k])]))`));
  const beforeTargets=new Set((await(await fetch(process.env.NAND_CDP_URL+'/json')).json()).map(t=>t.id));
  await c.evaluate(`app.workspace.moveLeafToPopout(mainBrowserLeaf,{width:1100,height:900});true`);await until('mainBrowserLeaf.view.containerEl.win!==window');
  let popupTarget;for(let i=0;i<100&&!popupTarget;i++){popupTarget=(await(await fetch(process.env.NAND_CDP_URL+'/json')).json()).find(t=>t.type==='page'&&!beforeTargets.has(t.id));if(!popupTarget)await delay(100);}
  assert.ok(popupTarget);const main=c;c=await connect(popupTarget.url,popupTarget.id);await until(`!!${panel}?.querySelector('webview')`);
  for(const width of [500,800,1100]){await c.evaluate(`require('@electron/remote').getCurrentWindow().setContentSize(${width},900);true`);await delay(200);await click(address);await key('f',2);await c.send('Input.insertText',{text:`popup${width}`});check(`popout-native-find-${width}`,(await snapshot()).findValue===`popup${width}`);const shot=await c.send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(runtime.evidence,`popout-${width}.png`),Buffer.from(shot.data,'base64'));await key('Escape');}
  await click(address);await key('l',2);check('popout-native-mod-l-selects-all',await c.evaluate(`${address}.selectionStart===0&&${address}.selectionEnd===${address}.value.length`));
  await main.evaluate('window.popupBrowserScope=[...reviewScopes].at(-1);true');
  await c.evaluate(`${p}.setModuleEnabled('browser',false)`);await delay(250);check('module-off-unmounts-browser-panels',await c.evaluate(`!document.querySelector('.nand-browser-panel')`));
  check('module-off-releases-popout-scope',await main.evaluate('!reviewScopes.has(popupBrowserScope)'));
  check('old-main-scope-is-not-retained',await main.evaluate('!reviewScopes.has(firstBrowserScope)'));
  check('main-and-popout-have-no-errors',(await c.evaluate('window.nandAcceptanceErrors?.length??0'))===0&&(await main.evaluate('nandAcceptanceErrors.length'))===0);
  c.close();c=main;
 }
 await runtime.shot(baseline?'baseline':'host-find');
 await fs.writeFile(path.join(runtime.evidence,'result.json'),JSON.stringify({method:'Native CDP Input.dispatchKeyEvent and Input.insertText in real Obsidian. Local HTTP guest.',baseline,rows},null,2));
}catch(error){if(runtime)await fs.writeFile(path.join(runtime.evidence,'partial.json'),JSON.stringify({rows,error:String(error),body:await c.evaluate('document.body.innerText'),errors:await c.evaluate('nandAcceptanceErrors')},null,2));throw error;}finally{if(runtime){console.log(JSON.stringify({evidence:runtime.evidence,checks:rows.length,failed:rows.filter(r=>!r.passed)}));await runtime.stop();}server.close();}
