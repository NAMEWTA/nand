import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as yaml } from 'yaml';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { connect } from './cdp.mjs';

const original='---\r\nlayout: immersive\r\nwidgets: []\r\nimmersive: []\r\ncustom: keep # personal\r\n---\r\n\r\n<!-- Keep my body -->\r\n';
const runtime=await launchFreshVault({root:process.argv[2],port:9264,files:{'A.md':original,'B.md':original,'Photos/sample.svg':'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="gray"/></svg>'},settings:{version:1,namespaces:{
	app:{language:'en',introSeen:true,modules:{home:true,news:false,agent:false,browser:false,archives:false,automations:false,notifications:false,icons:false,comments:false,sync:false}},
	home:{dashboardFile:'A',workspaceFiles:['A','B'],workspaceNames:['A','B'],albums:[],anniversaries:[],countdowns:[],widgetWeatherEnabled:false,widgetLunarEnabled:false,widgetMusicEnabled:false,pomodoroEnabled:false,widgetQuickActionsEnabled:false,widgetYearProgressEnabled:false},
}}});
let c=runtime.connection;
const rows=[];const check=(name,passed,detail)=>rows.push({name,passed,detail});
const until=async expression=>{const end=Date.now()+15000;while(Date.now()<end){if(await c.evaluate(expression))return;await delay(60);}throw Error(expression);};
const bytes=id=>fs.readFile(path.join(runtime.vault,`${id}.md`),'utf8');
const board=async id=>yaml((await bytes(id)).split('---')[1]);
const settings=async()=>JSON.parse(await fs.readFile(path.join(runtime.vault,'.nand/config/settings.json'),'utf8')).namespaces.home;
const press=async key=>{const code={Enter:13,Escape:27}[key];await c.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code,...(key==='Enter'?{text:'\r'}:{})});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code});};
const navigate=async id=>{await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard',resourceId:${JSON.stringify(id)}})`);await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getState().target.resourceId===${JSON.stringify(id)})`);await delay(220);};
const pointerClick=async selector=>{
	await c.send('Page.bringToFront');await c.evaluate('window.focus()');await delay(100);
	const p=await c.evaluate(`(()=>{const e=${selector};e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
	await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});
};
const open=async()=>{await pointerClick(`[...document.querySelectorAll('.nand-board-controls button')].find(e=>e.textContent==='Board widgets')`);await until(`!!document.querySelector('.nand-widget-catalog')`);};
const create=async kind=>{await pointerClick(`[...document.querySelectorAll('[data-widget-kind="home/${kind}"] button')].find(e=>e.textContent.startsWith('Create and add'))`);await until(`!!document.querySelector('.dashboard-modal')`);};
const saveCatalog=async()=>{await c.evaluate(`[...document.querySelectorAll('.nand-dialog-footer button')].find(e=>e.textContent==='Save').click()`);await until(`!document.querySelector('.nand-widget-catalog')`);await delay(300);};
const fill=async(kind,name)=>{
	await c.evaluate(`(()=>{const m=[...document.querySelectorAll('.dashboard-modal')].at(-1);const e=m.querySelector('input[type="text"],input:not([type])');e.value=${JSON.stringify(name)};e.dispatchEvent(new Event('input',{bubbles:true}));const date=m.querySelector('input[type="date"]');if(date){date.value='2020-01-02';date.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
	if(kind==='countdown'){await c.evaluate(`document.querySelector('.dashboard-countdown-date-trigger').click()`);await until(`!!document.querySelector('.dashboard-countdown-calendar-popup')`);await c.evaluate(`document.querySelector('.dashboard-countdown-calendar-popup .dashboard-modal-btn--confirm').click()`);}
};
const finish=async()=>{await c.evaluate(`[...document.querySelectorAll('.dashboard-modal')].at(-1).querySelector('.dashboard-modal-btn--confirm').click()`);await until(`!document.querySelector('.dashboard-modal')`);await until(`!document.querySelector('.nand-widget-catalog')`);await delay(400);};
try{
	await c.evaluate('app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();true');await c.send('Emulation.setDeviceMetricsOverride',{width:1700,height:1000,deviceScaleFactor:1,mobile:false});await navigate('A');
	for(const [kind,key,name] of [['album','albums','Photos'],['anniversary','anniversaries','Shared anniversary'],['countdown','countdowns','Shared countdown']]){
		const beforeBoard=await bytes('A'),before=JSON.stringify(await settings());await open();
		check(`${kind}-empty-family-create-visible`,await c.evaluate(`!![...document.querySelectorAll('[data-widget-kind="home/${kind}"] button')].find(e=>e.textContent.startsWith('Create and add'))`));
		await create(kind);await fill(kind,`Cancelled ${name}`);await press('Escape');await until(`!document.querySelector('.dashboard-modal')`);
		check(`${kind}-cancel-keeps-catalog`,await c.evaluate(`!!document.querySelector('.nand-widget-catalog')`));
		check(`${kind}-cancel-zero-config-and-member-writes`,await bytes('A')===beforeBoard&&JSON.stringify(await settings())===before);
		await create(kind);await fill(kind,name);await finish();
		const config=(await settings())[key],members=(await board('A')).widgets;
		check(`${kind}-confirm-persists-instance-then-member`,config.length===1&&members.some(m=>m.kind===kind&&m.instanceId===String(config[0].id)),{config,members});
		check(`${kind}-rendered-without-global-enable`,await c.evaluate(`!!document.querySelector('[data-widget-member="${members.find(m=>m.kind===kind).memberId}"]')`));
		check(`${kind}-other-board-untouched`,await bytes('B')===original);
	}
	await runtime.shot('created-families');
	let a=(await board('A')).widgets;const anniversary=a.find(m=>m.kind==='anniversary');const configBefore=JSON.stringify((await settings()).anniversaries);
	await navigate('B');await open();await c.evaluate(`[...document.querySelectorAll('[data-widget-kind="home/anniversary"] button')].find(e=>e.textContent.startsWith('Add')).click()`);await saveCatalog();
	check('same-instance-shared-across-two-boards',(await board('B')).widgets[0].instanceId===anniversary.instanceId&&JSON.stringify((await settings()).anniversaries)===configBefore);
	const bSaved=await bytes('B');await navigate('A');
	await pointerClick(`document.querySelector('[data-tile="${anniversary.memberId}"] .nand-immersive-remove')`);await delay(350);
	check('corner-remove-only-current-membership',!(await board('A')).widgets.some(m=>m.memberId===anniversary.memberId)&&await bytes('B')===bSaved&&JSON.stringify((await settings()).anniversaries)===configBefore);
	await open();await c.evaluate(`[...document.querySelectorAll('[data-widget-kind="home/anniversary"] button')].find(e=>e.textContent.startsWith('Add')).click()`);await saveCatalog();
	a=(await board('A')).widgets;let shared=a.find(m=>m.kind==='anniversary');
	check('readd-reuses-original-instance',shared.instanceId===anniversary.instanceId&&(await settings()).anniversaries.length===1);
	const p=await c.evaluate(`(()=>{const e=document.querySelector('[data-tile="${shared.memberId}"] .nand-immersive-grip');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+15,y:r.y+15}})()`);
	await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'right',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'right',clickCount:1});await until(`!![...document.querySelectorAll('.menu-item')].find(e=>e.textContent.includes('Remove from board'))`);
	await c.evaluate(`[...document.querySelectorAll('.menu-item')].find(e=>e.textContent.includes('Remove from board')).click()`);await delay(300);
	check('context-remove-keeps-instance-and-other-board',!(await board('A')).widgets.some(m=>m.memberId===shared.memberId)&&await bytes('B')===bSaved&&JSON.stringify((await settings()).anniversaries)===configBefore);
	await open();await c.evaluate(`[...document.querySelectorAll('[data-widget-kind="home/anniversary"] button')].find(e=>e.textContent.startsWith('Add')).click()`);await saveCatalog();
	shared=(await board('A')).widgets.find(m=>m.kind==='anniversary');await open();await pointerClick(`[...document.querySelectorAll('[data-member-id="${shared.memberId}"] button')].find(e=>e.textContent==='Configure')`);await until(`!!document.querySelector('.dashboard-modal')`);await fill('anniversary','Renamed shared anniversary');await c.evaluate(`document.querySelector('.dashboard-modal .dashboard-modal-btn--confirm').click()`);await until(`!document.querySelector('.dashboard-modal')`);await press('Escape');await until(`!document.querySelector('.nand-widget-catalog')`);await navigate('B');
	check('configure-updates-shared-instance',await c.evaluate(`document.querySelector('.nand-immersive-grid').textContent.includes('Renamed shared anniversary')&&document.querySelector('.nand-immersive-grip').textContent==='Renamed shared anniversary'`) && (await settings()).anniversaries.length===1);
	await navigate('A');await open();const last=(await board('A')).widgets.at(-1);await c.evaluate(`[...document.querySelectorAll('[data-member-id="${last.memberId}"] button')].find(e=>e.textContent==='Move up').focus()`);await press('Enter');await saveCatalog();
	const memberOrder=(await board('A')).widgets.map(m=>m.memberId);check('keyboard-member-reorder',memberOrder.at(-2)===last.memberId);
	await pointerClick(`document.querySelector('.nand-panel .nand-list-item.is-active button')`);await until(`!![...document.querySelectorAll('.menu-item')].find(e=>e.textContent.includes('Move board down'))`);await c.evaluate(`[...document.querySelectorAll('.menu-item')].find(e=>e.textContent.includes('Move board down')).click()`);await delay(250);
	await until(`JSON.stringify(app.plugins.plugins.nand.settingsNamespace('home').get().workspaceFiles)==='["B","A"]'`);await c.evaluate('app.plugins.plugins.nand.runtime.store.flush()');
	check('panel-reuses-board-reorder',JSON.stringify((await settings()).workspaceFiles)===JSON.stringify(['B','A']));
	const savedA=await bytes('A');await runtime.shot('catalog-managed');await runtime.restart();c=runtime.connection;await navigate('A');
	check('restart-retains-both-orders',JSON.stringify((await settings()).workspaceFiles)===JSON.stringify(['B','A'])&&JSON.stringify((await board('A')).widgets.map(m=>m.memberId))===JSON.stringify(memberOrder)&&await bytes('A')===savedA);
	for(const input of ['keyboard','touch']){
		const member=(await board('A')).widgets.find(m=>m.kind==='countdown'),configs=JSON.stringify((await settings()).countdowns);
		await c.send('Page.bringToFront');await c.evaluate('window.focus()');await delay(100);
		if(input==='keyboard'){await c.evaluate(`document.querySelector('[data-tile="${member.memberId}"] .nand-immersive-remove').focus()`);await press('Enter');}
		else {const p=await c.evaluate(`(()=>{const e=document.querySelector('[data-tile="${member.memberId}"] .nand-immersive-remove');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});}
		await delay(350);check(`${input}-remove-retains-provider-instance`,!(await board('A')).widgets.some(m=>m.memberId===member.memberId)&&JSON.stringify((await settings()).countdowns)===configs);
		await open();await c.evaluate(`[...document.querySelectorAll('[data-widget-kind="home/countdown"] button')].find(e=>e.textContent.startsWith('Add')).click()`);await saveCatalog();
	}
	const beforeFailure=await bytes('A'),beforeAlbums=JSON.stringify((await settings()).albums);
	await open();await create('album');await fill('album','Failed album');
	await c.evaluate(`(async()=>{const store=app.plugins.plugins.nand.runtime.store;await store.flush();const p=store.persistence;window.originalSettingsSave=p.save;window.failSettingsOnce=true;p.save=async function(scope,value){if(scope==='vault'&&window.failSettingsOnce){window.failSettingsOnce=false;throw Error('fixture settings save failure')}return window.originalSettingsSave.call(this,scope,value)}})()`);
	await c.evaluate(`document.querySelector('.dashboard-modal .dashboard-modal-btn--confirm').click()`);await until(`document.querySelector('.nand-widget-catalog [role="alert"]')?.textContent.includes('fixture settings save failure')`);
	check('failed-instance-save-no-member-or-orphan',await bytes('A')===beforeFailure&&JSON.stringify((await settings()).albums)===beforeAlbums&&await c.evaluate(`JSON.stringify(app.plugins.plugins.nand.settingsNamespace('home').get().albums)===${JSON.stringify(beforeAlbums)}`));
	await c.evaluate(`app.plugins.plugins.nand.runtime.store.persistence.save=window.originalSettingsSave;true`);await press('Escape');await until(`!document.querySelector('.nand-widget-catalog')`);
	await c.evaluate(`(()=>{const r=app.plugins.plugins.nand.registry;window.fixtureDisposed=0;const kind={key:'pending-create',titleKey:'home.widget.album',icon:'image',defaultSize:{w:3,h:20},minSize:{w:2,h:6},multiple:true,instances:()=>[],render:()=>{},create:ctx=>{window.pendingFixtureContext=ctx;ctx.register(()=>fixtureDisposed++);return new Promise(resolve=>window.finishFixtureCreate=()=>resolve({id:'late-created'}))}};r.contributions.get('home:widgets').set('browser',{kinds:[kind]});for(const cb of r.contributionWatchers.get('home:widgets')??[])cb();return true})()`);await delay(180);await open();
	await pointerClick(`document.querySelector('[data-widget-kind="browser/pending-create"] button')`);await until(`!!window.pendingFixtureContext`);
	await c.evaluate(`(()=>{const r=app.plugins.plugins.nand.registry;r.contributions.get('home:widgets').delete('browser');for(const cb of r.contributionWatchers.get('home:widgets')??[])cb();return true})()`);await until(`!document.querySelector('.nand-widget-catalog')`);
	check('provider-revocation-aborts-pending-create',await c.evaluate(`pendingFixtureContext.signal.aborted&&fixtureDisposed===1`));await c.evaluate(`finishFixtureCreate();true`);await delay(100);
	check('late-created-instance-cannot-add-member',await bytes('A')===beforeFailure);
	const beforeOff=JSON.stringify((await settings()).countdowns);
	await open();await create('countdown');await c.evaluate(`(()=>{window.popupListeners=new Set();window.savedAdd=document.addEventListener;window.savedRemove=document.removeEventListener;document.addEventListener=function(type,fn,...args){if(type==='mousedown')popupListeners.add(fn);return savedAdd.call(this,type,fn,...args)};document.removeEventListener=function(type,fn,...args){if(type==='mousedown')popupListeners.delete(fn);return savedRemove.call(this,type,fn,...args)};document.querySelector('.dashboard-countdown-date-trigger').click();return true})()`);await until(`!!document.querySelector('.dashboard-countdown-calendar-popup')`);await delay(30);
	check('calendar-popup-registers-owned-listener',await c.evaluate('popupListeners.size')===1);
	await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('home',false)`);await until(`!document.querySelector('.nand-widget-catalog')&&!document.querySelector('.dashboard-modal')&&!document.querySelector('.dashboard-countdown-calendar-popup')`);await delay(80);
	check('module-off-closes-editors-and-calendar-listener',await c.evaluate('popupListeners.size')===0&&JSON.stringify((await settings()).countdowns)===beforeOff&&await bytes('A')===beforeFailure);
	await c.evaluate(`document.addEventListener=savedAdd;document.removeEventListener=savedRemove;true`);
	await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('home',true)`);await navigate('A');
	const main=c,beforePopout=new Set((await(await fetch(process.env.NAND_CDP_URL+'/json')).json()).map(t=>t.id));
	await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`window.floatingBoard=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-dashboard-view');app.workspace.moveLeafToPopout(floatingBoard.leaf,{width:1500,height:1000});true`);await until(`floatingBoard.contentEl.win!==window`);
	const popTarget=(await(await fetch(process.env.NAND_CDP_URL+'/json')).json()).find(t=>t.type==='page'&&!beforePopout.has(t.id));assert.ok(popTarget);c=await connect(popTarget.url,popTarget.id);
	for(const [kind,name] of [['album','Photos'],['anniversary','Popout anniversary'],['countdown','Popout countdown']]){
		const before=JSON.stringify(await settings());await open();await create(kind);await fill(kind,name);
		check(`popout-${kind}-editor-in-owner-window`,await c.evaluate(`!!document.querySelector('.dashboard-modal')`)&&!await main.evaluate(`!!document.querySelector('.dashboard-modal')`));
		await press('Escape');await until(`!document.querySelector('.dashboard-modal')`);await press('Escape');await until(`!document.querySelector('.nand-widget-catalog')`);
		check(`popout-${kind}-cancel-zero-writes`,JSON.stringify(await settings())===before&&await bytes('A')===beforeFailure);
	}
	const popShot=await c.send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(runtime.evidence,'catalog-popout.png'),Buffer.from(popShot.data,'base64'));c.close();c=main;
	check('no-runtime-errors',(await c.evaluate('window.nandAcceptanceErrors')).length===0,await c.evaluate('window.nandAcceptanceErrors'));
	await fs.writeFile(path.join(runtime.evidence,'review.json'),JSON.stringify({rows,unverified:['Actual phone and other OS','Complete13kind matrix tracked by integrated Home acceptance']},null,2));
	const failed=rows.filter(r=>!r.passed);console.log(JSON.stringify({evidence:runtime.evidence,checks:rows.length,failed},null,2));assert.equal(failed.length,0);
}catch(error){await fs.writeFile(path.join(runtime.evidence,'partial-review.json'),JSON.stringify(rows,null,2));await runtime.shot('failure').catch(()=>undefined);throw error;}finally{await runtime.stop();}
