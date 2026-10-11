// Real Obsidian + published PTY helper. Local CLI fixtures validate delivery, not model quality.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const cli=String.raw`const fs=require('fs'),path=require('path'),cp=require('child_process');
const prompt=process.argv.at(-1),home=process.env.CODEX_HOME,cwd=process.cwd();
const hooks=JSON.parse(fs.readFileSync(path.join(home,'hooks.json'),'utf8')).hooks;
const script=/"([^"]+nand-automation-hook.cjs)"/.exec(hooks.Stop[0].hooks[0].command)[1];
const dir=path.join(cwd,'.nand/automation');const journals=fs.readdirSync(dir).map(name=>path.join(dir,name,'runtime.json')).filter(p=>fs.existsSync(p));
// Obsidian's adapter may be replacing a status snapshot while this independent process reads it.
// Retry incomplete JSON only; a complete snapshot missing the invocation must still fail the check.
const readJournal=p=>{for(let n=0;;n++){try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch(error){if(!(error instanceof SyntaxError)||n===99)throw error;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5);}}};
const recorded=journals.some(p=>readJournal(p).runs.some(r=>r.invocation&&[r.invocation.request.finalPrompt,...r.invocation.request.files].join('\n')===prompt));
fs.appendFileSync(path.join(cwd,'dispatch-probe.jsonl'),JSON.stringify({prompt,recorded,pid:process.pid})+'\n');
const post=(event,data={})=>cp.spawnSync(process.execPath,[script,event],{input:JSON.stringify(data),env:process.env,windowsHide:true});
post('UserPromptSubmit');setTimeout(()=>post('Stop',{last_assistant_message:'Fixture native completion'}),250);setInterval(()=>{},1000);`;
const interactive=String.raw`const fs=require('fs'),path=require('path');
process.stdin.setRawMode?.(true);process.stdin.resume();if(!process.argv.includes('unready'))process.stdout.write('\x1b[?2004hREADY');
process.stdin.on('data',data=>fs.appendFileSync(path.join(process.cwd(),'interactive-input.jsonl'),JSON.stringify(data.toString())+'\n'));setInterval(()=>{},1000);`;
const board='---\nlayout: stacked\nwidgets: [{memberId: quick, provider: home, kind: quick-actions, instanceId: default}]\nquickActions: [{name: Review native, icon: terminal, type: command, target: "skill:codex:review"}]\n---\n';
const runtime=await launchFreshVault({root:process.argv[2],port:9265,files:{'A.md':board,'B.md':board,'dispatch-cli.cjs':cli,'interactive-cli.cjs':interactive},settings:{version:1,namespaces:{
	app:{language:'en',introSeen:true,modules:{home:true,agent:true,automations:true,news:false,browser:false,archives:false,notifications:false,sync:false,comments:false,icons:false}},
	home:{dashboardFile:'A',workspaceFiles:['A','B'],workspaceNames:['A','B'],widgetLunarEnabled:false,widgetWeatherEnabled:false,widgetMusicEnabled:false,pomodoroEnabled:false},
}}});
let c=runtime.connection;const rows=[];const check=(name,passed,detail)=>{rows.push({name,passed,detail});assert.ok(passed,name);};
const until=async expression=>{const end=Date.now()+30000;while(Date.now()<end){if(await c.evaluate(expression))return;await delay(70);}throw Error(expression);};
const navigate=async target=>{await c.evaluate(`app.plugins.plugins.nand.openWorkbench(${JSON.stringify(target)})`);await delay(250);};
const calls=async()=>{try{return(await fs.readFile(path.join(runtime.vault,'dispatch-probe.jsonl'),'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);}catch{return[];}};
const runs=async()=>{const root=path.join(runtime.vault,'.nand/automation');for(const name of await fs.readdir(root)){const file=path.join(root,name,'runtime.json');try{return JSON.parse(await fs.readFile(file,'utf8')).runs;}catch{}}return[];};
const request=(id,destination,finalPrompt='Existing {{literal}}')=>({invocationId:id,title:'Native delivery',agentId:'codex',source:{kind:'widget',path:'A.md',id:'native'},destination,finalPrompt,files:[]});
const button=()=>`[...document.querySelectorAll('.dashboard-quick-actions button')].find(e=>e.textContent.includes('Review native')&&e.getClientRects().length)`;
const click=async expression=>{await c.send('Page.bringToFront');await c.evaluate(`window.focus();${expression}.scrollIntoView({block:'center'});true`);await delay(250);const p=await c.evaluate(`(()=>{const e=${expression},r=e.getBoundingClientRect(),p={x:r.x+r.width/2,y:r.y+r.height/2};window.pointerEvidence={p,rect:r.toJSON(),target:e.outerHTML,hit:document.elementFromPoint(p.x,p.y)?.outerHTML.slice(0,300)};return p})()`);await c.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});};
try{
	await c.evaluate(`window.nativeClicks=[];document.addEventListener('click',event=>nativeClicks.push(event.target.outerHTML?.slice(0,150)),true);app.workspace.leftSplit.collapse();true`);await c.send('Emulation.setDeviceMetricsOverride',{width:1500,height:1000,deviceScaleFactor:1,mobile:false});
	await navigate({feature:'terminal',section:'running'});await until(`app.workspace.getLeavesOfType('nand-workbench-view').some(l=>l.view.getNativeSurfaces().some(s=>s.getViewType()==='nand-agent-page'))`);
	await c.evaluate(`window.ac=app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-agent-page').controller;window.dispatch=app.plugins.plugins.nand.registry.services.peek({owner:'agent',id:'dispatch'});true`);
	await c.evaluate(`ac.settings.update(d=>{d.agents.agents.codex.enabled=true;d.agents.agents.codex.cliPath=${JSON.stringify(process.execPath)};d.agents.agents.codex.accountId='dispatch-probe';d.agents.agents.codex.permissionMode='manual';d.agents.agents.codex.extraArgs=${JSON.stringify('"'+path.join(runtime.vault,'dispatch-cli.cjs')+'"')}})`);
	await navigate({feature:'dashboard',resourceId:'A'});await until(`!!${button()}`);
	if(await c.evaluate(`!!document.querySelector('.dashboard-sidebar--collapsed')`)){await click(`document.querySelector('.dashboard-sidebar-slim-indicator')`);await until(`!document.querySelector('.dashboard-sidebar--collapsed')`);}
	await click(button());await until(`!!document.querySelector('.nand-agent-prompt-preview')`);
	check('default-preview-no-cli-start',(await calls()).length===0);
	await c.evaluate(`[...document.querySelectorAll('.nand-agent-prompt-preview button')].find(e=>e.textContent==='Cancel').click()`);await until(`!document.querySelector('.nand-agent-prompt-preview')`);
	check('preview-cancel-no-record',(await runs()).length===0);
	await click(button());await until(`!!document.querySelector('.nand-agent-prompt-preview')`);await c.evaluate(`${button()}.click();true`);
	check('rapid-repeat-keeps-one-preview',await c.evaluate(`document.querySelectorAll('.nand-agent-prompt-preview').length`)===1);
	const edited='  $review\nEdited {{input}} 中文\n';await c.evaluate(`(()=>{const e=document.querySelector('.nand-agent-prompt-preview textarea');e.value=${JSON.stringify(edited)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await runtime.shot('editable-preview');
	await c.evaluate(`[...document.querySelectorAll('.nand-agent-prompt-preview button')].find(e=>e.textContent==='Send to agent').click()`);await until(`!document.querySelector('.nand-agent-prompt-preview')`);
	await until(`ac.sessions.list().some(s=>s.automated)`);for(let n=0;n<150&&(await calls()).length===0;n++)await delay(100);
	const first=(await calls())[0];check('exact-edited-prompt-reaches-real-cli-once',(await calls()).length===1&&first?.prompt===edited,first);check('request-durable-before-cli-process',first.recorded);
	let history=[];for(let n=0;n<100;n++){history=await runs();if(history[0]?.status==='succeeded')break;await delay(100);}
	check('native-completion-and-delivery-separate',history[0]?.status==='succeeded'&&history[0]?.invocation?.receipt?.delivery==='started',history);
	const snapshot=history[0].invocation.request;const repeat=await c.evaluate(`Promise.all([dispatch.dispatch(${JSON.stringify(snapshot)}),dispatch.dispatch(${JSON.stringify(snapshot)})])`);
	check('same-invocation-no-second-process',repeat[0].runId===repeat[1].runId&&(await calls()).length===1);
	await c.evaluate(`ac.sessions.create({kind:'agent',title:'Interactive fixture',file:${JSON.stringify(process.execPath)},args:[${JSON.stringify(path.join(runtime.vault,'interactive-cli.cjs'))}],cwd:${JSON.stringify(runtime.vault)},agentId:'codex',hooks:false}).then(s=>window.interactive=s);true`);await until(`window.interactive?.inputReady()`);
	const id=await c.evaluate('interactive.id');const pasted=await c.evaluate(`dispatch.dispatch(${JSON.stringify(request('existing',{kind:'existing',sessionId:id}))})`);
	check('existing-port-pasted-receipt',pasted.delivery==='pasted'&&pasted.terminalId===id,pasted);await delay(150);
	const input=(await fs.readFile(path.join(runtime.vault,'interactive-input.jsonl'),'utf8')).trim().split('\n').map(JSON.parse).join('');
	check('native-terminal-one-block-no-enter',input==='\x1b[200~Existing {{literal}}\x1b[201~',JSON.stringify(input));
	check('paste-not-model-success',(await runs()).find(r=>r.invocation?.request.invocationId==='existing')?.status==='delivered');
	await c.evaluate(`ac.sessions.create({kind:'agent',title:'Unready fixture',file:${JSON.stringify(process.execPath)},args:[${JSON.stringify(path.join(runtime.vault,'interactive-cli.cjs'))},'unready'],cwd:${JSON.stringify(runtime.vault)},agentId:'codex',hooks:false}).then(s=>window.unready=s);true`);await until('window.unready?.running');
	const unready=await c.evaluate('unready.id');const timeout=await c.evaluate(`dispatch.dispatch(${JSON.stringify(request('timeout',{kind:'existing',sessionId:unready}))})`);
	check('native-readiness-timeout-keeps-session',timeout.delivery==='timeout'&&await c.evaluate('unready.running'),timeout);
	await navigate({feature:'automations',section:'runs'});await until(`!!document.querySelector('.nand-automation-run-history')`);await runtime.shot('run-history');
	check('history-has-delivery-and-prompt-detail',await c.evaluate(`document.querySelector('.nand-automation-run-history').textContent.includes('Pasted · awaiting your submission')&&document.querySelector('.nand-automation-run-history').textContent.includes('Delivered prompt and file references')`));
	await navigate({feature:'dashboard',resourceId:'A'});
	await click(`[...document.querySelectorAll('.nand-board-controls button')].find(e=>e.textContent==='Board widgets')`);await until(`!!document.querySelector('.nand-widget-catalog')`);
	await c.evaluate(`document.querySelector('[data-widget-kind="home/skills"] button').click()`);
	await c.evaluate(`[...document.querySelectorAll('.nand-widget-catalog button')].find(e=>e.textContent==='Save').click()`);await until(`!!document.querySelector('.nand-skills-widget')`);
	if(await c.evaluate(`!!document.querySelector('.dashboard-sidebar--collapsed')`))await click(`document.querySelector('.dashboard-sidebar-slim-indicator')`);
	const skillButton=text=>`[...document.querySelectorAll('.nand-skills-widget button')].find(e=>e.textContent===${JSON.stringify(text)})`;
	const fill=async(label,value,scope='.nand-skills-editor')=>{await c.evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(scope+' label')})].find(e=>e.querySelector('span')?.textContent===${JSON.stringify(label)}).querySelector('input,textarea');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(40);};
	const boardBytes=()=>fs.readFile(path.join(runtime.vault,'A.md'),'utf8');const beforeConfig=await boardBytes();
	await click(skillButton('Add skill button'));await fill('Button label','Discarded draft');
	check('inline-editor-click-keeps-widget-area-open',!await c.evaluate(`!!document.querySelector('.dashboard-sidebar--collapsed')`));
	await click(skillButton('Cancel'));await until(`!document.querySelector('.nand-skills-editor')`);
	check('skill-config-cancel-zero-writes',await boardBytes()===beforeConfig);
	await click(skillButton('Add skill button'));await fill('Button label','Configured review');
	await c.evaluate(`(()=>{const e=[...document.querySelectorAll('.nand-skills-editor label')].find(e=>e.querySelector('span')?.textContent==='Agent').querySelector('select');e.value='codex';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(50);
	await fill('Skill name','review');await fill('Prompt template','{{input}}\n{{path}}');await fill('Input placeholder','Focus area');await click(skillButton('Save'));await until(`!document.querySelector('.nand-skills-editor')`);
	await until(`app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.getViewType()==='nand-dashboard-view')?.sync.getSaveState().status==='saved'`);
	check('saving-inline-editor-keeps-widget-area-open',!await c.evaluate(`!!document.querySelector('.dashboard-sidebar--collapsed')`));
	check('widget-persists-board-local-declaration',(await boardBytes()).includes('Configured review')&&!(await fs.readFile(path.join(runtime.vault,'B.md'),'utf8')).includes('Configured review'));
	const countBefore=(await calls()).length;await click(skillButton('Configured review'));await until(`!!document.querySelector('.nand-skills-preview')`);
	await fill('Additional input','{{path}} literal input','.nand-skills-preview');
	check('preview-supplement-single-template-expansion',await c.evaluate(`document.querySelectorAll('.nand-skills-preview textarea')[1].value`) === '$review\n{{path}} literal input\nA.md');
	await c.evaluate(`[...document.querySelectorAll('.nand-skills-preview button')].find(e=>e.textContent==='Add a file').click()`);await until(`!!document.querySelector('.prompt')`);
	await c.evaluate(`(()=>{const e=document.querySelector('.prompt-input');e.value='B.md';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(180);
	await c.evaluate(`[...document.querySelectorAll('.suggestion-item')].find(e=>e.textContent==='B.md').click()`);await until(`!document.querySelector('.prompt')`);
	check('preview-file-picker-retains-selection',await c.evaluate(`!![...document.querySelectorAll('.nand-skills-preview input[type="checkbox"]')].find(e=>e.checked&&e.parentElement.textContent.includes('B.md'))`));
	const exact='  $review\nWidget edited {{input}} 中文\n';await fill('Final prompt',exact,'.nand-skills-preview');await fill('Additional input','changed after edit','.nand-skills-preview');
	check('supplement-cannot-overwrite-edited-final-text',await c.evaluate(`document.querySelectorAll('.nand-skills-preview textarea')[1].value`)===exact);
	await runtime.shot('skills-edited-preview');await c.evaluate(`[...document.querySelectorAll('.nand-skills-preview button')].find(e=>e.textContent==='Send to agent').click()`);await until(`!document.querySelector('.nand-skills-preview')`);
	for(let n=0;n<100&&(await calls()).length===countBefore;n++)await delay(100);
	check('configured-widget-exact-prompt-and-selected-file-once',(await calls()).length===countBefore+1&&(await calls()).at(-1).prompt===exact+'\nB.md');
	await navigate({feature:'dashboard',resourceId:'A'});if(await c.evaluate(`!!document.querySelector('.dashboard-sidebar--collapsed')`))await click(`document.querySelector('.dashboard-sidebar-slim-indicator')`);
	await click(`document.querySelector('.nand-skills-widget button[aria-label="Configure skill buttons"]')`);await click(`document.querySelector('.nand-skills-widget button[aria-label="Edit Configured review"]')`);
	await c.evaluate(`document.querySelector('.nand-skills-editor input[type="checkbox"]').click()`);await click(skillButton('Save'));await until(`!document.querySelector('.nand-skills-editor')`);
	const beforeDirect=(await calls()).length;await c.evaluate(`(()=>{const e=${skillButton('Configured review')};e.click();e.click();})()`);
	check('direct-send-skips-preview',!await c.evaluate(`!!document.querySelector('.nand-skills-preview')`));for(let n=0;n<100&&(await calls()).length===beforeDirect;n++)await delay(100);
	check('direct-send-repeat-starts-only-once',(await calls()).length===beforeDirect+1&&(await calls()).at(-1).prompt==='$review\n\nA.md');
	await navigate({feature:'dashboard',resourceId:'A'});if(await c.evaluate(`!!document.querySelector('.dashboard-sidebar--collapsed')`))await click(`document.querySelector('.dashboard-sidebar-slim-indicator')`);
	await click(`document.querySelector('.nand-skills-widget button[aria-label="Configure skill buttons"]')`);await click(`document.querySelector('.nand-skills-widget button[aria-label="Edit Configured review"]')`);
	check('saved-direct-send-reopens-checked',await c.evaluate(`document.querySelector('.nand-skills-editor input[type="checkbox"]').checked`));await click(skillButton('Cancel'));await runtime.shot('skills-widget');
	await click(`document.querySelector('.nand-skills-widget button[aria-label="Edit Configured review"]')`);await c.evaluate(`document.querySelector('.nand-skills-editor input[type="checkbox"]').click()`);
	const select=async(label,value,scope='.nand-skills-editor')=>{await c.evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(scope+' label')})].find(e=>e.querySelector('span')?.textContent===${JSON.stringify(label)}).querySelector('select');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(80);};
	await select('Destination','existing');await until(`!!document.querySelector('.nand-skills-editor option[value="${id}"]')`);await select('Session',id);await click(skillButton('Save'));await until(`!document.querySelector('.nand-skills-editor')`);
	await click(skillButton('Configured review'));await until(`!!document.querySelector('.nand-skills-preview')`);
	check('saved-session-selected-in-preview',await c.evaluate(`[...document.querySelectorAll('.nand-skills-preview select')].some(e=>e.value===${JSON.stringify(id)})`));
	const beforeInput=await fs.readFile(path.join(runtime.vault,'interactive-input.jsonl'),'utf8');const existingText='Widget paste {{literal}}';await fill('Final prompt',existingText,'.nand-skills-preview');await until(`![...document.querySelectorAll('.nand-skills-preview button')].find(e=>e.textContent==='Paste without sending').disabled`);await c.evaluate(`[...document.querySelectorAll('.nand-skills-preview button')].find(e=>e.textContent==='Paste without sending').click()`);await until(`!document.querySelector('.nand-skills-preview')`);await delay(300);
	const afterInput=await fs.readFile(path.join(runtime.vault,'interactive-input.jsonl'),'utf8');const appended=afterInput.slice(beforeInput.length).trim().split('\n').filter(Boolean).map(JSON.parse).join('');
	check('widget-existing-session-single-unsent-block',appended==='\x1b[200~'+existingText+'\x1b[201~',JSON.stringify(appended));
	await c.evaluate(`ac.sessions.end(${JSON.stringify(id)},true);true`);await until(`!interactive.running`);await navigate({feature:'dashboard',resourceId:'A'});
	if(await c.evaluate(`!!document.querySelector('.dashboard-sidebar--collapsed')`))await click(`document.querySelector('.dashboard-sidebar-slim-indicator')`);
	const beforeMissing=(await calls()).length;await click(skillButton('Configured review'));await until(`!!document.querySelector('.nand-skills-preview')`);await delay(150);
	check('expired-session-requires-reselection-without-fresh-fallback',await c.evaluate(`[...document.querySelectorAll('.nand-skills-preview select')].some(e=>e.value===${JSON.stringify(id)})&&[...document.querySelectorAll('.nand-skills-preview button')].find(e=>e.textContent==='Paste without sending').disabled`)&&(await calls()).length===beforeMissing);
	await runtime.shot('skills-expired-session');
	const beforeMatrix=await boardBytes();
	for(const preset of ['system','claude-code','eye-care'])for(const dark of [false,true]){
		await c.evaluate(`app.plugins.plugins.nand.theme.update(d=>{d.preset=${JSON.stringify(preset)}});app.changeTheme(${JSON.stringify(dark?'obsidian':'moonstone')});true`);
		for(const width of [500,800,1500]){
			await c.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await delay(180);
			const m=await c.evaluate(`(()=>{const e=document.querySelector('.nand-skill-preview-dialog'),r=e.getBoundingClientRect();return{left:r.left,right:r.right,width:innerWidth,overflow:e.scrollWidth>e.clientWidth+2,controls:[...e.querySelectorAll('button,select')].filter(b=>b.getClientRects().length).map(b=>b.getBoundingClientRect().height)}})()`);
			check(`skill-preview-${preset}-${dark?'dark':'light'}-${width}`,m.left>=0&&m.right<=m.width+1&&!m.overflow&&m.controls.every(h=>h>=32),m);await runtime.shot(`skills-${preset}-${dark?'dark':'light'}-${width}`);
		}
	}
	check('preview-theme-resize-does-not-rewrite-board',await boardBytes()===beforeMatrix);
	await c.evaluate(`[...document.querySelectorAll('.nand-skills-preview button')].find(e=>e.textContent==='Cancel').click()`);
	await click(skillButton('Configured review'));await until(`!!document.querySelector('.nand-skills-preview')`);await navigate({feature:'dashboard',resourceId:'B'});
	check('board-navigation-closes-owned-preview',!await c.evaluate(`!!document.querySelector('.nand-skills-preview')`));await navigate({feature:'dashboard',resourceId:'A'});
	if(await c.evaluate(`!!document.querySelector('.dashboard-sidebar--collapsed')`))await click(`document.querySelector('.dashboard-sidebar-slim-indicator')`);
	await click(skillButton('Configured review'));await until(`!!document.querySelector('.nand-skills-preview')`);await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('home',false)`);
	check('home-module-off-closes-owned-preview',!await c.evaluate(`!!document.querySelector('.nand-skills-preview')`));await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('home',true)`);await navigate({feature:'dashboard',resourceId:'A'});await until(`!!${skillButton('Configured review')}`);
	if(await c.evaluate(`!!document.querySelector('.dashboard-sidebar--collapsed')`))await click(`document.querySelector('.dashboard-sidebar-slim-indicator')`);
	await click(skillButton('Configured review'));await until(`!!document.querySelector('.nand-skills-preview')`);await c.evaluate(`[...document.querySelectorAll('.nand-skills-preview button')].find(e=>e.textContent==='Add a file').click()`);await until(`!!document.querySelector('.prompt')`);
	const totalCalls=(await calls()).length;
	await c.evaluate(`app.plugins.plugins.nand.setModuleEnabled('agent',false)`);const disabled=await c.evaluate(`dispatch.dispatch(${JSON.stringify(request('disabled',{kind:'fresh',cwd:runtime.vault}))})`);
	check('agent-module-off-closes-preview-and-file-picker',!await c.evaluate(`!!document.querySelector('.nand-skills-preview')||!!document.querySelector('.prompt')`));
	check('revoked-port-does-not-restart-module',disabled.delivery==='rejected'&&(await calls()).length===totalCalls);
	await until(`${skillButton('Configured review')}?.disabled`);check('widget-agent-off-placeholder',await c.evaluate(`document.querySelector('.nand-skills-widget').textContent.includes('not available')`));
	check('no-runtime-errors',await c.evaluate('nandAcceptanceErrors.length===0'),await c.evaluate('nandAcceptanceErrors'));
	const beforeRestart=await boardBytes();await runtime.restart();c=runtime.connection;await navigate({feature:'dashboard',resourceId:'A'});await until(`!!document.querySelector('.nand-skills-widget')`);
	check('restart-preserves-declarations-and-does-not-auto-start',await boardBytes()===beforeRestart&&(await calls()).length===totalCalls&&await c.evaluate(`!!${skillButton('Configured review')}`));
	await fs.writeFile(path.join(runtime.evidence,'review.json'),JSON.stringify({rows,unverified:['Actual provider/model execution','Context entrypoints and browser-workflow automation','Actual mobile hardware and skill preview in a popout window']},null,2));
}catch(error){await fs.writeFile(path.join(runtime.evidence,'partial-review.json'),JSON.stringify(rows,null,2));await fs.writeFile(path.join(runtime.evidence,'diagnostic.json'),JSON.stringify(await c.evaluate(`({pointer:window.pointerEvidence,errors:window.nandAcceptanceErrors,clicks:window.nativeClicks,notices:[...document.querySelectorAll('.notice')].map(e=>e.textContent),modals:[...document.querySelectorAll('.modal-container')].map(e=>e.textContent),dispatch:typeof app.plugins.plugins.nand.registry.services.peek({owner:'agent',id:'dispatch'})?.dispatch})`).catch(e=>String(e)),null,2));await runtime.shot('failure').catch(()=>{});throw error;}finally{console.log(JSON.stringify({evidence:runtime.evidence,checks:rows.length,failed:rows.filter(r=>!r.passed)}));await runtime.stop();}
