// Real Obsidian UI and file input; deterministic upstream-export fixture, no provider account.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { inspectLayout } from './workspace-history.mjs';

const p='app.plugins.plugins.nand', json=JSON.stringify, rows=[], errors=[];
const root='[...document.querySelectorAll(".nand-browser-workspace")].find(e=>e.getBoundingClientRect().width>0)';
const transfer=root+'.querySelector(".nand-browser-workspace-transfer")';
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
const bind=async()=>{c=runtime.connection;c.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails));await c.send('Runtime.enable');await c.evaluate('window.bw='+p+'.services.peek({owner:"browser",id:"workspace"});window.bc='+p+'.services.peek({owner:"browser",id:"control"});app.workspace.leftSplit?.collapse();app.workspace.rightSplit?.collapse();true')};
const list=async()=>{await c.evaluate(p+'.openWorkbench({feature:"browser",section:"multi-ai"},window)');await until('!!bw.snapshot()&&!!'+transfer);if(!await c.evaluate(transfer+'.open'))await click(transfer+'.querySelector("summary")')};
const choose=async file=>{
	await until('!'+transfer+'.querySelector("input[type=file]").disabled');
 const {result}=await c.send('Runtime.evaluate',{expression:transfer+'.querySelector("input[type=file]")'});
 await c.send('DOM.setFileInputFiles',{objectId:result.objectId,files:[path.resolve(file)]});
 await until('!'+transfer+'.querySelector("input[type=file]").disabled');
};
try{
 runtime=await launchFreshVault({root:process.argv[2],port:9276,settings:{version:1,namespaces:{app:{language:'en',introSeen:true,modules:{browser:true,home:false,agent:false,news:false,archives:false,sync:false,comments:false,notifications:false,automations:false,icons:false}}}}});
 await bind();await list();
 const source=path.resolve('src/modules/browser/core/workspace/fixtures/maiw-v3.jsonl'), text=await fs.readFile(source,'utf8');
 const invalid=path.join(process.argv[2],'invalid.jsonl');await fs.writeFile(invalid,text.replace('"version":3','"version":99'));
 await choose(invalid);await until('!!'+root+'.querySelector("[role=alert]")');
 check('invalid-version-file-rejected-with-line-without-documents',await c.evaluate('bw.snapshot().tasks.length===0&&'+root+'.textContent.includes("line 1")&&bc.list().length===0'));
 await choose(source);await until('!!'+button('Import reviewed history'));
 check('preview-counts-without-writing-or-opening-website',await c.evaluate('bw.snapshot().tasks.length===0&&'+transfer+'.textContent.includes("Tasks: 1 new")&&'+transfer+'.textContent.includes("Answers: 2 new")&&bc.list().length===0'));
 await click(button('Read source records'));check('source-preview-retains-template-answer-status-and-layout',await c.evaluate(transfer+'.querySelector("textarea").value.includes("Check sources")&&'+transfer+'.querySelector("textarea").value.includes("Saved answer")&&'+transfer+'.querySelector("textarea").value.includes("widthRatio")'));
 await inspectLayout({c,p,root,runtime,check},'maiw-import-preview',transfer);
 await click(button('Import reviewed history'));await until('bw.snapshot().tasks.length===1&&!'+transfer+'.querySelector("input").disabled');
 const imported=await c.evaluate('bw.snapshot()'), task=imported.tasks[0];
 check('import-preserves-two-rounds-and-separate-unverified-transcripts',imported.turns.length===2&&imported.exchanges.length===2&&imported.templates.length===0&&imported.exchanges.every(e=>e.imported&&!e.receipt&&!e.captures.length)&&!task.selectedTargetIds.length);
 const owned=await fs.readdir(path.join(runtime.vault,'NAND/AI Workspace'),{recursive:true});
 const texts=await Promise.all(owned.filter(file=>file.endsWith('.md')).map(file=>fs.readFile(path.join(runtime.vault,'NAND/AI Workspace',file),'utf8')));
 check('imported-transcripts-are-readable-owned-markdown',texts.some(text=>text.includes('# Saved answer'))&&texts.some(text=>text.includes('Partial historical answer.')));
 await choose(source);await until('!!'+button('Import reviewed history'));
 check('repeat-file-reports-duplicates-and-disables-submit',await c.evaluate(transfer+'.textContent.includes("Tasks: 0 new, 1 already imported")&&'+button('Import reviewed history')+'.disabled&&bw.snapshot().tasks.length===1'));
 const conflict=path.join(process.argv[2],'conflict.jsonl');await fs.writeFile(conflict,text.replace('# Saved answer','# Changed upstream'));
 await choose(conflict);await until(transfer+'.textContent.includes("source-exchange-one")');
 check('changed-source-id-conflict-keeps-original-transcript',await c.evaluate(button('Import reviewed history')+'.disabled&&bw.snapshot().exchanges.some(e=>e.imported?.markdown?.includes("# Saved answer"))'));
 await click(button('Imported research',root+'.querySelector(".nand-browser-workspace-history")'));await until('!!'+root+'.querySelector(".nand-browser-imported-answer")');
 check('local-reader-renders-both-sites-and-template-without-native-send-controls',await c.evaluate(root+'.querySelectorAll(".nand-browser-imported-answer").length===2&&!!'+root+'.querySelector(".nand-browser-answer table")&&!'+button('Collect this answer again')+'&&'+button('Open official page')+'.disabled&&bc.list().length===0'));
 await c.evaluate('window.transferModule=app.workspace.getLeavesOfType("nand-workbench-view").flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.taskId==='+json(task.id)+').module;window.copyOriginal=transferModule.copyText;transferModule.copyText=text=>{window.transcriptCopied=text};true');
 try{await click(button('Copy imported answer',root+'.querySelector(".nand-browser-imported-answer")'));await until('!!window.transcriptCopied');check('copy-uses-exact-imported-answer-at-clipboard-boundary',await c.evaluate('transcriptCopied==="Partial historical answer."'))}finally{await c.evaluate('transferModule.copyText=copyOriginal;true')}
 const md=root+'.querySelector(".nand-browser-workspace-export")';await click(md+'.querySelector("summary")');await click(button('Preview Markdown export',md));await until('!!'+md+'.querySelector("textarea")');
 check('markdown-export-includes-imported-source-and-both-answers',await c.evaluate(md+'.querySelector("textarea").value.includes("Imported MAIW history")&&'+md+'.querySelector("textarea").value.includes("Partial historical answer.")&&'+md+'.querySelector("textarea").value.includes("# Saved answer")'));
 await inspectLayout({c,p,root,runtime,check},'maiw-imported-reader',root+'.querySelector(".nand-browser-imported-answer")');
 await click(button('Bind selected account'));await until('bw.snapshot().tasks[0].targets[0].profileId==="default"&&!'+button('Open official page')+'.disabled');
 check('explicit-rebind-leaves-history-and-recipient-set-unverified',await c.evaluate('bc.list().length===0&&bw.snapshot().tasks[0].targets[0].status==="unverified"&&bw.snapshot().tasks[0].selectedTargetIds.length===0&&bw.snapshot().turns.every(t=>t.targets.every(x=>x.profileId==="unbound"&&!x.page))'));
 await click(button('Task history'));await until('!!'+transfer);if(!await c.evaluate(transfer+'.open'))await click(transfer+'.querySelector("summary")');
 await click(transfer+'.querySelector("input[type=checkbox]").closest("label")');await click(button('Preview MAIW v3 export'));await until('!!'+transfer+'.querySelector("textarea")');
 const output=await c.evaluate(transfer+'.querySelector("textarea").value'), records=output.trim().split('\n').map(JSON.parse), originalRecords=text.trim().split('\n').map(JSON.parse);
 check('v3-export-preserves-original-supported-records',records.slice(1).every(row=>isDeepStrictEqual(row,originalRecords.find(other=>other.type===row.type&&other.data?.id===row.data.id)))&&records[0].counts.exchanges===2);
 await click(button('Save export in vault',transfer));await until(transfer+'.textContent.includes("Saved: ")');
 const exports=await fs.readdir(path.join(runtime.vault,'NAND/AI Workspace/Exports'));
 check('v3-save-writes-exact-preview-in-new-visible-file',exports.length===1&&exports[0].endsWith('.maiw.jsonl')&&await fs.readFile(path.join(runtime.vault,'NAND/AI Workspace/Exports',exports[0]),'utf8')===output);
 // A host Vault.create fault models a full disk after parents are saved; the production bundle is unmodified.
 const second=path.join(process.argv[2],'second.jsonl');await fs.writeFile(second,text.replaceAll('source-','second-source-').replace('Imported research','Second import'));
 await choose(second);await until('!!'+button('Import reviewed history'));
 await c.evaluate('window.vaultCreateOriginal=app.vault.create;app.vault.create=function(file,text,...args){if(file.startsWith("NAND/AI Workspace/")&&text.includes("browser-exchange"))throw Error("fixture import write failure");return vaultCreateOriginal.call(this,file,text,...args)};true');
 try{await click(button('Import reviewed history'));await until('!!'+root+'.querySelector("[role=alert]")');check('failed-import-retains-all-transcripts-in-pending-draft',await c.evaluate('bw.snapshot().tasks.length===2&&bw.snapshot().exchanges.length===4&&bc.list().length===0'))}finally{await c.evaluate('app.vault.create=vaultCreateOriginal;true')}
 const recovery='document.querySelector(".nand-browser-recovery")';
 await click(button('Review local recovery',recovery));await until('!!'+recovery+'.querySelector("[data-recovery-id] button")');
 await click(recovery+'.querySelector("[data-recovery-id] button")');await until('!!'+button('Read recovery draft',recovery));
 await click(button('Read saved answers',recovery));
 check('interrupted-import-local-reader-keeps-valid-parents-and-saved-transcripts',await c.evaluate(recovery+'.textContent.includes("Second import")&&'+recovery+'.querySelectorAll(".nand-browser-imported-answer").length===2'));
 await click(button('Read recovery draft',recovery));
 check('recovery-reader-retains-every-imported-transcript',await c.evaluate(recovery+'.querySelectorAll(".nand-browser-imported-answer").length===6&&'+recovery+'.textContent.includes("4 saved answer entries")'));
 await runtime.shot('maiw-interrupted-import-recovery');
 await click(button('Retry saving'));await until('!'+root+'.querySelector("[role=alert]")&&!'+transfer+'.querySelector("input[type=file]").disabled');
 await choose(second);await until('!!'+button('Import reviewed history'));
 check('retry-save-completes-without-duplicate-import',await c.evaluate(transfer+'.textContent.includes("Answers: 0 new, 2 already imported")&&bw.snapshot().exchanges.length===4&&bc.list().length===0'));
 await runtime.restart();await bind();await list();
 check('restart-restores-source-identities-and-transcripts-without-guests',await c.evaluate('bw.snapshot().tasks.length===2&&bw.snapshot().turns.length===4&&bw.snapshot().exchanges.filter(e=>e.imported).length===4&&bc.list().length===0'));
 await choose(source);await until('!!'+button('Import reviewed history'));
 check('source-id-deduplication-survives-restart',await c.evaluate(transfer+'.textContent.includes("Tasks: 0 new, 1 already imported")&&'+button('Import reviewed history')+'.disabled'));
 await c.evaluate(p+'.changeLanguage("zh")');await until(transfer+'.textContent.includes("MAIW 历史迁移")');await runtime.shot('maiw-import-zh');
 check('localized-import-flow',await c.evaluate(transfer+'.textContent.includes("新增 0")&&'+transfer+'.textContent.includes("已导入 1")'));
 check('no-host-errors',errors.length===0&&(await c.evaluate('window.nandAcceptanceErrors??[]')).length===0,errors);
 await fs.writeFile(path.join(runtime.evidence,'result.json'),json({method:'Production bundle and native Obsidian UI. File control populated via CDP DOM.setFileInputFiles, fixture from actual pinned upstream export function. Copy destination observed at clipboard boundary; no OS clipboard mutation. Save failure injected at Vault.create for new answer documents. No website or account claim.',rows},null,2));
}catch(error){if(runtime){await runtime.shot('failure').catch(()=>{});await fs.writeFile(path.join(runtime.evidence,'partial.json'),json({rows,error:String(error),errors,state:await c.evaluate('({data:window.bw?.snapshot(),body:document.body.innerText,errors:window.nandAcceptanceErrors})').catch(String)},null,2))}throw error}
finally{if(runtime){console.log(json({evidence:runtime.evidence,checks:rows.length,failed:rows.filter(row=>!row.passed)}));await runtime.stop()}}
