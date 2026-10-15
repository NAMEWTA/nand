// Regression coverage for rev-p7: shared document revisions and rendered Markdown ranges.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { build } from 'esbuild';
import { launchFreshVault } from './fresh-vault.mjs';
import { connect } from './cdp.mjs';
const compiled = await fs.mkdtemp(path.join(tmpdir(), 'nand-comment-edge-core-'));
for (const name of ['anchor', 'store']) await build({ entryPoints: [`src/modules/comments/core/${name}.ts`], bundle: true, platform: 'node', format: 'esm', outfile: path.join(compiled, `${name}.mjs`) });
const { createAnchor } = await import(pathToFileURL(path.join(compiled, 'anchor.mjs')));
const { CommentStore } = await import(pathToFileURL(path.join(compiled, 'store.mjs')));
const base = 'Alpha start\nalpha TARGET omega\nlast line\n';
const rich = [
 { path: 'Rich.md', source: 'hello **bold** and world\n', quote: 'hello **bold** and world', visible: 'hello bold and world' },
 { path: 'Link.md', source: '**same** same [same](https://example.com) tail\n', quote: '[same](https://example.com)', visible: 'same', link: true },
 { path: 'Inline.md', source: 'start _emphasis_ ~~gone~~ [a **bold** link](https://example.com) &amp; [[Note|alias]] `excluded` end\n', visible: 'start emphasis gone a bold link & alias end' },
 { path: 'Partial.md', source: 'before **strong** after\n', quote: 'tron', visible: 'tron' },
 { path: 'Code.md', source: '`[[same]]` same same\n', quote: 'same', from: 11, visible: 'same', parent: 'P', after: ' same' },
 { path: 'Alias.md', source: '`[[Note|same]]` **same** same\n', quote: 'same', from: 18, visible: 'same', parent: 'STRONG' },
];
const files = { 'Note.md': base, 'Second.md': 'Second file has different text.\n', 'Moved.md': 'Inserted line\n'.repeat(50) + base, 'Synced.md': base, ...Object.fromEntries(rich.map(item => [item.path, item.source])) };
const memory = { read: async p => files[p], write: async (p,v) => { files[p]=v; }, exists: async p => p in files, remove: async p => { delete files[p]; } };
const store = new CommentStore(memory, { timers: { set: () => 0, clear: () => {} } });
for (const name of ['Note.md','Moved.md','Synced.md']) await store.add(name, { anchor: createAnchor(base, 18, 24), text: 'Thread ' + name });
for (const item of rich) { const quote = item.quote ?? item.source.trimEnd(), start = item.from ?? item.source.indexOf(quote); await store.add(item.path, { anchor: createAnchor(item.source, start, start + quote.length), text: 'Thread ' + item.path }); }
await store.close();
const runtime = await launchFreshVault({ root: process.argv[2], port: 9498, files, settings: { version: 1, namespaces: { app: { language: 'en', introSeen: true, modules: { home:false,comments:true,agent:false,browser:false,archives:false,automations:false,notifications:false,icons:false,sync:false } } } } });
const c = runtime.connection, rows = []; let pop;
const until = async (expression, connection = c) => { for (let i=0; i<200; i++) { if (await connection.evaluate(expression)) return; await delay(50); } throw Error('Timeout: ' + expression); };
const record = async (name, details) => { rows.push({ name, passed: true, ...details }); await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ passed: true, rows }, null, 2)); };
const snap = async name => { const index = JSON.parse(await fs.readFile(path.join(runtime.vault, '.nand/editor/comments/index.json'), 'utf8')); return JSON.parse(await fs.readFile(path.join(runtime.vault, '.nand/editor/comments/files', index.files[name].hash + '.json'), 'utf8')).threads[0]; };
const assertAnchor = async (name, source, label) => { await delay(800); const thread = await snap(name), start = source.indexOf('TARGET'); assert.deepEqual({ text:thread.anchor.text,start:thread.anchor.start,end:thread.anchor.end,status:thread.status }, { text:'TARGET',start,end:start+6,status:'open' }, label); await record(label, { thread }); };
try {
 await until(`app.plugins.plugins.nand.moduleState('comments')==='active'`);
 await c.evaluate(`window.a=app.workspace.getLeaf(false);a.openFile(app.vault.getFileByPath('Note.md'))`); await until(`!!a.view.containerEl.querySelector('.nand-comment-hl')`);
 await c.evaluate(`app.commands.executeCommandById('nand:comments-open-panel');true`); await until(`!!document.querySelector('.nand-comments-panel')`);
 await c.evaluate(`document.querySelector('.nand-comments-panel button[aria-label="More comment actions"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerType:'mouse'}));true`); await until(`!!document.querySelector('[role=menu]')`);
 assert.ok(await c.evaluate(`[...document.querySelectorAll('[role=menuitemradio]')].some(e=>e.textContent==='Position in note')`));
 await c.evaluate(`[...document.querySelectorAll('[role=menuitem]')].find(e=>e.textContent==='Settings').click();true`);
 await until(`!!document.querySelector('.setting-item input[type=color]')`);
 assert.ok(await c.evaluate(`document.querySelector('.setting-item input[type=color]').closest('.setting-item').getBoundingClientRect().height===0`));
 await c.evaluate(`[...document.querySelectorAll('.setting-item')].find(e=>e.querySelector('.setting-item-name')?.textContent==='Follow theme accent').querySelector('.checkbox-container').click();true`);
 await until(`document.querySelector('.setting-item input[type=color]').closest('.setting-item').getBoundingClientRect().height>0`);
 await c.evaluate(`document.querySelector('.setting-item input[type=color]').scrollIntoView({block:'center'});true`); await delay(300);
 await record('panel-menu-and-conditional-color-picker', { value: await c.evaluate(`document.querySelector('.setting-item input[type=color]').value`) }); await runtime.shot('comment-settings');
 await c.evaluate(`app.workspace.revealLeaf(a)`);
 await c.evaluate(`a.openFile(app.vault.getFileByPath('Second.md'))`); await delay(200); await c.evaluate(`a.openFile(app.vault.getFileByPath('Note.md'))`); await until(`!!a.view.containerEl.querySelector('.nand-comment-hl')`);
 await assertAnchor('Note.md', base, 'switch-note-roundtrip');
 await c.evaluate(`window.b=app.workspace.getLeaf('split');b.openFile(app.vault.getFileByPath('Note.md'))`); await until(`!!b.view.containerEl.querySelector('.nand-comment-hl')`);
 let text = 'prefix\n' + base;
 await c.evaluate(`a.view.editor.replaceRange('prefix\\n',{line:0,ch:0});true`); await assertAnchor('Note.md', text, 'same-note-two-editors');
 assert.deepEqual(await c.evaluate(`[a,b].map(l=>[...l.view.containerEl.querySelectorAll('.nand-comment-hl')].map(e=>e.textContent).join(''))`), ['TARGET','TARGET']);
 text = 'second\n' + text; await c.evaluate(`b.view.editor.replaceRange('second\\n',{line:0,ch:0});true`); await assertAnchor('Note.md', text, 'edit-second-split');
 const ids = new Set((await (await fetch(process.env.NAND_CDP_URL + '/json')).json()).map(target => target.id));
 await c.evaluate(`app.workspace.moveLeafToPopout(b,{width:1000,height:800});true`); await delay(1000);
 const target = (await (await fetch(process.env.NAND_CDP_URL + '/json')).json()).find(target => target.type==='page' && !ids.has(target.id)); assert.ok(target); pop = await connect(target.url, target.id);
 await until(`!!document.querySelector('.nand-comments-editor')`, pop);
 text = 'main\n' + text; await c.evaluate(`a.view.editor.replaceRange('main\\n',{line:0,ch:0});true`); await assertAnchor('Note.md', text, 'same-note-main-and-popout');
 text = 'popup\n' + text; await pop.evaluate(`app.workspace.getLeavesOfType('markdown').find(l=>l.view.containerEl.ownerDocument===document).view.editor.replaceRange('popup\\n',{line:0,ch:0});true`); await assertAnchor('Note.md', text, 'edit-popout-shared-note');
 assert.equal(await pop.evaluate(`[...document.querySelectorAll('.nand-comment-hl')].map(e=>e.textContent).join('')`), 'TARGET');
 await c.evaluate(`app.workspace.getLeavesOfType('markdown').filter(l=>l.view.containerEl.ownerDocument!==document).forEach(l=>l.detach());true`); pop.close(); pop = undefined;
 await c.evaluate(`a.openFile(app.vault.getFileByPath('Synced.md'))`); await until(`!!a.view.containerEl.querySelector('.nand-comment-hl')`);
 await c.evaluate(`app.vault.modify(app.vault.getFileByPath('Synced.md'),'external prefix\\n'+a.view.editor.getValue())`); await assertAnchor('Synced.md', 'external prefix\n' + base, 'external-update');
 await c.evaluate(`[...document.querySelectorAll('.nand-comments-panel [role=radio]')].find(e=>e.textContent==='Vault').click();true`); await delay(150);
 await c.evaluate(`[...document.querySelectorAll('.nand-comments-panel button')].find(e=>e.textContent.includes('Moved.md')).click();true`); await until(`[...document.querySelectorAll('.nand-comments-panel article')].some(e=>e.textContent.includes('Thread Moved.md'))`);
 await c.evaluate(`[...document.querySelectorAll('.nand-comments-panel article')].find(e=>e.textContent.includes('Thread Moved.md')).querySelector('button').click();true`);
 await assertAnchor('Moved.md', files['Moved.md'], 'vault-jump-after-external-insert');
 assert.equal(await c.evaluate(`app.workspace.getLeavesOfType('markdown').find(l=>l.view.file?.path==='Moved.md').view.editor.getSelection()`), 'TARGET'); await runtime.shot('vault-jump');
 for (const item of rich) {
  await c.evaluate(`a.openFile(app.vault.getFileByPath(${JSON.stringify(item.path)}),{state:{mode:'preview'}})`);
  await until(`a.view.getMode()==='preview' && !!a.view.containerEl.querySelector('.markdown-preview-view .nand-comment-hl')`);
  const view = await c.evaluate(`({marks:[...a.view.containerEl.querySelectorAll('.markdown-preview-view .nand-comment-hl')].map(e=>e.textContent),icons:a.view.containerEl.querySelectorAll('.nand-comment-reading-marker').length,html:a.view.containerEl.querySelector('.markdown-preview-sizer')?.innerHTML})`);
  assert.equal(view.marks.join('').replace(/\s+/g,' ').trim(), item.visible); assert.equal(view.icons, 0);
  if (item.parent) {
   const placement = await c.evaluate(`(()=>{const root=a.view.containerEl.querySelector('.markdown-preview-view'),mark=root.querySelector('.nand-comment-hl');return {parent:mark.parentElement.tagName,after:mark.nextSibling?.textContent,codeMarks:root.querySelectorAll('pre .nand-comment-hl,code .nand-comment-hl').length}})()`);
   assert.equal(placement.parent,item.parent); if(item.after) assert.equal(placement.after,item.after); assert.equal(placement.codeMarks,0); view.placement=placement;
  }
  if (item.link) assert.ok(await c.evaluate(`!!a.view.containerEl.querySelector('a .nand-comment-hl')`));
  await c.evaluate(`window.edgeClickedMark=a.view.containerEl.querySelector('.markdown-preview-view .nand-comment-hl');edgeClickedMark.click();true`); await until(`document.querySelector('[data-comments-overlay="threads"]')?.textContent.includes(${JSON.stringify('Thread ' + item.path)})`);
  await delay(350);
  view.geometry = await c.evaluate(`({connected:edgeClickedMark.isConnected,mark:edgeClickedMark.getBoundingClientRect().toJSON(),current:a.view.containerEl.querySelector('.markdown-preview-view .nand-comment-hl').getBoundingClientRect().toJSON(),overlay:document.querySelector('[data-comments-overlay="threads"]').getBoundingClientRect().toJSON()})`);
  assert.ok(view.geometry.mark.width > 0 && view.geometry.mark.height > 0);
  assert.ok(view.geometry.overlay.y > 0);
  assert.equal(await c.evaluate(`a.view.file.path`), item.path); await record('reading-' + item.path, { view, clicked: true }); await runtime.shot('reading-' + item.path.replace('.md',''));
  await c.evaluate(`document.querySelector('[data-comments-overlay] button[aria-label="Close comments"]').click();true`);
 }
 const errors = await c.evaluate('nandAcceptanceErrors'); assert.deepEqual(errors, []); await record('host-errors', { errors });
} catch (error) {
 await runtime.shot('failure'); await fs.writeFile(path.join(runtime.evidence,'failure.json'), JSON.stringify({ rows,error:String(error),errors:await c.evaluate('nandAcceptanceErrors'),body:await c.evaluate('document.body.innerText') },null,2)); throw error;
} finally { pop?.close(); await runtime.stop(); await fs.rm(compiled,{recursive:true,force:true}); console.log(JSON.stringify({evidence:runtime.evidence,rows})); }
