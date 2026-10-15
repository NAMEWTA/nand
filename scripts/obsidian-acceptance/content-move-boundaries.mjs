// Production Markdown renderer and clean native editor, including literal '%' identities.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
const p='app.plugins.plugins.nand', rows=[];
let runtime,c;
const check=(name,passed,detail)=>{rows.push({name,passed:!!passed,detail});assert.ok(passed,name);};
const until=async expression=>{for(let attempt=0;attempt<200;attempt++){if(await c.evaluate(expression))return;await delay(100);}throw Error(expression);};
const active="[...document.querySelectorAll('.nand-content-page')].find(e=>e.getBoundingClientRect().width>0)";
const code='    [[Old/Note]]\n\n> ```md\n> [[Old/Note]]\n> ```';
const source='[[A B|wiki space]]\n\n[[A%20B|wiki literal]]\n\n[markdown space](A%20B.md)\n\n[markdown literal](A%2520B.md)\n\n![picture](image(1).svg)';
const preview=async resource=>{
 await c.evaluate(`${p}.openWorkbench({feature:'content',resourceId:${JSON.stringify(resource)}},window)`);
 await until(`!!${active}`);
 await c.evaluate(`(()=>{const b=[...${active}.querySelectorAll('button')].find(e=>e.textContent==='预览');if(b)b.click()})()`);
};
try {
 runtime=await launchFreshVault({root:process.argv[2],port:9444,files:{
  '.nand/content/Old/Note.md':source,
  '.nand/content/Fault/Note.md':'![retained](../Old/image(1).svg)',
  '.nand/content/Old/A B.md':'# Space target',
  '.nand/content/Old/A%20B.md':'# Literal target',
  '.nand/content/Old/image(1).svg':'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"><rect width="14" height="14" fill="red"/></svg>',
  'Native.md':'[[Old/Note|native link]]\n\n'+code,
  'Archive/Done.md':'Personal archive',
 },settings:{version:1,namespaces:{app:{language:'zh',introSeen:true,modules:Object.fromEntries(['home','agent','browser','archives','automations','notifications','icons','comments','sync'].map(id=>[id,false]))}}}});c=runtime.connection;
 await c.evaluate(`(async()=>{window.nativeLeaf=app.workspace.getLeaf('tab');await nativeLeaf.openFile(app.vault.getFileByPath('Native.md'),{state:{mode:'source'}})})()`);
 await until(`window.nativeLeaf?.view.editor.getValue().includes('[[Old/Note|native link]]')`);
 await c.evaluate(`${p}.managedContent.rename(${p}.managedContent.getFileByPath('.nand/content/Old/Note.md'),'.nand/content/New/Note.md')`);
 await until(`window.nativeLeaf.view.editor.getValue().includes('[[/.nand/content/New/Note.md|native link]]')`);
 check('native-clean-editor-follows-reference-update',true);
 check('ordinary-code-examples-unchanged',(await fs.readFile(path.join(runtime.vault,'Native.md'),'utf8')).endsWith(code));
 await c.evaluate(`${p}.managedContent.prepareMetadata()`);
 const graph=await c.evaluate(`${p}.managedContent.resolvedLinks()['.nand/content/New/Note.md']`);
 check('rewritten-destinations-keep-distinct-identities',graph['.nand/content/Old/A B.md']===2&&graph['.nand/content/Old/A%20B.md']===2&&graph['.nand/content/Old/image(1).svg']===1,graph);
 await c.evaluate(`(async()=>{const adapter=app.vault.adapter,original=adapter.rename;let failed=false;adapter.rename=async function(from,to){await original.call(this,from,to);if(from==='.nand/content/Fault/Note.md'&&!failed){failed=true;throw Error('acceptance: moved before acknowledgement')}};try{await ${p}.managedContent.rename(${p}.managedContent.getFileByPath('.nand/content/Fault/Note.md'),'.nand/content/Recovered/Note.md')}catch(error){if(!String(error).includes('acceptance: moved before acknowledgement'))throw error}finally{adapter.rename=original}if(!failed)throw Error('fault was not injected')})()`);
 check('real-adapter-recovers-after-moving-a-document-with-outgoing-links',(await fs.readFile(path.join(runtime.vault,'.nand/content/Recovered/Note.md'),'utf8')).includes('/.nand/content/Old/image(1).svg'));
 await c.evaluate(`${p}.settingsNamespace('home').update(draft=>{draft.dashboardFile='.nand/content/Old/Note';draft.workspaceFiles=['.nand/content/Old/Note'];draft.workspaceNames=['Recovered board']},{persist:'immediate'})`);
 await runtime.restart();c=runtime.connection;
 check('ordinary-archive-stays-after-settings-save-and-restart',await fs.readFile(path.join(runtime.vault,'Archive/Done.md'),'utf8')==='Personal archive');
 await c.evaluate(`${p}.setModuleEnabled('home',true)`);
 check('home-activation-recovers-a-board-that-missed-the-rename-event',await c.evaluate(`${p}.settingsNamespace('home').get().dashboardFile==='.nand/content/New/Note'`));
 await c.evaluate(`${p}.setModuleEnabled('home',false)`);
 for(const [label,title] of [['wiki space','Space target'],['wiki literal','Literal target'],['markdown space','Space target'],['markdown literal','Literal target']]){
  await preview('.nand/content/New/Note.md');
  await until(`!![...${active}.querySelectorAll('a.internal-link')].find(e=>e.textContent===${JSON.stringify(label)})`);
  const links=await c.evaluate(`[...${active}.querySelectorAll('a.internal-link')].map(e=>({text:e.textContent,href:e.getAttribute('href'),data:e.dataset.href}))`);
  await c.evaluate(`[...${active}.querySelectorAll('a.internal-link')].find(e=>e.textContent===${JSON.stringify(label)}).click();true`);
  await until(`${active}?.querySelector('.nand-content-editor')?.value===${JSON.stringify('# '+title)}||${active}?.querySelector('.nand-content-body h1')?.textContent===${JSON.stringify(title)}`);
  await c.evaluate(`(()=>{const b=[...${active}.querySelectorAll('button')].find(e=>e.textContent==='预览');if(b)b.click()})()`);
  await until(`${active}?.querySelector('.nand-content-body h1')?.textContent===${JSON.stringify(title)}`);
  check('native-click-'+label,true,links);
 }
 await preview('.nand/content/New/Note.md');
 await until(`${active}?.querySelector('img')?.naturalWidth===14`);
 check('balanced-parenthesis-image-renders',true);await runtime.shot('markdown-identities');
 check('no-runtime-errors',await c.evaluate('nandAcceptanceErrors.length')===0,await c.evaluate('nandAcceptanceErrors'));
 await fs.writeFile(path.join(runtime.evidence,'result.json'),JSON.stringify({platform:process.platform,rows},null,2));
}catch(error){if(runtime){await runtime.shot('failure');await fs.writeFile(path.join(runtime.evidence,'partial.json'),JSON.stringify({rows,error:String(error),errors:await c.evaluate('nandAcceptanceErrors'),body:await c.evaluate('document.body.innerText')},null,2));}throw error;}
finally{if(runtime){console.log(JSON.stringify({evidence:runtime.evidence,checks:rows.length,failed:rows.filter(row=>!row.passed)}));await runtime.stop();}}
