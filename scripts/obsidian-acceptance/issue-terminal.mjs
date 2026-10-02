import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {connect} from './cdp.mjs';
import {authorize,openShell,cleanup,until,delay,screenshot} from './terminal-fixture.mjs';
import {language,escape} from './common.mjs';
const c=await connect(),rows=[];let authorized;
try{
	authorized=await authorize(c);
	await c.evaluate(`for(const leaf of app.workspace.getLeavesOfType('terminal-view'))leaf.detach()`);
	await delay(200);
	const a=await openShell(c),b=await openShell(c);
	await c.evaluate(`(()=>{const a=nandWorkbenchAudit;for(const s of a.service.getAllTerminals())s.setTitle('Same session name');a.view.changeWorkbench({navigation:'running',wideSidebarOpen:true,showHistory:false});})()`);await delay(200);
	const labels=await c.evaluate(`[...nandWorkbenchAudit.view.contentEl.querySelectorAll('.nand-session-short-id')].map(e=>e.textContent)`);
	assert.equal(labels.length,2);assert.equal(new Set(labels).size,2);
	rows.push({kind:'same-name',labels,ids:[a.id,b.id]});
	for(const query of [b.id,labels[1]]){
		await c.evaluate(`nandWorkbenchAudit.view.contentEl.querySelector('[aria-label="Switch session"]').click()`);await delay(150);
		await c.evaluate(`(()=>{const input=document.querySelector('.prompt-input');input.value=${JSON.stringify(query)};input.dispatchEvent(new Event('input',{bubbles:true}))})()`);await delay(150);
		const matches=await c.evaluate(`[...document.querySelectorAll('.suggestion-item')].map(e=>e.innerText)`);
		assert.equal(matches.length,1);rows.push({kind:'search',query,matches});await escape(c);
	}
	for(const lang of ['en','zh']){
		await language(c,lang);
		const status=await c.evaluate(`(()=>{const root=nandWorkbenchAudit.view.contentEl,e=root.querySelector('.terminal-current-status'),text=e.querySelector('.terminal-current-status-text'),dot=e.querySelector('i'),win=e.ownerDocument.defaultView;return {text:text.textContent,title:e.title,label:e.getAttribute('aria-label'),ellipsis:win.getComputedStyle(text).textOverflow,dotShrink:win.getComputedStyle(dot).flexShrink}})()`);
		assert.equal(status.title,status.text);assert.equal(status.label,status.text);assert.equal(status.ellipsis,'ellipsis');assert.equal(status.dotShrink,'0');rows.push({kind:'status',lang,...status});
		for(const entry of ['sidebar','pane'])for(const fail of [false,true]){
			await c.evaluate(`(()=>{const a=nandWorkbenchAudit,clipboard=a.view.contentEl.ownerDocument.defaultView.navigator.clipboard;window.issueClipboard=clipboard;window.issueClipboardWrite=clipboard.writeText;if(${fail})clipboard.writeText=async()=>{throw Error('Acceptance permission failure')};document.querySelectorAll('.notice').forEach(e=>e.remove());})()`);
			try{
				if(entry==='sidebar')await c.evaluate(`nandWorkbenchAudit.view.contentEl.querySelectorAll('.nand-session-more')[1].click()`);
				else await c.evaluate(`nandWorkbenchAudit.view.contentEl.querySelector('.terminal-header-actions button:last-child').click()`);
				await until(c,`!![...document.querySelectorAll('.menu-item')].find(e=>/^(Copy session ID|复制会话 ID)$/.test(e.textContent.trim()))`,'copy menu');
				await c.evaluate(`[...document.querySelectorAll('.menu-item')].find(e=>/^(Copy session ID|复制会话 ID)$/.test(e.textContent.trim())).click()`);
				const notice=await until(c,`[...document.querySelectorAll('.notice')].map(e=>e.textContent).find(s=>/^(Session ID copied|已复制会话 ID|Could not copy the session ID|复制会话 ID 失败)$/.test(s))`,'clipboard feedback');
				assert.equal(notice,lang==='en'?(fail?'Could not copy the session ID':'Session ID copied'):(fail?'复制会话 ID 失败':'已复制会话 ID'));
				if(!fail)assert.equal(await c.evaluate(`issueClipboard.readText()`),b.id);
				rows.push({kind:'copy',lang,entry,fail,notice});await delay(250);await screenshot(c,authorized.dir,`copy-${lang}-${entry}-${fail}`);
			}finally{await c.evaluate(`issueClipboard.writeText=issueClipboardWrite`)}
		}
	}
	await fs.writeFile(`${authorized.dir}/result.json`,JSON.stringify({passed:true,rows},null,2));console.log('Identity, search and both clipboard entries passed');
}catch(error){if(authorized)await fs.writeFile(`${authorized.dir}/partial.json`,JSON.stringify({error:String(error),rows},null,2));throw error}
finally{if(authorized)await cleanup(c);c.close()}
