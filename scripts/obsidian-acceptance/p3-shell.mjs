import fs from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { connect } from './cdp.mjs';
const root = process.env.NAND_P3_FIXTURE;
assert.ok(root && root.startsWith('/tmp/nand-p3-'));
await fs.mkdir(root);
const vault = path.join(root, 'vault'), profile = path.join(root, 'profile'), evidence = path.join(root, 'evidence');
const pluginDir = path.join(vault, '.obsidian/plugins/nand');
for (const dir of [pluginDir, profile, evidence, path.join(vault, '.nand/config'), path.join(root, 'config')]) await fs.mkdir(dir, { recursive: true });
for (const file of ['main.js', 'styles.css', 'manifest.json']) await fs.copyFile(file, path.join(pluginDir, file));
await fs.writeFile(path.join(vault, '.obsidian/community-plugins.json'), '["nand"]');
const minimalDir = process.env.NAND_P3_MINIMAL_DIR;
if (minimalDir) {
 const themeDir = path.join(vault, '.obsidian/themes/Minimal'); await fs.mkdir(themeDir, {recursive:true});
 const manifest = JSON.parse(await fs.readFile(path.join(minimalDir,'manifest.json'),'utf8')); assert.equal(manifest.version,'9.0.2');
 for (const file of ['theme.css','manifest.json','LICENSE']) await fs.copyFile(path.join(minimalDir,file),path.join(themeDir,file));
 await fs.writeFile(path.join(vault,'.obsidian/appearance.json'),JSON.stringify({cssTheme:'Minimal'}));
 await fs.writeFile(path.join(evidence,'minimal-manifest.json'),JSON.stringify(manifest,null,2));
} 
await fs.writeFile(path.join(vault, '.nand/config/settings.json'), JSON.stringify({ version: 1, namespaces: { app: { language: 'zh', introSeen: true, modules: { home: true, archives: true, comments: false, browser: true, agent: false, icons: false, sync: false, automations: false, notifications: false } }, home: { widgetMusicEnabled: false, widgetWeatherEnabled: false } } }));
await fs.writeFile(path.join(vault, 'Welcome.md'), '# NAND P3 fixture\n');
await fs.writeFile(path.join(profile, 'obsidian.json'), JSON.stringify({ updateDisabled: true, vaults: { abcdef1234567890: { path: vault, ts: Date.now(), open: true } } }));
const port = process.env.NAND_P3_CDP_PORT || '19553';
process.env.NAND_CDP_URL = 'http://127.0.0.1:' + port;
function start() {
const log = openSync(path.join(evidence, 'app.log'), 'a');
const child = spawn('/opt/Obsidian/obsidian', ['--no-sandbox', '--disable-gpu', '--user-data-dir=' + profile, '--remote-debugging-port=' + port], { env: { ...process.env, XDG_CONFIG_HOME: path.join(root, 'config') }, stdio: ['ignore', log, log] });
closeSync(log); return child; }
let proc = start();
let c; const results = [], errors = [];
async function waitFor(fn, name) { for (let i = 0; i < 600; i++) { if (await fn().catch(() => false)) return; await delay(100); } throw new Error('Timeout: ' + name); }
async function click(connection, selector, text) {
 const point = await connection.evaluate(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => ${text ? 'e.textContent.trim() === '+JSON.stringify(text) : 'true'}); if (!e) throw Error('Missing control'); e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
 await connection.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
 await connection.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
 await connection.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
 await delay(250);
}
async function escape(connection) { await connection.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await connection.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await delay(250); }
async function shot(connection, name) { const { data } = await connection.send('Page.captureScreenshot'); await fs.writeFile(path.join(evidence, name + '.png'), Buffer.from(data, 'base64')); }
async function key(connection, key, virtual, modifiers = 0) {
 await connection.send('Input.dispatchKeyEvent', { type:'keyDown', key, code:key, windowsVirtualKeyCode:virtual, modifiers });
 await connection.send('Input.dispatchKeyEvent', { type:'keyUp', key, code:key, windowsVirtualKeyCode:virtual, modifiers });
 await delay(60);
}
async function resize(connection, width) {
 await connection.evaluate(`(()=>{const e=app.workspace.getLeavesOfType('nand-workbench-view')[0].view.contentEl;e.style.width='${width}px';e.style.maxWidth='${width}px';return true;})()`);await delay(350);
}
const focused = connection => connection.evaluate(`(()=>{const e=document.activeElement;return {region:e?.closest('[data-shell-region]')?.dataset.shellRegion??null,label:e?.getAttribute('aria-label'),open:!!document.querySelector('[data-slot=sheet-content]')}})()`);

try {
 await waitFor(async () => { c = await connect(); return true; }, 'CDP');
 c.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails)); await c.send('Runtime.enable');
 await waitFor(async () => { await c.evaluate(`(()=>{[...document.querySelectorAll('button')].find(e=>e.textContent==='Trust author and enable plugins')?.click();return true;})()`); return c.evaluate(`!!globalThis.app?.plugins.plugins.nand?.appSettings`); }, 'plugin');
 assert.equal(await c.evaluate('app.vault.adapter.basePath'), vault);
 await waitFor(() => c.evaluate(`!!app.workspace.layoutReady && !!app.plugins.plugins.nand.workbench && app.plugins.plugins.nand.moduleState('archives') === 'active'`), 'workbench ready');
 await c.evaluate(`require('@electron/remote').getCurrentWindow().setSize(1600,1050); true`);
 await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand;await p.appSettings.update(d=>{d.devGallery=true;});await p.openWorkbenchSettings('general');return true;})()`);
 await waitFor(() => c.evaluate(`!!document.querySelector('.nand-settings-page')`), 'settings');
 if (minimalDir) {
  await waitFor(()=>c.evaluate(`Array.from(document.styleSheets).some(s=>s.ownerNode?.textContent?.includes('Minimal Theme for Obsidian'))`),'Minimal stylesheet loaded');
  results.push({communityTheme:'Minimal',version:'9.0.2',loaded:true});
 }
 // Deterministic quota fixture; no CLI credentials or remote quota API is touched.
 await c.evaluate(`(()=>{const p=app.plugins.plugins.nand; const peek=p.services.peek.bind(p.services);const snapshot={refreshing:false,providers:[{id:'claude-code',name:'Claude',windows:[{label:'5h',usedPercent:78},{label:'周',usedPercent:94}]},{id:'codex',name:'Codex',windows:[{label:'5h',usedPercent:100},{label:'周',usedPercent:80}]},{id:'gemini',name:'Gemini',windows:[{label:'Pro',usedPercent:40}]}]};const usage={snapshot:()=>snapshot,subscribe:()=>()=>{},refresh:async()=>{},setDisplay:()=>{}};p.services.peek=key=>key.owner==='agent'&&key.id==='usage'?usage:peek(key);p.workbenchRefresh();return true;})()`);
 assert.equal(await c.evaluate(`document.querySelectorAll('.nand-usage-mirror').length`),0);
 await c.evaluate(`app.plugins.plugins.nand.appSettings.update(d=>{d.statusBar.mirrorToObsidian=true;}).then(()=>true)`);await waitFor(()=>c.evaluate(`!!document.querySelector('.nand-usage-mirror')?.textContent.includes('Claude')`),'optional mirror');
 await c.evaluate(`app.plugins.plugins.nand.appSettings.update(d=>{d.statusBar.mirrorToObsidian=false;}).then(()=>true)`);await waitFor(()=>c.evaluate(`!document.querySelector('.nand-usage-mirror')`),'mirror removed');results.push({mirrorDefaultOff:true,mirrorToggle:true});
 for (const theme of ['theme-light','theme-dark']) {
  await c.evaluate(`document.body.classList.remove('theme-light','theme-dark');document.body.classList.add('${theme}');true`);
  for (const width of [1200,800,500]) {
   await c.evaluate(`(()=>{const e=app.workspace.getLeavesOfType('nand-workbench-view')[0].view.contentEl;e.style.width='${width}px';e.style.maxWidth='${width}px';return true;})()`); await delay(350);
   const metrics=await c.evaluate(`(()=>{const s=document.querySelector('.nand-shell'),bar=document.querySelector('.nand-status-bar');return {theme:'${theme}',width:s.getBoundingClientRect().width,layout:s.dataset.layout,barHeight:bar.getBoundingClientRect().height,overflow:s.scrollWidth-s.clientWidth,collapsed:bar.querySelector('[data-usage-more]')?.textContent,panel:!!s.querySelector('[data-shell-region=panel]')};})()`);
   results.push(metrics);assert.equal(metrics.layout,width===1200?'wide':width===800?'medium':'narrow');assert.equal(metrics.barHeight,24);assert.equal(metrics.overflow,0); await shot(c,`${theme}-${width}`);
   const controls = await c.evaluate(`(()=>{const input=document.querySelector('.nand-settings-page input[type=search]'),button=document.querySelector('.nand-settings-page [role=radio]'),content=document.querySelector('[data-settings-scroll] > div');return {theme:'${theme}',width:${width},inputHeight:input.getBoundingClientRect().height,buttonHeight:button.getBoundingClientRect().height,inputText:getComputedStyle(input).color,inputBackground:getComputedStyle(input).backgroundColor,buttonPointer:getComputedStyle(button).pointerEvents,spacing:[getComputedStyle(content).rowGap,getComputedStyle(content).paddingTop,getComputedStyle(content).paddingLeft,getComputedStyle(content).paddingBottom],scroll:getComputedStyle(content.parentElement).overflowY,contentOverflow:content.scrollWidth-content.clientWidth}})()`);results.push({controls});assert.equal(controls.inputHeight,36);assert.ok(controls.buttonHeight>=24);assert.notEqual(controls.buttonPointer,'none');assert.deepEqual(controls.spacing,['40px','40px','32px','96px']);assert.equal(controls.scroll,'auto');assert.equal(controls.contentOverflow,0);
   if(width===1200) { await click(c,'button[aria-label="用量"]');await shot(c,`${theme}-usage-roster`);assert.equal(await c.evaluate(`!!document.querySelector('[data-slot=dropdown-menu-content]')?.closest('.nand-portal-root')`),true);await escape(c); }

   if(width!==1200) {
    await click(c,'button[aria-label="切换导航栏"]');await waitFor(()=>c.evaluate(`!!document.querySelector('[data-slot=sheet-content]')`),'sheet');
    results.push(await c.evaluate(`(()=>{const e=document.querySelector('[data-slot=sheet-content]');return {sheet:true,width:e.getBoundingClientRect().width,scoped:!!e.closest('.nand-portal-root'),focused:e.contains(document.activeElement)};})()`));await shot(c,`${theme}-${width}-drawer`);
    if(width===800) {
     const f6=[];
     for(const modifiers of [8,0]) {
      await key(c,'F6',117,modifiers);const rail=await focused(c);assert.equal(rail.region,'rail');f6.push(rail);
      await key(c,'F6',117,modifiers);const panel=await focused(c);assert.equal(panel.region,'panel');f6.push(panel);
     }
     const tabs=[];
     for(const modifiers of [0,8]) {
      const traversal=[];
      for(let i=0;i<18;i++) {await key(c,'Tab',9,modifiers);const state=await focused(c);assert.ok(state.open);assert.ok(['rail','panel'].includes(state.region));traversal.push(state);}
      assert.deepEqual(new Set(traversal.map(s=>s.region)),new Set(['rail','panel']));tabs.push({reverse:modifiers===8,traversal});
     }
     results.push({keyboard:{theme,f6,tabs}});await shot(c,`${theme}-medium-keyboard`);
    }
    // The same dialog, search value and focus survive both directions without an autofocus remount.
    await click(c,'[data-slot=sheet-content] input');await c.send('Input.insertText',{text:'常规'});
    await c.evaluate(`window.p3Drawer=document.querySelector('[data-slot=sheet-content]');window.p3DrawerFocus=document.activeElement;true`);
    const transitions=[];
    for(const targetWidth of [width===500?800:500,width, width===500?800:500,width]) {
     await resize(c,targetWidth);
     const state=await c.evaluate(`({width:${targetWidth},layout:document.querySelector('.nand-shell').dataset.layout,open:!!document.querySelector('[data-slot=sheet-content]'),sameDialog:document.querySelector('[data-slot=sheet-content]')===window.p3Drawer,sameFocus:document.activeElement===window.p3DrawerFocus,query:document.activeElement?.value,rails:document.querySelectorAll('[data-shell-region=rail]').length})`);
     assert.ok(state.open&&state.sameDialog&&state.sameFocus,JSON.stringify(state));assert.equal(state.query,'常规');assert.equal(state.rails,1);assert.equal(state.layout,targetWidth===800?'medium':'narrow');transitions.push(state);
    }
    results.push({drawerResize:{theme,start:width,transitions}});await shot(c,`${theme}-${width}-resized-drawer`);
    await escape(c);
    assert.equal(await c.evaluate(`!!document.querySelector('[data-slot=sheet-content]')`),false);
    assert.equal((await focused(c)).label,'切换导航栏');
    assert.deepEqual(await c.evaluate(`({pointer:document.body.style.pointerEvents,lock:document.body.getAttribute('data-scroll-locked')})`),{pointer:'',lock:null});
   }
  }
 }
 await c.evaluate(`(()=>{const e=app.workspace.getLeavesOfType('nand-workbench-view')[0].view.contentEl;e.style.width='240px';e.style.maxWidth='240px';return true;})()`);await delay(350);
 const collapse=await c.evaluate(`({collapsed:document.querySelector('[data-usage-more]')?.textContent,hidden:document.querySelectorAll('[data-usage-collapsed=true]').length,overflow:document.querySelector('.nand-shell').scrollWidth-document.querySelector('.nand-shell').clientWidth})`);assert.ok(collapse.hidden>0);assert.equal(collapse.overflow,0);results.push({collapse});await shot(c,'usage-collapsed');
 await c.evaluate(`(()=>{const e=app.workspace.getLeavesOfType('nand-workbench-view')[0].view.contentEl;e.style.width='1200px';e.style.maxWidth='1200px';return true;})()`);await delay(350);
 await click(c,'button[aria-label="用量"]');await shot(c,'usage-roster');assert.equal(await c.evaluate(`!!document.querySelector('[data-slot=dropdown-menu-content]')?.closest('.nand-portal-root')`),true);await escape(c);
 // Real context menu changes the persistent app namespace.
 const point=await c.evaluate(`(()=>{const r=document.querySelector('.nand-status-bar').getBoundingClientRect();return {x:r.right-10,y:r.top+12};})()`);
 await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'right',clickCount:1,...point});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'right',clickCount:1,...point});await delay(150);await shot(c,'status-context');
 await click(c,'[role=menuitemcheckbox]','用量');await delay(200);assert.equal(await c.evaluate(`app.plugins.plugins.nand.appSettings.get().statusBar.segments.usage`),false);
 await c.evaluate(`app.plugins.plugins.nand.appSettings.update(d=>{d.statusBar.segments.usage=true;}).then(()=>true)`);
 // The upstream no-results surface appears when all setting wrappers report zero matches.
 await c.evaluate(`(()=>{const e=document.querySelector('.nand-settings-page input[type=search]');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(e,'NAND-no-match-42719');e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
 await waitFor(()=>c.evaluate(`(()=>{const e=document.querySelector('[data-settings-empty]');return !!e&&getComputedStyle(e).display!=='none'&&!document.querySelector('[data-settings-pending]')})()`),'settings empty state');await shot(c,'settings-empty');results.push({emptySettings:true});
 // Global settings search enters a still-legacy module and leaves only matching rows.
 await c.evaluate(`(()=>{const e=document.querySelector('.nand-settings-page input[type=search]');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(e,'搜索引擎');e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);await waitFor(()=>c.evaluate(`!!document.querySelector('.nand-settings-page .setting-item:not([hidden]) mark')`),'search matches');await shot(c,'settings-search');
 const search=await c.evaluate(`({marks:[...document.querySelectorAll('.nand-settings-page mark')].map(e=>e.textContent),visibleRows:[...document.querySelectorAll('.nand-settings-page .setting-item')].filter(e=>!e.hidden).map(e=>e.innerText)})`);results.push({search});assert.ok(search.visibleRows.some(t=>t.includes('搜索引擎')));assert.ok(search.marks.includes('搜索引擎'));
 await c.evaluate(`(()=>{const e=document.querySelector('.nand-settings-page input[type=search]');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(e,'');e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);await delay(200);
 await c.evaluate(`app.plugins.plugins.nand.openWorkbenchSettings('components').then(()=>true)`);await waitFor(()=>c.evaluate(`!!document.querySelector('[data-slot=component-gallery]')`),'gallery');await shot(c,'gallery');
 await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'contacts'},window).then(()=>true)`);await delay(250);await shot(c,'legacy-contacts');assert.ok(await c.evaluate(`document.querySelectorAll('.nand-contacts-action').length`));
 // Real mouse rail selection must reach the visible medium rail on the first click.
 for (const width of [800,500]) {
  await c.evaluate(`app.plugins.plugins.nand.openWorkbenchSettings('general').then(()=>true)`);
  await c.evaluate(`(()=>{const e=app.workspace.getLeavesOfType('nand-workbench-view')[0].view.contentEl;e.style.width='${width}px';e.style.maxWidth='${width}px';return true;})()`);await delay(350);
  await click(c,'button[aria-label="切换导航栏"]');await click(c,'[data-feature=contacts]');
  await waitFor(()=>c.evaluate(`app.workspace.getLeavesOfType('nand-workbench-view')[0].view.getState().target.feature==='contacts'`),'one-click rail navigation');
  const rail=await c.evaluate(`({width:${width},drawerOpen:!!document.querySelector('[data-slot=sheet-content]'),target:app.workspace.getLeavesOfType('nand-workbench-view')[0].view.getState().target})`);assert.equal(rail.drawerOpen,width===500);results.push({rail});await shot(c,'rail-navigation-'+width);await escape(c);
 }
 // Native leaf navigation must finish the source interaction before the destination receives its first click.
 await c.evaluate(`app.plugins.plugins.nand.openWorkbenchSettings('general').then(()=>true)`);
 await c.evaluate(`window.p3Source=app.workspace.getLeavesOfType('nand-workbench-view')[0];window.p3SourcePage=p3Source.view.contentEl.querySelector('.nand-settings-page');true`);
 const leafState=()=>c.evaluate(`(()=>{const active=app.workspace.activeLeaf,input=active.view.contentEl.querySelector('input');return {activeIsSource:active===p3Source,sourceShown:p3Source.view.contentEl.isShown(),pagePreserved:p3SourcePage===p3Source.view.contentEl.querySelector('.nand-settings-page'),sheet:!!document.querySelector('[data-slot=sheet-content]'),menu:!!document.querySelector('[role=menu]'),tooltip:!!document.querySelector('[data-slot=tooltip-content]'),guards:document.querySelectorAll('[data-radix-focus-guard]').length,pointer:document.body.style.pointerEvents,lock:document.body.getAttribute('data-scroll-locked'),inputFocused:document.activeElement===input,focusInSource:p3Source.view.contentEl.contains(document.activeElement)}})()`);
 const assertReleased=(state)=>{assert.equal(state.sheet,false);assert.equal(state.menu,false);assert.equal(state.tooltip,false);assert.equal(state.guards,0);assert.equal(state.pointer,'');assert.equal(state.lock,null);assert.equal(state.pagePreserved,true);};
 const firstDestinationClick=async()=>{
  const point=await c.evaluate(`(()=>{const input=app.workspace.activeLeaf.view.contentEl.querySelector('input'),r=input.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await delay(150);
  const state=await leafState();assert.equal(state.inputFocused,true);assert.equal(state.focusInSource,false);assertReleased(state);return state;
 };
 const railContext=async()=>{
  const point=await c.evaluate(`(()=>{const r=document.querySelector('[data-feature=contacts]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'right',clickCount:1,...point});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'right',clickCount:1,...point});await delay(150);
 };
 for(const theme of ['theme-light','theme-dark']) {
  await c.evaluate(`document.body.classList.remove('theme-light','theme-dark');document.body.classList.add('${theme}');true`);
  for(const width of [800,500]) for(const placement of ['tab','split']) {
   await resize(c,width);await click(c,'button[aria-label="切换导航栏"]');await railContext();
   await click(c,'[role=menuitem]',placement==='tab'?'在原生标签页中打开':'在分屏中打开');
   await waitFor(()=>c.evaluate(`app.workspace.activeLeaf!==p3Source&&!!app.workspace.activeLeaf.view.contentEl.querySelector('input')`),'native destination');await delay(250);
   await c.evaluate(`window.p3Destination=app.workspace.activeLeaf;true`);
   const opened=await leafState();assertReleased(opened);assert.equal(opened.activeIsSource,false);assert.equal(opened.sourceShown,placement==='split');
   const firstClick=await firstDestinationClick();results.push({nativeOpen:{theme,width,placement,opened,firstClick}});await shot(c,`${theme}-${width}-native-${placement}`);
   await c.evaluate(`app.workspace.revealLeaf(p3Source).then(()=>{app.workspace.setActiveLeaf(p3Source,{focus:true});return true;})`);await delay(250);
   const returned=await leafState();assertReleased(returned);assert.equal(returned.sourceShown,true);assert.equal(returned.activeIsSource,true);
   await c.evaluate(`p3Destination.detach();true`);await delay(250);
  }
  // Switch via the native workspace API, bypassing ShellRoot.onOpen altogether.
  await c.evaluate(`app.plugins.plugins.nand.workbench.openFocus({feature:'contacts'},{},window).then(()=>true)`);
  await waitFor(()=>c.evaluate(`app.workspace.activeLeaf!==p3Source&&!!app.workspace.activeLeaf.view.contentEl.querySelector('input')`),'visibility destination');
  await c.evaluate(`window.p3Destination=app.workspace.activeLeaf;app.workspace.revealLeaf(p3Source).then(()=>{app.workspace.setActiveLeaf(p3Source,{focus:true});return true;})`);await delay(250);
  for(const interaction of ['sheet-menu','status-menu','usage-menu']) {
   await resize(c,interaction==='sheet-menu'?800:1200);
   if(interaction==='sheet-menu'){await click(c,'button[aria-label="切换导航栏"]');await railContext();}
   if(interaction==='status-menu'){
    const point=await c.evaluate(`(()=>{const r=document.querySelector('.nand-status-bar').getBoundingClientRect();return {x:r.right-10,y:r.top+12}})()`);
    await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'right',clickCount:1,...point});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'right',clickCount:1,...point});await delay(150);
   }
   if(interaction==='usage-menu')await click(c,'button[aria-label="用量"]');
   assert.equal(await c.evaluate(`!!document.querySelector('[role=menu]')`),true);
   await c.evaluate(`app.workspace.revealLeaf(p3Destination).then(()=>{app.workspace.setActiveLeaf(p3Destination,{focus:true});return true;})`);await delay(250);
   const hidden=await leafState();assertReleased(hidden);assert.equal(hidden.sourceShown,false);assert.equal(hidden.focusInSource,false);
   const firstClick=await firstDestinationClick();await shot(c,`${theme}-hidden-${interaction}`);
   await c.evaluate(`app.workspace.revealLeaf(p3Source).then(()=>{app.workspace.setActiveLeaf(p3Source,{focus:true});return true;})`);await delay(250);
   const returned=await leafState();assertReleased(returned);assert.equal(returned.sourceShown,true);results.push({hiddenLifecycle:{theme,interaction,hidden,firstClick,returned}});
  }
  await c.evaluate(`p3Destination.detach();true`);await delay(250);
 }
 // Keep the same quota source/snapshot while adopting the live root into another Document.
 await c.evaluate(`app.plugins.plugins.nand.openWorkbenchSettings('general').then(()=>true)`);
 const usageTargets=new Set((await(await fetch(process.env.NAND_CDP_URL+'/json')).json()).map(t=>t.id));
 await c.evaluate(`window.p3UsageLeaf=app.workspace.getLeavesOfType('nand-workbench-view')[0];app.workspace.moveLeafToPopout(p3UsageLeaf,{width:900,height:900});true`);await waitFor(()=>c.evaluate(`p3UsageLeaf.view.contentEl.win!==window`),'usage popout migration');
 const usageTarget=(await(await fetch(process.env.NAND_CDP_URL+'/json')).json()).find(t=>t.type==='page'&&!usageTargets.has(t.id));assert.ok(usageTarget);const usagePop=await connect(usageTarget.url,usageTarget.id);usagePop.on('Runtime.exceptionThrown',event=>errors.push(event.exceptionDetails));await usagePop.send('Runtime.enable');
 await waitFor(()=>usagePop.evaluate(`!!document.querySelector('[data-usage-chip]')`),'popout usage data');
 for (const width of [240,700,400,240]) {
  await c.evaluate(`p3UsageLeaf.view.contentEl.style.width='${width}px';p3UsageLeaf.view.contentEl.style.maxWidth='${width}px';true`);await delay(500);
  const usageMetrics=await usagePop.evaluate(`(()=>{const cluster=document.querySelector('.status-bar-usage-cluster');return {width:${width},clusterWidth:cluster.clientWidth,hidden:document.querySelectorAll('[data-usage-collapsed=true]').length,more:document.querySelector('[data-usage-more]')?.textContent??null,refreshRight:document.querySelector('[aria-label="刷新用量数据"]').getBoundingClientRect().right,clusterRight:cluster.getBoundingClientRect().right}})()`);
  if(width===700)assert.equal(usageMetrics.hidden,0);if(width===240)assert.ok(usageMetrics.hidden>0);assert.ok(usageMetrics.refreshRight<=usageMetrics.clusterRight+1,JSON.stringify(usageMetrics));results.push({popoutUsage:usageMetrics});await shot(usagePop,'popout-usage-'+width);
 }
 await c.evaluate(`p3UsageLeaf.view.contentEl.style.width='700px';p3UsageLeaf.view.contentEl.style.maxWidth='700px';true`);await delay(350);
 await click(usagePop,'button[aria-label="切换导航栏"]');await waitFor(()=>usagePop.evaluate(`!!document.querySelector('[data-slot=sheet-content]')`),'popout sheet');
 const popup=await usagePop.evaluate(`(()=>{const e=document.querySelector('[data-slot=sheet-content]');return {owner:e.ownerDocument===document,portal:!!e.closest('.nand-portal-root'),focus:e.contains(document.activeElement)};})()`);assert.ok(popup.owner&&popup.portal&&popup.focus);assert.equal(await c.evaluate(`!!document.querySelector('[data-slot=sheet-content]')`),false);results.push({popout:popup});await shot(usagePop,'popout-drawer');await escape(usagePop);
 usagePop.close();
 // Persist real choices, restart the same isolated profile, and check the restored namespace.
 await c.evaluate(`app.plugins.plugins.nand.appSettings.update(d=>{d.statusBar.usageMode='compact';d.statusBar.usageDisplay='remaining';d.statusBar.segments.notifications=false;d.font='host';d.palette='orca';}).then(()=>true)`);
 const config=JSON.parse(await fs.readFile(path.join(vault,'.nand/config/settings.json'),'utf8'));results.push({persisted:config.namespaces.app.statusBar});assert.equal(config.namespaces.app.statusBar.usageDisplay,'remaining');
 await c.evaluate(`setTimeout(()=>require('@electron/remote').app.quit(),50);true`);c.close();c=null;await waitFor(async()=>proc.exitCode!==null,'first app shutdown');proc=start();
 await waitFor(async()=>{c=await connect();return true;},'restarted CDP');c.on('Runtime.exceptionThrown',event=>errors.push(event.exceptionDetails));await c.send('Runtime.enable');
 await waitFor(()=>c.evaluate(`!!globalThis.app?.plugins.plugins.nand?.appSettings`),'restarted plugin');
 await waitFor(()=>c.evaluate(`!!app.workspace.layoutReady && !!app.plugins.plugins.nand.workbench && app.plugins.plugins.nand.moduleState('archives')==='active'`),'restarted workbench');
 const restored=await c.evaluate(`app.plugins.plugins.nand.appSettings.get()`);assert.deepEqual(restored.statusBar,config.namespaces.app.statusBar);assert.equal(restored.font,'host');assert.equal(restored.palette,'orca');results.push({restart:true,statusBar:restored.statusBar});
 await c.evaluate(`app.plugins.plugins.nand.openWorkbenchSettings('general').then(()=>true)`);
 // Obsidian restores a leaf in its saved popout. Select that renderer instead of assuming the main document.
 await waitFor(async()=>{
  if(await c.evaluate(`!!document.querySelector('.nand-settings-page')`))return true;
  for(const target of (await(await fetch(process.env.NAND_CDP_URL+'/json')).json()).filter(t=>t.type==='page')){
   const candidate=await connect(target.url,target.id);
   if(await candidate.evaluate(`!!document.querySelector('.nand-settings-page')`)){c.close();c=candidate;c.on('Runtime.exceptionThrown',event=>errors.push(event.exceptionDetails));await c.send('Runtime.enable');return true;}candidate.close();
  }return false;
 },'restored settings');
 await waitFor(()=>c.evaluate(`document.querySelector('.nand-settings-page').closest('.nand-ui').dataset.palette==='orca'`),'appearance propagation');await shot(c,'settings-restored');
 // Dispose the restored surface in its actual document and verify all leases are released.
 await c.evaluate(`app.workspace.getLeavesOfType('nand-workbench-view').find(l=>l.view.contentEl.ownerDocument===document).view.disposeSurface().then(()=>true)`);await delay(200);
 const cleanup=await c.evaluate(`({shells:document.querySelectorAll('.nand-shell').length,portals:document.querySelectorAll('.nand-portal-root').length,guards:document.querySelectorAll('[data-radix-focus-guard]').length,lock:document.body.getAttribute('data-scroll-locked')})`);assert.deepEqual(cleanup,{shells:0,portals:0,guards:0,lock:null});results.push({cleanup});

 await fs.writeFile(path.join(evidence,'result.json'),JSON.stringify({passed:true,results,errors},null,2));assert.equal(errors.length,0);console.log(evidence);
} catch(error) {
 if(c) {try {await shot(c,'failure');} catch {}}
 await fs.writeFile(path.join(evidence,'result.json'),JSON.stringify({passed:false,error:String(error),results,errors},null,2));throw error;
} finally {
 if(c) {try {await c.evaluate(`setTimeout(()=>require('@electron/remote').app.quit(),50);true`);}catch{}}
 c?.close();await delay(500);if(proc.exitCode===null)proc.kill();
}
