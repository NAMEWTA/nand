// Pointer, keyboard and native settings checks in an isolated Obsidian profile.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { connect } from './cdp.mjs';

const runtime = await launchFreshVault({ root: process.argv[2], port: 9248, files: { 'Welcome.md': '# Review fixture\n' }, settings: { version: 1, namespaces: {
	app: { language: 'en', introSeen: true, modules: { home: true, archives: true, automations: true, icons: true, agent: false, browser: false, news: false, sync: false, comments: false, notifications: false } },
} } });
const c = runtime.connection, rows = [];
const until = async expression => {
	const deadline = Date.now() + 15000;
	while (Date.now() < deadline) { if (await c.evaluate(expression)) return; await delay(60); }
	throw Error(`Condition timed out: ${expression}`);
};
const click = async selector => {
	const point = await c.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
	await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
	await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
	await delay(80);
};
const press = async (key, modifiers = 0) => { await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, modifiers }); await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, modifiers }); await delay(30); };
const check = (name, passed, detail) => rows.push({ name, passed, detail });
try {
	await c.evaluate(`app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();app.plugins.plugins.nand.openWorkbench({feature:'contacts',section:'company'})`);
	await until(`!!document.querySelector('.nand-contacts-surface')`);
	await c.evaluate(`window.wv=app.workspace.getLeavesOfType('nand-workbench-view')[0].view;true`);
	await c.send('Emulation.setDeviceMetricsOverride', { width: 850, height: 900, deviceScaleFactor: 1, mobile: false });
	await until(`!!document.querySelector('.nand-shell--medium')`);
	for (const feature of ['dashboard', 'automations', 'contacts']) {
		const current = await c.evaluate(`wv.getState().target.feature`);
		await click(`.nand-rail-item[data-feature="${current}"] button`);
		await until(`!!document.querySelector('.nand-shell-overlay')`);
		await click(`.nand-rail-item[data-feature="${feature}"] button`);
		await until(`wv.getState().target.feature===${JSON.stringify(feature)}`);
		check(`medium-single-click-${feature}`, await c.evaluate(`!document.querySelector('.nand-shell-overlay')`));
	}
	check('rail-restores-archive-section', await c.evaluate(`wv.getState().target.section==='company'`));
	await click('.nand-rail-item[data-feature="contacts"] button');
	check('medium-visible-rail-not-hidden-by-modal-semantics', await c.evaluate(`document.querySelector('.nand-shell-overlay').getAttribute('aria-modal')!=='true'`));
	const mediumFocus = [];
	for (let i = 0; i < 14; i++) { await press('Tab'); mediumFocus.push(await c.evaluate(`({rail:!!document.activeElement.closest('.nand-rail'),panel:!!document.activeElement.closest('.nand-shell-overlay'),tag:document.activeElement.tagName})`)); }
	check('medium-keyboard-reaches-rail', mediumFocus.some(item=>item.rail), mediumFocus);
	await c.evaluate(`document.querySelector('.nand-shell-overlay button').focus()`);
	await press('Escape');
	check('medium-escape-close', await c.evaluate(`!document.querySelector('.nand-shell-overlay')`));
	await click('.nand-rail-item[data-feature="contacts"] button');
	await c.evaluate(`window.pageClicks=0;document.querySelector('.nand-shell-main').addEventListener('click',()=>pageClicks++)`);
	const scrim=await c.evaluate(`(()=>{const r=document.querySelector('.nand-shell-scrim').getBoundingClientRect();return {x:r.right-12,y:r.top+80}})()`);
	await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...scrim,button:'left',clickCount:1});
	await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...scrim,button:'left',clickCount:1});
	await delay(80);
	check('scrim-closes-without-page-click',await c.evaluate(`!document.querySelector('.nand-shell-overlay')&&pageClicks===0`));
	await c.send('Emulation.setDeviceMetricsOverride', { width: 450, height: 900, deviceScaleFactor: 1, mobile: false });
	await until(`!!document.querySelector('.nand-shell--narrow')`);
	await click('.nand-page-header button');
	await until(`!!document.querySelector('.nand-shell-overlay--narrow')`);
	await c.evaluate(`document.querySelector('.nand-shell-overlay button').focus()`);
	await press('Tab', 8);
	check('narrow-shift-tab-stays-in-dialog', await c.evaluate(`!!document.activeElement.closest('.nand-shell-overlay')`));
	const narrowFocus = [];
	for(let i=0;i<16;i++){await press('Tab');narrowFocus.push(await c.evaluate(`({inside:!!document.activeElement.closest('.nand-shell-overlay'),tag:document.activeElement.tagName})`));}
	check('narrow-tab-cycle-stays-in-dialog',narrowFocus.every(item=>item.inside),narrowFocus);
	await c.evaluate(`document.querySelector('.nand-shell-overlay button').focus()`);
	await press('Escape');
	check('narrow-focus-restored', await c.evaluate(`!!document.activeElement.closest('.nand-page-header')`));
	await c.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
	await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'settings',section:'general'})`);
	await until(`!!document.querySelector('.nand-settings-page .nand-home-module-icon')`);
	const icons = async (selector, native = false) => c.evaluate(`(()=>{const root=${native?'app.setting.activeTab.containerEl':'document'};return [...root.querySelectorAll(${JSON.stringify(selector)})].map(el=>{const r=el.getBoundingClientRect(),s=el.closest('.setting-item'),n=s.querySelector('.setting-item-info').getBoundingClientRect(),t=s.querySelector('.setting-item-control').getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,nameLeft:n.left,toggleLeft:t.left,nameRight:n.right,connected:el.isConnected}})})()`);
	const pageIcons = await icons('.nand-settings-page .nand-home-module-icon');
	check('workbench-module-icons', pageIcons.length>0 && pageIcons.every(i=>i.width===32&&i.height===32&&i.left<i.nameLeft&&i.nameRight<=i.toggleLeft), pageIcons);
	await runtime.shot('workbench-module-icons');
	for(const preset of ['system','claude-code','eye-care'])for(const width of [850,1400]){
		const language=width===850?'zh':'en';
		await c.evaluate(`app.plugins.plugins.nand.theme.update(d=>{d.preset=${JSON.stringify(preset)}});app.changeTheme(${JSON.stringify(width===850?'obsidian':'moonstone')});(()=>{const e=document.querySelector('.nand-settings-page [data-nand-language]');e.value=${JSON.stringify(language)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
		await until(`app.plugins.plugins.nand.appSettings.get().language===${JSON.stringify(language)}`);
		await c.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await delay(100);
		const measured=await icons('.nand-settings-page .nand-home-module-icon');
		check(`workbench-icons-${preset}-${width}`,measured.length===10&&measured.every(i=>i.width===32&&i.left<i.nameLeft&&i.nameRight<=i.toggleLeft),measured);
		check(`workbench-icons-language-${preset}-${width}`,await c.evaluate(`document.querySelector('.nand-settings-page .nand-home-module-icon').closest('.setting-item').querySelector('.setting-item-name').textContent===${JSON.stringify(language==='zh'?'浏览器':'Browser')}`));
		await c.evaluate(`document.querySelector('.nand-settings-page .nand-home-module-icon').scrollIntoView({block:'start'})`);
		await runtime.shot(`workbench-icons-${preset}-${width}`);
	}
	const beforeSettings = new Set((await (await fetch(process.env.NAND_CDP_URL+'/json')).json()).map(t=>t.id));
	await c.evaluate(`app.setting.open();app.setting.openTabById('nand');true`);
	await until(`!!app.setting.activeTab?.containerEl.querySelector('.nand-home-module-icon')`);
	await c.evaluate(`app.setting.activeTab.containerEl.classList.add('nand-native-acceptance');true`);
	const nativeIcons = await icons('.nand-home-module-icon', true);
	check('native-module-icons', nativeIcons.length>0 && nativeIcons.every(i=>i.width===32&&i.height===32&&i.left<i.nameLeft&&i.nameRight<=i.toggleLeft), nativeIcons);
	const nativeDocument=await c.evaluate(`({url:app.setting.activeTab.containerEl.ownerDocument.URL,same:app.setting.activeTab.containerEl.ownerDocument===document})`);
	const settingsTargets=await (await fetch(process.env.NAND_CDP_URL+'/json')).json();
	const settingsTarget=settingsTargets.find(t=>t.type==='page'&&t.url===nativeDocument.url&&!nativeDocument.same)??settingsTargets.find(t=>t.type==='page'&&!beforeSettings.has(t.id));
	rows.push({name:'native-settings-window',passed:!!settingsTarget||nativeDocument.same,detail:{...nativeDocument,targets:settingsTargets.map(t=>({type:t.type,url:t.url,title:t.title}))}});
	if(settingsTarget){
		const native=await connect(settingsTarget.url,settingsTarget.id);
		for(const preset of ['system','claude-code','eye-care'])for(const width of [700,1100]){
			await c.evaluate(`app.plugins.plugins.nand.theme.update(d=>{d.preset=${JSON.stringify(preset)}});app.changeTheme(${JSON.stringify(width===700?'obsidian':'moonstone')});true`);
			const language=width===700?'zh':'en';
			await c.evaluate(`(()=>{const e=app.setting.activeTab.containerEl.querySelector('[data-nand-language]');e.value=${JSON.stringify(language)};e.dispatchEvent(new e.win.Event('change',{bubbles:true}));})()`);
			await until(`app.plugins.plugins.nand.appSettings.get().language===${JSON.stringify(language)}`);
			await native.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await delay(100);
			const measured=await icons('.nand-home-module-icon',true);
			check(`native-icons-${preset}-${width}`,measured.length===10&&measured.every(i=>i.width===32&&i.left<i.nameLeft&&i.nameRight<=i.toggleLeft),measured);
			check(`shared-module-label-${preset}-${width}`,await c.evaluate(`document.querySelector('.nand-settings-page .nand-home-module-icon').closest('.setting-item').querySelector('.setting-item-name').textContent===${JSON.stringify(language==='zh'?'浏览器':'Browser')}`));
			await c.evaluate(`app.setting.activeTab.containerEl.querySelector('.nand-home-module-icon').scrollIntoView({block:'start'})`);
			const shot=await native.send('Page.captureScreenshot',{format:'png'});
			await fs.writeFile(path.join(runtime.evidence,`native-icons-${preset}-${width}.png`),Buffer.from(shot.data,'base64'));
		}
		native.close();
	}
	else await runtime.shot('native-module-icons');
	await c.evaluate(`app.setting.close();app.plugins.plugins.nand.openWorkbench({feature:'icons',section:'iconic-general'})`);
	await until(`!!document.querySelector('[data-settings-page="iconic-general"] select[data-nand-i18n-options]')`);
	await c.evaluate(`window.dropdown=document.querySelector('[data-settings-page="iconic-general"] select[data-nand-i18n-options]');dropdown.value='mobile';dropdown.dispatchEvent(new Event('change',{bubbles:true}));window.dropdownChanges=0;dropdown.addEventListener('change',()=>dropdownChanges++)`);
	await delay(100);
	for (const language of ['zh','en','zh']) {
		await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'contacts'})`);
		await c.evaluate(`app.plugins.plugins.nand.changeLanguage(${JSON.stringify(language)})`);
		await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'icons',section:'iconic-general'})`);
		const measurement = await c.evaluate(`(()=>{const selected=dropdown.selectedOptions[0],r=dropdown.getBoundingClientRect(),style=getComputedStyle(dropdown),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=style.font;return {text:selected.textContent,value:dropdown.value,width:r.width,required:ctx.measureText(selected.textContent).width+parseFloat(style.paddingLeft)+parseFloat(style.paddingRight),changes:dropdownChanges,parent:dropdown.parentElement.innerHTML}})()`);
		check(`dropdown-${language}-${rows.length}`, measurement.value==='mobile'&&measurement.changes===0&&measurement.width>=measurement.required-1, measurement);
		await runtime.shot(`dropdown-${language}-${rows.length}`);
	}
	const iconFile = path.join(runtime.vault,'.nand/icons/iconic.json');
	const iconState = await fs.readFile(iconFile,'utf8');
	await c.evaluate(`app.plugins.plugins.nand.changeLanguage('en')`);
	check('language-does-not-save-icon-preferences',await fs.readFile(iconFile,'utf8')===iconState);
	await c.evaluate(`window.retiredDropdown=dropdown;window.retiredText=dropdown.textContent;app.plugins.plugins.nand.setModuleEnabled('icons',false)`);
	await c.evaluate(`app.plugins.plugins.nand.changeLanguage('zh')`);
	check('disposed-dropdown-not-refreshed',await c.evaluate(`!retiredDropdown.isConnected && retiredDropdown.textContent===retiredText`));
	await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('icons',true)`);
	await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'icons',section:'iconic-general'})`);
	check('reopened-dropdown-keeps-value',await c.evaluate(`document.querySelector('[data-settings-page="iconic-general"] select[data-nand-i18n-options]').value==='mobile'`));
	await c.evaluate(`document.querySelector('[data-settings-page="iconic-general"] button').click()`);
	await until(`!!document.querySelector('.iconic-rule-picker select')`);
	await c.evaluate(`window.ruleSelect=document.querySelector('.iconic-rule-picker select');window.ruleValue=ruleSelect.value;app.plugins.plugins.nand.changeLanguage('en')`);
	check('rule-picker-localized-value-preserved',await c.evaluate(`ruleSelect.value===ruleValue && ruleSelect.selectedOptions[0].textContent.includes('rules')`));
	await press('Escape');
	await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'contacts'})`);
	await c.send('Emulation.clearDeviceMetricsOverride');
	const beforePopout = new Set((await (await fetch(process.env.NAND_CDP_URL+'/json')).json()).map(t=>t.id));
	await c.evaluate(`app.workspace.moveLeafToPopout(wv.leaf,{width:850,height:900});true`);
	await until(`wv.contentEl.win!==window`);
	const popoutTarget=(await (await fetch(process.env.NAND_CDP_URL+'/json')).json()).find(t=>t.type==='page'&&!beforePopout.has(t.id));
	assert.ok(popoutTarget);
	const popout=await connect(popoutTarget.url,popoutTarget.id);
	await popout.send('Emulation.setDeviceMetricsOverride',{width:850,height:900,deviceScaleFactor:1,mobile:false});
	await delay(100);
	const railPoint=await c.evaluate(`(()=>{const r=wv.contentEl.querySelector('.nand-rail-item[data-feature="contacts"] button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
	await popout.send('Input.dispatchMouseEvent',{type:'mousePressed',...railPoint,button:'left',clickCount:1});
	await popout.send('Input.dispatchMouseEvent',{type:'mouseReleased',...railPoint,button:'left',clickCount:1});
	await delay(80);
	check('popout-overlay-medium',await c.evaluate(`!!wv.contentEl.querySelector('.nand-shell-overlay--medium')`));
	await c.evaluate(`wv.contentEl.querySelector('.nand-shell-overlay button').focus()`);
	await popout.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
	await popout.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
	await delay(80);
	check('popout-escape-and-focus',await c.evaluate(`!wv.contentEl.querySelector('.nand-shell-overlay')&&!!wv.contentEl.doc.activeElement.closest('.nand-rail')`));
	const popoutShot=await popout.send('Page.captureScreenshot',{format:'png'});
	await fs.writeFile(path.join(runtime.evidence,'popout.png'),Buffer.from(popoutShot.data,'base64'));
	popout.close();
	check('no-host-errors', (await c.evaluate(`window.nandAcceptanceErrors`)).length===0, await c.evaluate(`window.nandAcceptanceErrors`));
	await fs.writeFile(path.join(runtime.evidence,'result.json'),JSON.stringify({passed:rows.every(r=>r.passed),rows},null,2));
	console.log(JSON.stringify({evidence:runtime.evidence,failed:rows.filter(r=>!r.passed)}));
	assert.ok(rows.every(r=>r.passed));
} catch (error) {
	await runtime.shot('failure').catch(()=>{});
	await fs.writeFile(path.join(runtime.evidence,'result.json'),JSON.stringify({passed:false,rows,error:String(error)},null,2));
	await fs.writeFile(path.join(runtime.evidence,'page-failure.json'),JSON.stringify(await c.evaluate(`({body:document.body.innerText,errors:window.nandAcceptanceErrors,settings:{id:app.setting.activeTab?.id,connected:app.setting.activeTab?.containerEl.isConnected,text:app.setting.activeTab?.containerEl.innerText}})`).catch(()=>null),null,2));
	throw error;
} finally { await runtime.stop(); }
