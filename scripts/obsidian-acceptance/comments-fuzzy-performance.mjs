// Regression for rev-p7 R2; original host timing scenario by rev-p7.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {launchFreshVault} from './fresh-vault.mjs';
const compiled=await fs.mkdtemp(path.join(tmpdir(),'nand-comment-performance-'));
for(const name of ['anchor','store'])await build({entryPoints:[`src/modules/comments/core/${name}.ts`],bundle:true,platform:'node',format:'esm',outfile:path.join(compiled,`${name}.mjs`)});
const {createAnchor}=await import(pathToFileURL(path.join(compiled,'anchor.mjs')));
const {CommentStore}=await import(pathToFileURL(path.join(compiled,'store.mjs')));
const quote=('A reviewer checks the selected paragraph and preserves its exact location when nearby notes are edited. ').repeat(10).slice(0,500);
const edited=[...quote].map((c,i)=>i%5===2?'X':c).join('');
const filler='This unrelated note describes the build process, pending release work and the status of integration tests.\n';
const source=filler.repeat(50)+edited+'\n'+filler.repeat(50);
const anchor=createAnchor(quote,0,quote.length);anchor.lineHint=51;
const files={'Note.md':source};
const store=new CommentStore({read:async p=>files[p],write:async(p,v)=>{files[p]=v},exists:async p=>p in files,remove:async p=>{delete files[p]}},{timers:{set:()=>0,clear:()=>{}}});
await store.add('Note.md',{anchor,text:'500-character paragraph modified externally'});await store.close();
const runtime=await launchFreshVault({root:process.argv[2],port:9701,files,settings:{version:1,namespaces:{app:{language:'en',introSeen:true,modules:{home:false,comments:true,agent:false,browser:false,archives:false,automations:false,notifications:false,icons:false,sync:false}}}}});
const c=runtime.connection;const until=async expression=>{for(let i=0;i<180;i++){if(await c.evaluate(expression))return;await delay(50)}throw Error('timeout '+expression)};
try{
 await until(`app.plugins.plugins.nand.moduleState('comments')==='active'`);
 await c.evaluate(`window.gaps=[];window.lastTick=performance.now();window.ticker=setInterval(()=>{const n=performance.now();gaps.push(n-lastTick);lastTick=n},20);true`);await delay(300);
 const began=Date.now();await c.evaluate(`window.a=app.workspace.getLeaf(false);a.openFile(app.vault.getFileByPath('Note.md'))`);
 await c.evaluate(`a.view.editor.setCursor({line:50,ch:0});a.view.editor.scrollIntoView({from:{line:50,ch:0},to:{line:50,ch:500}},true);true`);
 await until(`!!a.view.containerEl.querySelector('.nand-comment-hl')`);await delay(1000);
 const metrics=await c.evaluate(`clearInterval(ticker);({maxGapMs:Math.max(...gaps),gapsAbove100:gaps.filter(g=>g>100),gapsCount:gaps.length,marks:[...a.view.containerEl.querySelectorAll('.nand-comment-hl')].map(e=>e.textContent),errors:nandAcceptanceErrors})`);
 const index=JSON.parse(await fs.readFile(path.join(runtime.vault,'.nand/editor/comments/index.json'),'utf8'));
 const thread=JSON.parse(await fs.readFile(path.join(runtime.vault,'.nand/editor/comments/files',index.files['Note.md'].hash+'.json'),'utf8')).threads[0];
 const result={docLength:source.length,quoteLength:quote.length,lines:source.split('\n').length,elapsedMs:Date.now()-began,...metrics,anchor:thread.anchor,status:thread.status};
 await fs.writeFile(path.join(runtime.evidence,'result.json'),JSON.stringify(result,null,2));await runtime.shot('fuzzy-performance');console.log(JSON.stringify(result,null,2));
 assert.deepEqual({text:thread.anchor.text,start:thread.anchor.start,end:thread.anchor.end,status:thread.status},{text:edited,start:filler.length*50,end:filler.length*50+edited.length,status:'open'});
 assert.deepEqual(metrics.errors,[]);assert.ok(metrics.maxGapMs<200,`Longest host interval: ${metrics.maxGapMs} ms`);
}finally{await runtime.stop();await fs.rm(compiled,{recursive:true,force:true})}
