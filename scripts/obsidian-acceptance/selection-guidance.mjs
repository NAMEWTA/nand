import assert from 'node:assert/strict';
import { inspectLayout } from './workspace-history.mjs';

export async function exerciseSelectionGuidance({ c, p, root, click, until, button, check, runtime }) {
 const json=JSON.stringify, panel='document.querySelector(".nand-browser-grab")', guidance=panel+'.querySelector(".nand-browser-guidance")';
 const before=await c.evaluate('bw.snapshot()'), exchange=before.exchanges.at(-1), target=before.tasks[0].targets[0].page;
 await c.evaluate('bc.activate('+json(target)+')');
 await click('document.querySelector('+json('.nand-browser-workspace-pane button[aria-label="Select element"]')+')');
 const point=await c.evaluate('wv.executeJavaScript('+json('(()=>{const e=[...document.querySelectorAll("[data-role=assistant] code")].at(-1);e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()')+')');
 for(const type of ['mouseMove','mouseDown','mouseUp'])await c.evaluate('wv.sendInputEvent('+json({type,...point,button:'left',clickCount:1})+');true');
 await until('!!'+guidance+'&&'+guidance+'.querySelector("select")?.options.length===4');
 check('native-design-selection-retains-selected-text-and-partial-warning',await c.evaluate(panel+'.textContent.includes("const a = 1;")&&'+guidance+'.textContent.includes("2,000")'));
 await inspectLayout({c,p,root:guidance,runtime,check},'guidance-selection',guidance);
 await click(guidance+'.querySelector("select")');
 for(let i=0;i<3;i++)for(const type of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type,key:'ArrowDown',windowsVirtualKeyCode:40});
 for(const type of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type,key:'Enter',windowsVirtualKeyCode:13});
 check('selection-requires-explicit-round-choice',await c.evaluate(guidance+'.querySelector("select").value==='+json(exchange.id)));
 await click(button('Save selected excerpt',guidance));await until('bw.snapshot().exchanges.some(e=>e.selections?.length===1)&&!'+panel);
 const after=await c.evaluate('bw.snapshot()'), saved=after.exchanges.find(e=>e.id===exchange.id), excerpt=saved.selections[0];
 check('partial-excerpt-keeps-exact-native-page-account-element-and-message',excerpt.source==='user-selection'&&!excerpt.complete&&excerpt.markdown==='const a = 1;'&&excerpt.selection.page.pageId===target.pageId&&excerpt.selection.page.profileId===target.profileId&&excerpt.selection.page.generation===target.generation&&excerpt.selection.messageId===exchange.captures[0].messageId&&excerpt.selection.rect.width>0&&excerpt.selection.selector.includes('code'));
 assert.deepEqual(saved.captures,exchange.captures);
 check('manual-excerpt-does-not-replace-current-answer-or-submit-again',saved.currentCaptureId===exchange.currentCaptureId&&saved.acquisitionState===exchange.acquisitionState&&await c.evaluate('wv.executeJavaScript("fixtureCount()")')===6);
 const note=await c.evaluate('(async()=>{const files=app.vault.getMarkdownFiles();const f=files.find(f=>f.path.endsWith('+json('/'+exchange.id+'.md')+'));return app.vault.read(f)})()');
 check('selected-text-is-readable-markdown-with-separate-provenance',note.includes('<!-- nand:selection-a -->')&&note.includes('source: user-selection')&&note.includes(excerpt.selection.selector));
 const synth=root+'.querySelector(".nand-browser-synthesis")';await click(synth+'.querySelector("input[type=checkbox]").closest("label")');
 await until('!!'+synth+'.querySelector("fieldset")');
 check('opt-in-synthesis-offers-explicit-partial-excerpt',await c.evaluate(synth+'.querySelector("fieldset").textContent.includes("Selected excerpt")&&'+synth+'.querySelector("fieldset").textContent.includes("Incomplete")'));
 await click(synth+'.querySelector("input[type=checkbox]").closest("label")');
 await c.evaluate(root+'.querySelector(".nand-browser-workspace-turns").scrollIntoView({block:"end"});true');await runtime.shot('guidance-saved');
}
