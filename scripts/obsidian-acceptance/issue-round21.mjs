// Explicit native acceptance for the eight-issue repair. Runs ONLY in a marked disposable Vault.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { connect } from './cdp.mjs';
import { delay, language, escape } from './common.mjs';
assert.equal(process.env.NAND_ALLOW_BROWSER_E2E, '1');
for (const key of ['NAND_ACCEPTANCE_DIR', 'NAND_ACCEPTANCE_VAULT', 'NAND_ACCEPTANCE_PROFILE']) assert.ok(path.isAbsolute(process.env[key] || ''), key);
assert.match(process.env.NAND_EXPECT_MAIN_SHA || '', /^[a-f0-9]{64}$/);
assert.ok(process.env.NAND_WINDOWS_E2E_NONCE);
const dir = process.env.NAND_ACCEPTANCE_DIR;
await fs.mkdir(dir, { recursive: true });
const c = await connect(), checks = [], selected = process.env.NAND_ACCEPTANCE_CASE || 'all';
const run = expression => c.evaluate(`(()=>eval(${JSON.stringify(expression)}))()`);
async function until(expression, label, timeout = 12000) {
  const end = Date.now() + timeout;
  do { const value = await run(expression); if (value) return value; await delay(60); } while (Date.now() < end);
  throw Error('Timed out: ' + label);
}
const check = (name, detail = {}) => { checks.push({ name, passed: true, ...detail }); console.log(name, JSON.stringify(detail)); };
async function shot(name) { await fs.writeFile(path.join(dir, name + '.png'), Buffer.from((await c.send('Page.captureScreenshot')).data, 'base64')); }
let runtime;
try {
  runtime = await run(`(async()=>{const p=app.plugins.plugins.nand;return {vault:app.vault.adapter.basePath,profile:window.require('@electron/remote').app.getPath('userData'),marker:JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json')),platform:process.platform,ua:navigator.userAgent,mainSha256:window.require('crypto').createHash('sha256').update(window.require('fs').readFileSync(app.vault.adapter.basePath+'/'+p.manifest.dir+'/main.js')).digest('hex')}})()`);
  assert.equal(runtime.marker.kind, 'nand-windows-e2e'); assert.equal(runtime.marker.nonce, process.env.NAND_WINDOWS_E2E_NONCE);
  assert.equal(path.resolve(runtime.vault), path.resolve(process.env.NAND_ACCEPTANCE_VAULT));
  assert.equal(path.resolve(runtime.profile), path.resolve(process.env.NAND_ACCEPTANCE_PROFILE));
  assert.equal(path.resolve(runtime.marker.vaultPath), path.resolve(runtime.vault));
  assert.equal(runtime.mainSha256, process.env.NAND_EXPECT_MAIN_SHA);
  assert.equal(createHash('sha256').update(await fs.readFile('main.js')).digest('hex'), runtime.mainSha256);
  await run(`(()=>{window.nandRound21Errors=[];window.nandRound21ErrorHandler=e=>nandRound21Errors.push(String(e.reason??e.error??e.message));window.addEventListener('unhandledrejection',nandRound21ErrorHandler);window.addEventListener('error',nandRound21ErrorHandler);app.setting.close();})()`);
  await escape(c);

  if (selected === 'all' || selected === 'content') {
    await language(c, 'zh'); await run(`app.plugins.plugins.nand.openDashboard()`);
    await until(`!!app.workspace.getLeavesOfType('nand-dashboard-view')[0]?.view.data`, 'dashboard');
    const seed = await run(`(()=>{const p=app.plugins.plugins.nand,v=app.workspace.getLeavesOfType('nand-dashboard-view')[0].view;return {columns:v.data.columns.map(c=>c.name),reading:v.data.columns[3].cards.map(c=>c.title),quote:v.data.banner.quote,archive:p.settings.taskArchivePath,highlights:p.settings.wereadImportPath}})()`);
    assert.deepEqual(seed.columns, ['备忘','待办','项目','书库']); assert.deepEqual(seed.reading, ['在读','待读','已读']);
    assert.equal(seed.archive,'Archive/Done.md'); assert.equal(seed.highlights,'Weread/Highlights'); assert.equal(seed.quote,'每天留下一点看得见的进步。');
    check('118-native-Chinese-first-document-and-defaults', seed); await shot('118-Chinese-default');
    const before = await run(`app.vault.read(app.vault.getFileByPath('dashboard.md'))`);
    await language(c, 'en'); assert.equal(await run(`app.vault.read(app.vault.getFileByPath('dashboard.md'))`), before);
    check('118-language-switch-does-not-rewrite-existing-document');
    const english = await run(`(async()=>{const p=app.plugins.plugins.nand;await p.createWorkspace('R21 English');const v=app.workspace.getLeavesOfType('nand-dashboard-view')[0].view;const result={path:p.settings.dashboardFile,columns:v.data.columns.map(c=>c.name),reading:v.data.columns[3].cards.map(c=>c.title),quote:v.data.banner.quote};await p.switchWorkspace('dashboard');await p.removeWorkspace(result.path);return result})()`);
    assert.deepEqual(english.columns,['Memo','Todo','Projects','Library']);assert.deepEqual(english.reading,['Reading','To read','Done']);assert.equal(english.quote,'Keep a little progress visible every day.');check('118-native-English-new-workspace',english);
    for(const renderer of ['declarative','fallback']) {
      await run(`(()=>{app.setting.open();app.setting.openTabById('nand');const tab=app.plugins.plugins.nand.settingsTab;tab.activeProduct='dashboard';${renderer==='fallback'?'tab.renderFallback()':'tab.refresh()'};})()`);
      const settings=await until(`(()=>{const row=[...activeDocument.querySelectorAll('.setting-item')].find(e=>e.querySelector('.setting-item-name')?.textContent==='Memo note template');const codes=row&&[...row.querySelectorAll('code')].map(e=>e.textContent);return codes?.length&&{codes}})()`,'rich schema keys '+renderer);
      assert.ok(settings.codes.includes('创建时间'));assert.ok(settings.codes.includes('type'));check('118-native-settings-'+renderer,settings);await shot('118-settings-'+renderer);
      await run(`app.setting.close()`);
    }
    const preserved=await run(`(async()=>{const p=app.plugins.plugins.nand;const previous={a:p.settings.taskArchivePath,h:p.settings.wereadImportPath};p.settings.taskArchivePath='归档/自定义.md';p.settings.wereadImportPath='自定义/划线';await p.saveSettings();p.settings.language='zh';await p.saveSettings();await p.loadSettings();p.settings.language='en';await p.saveSettings();await p.loadSettings();const result={a:p.settings.taskArchivePath,h:p.settings.wereadImportPath};p.settings.taskArchivePath=previous.a;p.settings.wereadImportPath=previous.h;await p.saveSettings();return result})()`);
    assert.deepEqual(preserved,{a:'归档/自定义.md',h:'自定义/划线'});check('118-native-explicit-paths-survive-language-changes',preserved);

    // This is the actual automation editor, not a constructed replacement picker.
    await run(`app.commands.executeCommandById('nand:new-automation')`);
    await until(`!!document.querySelector('.nand-automation-editor')`, 'automation editor');
    await run(`(()=>{const root=document.querySelector('.nand-automation-editor'),select=[...root.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='create-task'));select.value='create-task';select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    const options = await until(`(()=>{const s=[...document.querySelectorAll('.nand-automation-editor select')].find(s=>[...s.options].some(o=>o.textContent.includes('dashboard /')));return s&&[...s.options].filter(o=>o.value).map(o=>({value:o.value,title:o.textContent}))})()`, 'task target choices');
    assert.equal(options.length,2); assert.ok(options.every(o=>o.title.includes('待办'))); check('119-actual-editor-only-offers-two-task-cards', {options});
    await run(`(()=>{const r=document.querySelector('.nand-automation-editor');const s=[...r.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.textContent.includes('dashboard /')));s.value='0';s.dispatchEvent(new Event('change',{bubbles:true}));const name=r.querySelector('input');name.value='R21 native task';name.dispatchEvent(new Event('input',{bubbles:true}));const text=r.querySelector('textarea');text.value='R21 correctly routed task';text.dispatchEvent(new Event('input',{bubbles:true}));[...r.querySelectorAll('button')].find(b=>b.textContent==='Save').click()})()`);
    await until(`!document.querySelector('.nand-automation-editor')`, 'automation saved');
    const delivery = await run(`(async()=>{const s=app.plugins.plugins.nand.automationHost.service,d=s.definitions.find(d=>d.name==='R21 native task');if(!d)throw Error('Definition did not persist');await s.run(d);return {action:d.action,run:s.state.runs.find(r=>r.automationId===d.id),raw:await app.vault.read(app.vault.getFileByPath('dashboard.md'))}})()`);
    assert.equal(delivery.action.kind,'create-task'); assert.equal(delivery.run.status,'succeeded'); assert.equal(delivery.raw.split('R21 correctly routed task').length-1,1);
    check('119-actual-saved-action-delivers-to-task-card', {action:delivery.action,status:delivery.run.status});
    await shot('119-saved-task');
    const rejected = await run(`(async()=>{const service=app.plugins.plugins.nand.automationHost.service,original=service.definitions.find(d=>d.name==='R21 native task'),raw=await app.vault.read(app.vault.getFileByPath('dashboard.md'));const bad={...structuredClone(original),id:crypto.randomUUID(),name:'R21 invalid target',action:{...original.action,cardId:'demo-memo-1'}};await service.save(bad);await service.run(bad);const result=service.state.runs.find(r=>r.automationId===bad.id);return {status:result.status,code:result.errorCode,unchanged:raw===await app.vault.read(app.vault.getFileByPath('dashboard.md'))}})()`);
    assert.equal(rejected.status,'failed'); assert.equal(rejected.code,'taskTargetInvalid'); assert.equal(rejected.unchanged,true); check('119-execution-rejects-forged-memo-target',rejected);
    await run(`(async()=>{const a=app.vault,p=app.plugins.plugins.nand;for(const name of ['R21 note A.md','R21 note B.md','NAND/技术笔记/R21 material.md']){const folder=name.slice(0,name.lastIndexOf('/'));if(folder)await a.createFolder(folder).catch(()=>{});if(!a.getFileByPath(name))await a.create(name,'User text '+name);}p.habitService.addHabit('R21 latest habit');await p.habitService.flush();await p.openDashboard();const l=app.workspace.getLeavesOfType('nand-dashboard-view')[0];app.workspace.setActiveLeaf(l,{focus:true});l.view.sidebarPinned=true;l.view.render(l.view.data)})()`);
    const recent=await until(`(()=>{const names=[...document.querySelectorAll('.dashboard-recent-name')].map(e=>e.textContent);return names.length&&names})()`,'recent list');
    assert.ok(recent.includes('R21 material'));assert.ok(recent.includes('R21 note A'));assert.ok(!recent.includes('习惯'));assert.ok(!recent.includes('dashboard'));assert.ok(!recent.includes('操作'));check('117-real-sidebar-excludes-managed-writes-and-retains-material',{recent});await shot('117-recent-documents');
  }
  if (selected === 'all' || selected === 'layout') {
    await run(`(async()=>{const p=app.plugins.plugins.nand;p.settings.quickNotesEnabled=true;p.settings.quickCaptureEnabled=false;p.settings.quickDailyEnabled=false;p.settings.quickNotePresets=[];p.settings.quickCommands=[];p.settings.pinnedNotes=[];await p.saveSettings();await p.loadSettings();await p.openDashboard();const v=app.workspace.getLeavesOfType('nand-dashboard-view')[0].view;v.render(v.data);})()`);
    for (const lang of ['en','zh']) {
      await language(c,lang);
      for (const theme of ['theme-light','theme-dark']) {
        await run(`document.body.classList.remove('theme-light','theme-dark');document.body.classList.add(${JSON.stringify(theme)})`);
        for (const width of [632,792,640,800,1000]) {
          await c.send('Emulation.setDeviceMetricsOverride',{width,height:740,deviceScaleFactor:1,mobile:false});
          await run(`app.plugins.plugins.nand.openDashboard()`);await delay(120);
          const quick=await run(`(()=>{const b=document.querySelector('.dashboard-quicknote-empty-btn'),r=b?.closest('.dashboard-quicknote-section')??b?.closest('.dashboard-quicknote');if(!b||!r)return null;const a=b.getBoundingClientRect(),z=r.getBoundingClientRect();return {left:a.left,right:a.right,width:a.width,parentLeft:z.left,parentRight:z.right,text:b.textContent,scroll:b.scrollWidth,client:b.clientWidth}})()`);
          assert.ok(quick,'quick-note button exists');assert.ok(quick.left>=quick.parentLeft-1&&quick.right<=quick.parentRight+1);assert.ok(quick.client>=quick.scroll-1,'button label is not clipped');
          await run(`app.plugins.plugins.nand.browserHost.open({url:'about:blank',target:'tab'})`);await delay(120);
          const browser=await run(`(()=>{const p=document.querySelector('.workspace-leaf.mod-active .nand-browser-panel'),r=p.getBoundingClientRect();return {paneWidth:r.width,left:r.left,right:r.right,controls:[...p.querySelectorAll('.nand-browser-toolbar button,.nand-browser-toolbar select,.nand-browser-address')].map(e=>{const b=e.getBoundingClientRect();return {name:e.getAttribute('aria-label'),left:b.left,right:b.right,width:b.width}})}})()`);
          for(const b of browser.controls)assert.ok(b.width>0&&b.left>=browser.left-1&&b.right<=browser.right+1,JSON.stringify(b));
          const address=browser.controls.find(b=>b.name===(lang==='en'?'Address or search':'网址或搜索'));
          assert.ok(address&&address.width>=180,'address retains a usable width');
          await run(`(()=>{const p=document.querySelector('.workspace-leaf.mod-active .nand-browser-panel');[...p.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===${JSON.stringify(lang==='en'?'More actions':'更多操作')}).click()})()`);
          const menu=await until(`activeDocument.querySelector('.menu')?.textContent`,'native more-actions menu');assert.ok(menu.includes(lang==='en'?'Screenshot':'截图'));await escape(c);
          check('120-native-layout',{lang,theme,windowWidth:width,quick,browser});await shot(`120-${lang}-${theme}-${width}`);
          await run(`app.workspace.getLeavesOfType('nand-browser-view').forEach(l=>l.detach())`);
        }
      }
    }
    await run(`app.plugins.plugins.nand.browserHost.open({url:'about:blank',target:'tab'})`);
    const identity=await until(`(()=>{const p=document.querySelector('.workspace-leaf.mod-active .nand-browser-panel');const page=p&&app.plugins.plugins.nand.browserHost.pages.get(p.dataset.pageId);return page?.guest&&{pageId:p.dataset.pageId,guestId:page.guest.id}})()`,'persistent browser guest');
    await run(`(()=>{const i=document.querySelector('.workspace-leaf.mod-active input.nand-browser-address');i.focus();i.value='R21 unsent address';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    for(const width of [632,792,1000,632]) {await c.send('Emulation.setDeviceMetricsOverride',{width,height:740,deviceScaleFactor:1,mobile:false});await delay(100);const current=await run(`(()=>{const p=document.querySelector('.workspace-leaf.mod-active .nand-browser-panel');return {pageId:p.dataset.pageId,guestId:app.plugins.plugins.nand.browserHost.pages.get(p.dataset.pageId).guest.id,value:p.querySelector('input').value}})()`);assert.equal(current.pageId,identity.pageId);assert.equal(current.guestId,identity.guestId);assert.equal(current.value,'R21 unsent address');}
    check('120-resize-preserves-native-guest-and-unsubmitted-address',identity);
    await run(`app.workspace.getLeavesOfType('nand-browser-view').forEach(l=>l.detach())`);await c.send('Emulation.clearDeviceMetricsOverride');
  }
  if (selected === 'all' || selected === 'conflict') {
    await language(c,'en');await run(`app.plugins.plugins.nand.openDashboard()`);await delay(120);
    await run(`(()=>{const l=app.workspace.getLeavesOfType('nand-dashboard-view')[0];app.workspace.setActiveLeaf(l,{focus:true});l.view.sidebarPinned=false;l.view.render(l.view.data);window.nandRound21Errors=[];const f=app.vault.adapter.basePath+'/dashboard.md';window.require('fs').appendFileSync(f,'\\n<!-- R21 actual external write -->\\n');const box=l.view.contentEl.querySelector('input[type="checkbox"]');if(!box)throw Error('Task checkbox absent');box.click()})()`);
    await until(`app.workspace.getLeavesOfType('nand-dashboard-view')[0].view.sync.getSaveState().status==='conflict-saved'`,'recovery written');
    for(let i=1;i<=2;i++) { await run(`(()=>{const v=app.workspace.getLeavesOfType('nand-dashboard-view')[0].view;v.contentEl.querySelectorAll('input[type="checkbox"]')[${i}].click()})()`); await delay(80); }
    const recovery=await until(`(async()=>{const v=app.workspace.getLeavesOfType('nand-dashboard-view')[0].view,s=v.sync.getSaveState();if(s.status!=='conflict-saved')return null;const record=JSON.parse(await app.vault.adapter.read(s.recoveryPath));return {state:s,latest:record.local===v.sync.getLocalDraft(),external:(await app.vault.read(app.vault.getFileByPath('dashboard.md'))).includes('R21 actual external write'),panel:v.contentEl.querySelector('.dashboard-save-state')?.textContent,errors:nandRound21Errors}})()`,'latest recovery matches UI');
    assert.equal(recovery.latest,true);assert.equal(recovery.external,true);assert.deepEqual(recovery.errors,[]);assert.ok(recovery.panel.includes(recovery.state.recoveryPath));assert.ok(!recovery.panel.includes('.dashboard-backup'));
    check('121-native-checkbox-conflict-retains-latest-revision-without-unhandled-rejections',recovery);await shot('121-conflict-English');
    await language(c,'zh');const translated=await run(`document.querySelector('.dashboard-save-state').textContent`);assert.ok(translated.includes('当前修改已保存到恢复副本'));assert.ok(translated.includes(recovery.state.recoveryPath));await shot('121-conflict-Chinese');
    await run(`app.workspace.getLeavesOfType('nand-dashboard-view')[0].view.sync.reloadFromDisk()`);
    assert.equal(await run(`app.workspace.getLeavesOfType('nand-dashboard-view')[0].view.sync.getSaveState().status`),'saved');check('121-native-explicit-reload-retains-recovery-file');
  }
  if (selected === 'all' || selected === 'comments') {
    await language(c,'en');
    for(let n=0;n<10;n++) {
      const note=`R21 Comment reload ${n}.md`;
      await run(`(async()=>{let f=app.vault.getFileByPath(${JSON.stringify(note)});if(!f)f=await app.vault.create(${JSON.stringify(note)},'alpha beta gamma');const l=app.workspace.getLeaf('tab');await l.openFile(f);app.workspace.setActiveLeaf(l,{focus:true});l.view.editor.setSelection({line:0,ch:0},{line:0,ch:5});app.commands.executeCommandById('nand:add-comment-to-selection')})()`);
      await until(`!!activeDocument.querySelector('.nand-editor-comment-prompt')`,'comment prompt');
      await run(`(()=>{const i=activeDocument.querySelector('.nand-editor-comment-prompt');i.value='Delete me ${n}';i.dispatchEvent(new i.win.Event('input',{bubbles:true}));activeDocument.querySelector('.nand-editor-comment-prompt-row .mod-cta').click()})()`);
      await until(`(async()=>{try{return JSON.parse(await app.vault.adapter.read('.nand/editor/comments/index.json')).files[${JSON.stringify(note)}]?.total===1}catch{return false}})()`,'comment persisted');
      await run(`app.plugins.plugins.nand.openEditorView()`);await until(`!!document.querySelector('.nand-editor-comment-more')`,'comment card');
      await run(`(async()=>{document.querySelector('.nand-editor-comment-more').click();const item=[...activeDocument.querySelectorAll('.menu-item')].find(e=>e.textContent.includes('Delete'));if(!item)throw Error('Delete menu missing');item.click();await app.plugins.disablePlugin('nand');await app.plugins.enablePlugin('nand');await app.plugins.plugins.nand.openEditorView()})()`);
      await delay(400);
      const result=await run(`(async()=>({cards:document.querySelectorAll('.nand-editor-comment').length,index:JSON.parse(await app.vault.adapter.read('.nand/editor/comments/index.json')).files[${JSON.stringify(note)}]??null,pending:await app.vault.adapter.exists('.nand/editor/comments/pending.json'),body:await app.vault.read(app.vault.getFileByPath(${JSON.stringify(note)}))}))()`);
      assert.equal(result.cards,0);assert.equal(result.index,null);assert.equal(result.pending,false);assert.equal(result.body,'alpha beta gamma');check('98-native-immediate-delete-reload-'+n,result);
      await run(`app.workspace.getLeavesOfType('markdown').filter(l=>l.view.file?.path===${JSON.stringify(note)}).forEach(l=>l.detach())`);
    }
    await shot('98-after-ten-reloads');
  }
  const errors=await run(`nandRound21Errors`);assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(dir,'result.json'),JSON.stringify({passed:true,selected,runtime,checks},null,2));
} catch(error) {
  await shot('failure').catch(()=>{});
  await fs.writeFile(path.join(dir,'partial.json'),JSON.stringify({passed:false,selected,runtime,checks,error:String(error)},null,2));throw error;
} finally {
  await run(`(()=>{window.removeEventListener('unhandledrejection',window.nandRound21ErrorHandler);window.removeEventListener('error',window.nandRound21ErrorHandler)})()`).catch(()=>{});c.close();
}
