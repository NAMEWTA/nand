import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { connect } from './cdp.mjs';
import { delay, metrics, language, escape, shot, init, dir } from './common.mjs';

// Opt-in acceptance against the deployed plugin in an explicitly marked test vault.
const c = await connect(), rows = [];
const evaluate = c.evaluate;
c.evaluate = expression => evaluate(`(()=>eval(${JSON.stringify(expression)}))()`);
async function capture(kind, value) { rows.push({ kind, ...value }); console.log(kind, JSON.stringify(value)); }
try {
	assert.equal(process.env.NAND_ALLOW_WINDOWS_E2E, '1');
	const runtime = await c.evaluate(`(async()=>{const fs=window.require('fs'),path=window.require('path'),crypto=window.require('crypto');return {vault:app.vault.adapter.basePath,marker:JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json')),sha:crypto.createHash('sha256').update(fs.readFileSync(path.join(app.vault.adapter.basePath,'.obsidian/plugins/nand/main.js'))).digest('hex')}})()`);
	assert.equal(runtime.marker.kind, 'nand-windows-e2e');
	assert.equal(runtime.marker.nonce, process.env.NAND_WINDOWS_E2E_NONCE);
	assert.equal(runtime.marker.vaultPath, runtime.vault);
	assert.equal(runtime.sha, process.env.NAND_EXPECT_MAIN_SHA);
	await init(c);
	await escape(c);
	await metrics(c,1280,900);
	await language(c,'en');
	await c.evaluate(`(async()=>{await app.plugins.plugins.nand.openDashboard();window.issueBoard=app.workspace.getLeavesOfType('nand-dashboard-view')[0].view;issueBoard.leaf.tabHeaderEl.click();issueBoard.sidebarPinned=true;window.issueOriginalCountdown=structuredClone(issueBoard.plugin.settings.countdowns[0]);issueBoard.plugin.settings.countdowns[0]={...issueOriginalCountdown,label:'Countdown to New Year',defaultLabel:true};issueBoard.plugin.settings.widgetHabitEnabled=true;issueBoard.render(issueBoard.data);})()`);
	await delay(300);
	const label=await c.evaluate(`document.querySelector('.dashboard-sidebar-countdown').innerText`);
	assert.match(label,/Until New Year/);
	assert.doesNotMatch(label,/Countdown to/);
	await capture('default-label',{label});
	for(const [kind,selector] of [['countdown','.dashboard-sidebar-countdown-settings-btn'],['anniversary','.dashboard-sidebar-anniversary .dashboard-widget-cfg-btn']]) {
		for(const width of [480,1280]) {
			await metrics(c,width,900);
			await c.evaluate(`document.querySelector('${selector}').click()`); await delay(150);
			const result=await c.evaluate(`(()=>{const outer=document.querySelector('.modal.modal--dashboard'),inner=outer?.querySelector('.dashboard-modal');if(!outer||!inner)throw Error('Missing native modal');return {outerBorder:getComputedStyle(outer).borderWidth,outerShadow:getComputedStyle(outer).boxShadow,innerCount:outer.querySelectorAll('.dashboard-modal').length,overflow:inner.scrollWidth-inner.clientWidth,rows:inner.querySelectorAll('.setting-item').length,rect:auditRect(inner)}})()`);
			assert.equal(result.innerCount,1); assert.ok(result.overflow<=1); assert.equal(result.outerShadow,'none'); assert.equal(result.outerBorder,'0px');
			assert.ok(result.rows>=4);
			await capture(kind+'-modal',{width,...result}); await shot(c,`${kind}-${width}`);
			await c.evaluate(`document.querySelector('.modal--dashboard .dashboard-modal-btn--cancel').click()`);
		}
	}
	await metrics(c,1280,900);
	// Real native button receives Enter; calendar/time changes commit only on Save.
	const original=await c.evaluate(`JSON.stringify(issueBoard.plugin.settings.countdowns[0])`);
	await c.evaluate(`document.querySelector('.dashboard-sidebar-countdown-settings-btn').click()`);
	await delay(150);
	await c.evaluate(`document.querySelector('.dashboard-countdown-date-trigger').focus()`);
	for(const type of ['keyDown','keyUp']) await c.send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r',unmodifiedText:'\r'}:{})});
	assert.equal(await c.evaluate(`!!document.querySelector('.dashboard-countdown-calendar-popup')`),true);
	await c.evaluate(`document.querySelector('.dashboard-countdown-calendar-popup .dashboard-modal-btn--cancel').click();document.querySelector('.modal--dashboard input[type=text]').value='Cancelled fixture';document.querySelector('.modal--dashboard input[type=text]').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.modal--dashboard .dashboard-modal-btn--cancel').click()`);
	assert.equal(await c.evaluate(`JSON.stringify(issueBoard.plugin.settings.countdowns[0])`),original);
	await c.evaluate(`document.querySelector('.dashboard-sidebar-countdown-settings-btn').click();const input=document.querySelector('.modal--dashboard input[type=text]');input.value='Custom issue acceptance';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.dashboard-countdown-date-trigger').click()`);
	await c.evaluate(`document.querySelector('.dashboard-task-reminder-calendar-day:not(.dashboard-task-reminder-calendar-day--other-month)').click();const inputs=[...document.querySelectorAll('.dashboard-countdown-popup-time select')];inputs.forEach((e,i)=>{e.value=i?'35':'14';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))});document.querySelector('.dashboard-countdown-calendar-popup .dashboard-modal-btn--confirm').click();document.querySelector('.modal--dashboard .dashboard-modal-btn--confirm').click()`);
	await delay(300);
	const saved=await c.evaluate(`issueBoard.plugin.settings.countdowns[0]`);
	assert.equal(saved.label,'Custom issue acceptance');assert.equal(saved.defaultLabel,false);assert.match(saved.targetDate,/T14:35$/);
	await capture('countdown-save-cancel-keyboard',{saved});
	await c.evaluate(`(async()=>{issueBoard.plugin.settings.countdowns[0]=${original};await issueBoard.plugin.saveSettings();issueBoard.render(issueBoard.data)})()`);
	// Select a newly-created habit: zero records, then a real check-in.
	await c.evaluate(`window.issueHabit=app.plugins.plugins.nand.habitService.addHabit('Issue 100 '+Date.now());issueBoard.render(issueBoard.data)`);
	for(const checked of [false,true]) {
		if(checked)await c.evaluate(`app.plugins.plugins.nand.habitService.toggle(issueHabit.id)`);
		await c.evaluate(`document.querySelectorAll('.dashboard-sidebar-habit-icon-btn')[2].click()`);await delay(150);
		const options=await c.evaluate(`[...document.querySelectorAll('.dashboard-habit-stats-modal select option')].map(e=>({value:e.value,text:e.textContent}))`);
		if(options.some(x=>x.value))await c.evaluate(`const select=document.querySelector('.dashboard-habit-stats-modal select');select.value=issueHabit.id;select.dispatchEvent(new Event('change',{bubbles:true}))`);
		await delay(100);
		const grid=await c.evaluate(`(()=>{const card=[...document.querySelectorAll('.dashboard-habit-stats-card')].find(e=>e.querySelector('.dashboard-habit-stats-card-name').textContent===issueHabit.name),cells=[...card.querySelectorAll('.dashboard-habit-stats-heatmap-cell')],grid=card.querySelector('.dashboard-habit-stats-heatmap-grid'),empty=card.querySelector('.dashboard-habit-stats-heatmap-empty');card.scrollIntoView({block:'center'});return {count:cells.length,columns:new Set(cells.map(e=>Math.round(e.getBoundingClientRect().x))).size,rows:new Set(cells.map(e=>Math.round(e.getBoundingClientRect().y))).size,done:cells.filter(e=>e.classList.contains('dashboard-habit-stats-heatmap-cell--done')).length,emptyBelow:!empty||empty.getBoundingClientRect().top>=grid.getBoundingClientRect().bottom,dates:cells.map(e=>e.getAttribute('aria-label')||e.title)}})()`);
		assert.equal(grid.count,84);assert.equal(grid.columns,12);assert.equal(grid.rows,7);assert.ok(grid.emptyBelow);assert.equal(grid.done,checked?1:0);
		await capture('heatmap',{checked,...grid});await shot(c,`heatmap-${checked}`);await escape(c);
	}
	// Compare real declarative settings with the fallback, in both languages.
	for(const lang of ['en','zh']) {
		await language(c,lang);
		await c.evaluate(`app.setting.open();app.plugins.plugins.nand.settingsTab.activeProduct='editor';app.setting.openTabById('nand');app.plugins.plugins.nand.settingsTab.refresh()`);await delay(250);
		const current=await c.evaluate(`(()=>{const root=app.plugins.plugins.nand.settingsTab.containerEl.querySelector('[data-settings-page=copy]');if(!root)throw Error('No declarative copy section');return [...root.querySelectorAll('.setting-item')].map(e=>e.innerText)})()`);
		assert.equal(current.length,3);assert.ok(current.every(x=>x.length>20));
		const settingsClient=await connect(await c.evaluate(`app.plugins.plugins.nand.settingsTab.containerEl.ownerDocument.location.href`));
		await shot(settingsClient,`settings-${lang}-native`);
		await c.evaluate(`app.plugins.plugins.nand.settingsTab.renderFallback()`);
		const fallback=await c.evaluate(`[...app.plugins.plugins.nand.settingsTab.containerEl.querySelectorAll('.dashboard-settings-content > .setting-item')].slice(-3).map(e=>e.innerText)`);
		assert.deepEqual(fallback,current);await capture('copy-help',{lang,current,fallback});await shot(settingsClient,`settings-${lang}-fallback`);settingsClient.close();await c.evaluate(`app.setting.close()`);
		for(const width of [480,1280]) {
			await metrics(c,width,900);
			for(const action of ['agent','notify','create-task']) {
				await c.evaluate(`app.commands.executeCommandById('nand:new-automation')`);await delay(100);
				await c.evaluate(`const s=document.querySelector('.nand-automation-editor > .setting-item select');s.value='${action}';s.dispatchEvent(new Event('change',{bubbles:true}))`);await delay(100);
				const form=await c.evaluate(`(()=>{const side=document.querySelector('.nand-automation-editor-side'),s=getComputedStyle(side),heading=side.querySelector('.setting-item-heading .setting-item-name'),label=side.querySelector('.setting-item:not(.setting-item-heading) .setting-item-name'),body=document.querySelector('.nand-automation-editor-body');return {padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft],headingX:heading.getBoundingClientRect().x,labelX:label.getBoundingClientRect().x,columns:getComputedStyle(body).gridTemplateColumns,overflow:body.scrollWidth-body.clientWidth}})()`);
				assert.deepEqual(form.padding,['12px','12px','12px','12px']);assert.ok(Math.abs(form.headingX-form.labelX)<1);assert.ok(form.overflow<=1);assert.equal(form.columns.split(' ').length,width<700?1:2);
				await capture('automation-spacing',{lang,width,action,...form});await shot(c,`automation-${lang}-${width}-${action}`);await escape(c);
			}
		}
	}
	await fs.writeFile(`${dir}/result.json`,JSON.stringify({passed:true,runtime,rows},null,2));
}catch(error){await fs.writeFile(`${dir}/partial.json`,JSON.stringify({error:String(error),rows},null,2));throw error;}
finally{await c.evaluate(`(async()=>{if(window.issueOriginalCountdown){issueBoard.plugin.settings.countdowns[0]=issueOriginalCountdown;await issueBoard.plugin.saveSettings();issueBoard.render(issueBoard.data)}})()`);await c.send('Emulation.clearDeviceMetricsOverride');c.close();}
