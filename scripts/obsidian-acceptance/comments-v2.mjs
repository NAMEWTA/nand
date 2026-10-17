// Stage 7: real Obsidian editor, side panel, reading and popout integration on a disposable vault.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { connect } from './cdp.mjs';
const source = '# Comments fixture\n\nThe alpha target belongs here.\n\nA second paragraph for line comments.\n\nThe final paragraph.\n';
const runtime = await launchFreshVault({ root: process.argv[2], port: 9287, files: { 'Note.md': source, 'Second.md': 'Other note.\n' }, settings: { version: 1, namespaces: { app: { language: 'en', introSeen: true, modules: { home: false, comments: true, agent: false, browser: false, archives: false, automations: false, notifications: false, icons: false, sync: false } } } } });
let c = runtime.connection; const main = c, rows = [];
const check = (name, value, details) => { rows.push({ name, passed: !!value, details }); assert.ok(value, name); };
const until = async expression => { const end = Date.now() + 15000; while (Date.now() < end) { if (await c.evaluate(expression)) return; await delay(70); } throw Error('Timeout: ' + expression); };
const click = async expression => { await c.evaluate(`${expression}.click();true`); await delay(100); };
const input = async (value, selector = '[data-comments-overlay] textarea') => { await c.evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});input.focus();const setter=Object.getOwnPropertyDescriptor(input.ownerDocument.defaultView.HTMLTextAreaElement.prototype,'value').set;setter.call(input,${JSON.stringify(value)});input.dispatchEvent(new input.ownerDocument.defaultView.Event('input',{bubbles:true}));return true})()`); };
const button = label => `[...document.querySelectorAll('[data-comments-overlay] button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}||b.getAttribute('aria-label')===${JSON.stringify(label)})`;
const key = async (value, modifiers = 0) => { await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code: value, windowsVirtualKeyCode: value === 'Escape' ? 27 : 13, modifiers }); await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: value, modifiers }); await delay(120); };
async function hover(selector) { await delay(180); const point = await c.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`); await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point }); }
async function submit(text) { await until(`!!document.querySelector('[data-comments-overlay="compose"] textarea')`); await input(text); await click(button('Comment')); await until(`!document.querySelector('[data-comments-overlay="compose"]')`); }
const readFiles = async () => { const dir = path.join(runtime.vault, '.nand/editor/comments/files'); return Promise.all((await fs.readdir(dir)).map(async file => JSON.parse(await fs.readFile(path.join(dir, file), 'utf8')))); };
try {
 await until(`app.plugins.plugins.nand.moduleState('comments')==='active' && app.workspace.getLeavesOfType('nand-comments-view').length===1`);
 check('auto-placed-once', await c.evaluate(`app.plugins.plugins.nand.namespaces?.comments?.get?.().panelAutoPlaced ?? app.workspace.getLeavesOfType('nand-comments-view').length===1`));
 if (process.env.NAND_COMMENTS_THEME === 'minimal') {
  const themeDir = path.join(runtime.vault, '.obsidian/themes/Minimal'); await fs.mkdir(themeDir, { recursive: true });
  for (const file of ['theme.css', 'manifest.json']) await fs.copyFile(path.join(process.env.NAND_MINIMAL_THEME_DIR ?? path.join(process.env.HOME, 'refs/obsidian-minimal-9.0.2'), file), path.join(themeDir, file));
  await c.evaluate(`(async()=>{await app.customCss.readThemes();await app.customCss.setTheme('Minimal');return true})()`);
  await until(`Array.from(document.styleSheets).some(s=>s.ownerNode?.textContent?.includes('Minimal Theme for Obsidian'))`); check('minimal-theme-loaded', true);
 }
 await c.evaluate(`window.noteLeaf=app.workspace.getLeaf(false);noteLeaf.openFile(app.vault.getFileByPath('Note.md'))`);
 await until(`!!document.querySelector('.nand-comments-editor')`);
 await c.evaluate(`app.commands.executeCommandById('nand:comments-open-panel');true`); await until(`!!document.querySelector('.nand-comments-panel')`);
 check('sidebar-icon', await c.evaluate(`app.workspace.getLeavesOfType('nand-comments-view')[0].view.getIcon()==='message-square-text'`));
 // Real pointer hover in the line's left margin, then click the gutter affordance.
 const point = await c.evaluate(`(()=>{const cm=noteLeaf.view.editor.cm,line=cm.state.doc.line(5),r=cm.coordsAtPos(line.from),g=cm.dom.querySelector('.cm-gutters').getBoundingClientRect();return{x:g.left+8,y:(r.top+r.bottom)/2}})()`);
 await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point }); await until(`!!document.querySelector('.nand-comment-marker.is-add')`);
 await click(`document.querySelector('.nand-comment-marker.is-add')`); await submit('Line comment **bold**');
 check('line-sidecar-v2', (await readFiles())[0].threads[0].kind === 'line');
 for (const touch of [false, true]) {
  await c.send('Emulation.setTouchEmulationEnabled', { enabled: touch }); await delay(100);
  const hit = await c.evaluate(`(()=>{const marker=document.querySelector('.nand-comment-marker'),rect=marker.getBoundingClientRect(),style=getComputedStyle(marker,'::before');return{width:rect.width-parseFloat(style.left)-parseFloat(style.right),height:rect.height-parseFloat(style.top)-parseFloat(style.bottom)}})()`);
  check(touch?'gutter-hit-44':'gutter-hit-32', hit.width >= (touch?44:32) && hit.height >= (touch?44:32), hit);
 }
 await c.send('Emulation.setTouchEmulationEnabled', { enabled: false });
 await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 20, y: 20 }); await delay(400);
 await runtime.shot('line-and-sidebar');
 // Selection button and overlapping thread ids.
 // Seed a range comment that extends past the text we are about to select, so the drag below starts on plain text and ends inside an existing highlight (a drag that starts inside a highlight is a click on it and pins the thread popover instead).
 await c.evaluate(`(()=>{const cm=noteLeaf.view.editor.cm;cm.focus();const start=cm.state.doc.toString().indexOf('target belongs');cm.dispatch({selection:{anchor:start,head:start+'target belongs here'.length}});app.commands.executeCommandById('nand:add-comment-to-selection');return true})()`);
 await submit('Seeded range'); await delay(400); await c.evaluate(`(()=>{const cm=noteLeaf.view.editor.cm;cm.dispatch({selection:{anchor:cm.state.doc.length}});return true})()`);
 await until(`!document.querySelector('[data-comments-overlay]')`);
 await until(`[...document.querySelectorAll('.cm-content .nand-comment-hl')].some(el=>el.textContent.includes('target belongs'))`); check('seeded-highlight-under-path', true);
 // Real mouse (a human holds the button ~100ms; the editor blur is handled in the next frame): drag-select text, move to the floating button and click it (JS .click() hides focus/hover bugs).
 const mouse = (type, point, extra = {}) => c.send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y, button: type === 'mouseMoved' && !extra.buttons ? 'none' : 'left', clickCount: type === 'mouseMoved' ? 0 : 1, ...extra });
 const pointOf = expression => c.evaluate(`(()=>{const r=(${expression}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 const ends = await c.evaluate(`(()=>{const cm=noteLeaf.view.editor.cm,start=cm.state.doc.toString().indexOf('alpha target'),a=cm.coordsAtPos(start),b=cm.coordsAtPos(start+12);return{from:{x:a.left+1,y:(a.top+a.bottom)/2},to:{x:b.left,y:(b.top+b.bottom)/2}}})()`);
 await mouse('mouseMoved', ends.from); await mouse('mousePressed', ends.from, { buttons: 1 });
 for (let i = 1; i <= 6; i++) await mouse('mouseMoved', { x: ends.from.x + (ends.to.x - ends.from.x) * i / 6, y: ends.to.y }, { buttons: 1 });
 await mouse('mouseReleased', ends.to, { buttons: 0 });
 await delay(500); // longer than the 350ms hover delay: the highlight hover fires while the pointer rests at the selection end
 await until(`!!document.querySelector('[data-comments-overlay="selection"]')`); check('selection-button-shown', true);
 await runtime.shot('selection-button');
 // The pointer rests inside the seeded highlight and its 350ms hover timer has fired; the selection button must still be there while the pointer walks to it.
 check('hover-did-not-replace-selection', await c.evaluate(`!!document.querySelector('[data-comments-overlay="selection"]') && !document.querySelector('[data-comments-overlay="threads"]')`));
 const approach = await pointOf(button('Comment'));
 for (let i = 1; i <= 8; i++) { await mouse('mouseMoved', { x: ends.to.x + (approach.x - ends.to.x) * i / 8, y: ends.to.y + (approach.y - ends.to.y) * i / 8 }); await delay(60); }
 await delay(500); check('selection-button-survives-approach', await c.evaluate(`!!document.querySelector('[data-comments-overlay="selection"]')`));
 const clickPoint = await pointOf(button('Comment')); await mouse('mousePressed', clickPoint, { buttons: 1 }); await delay(150); await mouse('mouseReleased', clickPoint, { buttons: 0 });
 await until(`!!document.querySelector('[data-comments-overlay="compose"] textarea')`); check('real-click-opens-composer', true);
 await runtime.shot('compose-from-selection');
 await c.evaluate(`document.body.classList.replace('theme-light','theme-dark');true`); await delay(300); await runtime.shot('compose-from-selection-dark'); await c.evaluate(`document.body.classList.replace('theme-dark','theme-light');true`); await delay(200);
 check('composer-focused', await c.evaluate(`document.activeElement?.tagName==='TEXTAREA' && !!document.activeElement.closest('[data-comments-overlay="compose"]')`));
 await c.send('Input.insertText', { text: 'Range comment [[Second]]' }); await delay(120);
 const save = await pointOf(button('Comment')); await mouse('mouseMoved', save); await mouse('mousePressed', save, { buttons: 1 }); await delay(150); await mouse('mouseReleased', save, { buttons: 0 });
 await until(`!document.querySelector('[data-comments-overlay="compose"]')`);
 check('real-click-saved', (await readFiles())[0].threads.some(thread => thread.kind === 'range' && JSON.stringify(thread).includes('Range comment [[Second]]')));
 // A drag that starts AND ends inside one highlight also fires click on it; the selection button must still win over the pinned thread popover.
 await c.evaluate(`(()=>{const cm=noteLeaf.view.editor.cm;cm.dispatch({selection:{anchor:cm.state.doc.length}});return true})()`); await delay(500);
 await until(`!document.querySelector('[data-comments-overlay]')`);
 const inner = await c.evaluate(`(()=>{const cm=noteLeaf.view.editor.cm,start=cm.state.doc.toString().indexOf('alpha target'),a=cm.coordsAtPos(start+1),b=cm.coordsAtPos(start+4),span=document.elementFromPoint(a.left+1,(a.top+a.bottom)/2),span2=document.elementFromPoint(b.left-1,(b.top+b.bottom)/2);return{from:{x:a.left+1,y:(a.top+a.bottom)/2},to:{x:b.left-1,y:(b.top+b.bottom)/2},same:span===span2&&span.classList.contains('nand-comment-hl')}})()`);
 check('drag-inside-one-highlight', inner.same, inner);
 await mouse('mouseMoved', inner.from); await mouse('mousePressed', inner.from, { buttons: 1 });
 for (let i = 1; i <= 4; i++) await mouse('mouseMoved', { x: inner.from.x + (inner.to.x - inner.from.x) * i / 4, y: inner.to.y }, { buttons: 1 });
 await mouse('mouseReleased', inner.to, { buttons: 0 }); await delay(600);
 check('drag-inside-highlight-shows-button', await c.evaluate(`!!document.querySelector('[data-comments-overlay="selection"]') && !document.querySelector('[data-comments-overlay="threads"]')`));
 await runtime.shot('drag-inside-highlight');
 // Collapsing the selection must dismiss the button and stay collapsed (no selection restore on close).
 await c.evaluate(`(()=>{const cm=noteLeaf.view.editor.cm;cm.dispatch({selection:{anchor:cm.state.doc.length}});return true})()`); await delay(500);
 check('collapse-dismisses-button', await c.evaluate(`!document.querySelector('[data-comments-overlay]') && noteLeaf.view.editor.cm.state.selection.main.empty`));
 // A plain click on the highlight (no selection) still pins its threads.
 const plain = await pointOf(`document.querySelector('.cm-content .nand-comment-hl')`); await mouse('mouseMoved', plain); await mouse('mousePressed', plain, { buttons: 1 }); await delay(80); await mouse('mouseReleased', plain, { buttons: 0 });
 await until(`!!document.querySelector('[data-comments-overlay="threads"]')`); check('plain-click-pins-threads', await c.evaluate(`!!document.querySelector('[data-comments-overlay="threads"]')`));
 await key('Escape'); await mouse('mouseMoved', { x: 20, y: 20 }); await delay(500); await until(`!document.querySelector('[data-comments-overlay]')`);
 check('note-bytes-unchanged', await fs.readFile(path.join(runtime.vault, 'Note.md'), 'utf8') === source);
 await until(`!!document.querySelector('.cm-content .nand-comment-hl')`);
 await hover('.cm-content .nand-comment-hl'); await delay(200); check('hover-waits-350ms', !await c.evaluate(`!!document.querySelector('[data-comments-overlay="threads"]')`)); await until(`!!document.querySelector('[data-comments-overlay="threads"]')`);
 await runtime.shot('hover-before-entry'); await hover('[data-comments-overlay="threads"]'); await delay(400); check('enter-retains-hover', await c.evaluate(`!!document.querySelector('[data-comments-overlay="threads"]')`));
 await click(button('Edit comment')); await input('Edited range'); await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 20, y: 20 }); await delay(500); check('draft-keeps-hover-open', await c.evaluate(`document.querySelector('[data-comments-overlay] textarea')?.value==='Edited range'`));
 await click(button('Save')); await until(`!document.querySelector('[data-comments-overlay] textarea')`);
 await click(button('Reply…')); await input('Reply from overlay'); await key('Enter', 2); await until(`!document.querySelector('[data-comments-overlay] textarea')`);
 await click(button('Resolve')); await until(`document.querySelector('[data-comments-overlay]')?.textContent.includes('Resolved')`); await click(button('Reopen'));
 await click(button('Pin')); await runtime.shot('thread-edited-replied'); await key('Escape');
 await until(`!document.querySelector('[data-comments-overlay="threads"]')`);
 await hover('.cm-content .nand-comment-hl'); await until(`!!document.querySelector('[data-comments-overlay="threads"]')`); await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 20, y: 20 }); await delay(400); check('hover-leave-closes', !await c.evaluate(`!!document.querySelector('[data-comments-overlay="threads"]')`));
 // Live anchor mapping and external re-location.
 await c.evaluate(`noteLeaf.view.editor.replaceRange('inserted\\n'.repeat(50),{line:0,ch:0});true`); await delay(600);
 check('mapped-anchor', (await readFiles())[0].threads.find(t => t.kind === 'range').anchor.lineHint === 53);
 await c.evaluate(`noteLeaf.setViewState({type:'markdown',state:{file:'Note.md',mode:'preview'},active:true})`); await until(`!!document.querySelector('.markdown-preview-view .nand-comment-hl')`); await click(`document.querySelector('.markdown-preview-view .nand-comment-hl')`); await until(`!!document.querySelector('[data-comments-overlay="threads"]')`); check('reading-click', true); await runtime.shot('reading'); await key('Escape');
 // Closing the view is respected across module re-enable; command can re-open it.
 await c.evaluate(`app.workspace.getLeavesOfType('nand-comments-view')[0].detach();app.plugins.plugins.nand.setModuleEnabled('comments',false)`); await delay(400);
 check('disable-removes-ui', await c.evaluate(`!document.querySelector('.nand-comments-overlay-root,.nand-comment-gutter,.nand-comment-hl')`));
 await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('comments',true)`); await until(`app.plugins.plugins.nand.moduleState('comments')==='active'`); await delay(500); check('closed-sidebar-not-replaced', await c.evaluate(`app.workspace.getLeavesOfType('nand-comments-view').length===0`));
 await c.evaluate(`app.commands.executeCommandById('nand:comments-open-panel');true`); await until(`!!document.querySelector('.nand-comments-panel')`);
 // Popout runs the same editor/overlay code against its own ownerDocument.
 await c.evaluate(`noteLeaf.setViewState({type:'markdown',state:{file:'Note.md',mode:'source'},active:true})`);
 await until(`noteLeaf.view.getMode()==='source' && !!noteLeaf.view.containerEl.querySelector('.nand-comments-editor')`);
 const ids = new Set((await (await fetch(process.env.NAND_CDP_URL + '/json')).json()).map(target => target.id));
 await c.evaluate(`app.workspace.moveLeafToPopout(noteLeaf,{width:1000,height:800});true`); await delay(1200);
 const target = (await (await fetch(process.env.NAND_CDP_URL + '/json')).json()).find(target => target.type === 'page' && !ids.has(target.id)); assert.ok(target);
 c = await connect(target.url, target.id); await until(`!!document.querySelector('.nand-comments-editor')`);
 await c.evaluate(`(()=>{const leaf=app.workspace.getLeavesOfType('markdown').find(l=>l.view.containerEl.ownerDocument===document);window.popNote=leaf;leaf.view.editor.setCursor({line:52,ch:6});leaf.view.editor.focus();app.workspace.setActiveLeaf(leaf,{focus:true});app.commands.executeCommandById('nand:comments-at-cursor');return true})()`);
 await until(`!!document.querySelector('[data-comments-overlay="threads"]')`);
 check('popout-owner', await c.evaluate(`document.querySelector('[data-comments-overlay]').ownerDocument===document && document.querySelectorAll('.nand-comments-overlay-root').length===1`));
 check('main-no-popout-overlay', !await main.evaluate(`!!document.querySelector('[data-comments-overlay="threads"]')`));
 await key('Escape'); await hover('.cm-content .nand-comment-hl'); await until(`!!document.querySelector('[data-comments-overlay="threads"]')`); check('popout-hover', true);
 await delay(400); const shot = await c.send('Page.captureScreenshot'); await fs.writeFile(path.join(runtime.evidence, 'popout.png'), Buffer.from(shot.data, 'base64'));
 await c.evaluate(`document.body.classList.remove('theme-light');document.body.classList.add('theme-dark');true`); await delay(300); const dark = await c.send('Page.captureScreenshot'); await fs.writeFile(path.join(runtime.evidence, 'popout-dark.png'), Buffer.from(dark.data, 'base64'));
 await c.send('Runtime.evaluate', { expression: `window.p7Listeners=[popNote.view.editor.cm.dom,popNote.view.editor.cm.scrollDOM,document,window].map(node=>({node,listeners:Object.values(getEventListeners(node)).flat().map(item=>item.listener)}))`, includeCommandLineAPI: true });
 await main.evaluate(`app.plugins.plugins.nand.setModuleEnabled('comments',false)`); await delay(400); check('both-window-roots-disposed', await c.evaluate(`!document.querySelector('.nand-comments-overlay-root,.nand-comment-gutter')`) && await main.evaluate(`!document.querySelector('.nand-comments-overlay-root')`));
 const removed = await c.send('Runtime.evaluate', { expression: `p7Listeners.map(({node,listeners})=>{const now=Object.values(getEventListeners(node)).flat().map(item=>item.listener);return listeners.filter(fn=>!now.includes(fn)).length})`, includeCommandLineAPI: true, returnByValue: true });
 check('popout-listeners-removed', removed.result.value.every((count,index)=>count >= [3,2,1,1][index]), removed.result.value);
 await main.evaluate(`app.plugins.plugins.nand.setModuleEnabled('comments',true)`); await until(`!!document.querySelector('.nand-comments-editor')`); await c.evaluate(`app.commands.executeCommandById('nand:comments-at-cursor');true`); await until(`!!document.querySelector('[data-comments-overlay="threads"]')`); check('popout-reenabled-one-root', await c.evaluate(`document.querySelectorAll('.nand-comments-overlay-root').length===1`));
 check('host-errors', (await main.evaluate('nandAcceptanceErrors')).length === 0, await main.evaluate('nandAcceptanceErrors'));
 await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ passed: true, rows }, null, 2));
} catch (error) { await runtime.shot('failure'); const shot = await c.send('Page.captureScreenshot'); await fs.writeFile(path.join(runtime.evidence, 'failure-active.png'), Buffer.from(shot.data, 'base64')); await fs.writeFile(path.join(runtime.evidence, 'partial.json'), JSON.stringify({ rows, error: String(error), errors: await main.evaluate('nandAcceptanceErrors'), body: await c.evaluate('document.body.innerText'), diagnostic: await c.evaluate(`({editors:[...document.querySelectorAll('.cm-editor')].map(e=>({classes:e.className,content:e.querySelector('.cm-content')?.textContent})),views:app.workspace.getLeavesOfType('markdown').map(l=>({mode:l.view.getMode(),doc:l.view.containerEl.ownerDocument===document,cm:l.view.editor.cm?.dom.className,state:l.getViewState()})),extensionCount:app.plugins.plugins.nand.editorExtensions.length,state:app.plugins.plugins.nand.moduleState('comments')})`) }, null, 2)); throw error; }
finally { if (c !== main) c.close(); await runtime.stop(); console.log(JSON.stringify({ evidence: runtime.evidence, rows })); }
