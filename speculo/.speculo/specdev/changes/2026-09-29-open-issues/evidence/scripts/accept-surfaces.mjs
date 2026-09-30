import {connect} from './cdp.mjs';import {metrics,language,init,escape,shot,delay,dir} from './common.mjs';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const c=await connect(),rows=[];
try{await init(c);await metrics(c,1280);await c.evaluate('app.setting.close()');
for(const lang of ['en','zh']){
 await language(c,lang);
 await c.evaluate(`(async()=>{await app.plugins.plugins.nand.openContacts();app.workspace.leftSplit.expand();app.workspace.rightSplit.expand();await new Promise(r=>setTimeout(r,200));})()`);
 for(const kind of ['person','company']){
 const s=await c.evaluate(`(async()=>{const v=app.workspace.getLeavesOfType('nand-contacts-view')[0].view;v.state.selectedPath='';v.state.selectedId='';v.history=[];v.changeKind('${kind}');await new Promise(r=>setTimeout(r,80));const e=v.contentEl.querySelector('input[type=search]');return {rect:auditRect(e),placeholder:e.placeholder}})()`);
 assert.ok(s.placeholder.includes(lang==='en'?(kind==='person'?'people':'companies'):(kind==='person'?'联系人':'企业')));rows.push({issue:55,lang,kind,...s});
 }
 await c.evaluate(`app.workspace.getLeavesOfType('nand-contacts-view')[0].view.filters()`);await delay(100);
 const empty=await c.evaluate(`(()=>{const e=document.querySelector('.modal');return {text:e.innerText,placeholders:[...e.querySelectorAll('.nand-contacts-muted')].map(e=>e.textContent)}})()`);
 assert.ok(empty.text.includes(lang==='en'?'No options':'暂无可选'));rows.push({issue:64,lang,...empty});await shot(c,`filters-${lang}`);await escape(c);
 await c.evaluate(`(async()=>{await app.plugins.plugins.nand.automationHost.open();})()`);await delay(100);
 const input=await c.evaluate(`(()=>{const e=document.querySelector('.nand-automation-filters input');const s=getComputedStyle(e);return {type:e.type,attr:e.getAttribute('type'),border:s.borderStyle,font:s.fontSize,height:e.getBoundingClientRect().height}})()`);
 assert.equal(input.attr,'search');assert.notEqual(input.border,'inset');rows.push({issue:56,lang,...input});
 await c.evaluate(`(async()=>{await app.plugins.plugins.nand.openEditorView();await new Promise(r=>setTimeout(r,100));})()`);
 const tabs=await c.evaluate(`(()=>{const es=[...document.querySelectorAll('.nand-editor-tab')];return es.map(e=>({rect:auditRect(e),label:auditRect(e.querySelector('.nand-editor-tab-label'))}))})()`);
 assert.equal(tabs.length,1);assert.equal(tabs[0].label.text,lang==='en'?'Comments':'评论');assert.ok(tabs[0].label.scroll<=tabs[0].label.client+1);rows.push({issue:[57,60],lang,tabs});
}
await c.evaluate(`(async()=>{app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();await app.plugins.plugins.nand.openContacts();const v=app.workspace.getLeavesOfType('nand-contacts-view')[0].view;v.changeKind('person');v.add('person');await new Promise(r=>setTimeout(r,80));const input=document.querySelector('.modal input[type=text]');input.value='Issue audit';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.modal button.mod-cta').click();await new Promise(r=>setTimeout(r,300));})()`);
for(const lang of ['zh','en']){await language(c,lang);const d=await c.evaluate(`(()=>{const v=app.workspace.getLeavesOfType('nand-contacts-view')[0].view;const record=[...v.controller.index.byPath.values()].find(r=>r.fields.name==='Issue audit');v.select(record.path);return new Promise(resolve=>setTimeout(()=>resolve([...v.contentEl.querySelectorAll('.nand-contacts-section')].map(e=>({title:e.querySelector('h3')?.textContent,placeholder:e.querySelector('.nand-contacts-placeholder')?.textContent,color:e.querySelector('.nand-contacts-placeholder')?getComputedStyle(e.querySelector('.nand-contacts-placeholder')).color:null}))),100))})()`);assert.ok(d.length>=6);assert.ok(d.every(x=>x.placeholder));rows.push({issue:62,lang,sections:d});await shot(c,`contact-empty-${lang}`);}
await c.evaluate(`app.setting.open();void app.setting.openTabById('nand')`);await delay(300);const s=await connect('about:blank');
try{for(const lang of ['en','zh']){await language(c,lang);for(const width of [560,600,640,700,908,1280]){await metrics(s,width,704);await c.evaluate(`(()=>{const t=app.plugins.plugins.nand.settingsTab;t.activeProduct='contacts';t.activePage='contacts';t.refresh()})()`);await delay(120);
const g=await c.evaluate(`(()=>{const h=app.plugins.plugins.nand.settingsTab.containerEl,e=h.querySelector('.nand-contacts-folder-setting'),info=e.querySelector('.setting-item-info'),controls=e.querySelector('.setting-item-control'),nav=h.querySelector('.dashboard-settings-products');return {row:auditRect(e),info:auditRect(info),controls:auditRect(controls),nav:auditRect(nav),tabs:[...nav.children].map(auditRect)}})()`);
assert.ok(g.row.height<250,JSON.stringify(g));if(g.controls.y>=g.info.bottom)assert.ok(g.controls.y-g.info.bottom<45);assert.ok(g.nav.scroll<=g.nav.client+1);assert.ok(g.tabs.every(t=>t.right<=g.nav.right+1));rows.push({issue:[51,61],lang,width,...g});
await c.evaluate(`(()=>{const h=app.plugins.plugins.nand.settingsTab.containerEl;[...h.querySelectorAll('.dashboard-settings-tab')].at(-1).click()})()`);await delay(100);const selected=await c.evaluate(`(()=>{const h=app.plugins.plugins.nand.settingsTab.containerEl;return {nav:auditRect(h.querySelector('.dashboard-settings-products')),tab:auditRect(h.querySelector('.dashboard-settings-tab.active'))}})()`);assert.ok(selected.tab.right<=selected.nav.right+1);if(width===640||width===908)await shot(s,`settings-${lang}-${width}`);
}}}finally{s.close();await c.evaluate('app.setting.close()')}
await fs.writeFile(`${dir}/surfaces-acceptance.json`,JSON.stringify({passed:true,rows},null,2));console.log(JSON.stringify({passed:true,cases:rows.length}));
}catch(e){await fs.writeFile(`${dir}/surfaces-partial.json`,JSON.stringify({error:String(e),rows},null,2));throw e}finally{c.close()}
