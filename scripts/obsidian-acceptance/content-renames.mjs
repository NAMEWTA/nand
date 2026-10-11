// Real Adapter and Markdown renderer: references survive moves, reuse and restart.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
const p='app.plugins.plugins.nand', rows=[];
let runtime,c;
const check=(name,passed,detail)=>{rows.push({name,passed:!!passed,detail});assert.ok(passed,name);};
const until=async(expression)=>{for(let attempt=0;attempt<200;attempt++){if(await c.evaluate(expression))return;await delay(100);}throw Error(expression);};
const current=`[...document.querySelectorAll('.nand-content-editor')].find(e=>e.getBoundingClientRect().width>0)`;
const open=async resource=>{await c.evaluate(`${p}.openWorkbench({feature:'content',resourceId:${JSON.stringify(resource)}},window)`);await until(`!!${current}`);};
try {
 runtime=await launchFreshVault({root:process.argv[2],port:9443,files:{
  '.nand/content/Old/Note.md':'# Note\n![image](picture.svg)\n',
  '.nand/content/Old/picture.svg':'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="red"/></svg>',
  '.nand/content/New/picture.svg':'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="blue"/></svg>',
  '.nand/content/Ref.md':'[[Old/Note#Note|Keep target]]',
  'Ordinary.md':'[Keep target](Old/Note.md#Note)',
  'Archive/Done.md':'# Personal archive',
 },settings:{version:1,namespaces:{app:{language:'zh',introSeen:true,modules:Object.fromEntries(['home','agent','browser','news','archives','automations','notifications','icons','comments','sync'].map(id=>[id,false]))}}}});c=runtime.connection;
 check('ordinary-default-archive-keeps-its-owner',await fs.readFile(path.join(runtime.vault,'Archive/Done.md'),'utf8')==='# Personal archive');
 await open('.nand/content/Old/Note.md');
 await c.evaluate(`${p}.managedContent.rename(${p}.managedContent.getFileByPath('.nand/content/Old/Note.md'),'.nand/content/New/Note.md')`);
 await until(`${current}?.value.includes('/.nand/content/Old/picture.svg')`);
 check('open-editor-follows-rename-and-preserves-old-image',true);
 await c.evaluate(`[...document.querySelectorAll('.nand-content-page button')].find(e=>e.textContent==='预览').click();true`);
 await until(`!!document.querySelector('.nand-content-body img')?.naturalWidth`);
 check('rewritten-absolute-image-renders-in-native-markdown',true);
 await c.evaluate(`${p}.managedContent.process('.nand/content/New/Note.md',text=>text+${JSON.stringify('\n![new](./picture.svg)')})`);
 check('new-relative-link-uses-the-current-directory',await c.evaluate(`${p}.managedContent.resolveLink('./picture.svg','.nand/content/New/Note.md').path==='.nand/content/New/picture.svg'`));
 await c.evaluate(`${p}.managedContent.rename(${p}.managedContent.getFileByPath('.nand/content/New/Note.md'),'.nand/content/Final/Note.md')`);
 await c.evaluate(`Promise.all([${p}.managedContent.create('.nand/content/Old/Note.md','Unrelated old path'),${p}.managedContent.create('.nand/content/New/Note.md','Unrelated intermediate path')])`);
 await until(`${p}.managedContent.getFileByPath('.nand/content/New/Note.md')!==null`);
 const reference=await fs.readFile(path.join(runtime.vault,'.nand/content/Ref.md'),'utf8');
 check('existing-incoming-links-follow-original-identity',reference==='[[/.nand/content/Final/Note.md#Note|Keep target]]');
 check('ordinary-incoming-link-preserves-the-target',await fs.readFile(path.join(runtime.vault,'Ordinary.md'),'utf8')==='[Keep target](</.nand/content/Final/Note.md#Note>)');
 await runtime.restart();c=runtime.connection;
 await open('.nand/content/Final/Note.md');
 check('restart-retains-both-image-targets',await c.evaluate(`${current}.value.includes('/.nand/content/Old/picture.svg')&&${current}.value.includes('/.nand/content/New/picture.svg')`));
 await c.evaluate(`(async()=>{const leaf=app.workspace.getLeaf('tab');await leaf.openFile(app.vault.getFileByPath('Ordinary.md'),{state:{mode:'preview'}})})()`);
 await until(`!!document.querySelector('.markdown-reading-view a[data-href=".nand/content/Final/Note.md#Note"]')`);
 await c.evaluate(`document.querySelector('.markdown-reading-view a[data-href=".nand/content/Final/Note.md#Note"]').click();true`);
 await until(`!!document.querySelector('.nand-content-body h1')`);
 check('native-reference-opens-original-after-path-reuse',await c.evaluate(`document.querySelector('.nand-content-body h1').textContent==='Note'`));
 await runtime.shot('renamed-content-links');
 check('no-runtime-errors',await c.evaluate('nandAcceptanceErrors.length')===0,await c.evaluate('nandAcceptanceErrors'));
 await fs.writeFile(path.join(runtime.evidence,'result.json'),JSON.stringify({platform:process.platform,rows},null,2));
}catch(error){if(runtime){await runtime.shot('failure');await fs.writeFile(path.join(runtime.evidence,'partial.json'),JSON.stringify({rows,error:String(error),errors:await c.evaluate('nandAcceptanceErrors'),body:await c.evaluate('document.body.innerText')},null,2));}throw error;}
finally{if(runtime){console.log(JSON.stringify({evidence:runtime.evidence,checks:rows.length,failed:rows.filter(row=>!row.passed)}));await runtime.stop();}}
