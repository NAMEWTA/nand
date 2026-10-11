import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const old = '---\r\n# Keep my header\r\ncustom: [one, two] # personal\r\nbanner:\r\n  quote: "A board with its own layout"\r\n  author: "Fixture"\r\n---\r\n\r\n<!-- Keep my introduction -->\r\n\r\n## Notes\r\n\r\n### First card\r\nid: stable-card\r\ntype: generic\r\nPersonal text.\r\n';
const modern = old.replace('# Keep my header\r\n','layout: stacked\r\n# Keep my header\r\n');
const runtime=await launchFreshVault({root:process.argv[2],port:9261,files:{'Old.md':old,'Modern.md':modern},settings:{version:1,namespaces:{
	app:{language:'en',introSeen:true,modules:{home:true,news:false,agent:false,browser:false,archives:false,automations:false,notifications:false,icons:false,comments:false,sync:false}},
	home:{dashboardFile:'Old',workspaceFiles:['Old','Modern'],workspaceNames:['Old','Modern'],layoutMode:'side',quickNotesEnabled:true,widgetLunarEnabled:false,widgetWeatherEnabled:false,widgetMusicEnabled:false,pomodoroEnabled:false,widgetQuickActionsEnabled:false,widgetYearProgressEnabled:true},
}}});
let c=runtime.connection;
const rows=[];
const check=(name,passed,detail)=>rows.push({name,passed,detail});
const until=async expression=>{const end=Date.now()+15000;while(Date.now()<end){if(await c.evaluate(expression))return;await delay(60);}throw Error(expression);};
const navigate=async file=>{
	await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard',resourceId:${JSON.stringify(file)}})`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getState().target.resourceId===${JSON.stringify(file)})`);
	await delay(150);
};
const layout=()=>c.evaluate(`(()=>{const r=document.querySelector('.nand-dashboard-root:not([hidden])');const q=r.querySelector('.dashboard-quicknote');return {layout:r.dataset.layout,selected:r.querySelector('[data-board-layout-choice]').value,hoisted:q.parentElement.classList.contains('dashboard-main'),widgets:r.querySelector('.dashboard-sidebar-widgets')?.dataset.layout,scrollRegion:!!r.querySelector('.dashboard-scroll-region')}})()`);
const choose=async value=>{
	await c.evaluate(`(()=>{const e=document.querySelector('[data-board-layout-choice]');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
	await delay(250);
};
try{
	await c.evaluate(`app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();true`);
	await c.send('Emulation.setDeviceMetricsOverride',{width:1400,height:900,deviceScaleFactor:1,mobile:false});
	await navigate('Old');
	const legacy=await layout();check('historical-side-really-renders',legacy.layout==='side'&&!legacy.hoisted&&!legacy.scrollRegion&&legacy.widgets==='side',legacy);
	await runtime.shot('old-side');
	await navigate('Modern');
	const current=await layout();check('saved-stacked-overrides-history',current.layout==='stacked'&&current.hoisted&&current.scrollRegion&&current.widgets==='stacked',current);
	check('both-openings-byte-identical',await fs.readFile(path.join(runtime.vault,'Old.md'),'utf8')===old&&await fs.readFile(path.join(runtime.vault,'Modern.md'),'utf8')===modern);
	await choose('side');
	const side=await layout();check('explicit-side-select',side.layout==='side'&&side.selected==='side'&&side.widgets==='side',side);
	check('other-board-unchanged',await fs.readFile(path.join(runtime.vault,'Old.md'),'utf8')===old);
	await navigate('Old');await choose('stacked');
	const stacked=await layout();check('explicit-stacked-over-history',stacked.layout==='stacked'&&stacked.selected==='stacked'&&stacked.widgets==='stacked',stacked);
	const savedOld=await fs.readFile(path.join(runtime.vault,'Old.md'),'utf8'),savedModern=await fs.readFile(path.join(runtime.vault,'Modern.md'),'utf8');
	check('explicit-layout-fields',/^layout: stacked\r?$/m.test(savedOld)&&/^layout: side\r?$/m.test(savedModern));
	check('personal-body-preserved',savedOld.slice(savedOld.indexOf('<!-- Keep'))===old.slice(old.indexOf('<!-- Keep'))&&savedOld.includes('# personal'));
	await runtime.shot('old-stacked');
	await runtime.restart();c=runtime.connection;
	await navigate('Old');check('restart-old-stacked',(await layout()).layout==='stacked');
	await navigate('Modern');check('restart-modern-side',(await layout()).layout==='side');
	for(const width of [640,850,1400]){await c.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await delay(100);check(`resize-${width}-retains-side`,(await layout()).layout==='side');}
	check('restart-and-resize-zero-file-edits',await fs.readFile(path.join(runtime.vault,'Old.md'),'utf8')===savedOld&&await fs.readFile(path.join(runtime.vault,'Modern.md'),'utf8')===savedModern);
	check('panel-active-follows-resource',await c.evaluate(`document.querySelector('.nand-panel .nand-list-item.is-active')?.textContent.includes('Modern')`));
	await c.evaluate(`[...document.querySelectorAll('.nand-panel .nand-list-item')].find(e=>e.textContent.includes('Modern')).querySelector('button').click()`);
	await until(`!![...document.querySelectorAll('.menu-item')].find(e=>e.textContent.includes('Stacked layout'))`);
	await c.evaluate(`[...document.querySelectorAll('.menu-item')].find(e=>e.textContent.includes('Stacked layout')).click()`);
	await delay(250);
	check('panel-layout-menu', (await layout()).layout==='stacked');
	await c.evaluate(`document.querySelector('.nand-panel-primary-button').click()`);
	await until(`!!document.querySelector('.nand-dialog input')`);
	check('new-dialog-cancel-zero-files',!(await fs.readdir(runtime.vault)).includes('Created.md'));
	await c.evaluate(`document.querySelector('.nand-dialog .nand-btn').click()`);
	await until(`!document.querySelector('.nand-dialog')`);
	await c.evaluate(`document.querySelector('.nand-panel-primary-button').click()`);
	await until(`!!document.querySelector('.nand-dialog input')`);
	await c.evaluate(`(()=>{const e=document.querySelector('.nand-dialog input');e.value='Created';e.dispatchEvent(new Event('input',{bubbles:true}));const s=document.querySelector('.nand-dialog select');s.value='side';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
	await delay(60);
	await c.evaluate(`document.querySelector('.nand-dialog form').requestSubmit()`);
	await until(`!!app.vault.getFileByPath('Created.md')`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getState().target.resourceId==='Created')`);
	await delay(80);
	check('new-board-opens-with-selected-layout',(await layout()).layout==='side'&&await c.evaluate(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getState().target.resourceId==='Created')`));
	check('new-board-layout-saved',/^layout: side\r?$/m.test(await fs.readFile(path.join(runtime.vault,'Created.md'),'utf8')));
	check('new-board-does-not-edit-existing',await fs.readFile(path.join(runtime.vault,'Old.md'),'utf8')===savedOld);
	const errors=await c.evaluate('window.nandAcceptanceErrors');check('no-runtime-errors',errors.length===0,errors);
	await fs.writeFile(path.join(runtime.evidence,'review.json'),JSON.stringify({rows,unverified:['Actual phone; pure effective layout function tested separately','Full member/tile codec and migration still pending T-02/T-03/T-04 review']},null,2));
	const failed=rows.filter(r=>!r.passed);console.log(JSON.stringify({evidence:runtime.evidence,checks:rows.length,failed},null,2));assert.equal(failed.length,0);
}catch(error){await fs.writeFile(path.join(runtime.evidence,'partial-review.json'),JSON.stringify(rows,null,2));await runtime.shot('failure').catch(()=>undefined);throw error;}finally{await runtime.stop();}
