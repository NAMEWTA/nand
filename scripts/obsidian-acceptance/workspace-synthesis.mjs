// Production browser UI/storage with explicit fixtures at the public agent capability boundary.
// No real CLI account, website session or operating-system clipboard claim.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parse, stringify } from 'yaml';
import { launchFreshVault } from './fresh-vault.mjs';
import { inspectLayout } from './workspace-history.mjs';

const p='app.plugins.plugins.nand', json=JSON.stringify, rows=[], errors=[];
const root='[...document.querySelectorAll(".nand-browser-workspace")].find(e=>e.getBoundingClientRect().width>0)';
const panel=root+'.querySelector(".nand-browser-synthesis")', history=root+'.querySelector(".nand-browser-synthesis-history")';
const button=(label,scope=root)=>'[...'+scope+'.querySelectorAll("button")].find(e=>e.textContent==='+json(label)+')';
const check=(name,passed,detail)=>{rows.push({name,passed,detail});assert.ok(passed,name)};
let runtime,c;
const until=async expression=>{const end=Date.now()+25000;while(Date.now()<end){try{if(await c.evaluate(expression))return}catch{}await delay(80)}throw Error(expression)};
const click=async expression=>{
 await c.send('Page.bringToFront');await c.evaluate('window.focus();'+expression+'.scrollIntoView({block:"center",inline:"center"});true');await delay(150);
 const point=await c.evaluate('(()=>{const r='+expression+'.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
 await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
 await until('(()=>{const e='+expression+',r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()');
 for(const type of ['mousePressed','mouseReleased'])await c.send('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1});
};
const type=async(expression,text)=>{await click(expression);for(const type of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await c.send('Input.insertText',{text})};
const select=async(expression,key)=>{await click(expression);for(const [name,code] of [[key,key==='ArrowDown'?40:38],['Enter',13]])for(const type of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type,key:name,code:name,windowsVirtualKeyCode:code})};
const bind=async()=>{c=runtime.connection;c.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails));await c.send('Runtime.enable');await c.evaluate('window.bw='+p+'.services.peek({owner:"browser",id:"workspace"});window.bc='+p+'.services.peek({owner:"browser",id:"control"});app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();true')};
const task=async()=>{await c.evaluate(p+'.openWorkbench({feature:"browser",section:"multi-ai",resourceId:"task"},window)');await until('!!'+panel+'&&!!bw.snapshot()');};
const fixture=async()=>c.evaluate(String.raw`(()=>{
 window.ownerCalls=[];window.ownerPastes=[];window.ownerOpens=[];window.ownerAborts=0;window.ownerMode='success';window.ownerAvailable=true;
 const services=${p}.registry.services,original=services.peek;window.restoreSynthesisOwner=()=>{services.peek=original};
 const runner={run:async request=>{ownerCalls.push({prompt:request.prompt,agentId:request.agentId,purpose:request.purpose,channel:request.resultChannel});request.onState?.({status:'running',terminalId:'fixture-terminal'});
  if(ownerMode==='wait'){request.onState?.({status:'needs-attention',terminalId:'fixture-terminal'});await new Promise(resolve=>request.signal.addEventListener('abort',resolve,{once:true}));ownerAborts++;return{status:'cancelled',text:'',terminalId:'fixture-terminal'}}
  if(ownerMode==='save-failure')window.failSynthesisWrite=true;
  return{status:'succeeded',text:'# Reviewed synthesis\n\nSelected evidence [S1] and [S2].\n\n| Source | Limit |\n| --- | --- |\n| S2 | Partial |',terminalId:'fixture-terminal',usage:{input:123,output:45,cacheRead:0,cacheWrite:0,cost:null,known:true}}},open:async id=>{ownerOpens.push(id)}};
 const capabilities={directory:{list:()=>ownerAvailable?[{id:'codex',title:'Codex fixture',enabled:true,installed:true}]:[]},sessions:{list:async()=>ownerAvailable?[{id:'fixture-session',title:'Existing review',agentId:'codex'}]:[],attachMaterial:async()=>{throw Error('Wrong delivery path')}},'prompt-runner':runner,dispatch:{dispatch:async request=>{ownerPastes.push(request);return{invocationId:request.invocationId,delivery:'pasted',terminalId:'fixture-terminal'}}}};
 services.peek=key=>key.owner==='agent'?capabilities[key.id]:original(key);return true;
})()`);
const preview=async()=>{await click(button('Review synthesis material and target',panel));await until('!!'+button('Authorize and run once',panel)+'||!!'+button('Paste reviewed material once',panel))};
const start=async()=>{await preview();await click(button('Authorize and run once',panel))};
const ready=async()=>until('!'+button('Review synthesis material and target',panel)+'.disabled');

try{
 const golden=(await fs.readFile('test/golden/__snapshots__/browser-workspace.md','utf8')).replaceAll('\r\n','\n');
 const files=Object.fromEntries([...golden.matchAll(/^# (NAND\/AI Workspace\/[^\n]+)\n\n([\s\S]*?)(?=^# NAND\/AI Workspace\/|(?![\s\S]))/gm)].map(match=>[match[1],match[2]]));
 const modify=(file,change)=>{const [,yaml,body]=/^---\n([\s\S]*?)---\n([\s\S]*)$/.exec(files[file]);const meta=parse(yaml);change(meta);files[file]='---\n'+stringify(meta)+'---\n'+body};
 for(const file of Object.keys(files).filter(file=>!file.includes('/回答/')))modify(file,meta=>{const data=meta['nand-workspace'];data.targets.push({...structuredClone(data.targets[0]),id:'target-kimi',provider:'kimi'});});
 const answer=Object.keys(files).find(file=>file.includes('/回答/')), second=answer.replace('exchange.md','exchange-kimi.md');files[second]=files[answer].replace('# Heading','# Kimi source').replace('Partial update','Kimi partial update');
 modify(second,meta=>{meta['nand-id']='exchange-kimi';const data=meta['nand-workspace'];data.id='exchange-kimi';data.targetId='target-kimi';data.currentCaptureId='kimi-capture-two';for(const capture of data.captures){capture.id='kimi-'+capture.id;capture.exchangeId='exchange-kimi'}});
 check('fixture-has-two-site-histories',Object.keys(files).length===4);
 runtime=await launchFreshVault({root:process.argv[2],port:9276,files,settings:{version:1,namespaces:{app:{language:'en',introSeen:true,modules:{browser:true,home:false,agent:false,news:false,archives:false,sync:false,comments:false,notifications:false,automations:false,icons:false}}}}});
 await bind();await task();const original=await c.evaluate('JSON.stringify(bw.snapshot().exchanges)');
 check('synthesis-opt-in-is-off-and-no-guests-open',await c.evaluate('!'+panel+'.querySelector("input[type=checkbox]").checked&&!'+panel+'.querySelector("select")&&bc.list().length===0'));
 await click(panel+'.querySelector("input[type=checkbox]").closest("label")');await until(panel+'.textContent.includes("Enable the Agent module")');
 check('missing-capability-explains-configuration-without-activating-agent',await c.evaluate('!'+p+'.registry.services.peek({owner:"agent",id:"directory"})'));
 await fixture();await click(button('Refresh available agents and sessions',panel));await until(panel+'.querySelectorAll("select")[1].options.length===2');
 await select(panel+'.querySelectorAll("select")[1]','ArrowDown');await type(panel+'.querySelector("input[type=text]")','Native synthesis');await type(panel+'.querySelector("textarea")','Compare only selected evidence and cite sources.');
 await click(panel+'.querySelectorAll("fieldset label")[0]');await click(panel+'.querySelectorAll("fieldset label")[3]');await preview();
 check('review-is-exact-two-selected-versions-without-owner-call',await c.evaluate('ownerCalls.length===0&&ownerPastes.length===0&&'+panel+'.textContent.includes("Capture v1")&&'+panel+'.textContent.includes("Capture v2")&&'+panel+'.querySelector("article").textContent.includes("Kimi partial update")&&!'+panel+'.querySelector("article").textContent.includes("Kimi source")'));
 await click(panel+'.querySelector("article details summary")');await inspectLayout({c,p,root,runtime,check},'synthesis-preview',panel+'.querySelector("article")');
 await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await delay(100);
 check('touch-checkbox-labels-are-at-least-44px',await c.evaluate('[...'+panel+'.querySelectorAll(".nand-browser-workspace-check")].every(e=>e.getBoundingClientRect().height>=44)'));
 await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});
 await click(button('Authorize and run once',panel));await until('bw.snapshot().syntheses.some(r=>r.status==="succeeded")');await ready();
 check('automatic-owner-called-once-with-selected-capture-material',await c.evaluate('ownerCalls.length===1&&ownerPastes.length===0&&ownerCalls[0].channel==="native"&&ownerCalls[0].prompt.includes("Kimi partial update")&&!ownerCalls[0].prompt.includes("Kimi source")&&bw.snapshot().syntheses[0].inputs.length===2'));
 check('completed-result-renders-separately-with-usage',await c.evaluate(history+'.querySelector(".nand-browser-answer table")&&'+history+'.textContent.includes("123 input")&&'+history+'.textContent.includes("45 output")'));
 await c.evaluate('window.synthesisModule=app.workspace.getLeavesOfType("nand-workbench-view").flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.taskId==="task").module;window.originalCopy=synthesisModule.copyText;synthesisModule.copyText=text=>{window.copiedSynthesis=text};true');
 try{await click(button('Copy synthesis result',history));check('copy-uses-exact-result-at-clipboard-boundary',await c.evaluate('copiedSynthesis===bw.snapshot().syntheses[0].text'))}finally{await c.evaluate('synthesisModule.copyText=originalCopy;true')}
 const result=await c.evaluate('bw.snapshot().syntheses[0]');const file=path.join(runtime.vault,'NAND/AI Workspace/综合',result.id+'.md'), saved=await fs.readFile(file,'utf8');
 check('standalone-markdown-retains-full-output-and-exact-source-references',saved.includes('Reviewed synthesis')&&saved.includes('capture-one')&&saved.includes('kimi-capture-two')&&saved.includes('Kimi partial update'));
 await inspectLayout({c,p,root,runtime,check},'synthesis-result',history);
 await c.evaluate('window.ownerMode="wait";true');await start();await until(history+'.textContent.includes("The agent needs attention")');await click(button('Open running agent',history));
 check('needs-attention-opens-the-owned-running-terminal',await c.evaluate('ownerOpens.length===1&&ownerOpens[0]==="fixture-terminal"'));
 await click(button('Cancel synthesis',history));await until('bw.snapshot().syntheses.some(r=>r.status==="cancelled")');await ready();check('cancel-keeps-selected-original-answers',await c.evaluate('JSON.stringify(bw.snapshot().exchanges)==='+json(original)));
 await select(panel+'.querySelectorAll("select")[0]','ArrowDown');await select(panel+'.querySelectorAll("select")[1]','ArrowDown');await preview();await click(button('Paste reviewed material once',panel));await until('bw.snapshot().syntheses.some(r=>r.status==="pasted")');await ready();
 check('existing-session-only-pastes-without-second-execution',await c.evaluate('ownerCalls.length===2&&ownerPastes.length===1&&ownerPastes[0].destination.sessionId==="fixture-session"&&bw.snapshot().syntheses.find(r=>r.status==="pasted").text===""'));
 await select(panel+'.querySelectorAll("select")[0]','ArrowUp');await c.evaluate('window.ownerMode="save-failure";window.originalProcess=app.vault.process;app.vault.process=function(file,...args){if(window.failSynthesisWrite&&file.path.includes("/综合/"))throw Error("Fixture output write failure");return originalProcess.call(this,file,...args)};true');
 try{await start();await until(history+'.textContent.includes("latest result is unsaved")');check('write-failure-preserves-completed-output-without-another-call',await c.evaluate('ownerCalls.length===3&&bw.snapshot().syntheses.filter(r=>r.status==="succeeded").length===2'))}finally{await c.evaluate('window.failSynthesisWrite=false;app.vault.process=originalProcess;true')}
 await click(button('Retry saving',history));await until('!'+history+'.textContent.includes("latest result is unsaved")');await ready();check('save-retry-does-not-execute-model',await c.evaluate('ownerCalls.length===3'));
 const recovery='document.querySelector(".nand-browser-recovery")';await click(button('Review local recovery',recovery));await until('!!'+recovery+'.querySelector("[data-recovery-id] button")');await click(recovery+'.querySelector("[data-recovery-id] button")');await until('!!'+button('Read recovery draft',recovery));await click(button('Read recovery draft',recovery));
 check('recovery-reader-shows-independent-results-and-citations',await c.evaluate(recovery+'.textContent.includes("Reviewed synthesis")&&'+recovery+'.querySelectorAll("[data-synthesis-id]").length===4'));
 await c.evaluate('window.ownerMode="wait";true');await start();await until(history+'.textContent.includes("The agent needs attention")');
 await runtime.crashRestart();await bind();await task();check('restart-marks-unfinished-intent-interrupted-without-replay',await c.evaluate('bw.snapshot().syntheses.length===5&&bw.snapshot().syntheses.some(r=>r.status==="interrupted")&&!'+p+'.services.peek({owner:"agent",id:"directory"})&&bc.list().length===0'));
 check('restart-keeps-full-completed-result-and-selected-inputs',await c.evaluate('bw.snapshot().syntheses.filter(r=>r.status==="succeeded").every(r=>r.inputs.length===2&&r.text.includes("Reviewed synthesis"))'));
 await fixture();await click(panel+'.querySelector("input[type=checkbox]").closest("label")');await until(panel+'.querySelectorAll("select")[1].options.length===2');
 await select(panel+'.querySelectorAll("select")[1]','ArrowDown');await type(panel+'.querySelector("input[type=text]")','Disable cancellation');await type(panel+'.querySelector("textarea")','Summarize selected source.');await click(panel+'.querySelectorAll("fieldset label")[0]');
 await c.evaluate('window.ownerMode="wait";true');await start();await until(history+'.textContent.includes("The agent needs attention")');await c.evaluate(p+'.setModuleEnabled("browser",false)');
 check('module-disable-aborts-and-drains-its-owned-call',await c.evaluate('ownerAborts===1&&!'+p+'.services.peek({owner:"browser",id:"workspace"})&&!document.querySelector("webview")'));
 await c.evaluate(p+'.setModuleEnabled("browser",true)');await bind();await task();
 check('reenable-keeps-cancelled-result-without-reexecution',await c.evaluate('bw.snapshot().syntheses.length===6&&bw.snapshot().syntheses.filter(r=>r.status==="cancelled").length===2&&ownerCalls.length===1'));
 await click(button('Task history'));const taskHistory=root+'.querySelector(".nand-browser-workspace-history")';await until('!!'+taskHistory);await click(button('Delete local task',taskHistory));await until('!!'+button('Confirm local deletion',taskHistory));await click(button('Confirm local deletion',taskHistory));await until('bw.snapshot().tasks.length===0');
 check('task-deletion-retains-all-independent-result-readers',await c.evaluate('bw.snapshot().syntheses.length===6&&'+history+'.querySelectorAll("[data-synthesis-id]").length===6&&'+history+'.textContent.includes("Reviewed synthesis")'));
 await c.evaluate(p+'.changeLanguage("zh")');await until(history+'.textContent.includes("综合记录")');await runtime.shot('synthesis-chinese');check('localized-status-and-source-reader',await c.evaluate(history+'.textContent.includes("综合已中断")&&'+history+'.textContent.includes("所选来源与综合指令")'));
 check('no-host-errors',errors.length===0&&(await c.evaluate('window.nandAcceptanceErrors??[]')).length===0,errors);
 await fs.writeFile(path.join(runtime.evidence,'result.json'),json({method:'Production bundle in real Obsidian; deterministic saved capture documents, fixtures at public AGENT_DIRECTORY/SESSIONS/PROMPT_RUNNER/DISPATCH boundary. Vault.process result-write fault, clipboard-boundary copy observation, owned fixture crash/restart. No live website, real CLI account or OS clipboard mutation.',rows},null,2));
}catch(error){if(runtime){await runtime.shot('failure').catch(()=>{});await fs.writeFile(path.join(runtime.evidence,'partial.json'),json({rows,error:String(error),errors,state:await c.evaluate('({data:window.bw?.snapshot(),body:document.body.innerText,errors:window.nandAcceptanceErrors})').catch(String)},null,2))}throw error}
finally{if(runtime){console.log(json({evidence:runtime.evidence,checks:rows.length,failed:rows.filter(row=>!row.passed)}));await runtime.stop()}}
