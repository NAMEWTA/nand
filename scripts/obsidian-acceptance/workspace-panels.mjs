import { inspectLayout } from './workspace-history.mjs';

export async function exercisePanelLayout({ c, p, root, runtime, check, click, type, until, button, row, key, counts }) {
 const json=JSON.stringify, before=await c.evaluate('bw.snapshot().tasks[0]');
 const identities=await c.evaluate('bc.list().map(p=>p.target)'), guestIds=await c.evaluate('fixtureGuests.map(g=>g.id)');
 const slot=index=>root+'.querySelectorAll(".nand-browser-panel-slot")['+index+']';
 await type(root+'.querySelector("textarea")','Keep this layout draft');
 await click(button('Preview send'));await until('!!'+button('Send this preview'));
 await click(button('Move panel earlier',slot(1)));await until('bw.snapshot().tasks[0].panelLayout?.order[0]==='+json(before.targets[1].id));
 check('panel-reorder-preserves-guest-targets-recipients-and-send-preview',await c.evaluate('JSON.stringify(bc.list().map(p=>p.target))==='+json(json(identities))+'&&JSON.stringify(fixtureGuests.map(g=>g.id))==='+json(json(guestIds))+'&&bw.snapshot().tasks[0].draft==="Keep this layout draft"&&JSON.stringify(bw.snapshot().tasks[0].selectedTargetIds)==='+json(json(before.selectedTargetIds))+'&&!!'+button('Send this preview')));
 check('css-panel-order-matches-reviewed-order',await c.evaluate('getComputedStyle('+slot(1)+').order==="0"&&getComputedStyle('+slot(0)+').order==="1"'));
 await click(slot(1)+'.querySelector("input[type=range]")');await key('End','End',35);
 await until('bw.snapshot().tasks[0].panelLayout.widths['+json(before.targets[1].id)+']===3');
 check('keyboard-panel-width-persists-without-website-input',await c.evaluate('getComputedStyle('+slot(1)+').flexGrow==="3"&&bw.snapshot().turns.length===0')&&(await counts()).every(n=>n===0));
 await click(button('Maximize panel',slot(1)));await until(slot(1)+'.dataset.maximized==="true"');
 check('maximize-keeps-saved-visibility-and-recipients-with-one-displayed-pane',await c.evaluate('JSON.stringify(bw.snapshot().tasks[0].visibleTargetIds)==='+json(json(before.visibleTargetIds))+'&&[...'+root+'.querySelectorAll(".nand-browser-panel-slot")].filter(e=>e.getClientRects().length).length===1&&bc.list().length===3'));
 await runtime.shot('panels-maximized');
 await click(button('Restore panel layout',slot(1)));await until('!bw.snapshot().tasks[0].panelLayout.maximized');
 await c.send('Emulation.setDeviceMetricsOverride',{width:500,height:1000,deviceScaleFactor:1,mobile:false});
 await until('[...'+root+'.querySelectorAll(".nand-browser-panel-slot")].filter(e=>e.getClientRects().length).length===1');
 const focus=root+'.querySelector(".nand-browser-pane-focus")';
 await click(focus+'.querySelectorAll("button")[1]');await until('bw.snapshot().tasks[0].panelLayout.focused==='+json(before.targets[0].id));
 check('narrow-focus-switch-preserves-three-guests-and-both-selections',await c.evaluate('!!'+slot(0)+'.getClientRects().length&&'+focus+'.querySelectorAll("button")[1].getAttribute("aria-pressed")==="true"&&bc.list().length===3&&bw.snapshot().tasks[0].selectedTargetIds.length===3&&bw.snapshot().tasks[0].visibleTargetIds.length===3'));
 await runtime.shot('panels-narrow-focus');
 await c.send('Emulation.clearDeviceMetricsOverride');
 await inspectLayout({c,p,root,runtime,check},'website-panels',root+'.querySelector(".nand-browser-panel-deck")');
 // Reload uses the actual existing browser toolbar. It is an explicit page action, never a submit retry.
 await click(slot(0)+'.querySelector("button[aria-label=Reload]")');
 await until('bc.list().every(p=>!p.loading)&&fixtureGuests[0].executeJavaScript("!!document.querySelector(\'.fixture-composer\')")');
 check('explicit-refresh-does-not-submit-or-change-local-draft',await c.evaluate('bw.snapshot().turns.length===0&&bw.snapshot().tasks[0].draft==="Keep this layout draft"')&&(await counts()).every(n=>n===0));
 await click(button('New website conversation',row(0)));await until('!bw.busy(taskId)&&bw.snapshot().tasks[0].targets[0].status==="ready"');
 return await c.evaluate('bw.snapshot().tasks[0].panelLayout');
}
