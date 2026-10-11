// Real Obsidian DataAdapter paths, widget picker and per-device settings; no model calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { connect } from './cdp.mjs';

const board='---\nlayout: stacked\nwidgets: [{memberId: skills, provider: home, kind: skills, instanceId: default}]\nskills: []\n---\n';
const runtime=await launchFreshVault({root:process.argv[2],port:9267,files:{
	'Board.md':board,
	'.agents/skills/alpha/SKILL.md':'---\nname: shared-review\n---\nname: wrong-body-name\n',
	'.claude/skills/beta/SKILL.md':'---\nname: shared-review\n---\n',
	'.codex/skills/from-directory/SKILL.md':'# Skill\nname: wrong-body-name\n',
	'.agents/skills/invalid/SKILL.md':'---\nname: [invalid]\n---\n',
	'.agents/skills/missing/README.md':'This folder is not a skill.\n',
},settings:{version:1,namespaces:{app:{language:'en',introSeen:true,modules:{home:true,agent:true,automations:true,news:false,browser:false,archives:false,notifications:false,sync:false,comments:false,icons:false}},home:{dashboardFile:'Board',workspaceFiles:['Board'],workspaceNames:['Board'],widgetLunarEnabled:false,widgetWeatherEnabled:false,widgetMusicEnabled:false,pomodoroEnabled:false}}}});
let c=runtime.connection;const rows=[];
const check=(name,passed,detail)=>{rows.push({name,passed,detail});assert.ok(passed,name);};
const until=async expression=>{const end=Date.now()+25000;while(Date.now()<end){if(await c.evaluate(expression))return;await delay(60);}throw Error(expression);};
const click=async expression=>{await c.send('Page.bringToFront');await c.evaluate(`window.focus();${expression}.scrollIntoView({block:'center'});true`);await delay(150);await until(`(()=>{const e=${expression},r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()`);const p=await c.evaluate(`(()=>{const r=${expression}.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});};
const enter=async expression=>{await c.send('Page.bringToFront');await c.evaluate(`window.focus();${expression}.focus();true`);await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});};
const visible=selector=>`[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getBoundingClientRect().height>0)`;
const button=text=>`[...document.querySelectorAll('.nand-skills-widget button')].find(e=>e.getBoundingClientRect().height>0&&e.textContent===${JSON.stringify(text)})`;
const fill=async(label,value)=>{await c.evaluate(`(()=>{const e=[...document.querySelectorAll('.nand-skills-editor label')].find(e=>e.querySelector('span')?.textContent===${JSON.stringify(label)}).querySelector('input,textarea');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(30);};
const home=async()=>{await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard',resourceId:'Board'})`);await until(`!!document.querySelector('.nand-skills-widget')`);if(await c.evaluate(`!!document.querySelector('.dashboard-sidebar--collapsed')`))await click(`document.querySelector('.dashboard-sidebar-slim-indicator')`);await c.evaluate(`window.hs=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-dashboard-view');window.directory=app.plugins.plugins.nand.registry.services.peek({owner:'agent',id:'skills'});true`);};
const agent=async id=>{await c.evaluate(`(()=>{const e=[...document.querySelectorAll('.nand-skills-editor label')].find(e=>e.querySelector('span')?.textContent==='Agent').querySelector('select');e.value=${JSON.stringify(id)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(70);};
const choose=async()=>{await click(button('Choose a discovered skill'));await until(`!!${visible('.nand-skills-choice')}`);};
const agentSettings=async()=>{await c.evaluate(`app.plugins.plugins.nand.openWorkbenchSettings('terminal')`);await until(`[...document.querySelectorAll('.setting-item-name')].some(e=>e.textContent==='Additional skill directories')`);};
const setDirectories=async value=>{await c.evaluate(`(()=>{const e=[...document.querySelectorAll('.setting-item')].find(e=>e.querySelector('.setting-item-name')?.textContent==='Additional skill directories').querySelector('textarea');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(350);};
try{
	await c.evaluate(`app.workspace.leftSplit.collapse();true`);await c.send('Emulation.setDeviceMetricsOverride',{width:1500,height:1000,deviceScaleFactor:1,mobile:false});await home();
	await c.evaluate(`window.skillReads=[];const adapter=app.vault.adapter;for(const method of ['exists','list','read']){const original=adapter[method].bind(adapter);adapter[method]=(...args)=>{if(typeof args[0]==='string'&&['.agents/skills','.claude/skills','.codex/skills'].some(root=>args[0].startsWith(root)))skillReads.push({method,path:args[0]});return original(...args)}}true`);
	await click(button('Add skill button'));await agent('codex');await fill('Button label','Discarded');await fill('Skill name','not-saved');check('editor-and-manual-input-do-not-scan',await c.evaluate('skillReads.length')===0);await click(button('Cancel'));
	check('cancelled-name-not-remembered',await c.evaluate(`!app.plugins.plugins.nand.settingsNamespace('agent').get().knownSkills.codex?.includes('not-saved')`));
	await click(button('Add skill button'));await agent('codex');await fill('Button label','Remembered review');await choose();
	const discovered=await c.evaluate(`directory.list('codex')`);check('real-adapter-frontmatter-fallback-and-merged-full-path-sources',discovered.entries.length===2&&discovered.entries.find(e=>e.name==='shared-review')?.sources.length===2&&discovered.entries.some(e=>e.name==='from-directory')&&!discovered.entries.some(e=>e.name==='wrong-body-name'),discovered);
	check('invalid-skill-is-visible-partial-discovery',discovered.unavailable.length===1&&await c.evaluate(`document.querySelector('.nand-skill-picker').textContent.includes('could not be read: 1')`));
	const reads=await c.evaluate('skillReads');check('adapter-paths-never-double-prefix',reads.filter(r=>r.method==='read').every(r=>/^\.(agents|claude|codex)\/skills\/[^/]+\/SKILL.md$/.test(r.path)),reads);await runtime.shot('skill-picker-sources');
	await click(`document.querySelector('.nand-skills-choice button')`);await fill('Skill name','remembered-only');await click(button('Cancel'));check('picked-but-cancelled-name-does-not-enter-memory',await c.evaluate(`!app.plugins.plugins.nand.settingsNamespace('agent').get().knownSkills.codex?.includes('remembered-only')`));
	await click(button('Add skill button'));await agent('codex');await fill('Button label','Remembered review');await fill('Skill name','remembered-only');await click(button('Save'));await until(`hs.sync.getSaveState().status==='saved'&&app.plugins.plugins.nand.settingsNamespace('agent').get().knownSkills.codex?.includes('remembered-only')`);
	check('saved-name-remembered-for-selected-agent-only',await c.evaluate(`Promise.all([directory.list('codex'),directory.list('pi')]).then(([a,b])=>a.entries.some(e=>e.name==='remembered-only'&&e.sources.some(s=>s.kind==='remembered'))&&!b.entries.some(e=>e.name==='remembered-only'))`));
	await click(`document.querySelector('.nand-skills-widget button[aria-label="Configure skill buttons"]')`);await click(button('Add skill button'));await agent('codex');await fill('Button label','Shared review');await choose();await click(`[...document.querySelectorAll('.nand-skills-choice button')].find(e=>e.textContent==='shared-review')`);await click(button('Save'));await until(`app.plugins.plugins.nand.settingsNamespace('agent').get().knownSkills.codex?.includes('shared-review')`);
	await c.evaluate(`app.vault.adapter.rename('.agents/skills/alpha','.agents/retired-alpha').then(()=>app.vault.adapter.rename('.claude/skills/beta','.claude/retired-beta'))`);
	check('saved-discovered-name-survives-moved-directories',await c.evaluate(`directory.list('codex').then(result=>{const row=result.entries.find(e=>e.name==='shared-review');return row?.sources.length===1&&row.sources[0].kind==='remembered'})`));
	const outside=path.join(path.dirname(runtime.vault),'explicit skills');await fs.mkdir(path.join(outside,'external'),{recursive:true});await fs.writeFile(path.join(outside,'external','SKILL.md'),'---\nname: external-review\n---\n');
	check('empty-config-excludes-outside-skills',!(await c.evaluate(`directory.list('codex')`)).entries.some(e=>e.name==='external-review'));
	await agentSettings();await setDirectories(outside);await home();check('device-setting-enables-explicit-directory-source',(await c.evaluate(`directory.list('codex')`)).entries.some(e=>e.name==='external-review'&&e.sources[0].kind==='directory'));
	await runtime.restart();c=runtime.connection;await home();check('restart-retains-button-memory-and-explicit-device-path',await c.evaluate(`directory.list('codex').then(result=>result.entries.some(e=>e.name==='remembered-only')&&result.entries.some(e=>e.name==='external-review')&&hs.data.skills[0]?.skillName==='remembered-only')`));
	await agentSettings();await setDirectories('');await home();check('clearing-extra-directories-removes-outside-source',!(await c.evaluate(`directory.list('codex')`)).entries.some(e=>e.name==='external-review'));
	await agentSettings();await click(`[...document.querySelectorAll('.setting-item')].find(e=>e.querySelector('.setting-item-name')?.textContent==='Remembered skills · Codex').querySelector('button')`);await home();check('clearing-memory-keeps-saved-board-button',!(await c.evaluate(`directory.list('codex')`)).entries.some(e=>e.name==='remembered-only')&&await c.evaluate(`hs.data.skills[0]?.skillName==='remembered-only'`));
	check('six-public-capabilities-match-official-evidence',JSON.stringify(await c.evaluate(`['claude-code','codex','grok','pi','opencode','gemini'].map(id=>directory.capability(id)?.prefix??null)`))===JSON.stringify(['/','$','/','/skill:',null,null]));
	const originalSkills=await c.evaluate('hs.data.skills');
	for(const [agentId,prefix] of [['claude-code','/'],['codex','$'],['grok','/'],['pi','/skill:'],['opencode',''],['gemini','']]){
		await c.evaluate(`hs.sync.setBoardSkills(hs.data.skills.map((skill,i)=>i?skill:{...skill,agentId:${JSON.stringify(agentId)},skillName:${JSON.stringify(prefix?'review':'')},promptTemplate:'plain {{input}}'}))`);
		await click(button('Remembered review'));await until(`!!document.querySelector('.nand-skills-preview')`);
		check(`native-preview-capability-${agentId}`,await c.evaluate(`document.querySelectorAll('.nand-skills-preview textarea')[1].value`) === (prefix?`${prefix}review\n`:'')+'plain ');
		await click(`[...document.querySelectorAll('.nand-skills-preview button')].find(e=>e.textContent==='Cancel')`);await until(`!document.querySelector('.nand-skills-preview')`);
	}
	await c.evaluate(`hs.sync.setBoardSkills(${JSON.stringify(originalSkills)})`);
	await click(`document.querySelector('.nand-skills-widget button[aria-label="Configure skill buttons"]')`);await click(`document.querySelector('.nand-skills-widget button[aria-label="Edit Remembered review"]')`);await choose();const beforeMatrix=await fs.readFile(path.join(runtime.vault,'Board.md'),'utf8');
	for(const preset of ['system','claude-code','eye-care'])for(const dark of [false,true]){
		await c.evaluate(`app.plugins.plugins.nand.theme.update(d=>{d.preset=${JSON.stringify(preset)}});app.changeTheme(${JSON.stringify(dark?'obsidian':'moonstone')});true`);
		for(const width of [500,800,1500]){
			await c.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await delay(160);
			if(width===500){
				if(await c.evaluate(`document.querySelector('.dashboard-mobile-widget-strip').getAttribute('aria-expanded')==='false'`))await click(`document.querySelector('.dashboard-mobile-widget-strip')`);
				if(!await c.evaluate(`!!${visible('.nand-skills-widget')}`))await click(`document.querySelector('.dashboard-mobile-widget-btn[data-widget-member="skills"]')`);
				await until(`!!${visible('.nand-skills-widget')}`);
				if(!await c.evaluate(`!!${visible('.nand-skill-picker')}`)){
					await click(visible('.nand-skills-widget button[aria-label="Configure skill buttons"]'));
					await click(visible('.nand-skills-widget button[aria-label="Edit Remembered review"]'));await choose();
				}
			}else if(await c.evaluate(`!!document.querySelector('.dashboard-sidebar--collapsed')`))await click(`document.querySelector('.dashboard-sidebar-slim-indicator')`);
			const measure=await c.evaluate(`(()=>{const e=${visible('.nand-skill-picker')};return{overflow:e.scrollWidth>e.clientWidth+2,buttons:[...e.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height)}})()`);
			check(`skill-picker-${preset}-${dark?'dark':'light'}-${width}`,!measure.overflow&&measure.buttons.length>2&&measure.buttons.every(h=>h>=32),measure);await runtime.shot(`picker-${preset}-${dark?'dark':'light'}-${width}`);
		}
	}
	check('picker-theme-resize-does-not-save-draft',await fs.readFile(path.join(runtime.vault,'Board.md'),'utf8')===beforeMatrix);
	await c.send('Emulation.setDeviceMetricsOverride',{width:500,height:1000,deviceScaleFactor:1,mobile:false});
	check('narrow-widget-tabs-follow-board-membership',await c.evaluate(`JSON.stringify([...document.querySelectorAll('.dashboard-mobile-widget-btn')].map(e=>e.dataset.widgetMember))===JSON.stringify(hs.data.widgets.map(w=>w.memberId))`));
	await c.evaluate(`window.originalSkillList=directory.list.bind(directory);window.pendingSkillScan=null;directory.list=(id,signal)=>new Promise(resolve=>{window.pendingSkillScan={signal};signal.addEventListener('abort',()=>resolve({entries:[],unavailable:[]}),{once:true})});true`);
	await click(button('Refresh skill list'));await until(`!!pendingSkillScan`);
	await click(`document.querySelector('.dashboard-mobile-widget-btn[data-widget-member="skills"]')`);
	check('narrow-tab-close-aborts-picker-and-unmounts',await c.evaluate(`pendingSkillScan.signal.aborted&&!document.querySelector('.dashboard-mobile-widget-panel .nand-skills-widget')`));
	await c.evaluate(`directory.list=originalSkillList;true`);
	await enter(`document.querySelector('.dashboard-mobile-widget-strip')`);
	check('narrow-collapsed-tabs-are-inert',await c.evaluate(`document.querySelector('.dashboard-mobile-widget-tabs').inert`));
	await enter(`document.querySelector('.dashboard-mobile-widget-strip')`);await enter(`document.querySelector('.dashboard-mobile-widget-btn[data-widget-member="skills"]')`);await until(`!!${visible('.nand-skills-widget')}`);
	check('narrow-widget-opens-with-keyboard-and-touch-sized-buttons',await c.evaluate(`[...document.querySelectorAll('.dashboard-mobile-widget-strip,.dashboard-mobile-widget-btn')].every(e=>e.getBoundingClientRect().height>=44)`));
	const main=c,beforePopout=new Set((await(await fetch(process.env.NAND_CDP_URL+'/json')).json()).map(t=>t.id));
	await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`app.workspace.moveLeafToPopout(hs.leaf,{width:1500,height:1000});true`);await until(`hs.contentEl.win!==window`);
	const popTarget=(await(await fetch(process.env.NAND_CDP_URL+'/json')).json()).find(t=>t.type==='page'&&!beforePopout.has(t.id));assert.ok(popTarget);c=await connect(popTarget.url,popTarget.id);
	await until(`!!document.querySelector('.nand-skills-widget')`);if(await c.evaluate(`!!document.querySelector('.dashboard-sidebar--collapsed')`))await click(`document.querySelector('.dashboard-sidebar-slim-indicator')`);
	if(!await c.evaluate(`!!document.querySelector('.nand-skills-editor')`)){await click(visible('.nand-skills-widget button[aria-label="Configure skill buttons"]'));await click(visible('.nand-skills-widget button[aria-label="Edit Remembered review"]'));}
	if(!await c.evaluate(`!!document.querySelector('.nand-skills-choice')`))await choose();
	check('popout-picker-renders-in-owner-window',await c.evaluate(`document.querySelector('.nand-skills-choice').textContent.includes('from-directory')`)&&!await main.evaluate(`!!document.querySelector('.nand-skill-picker')`));
	const popShot=await c.send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(runtime.evidence,'picker-popout.png'),Buffer.from(popShot.data,'base64'));
	check('narrow-collapse-keyboard-popout-do-not-write-board',await fs.readFile(path.join(runtime.vault,'Board.md'),'utf8')===beforeMatrix);
	await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('agent',false)`);await until(`!document.querySelector('.nand-skills-choice')`);
	check('module-off-revokes-picker-without-reactivation',await c.evaluate(`${button('Close skill list')}.disabled&&app.plugins.plugins.nand.registry.services.peek({owner:'agent',id:'skills'})===undefined`));
	c.close();c=main;
	check('no-unhandled-native-errors',await c.evaluate('nandAcceptanceErrors.length')===0,await c.evaluate('nandAcceptanceErrors'));
	await fs.writeFile(path.join(runtime.evidence,'review.json'),JSON.stringify({rows,unverified:['Actual mobile hardware; portable module and no-desktop-import behavior covered by module/service tests','Actual Grok/Pi and other provider/model execution']},null,2));
}catch(error){await fs.writeFile(path.join(runtime.evidence,'partial-review.json'),JSON.stringify(rows,null,2));await fs.writeFile(path.join(runtime.evidence,'diagnostic.json'),JSON.stringify(await c.evaluate(`({errors:nandAcceptanceErrors,body:document.body.innerText,reads:window.skillReads})`).catch(e=>String(e)),null,2));await runtime.shot('failure').catch(()=>{});throw error;}finally{console.log(JSON.stringify({evidence:runtime.evidence,checks:rows.length,failed:rows.filter(r=>!r.passed)}));await runtime.stop();}
