// Resume the combined consumer journey from a controlled multisite probe's saved Markdown.
// Input is an explicitly named disposable fixture vault; no cookies or runtime credentials are copied.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { exerciseWorkspaceDelivery } from './workspace-delivery.mjs';

const files={},source=path.resolve(process.argv[3],'NAND/AI Workspace');
for(const entry of await fs.readdir(source,{recursive:true,withFileTypes:true})){
 if(!entry.isFile()||!entry.name.endsWith('.md'))continue;
 const absolute=path.join(entry.parentPath,entry.name),relative=path.relative(source,absolute).replaceAll('\\','/');
 if(['Exports/','综合/','流程/','助手/'].some(prefix=>relative.startsWith(prefix)))continue;
 files['NAND/AI Workspace/'+relative]=await fs.readFile(absolute,'utf8');
}
assert.ok(Object.keys(files).some(name=>name.endsWith('/任务.md')),'Requires saved controlled task history');
const p='app.plugins.plugins.nand',json=JSON.stringify,rows=[],errors=[];
const root='[...document.querySelectorAll(".nand-browser-workspace")].find(e=>e.getBoundingClientRect().width>0)';
const button=(label,scope=root)=>'[...'+scope+'.querySelectorAll("button")].find(e=>e.textContent==='+json(label)+')';
let runtime,c;
const check=(name,passed,detail)=>{rows.push({name,passed,detail});assert.ok(passed,name)};
const until=async expression=>{const end=Date.now()+30000;while(Date.now()<end){try{if(await c.evaluate(expression))return}catch{}await delay(100)}throw Error(expression)};
const click=async expression=>{await c.send('Page.bringToFront');let point;
 for(let i=0;i<12&&!point;i++){await c.evaluate('window.focus();'+expression+'?.scrollIntoView({block:"center"});true');await delay(150);point=await c.evaluate('(()=>{const e='+expression+';if(!e)return null;const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))?{x:r.x+r.width/2,y:r.y+r.height/2}:null})()');}
 assert.ok(point,'Visible control '+expression);for(const type of ['mousePressed','mouseReleased'])await c.send('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1});};
const type=async(expression,text)=>{await click(expression);for(const type of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await c.send('Input.insertText',{text})};
try{
 runtime=await launchFreshVault({root:process.argv[2],port:9276,files,settings:{version:1,namespaces:{app:{language:'en',introSeen:true,modules:{browser:true,home:false,agent:false,news:false,archives:false,sync:false,comments:false,notifications:false,automations:false,icons:false}}}}});c=runtime.connection;
 await c.send('Runtime.enable');c.on('Runtime.exceptionThrown',e=>errors.push(e.exceptionDetails));
 await c.evaluate('window.bw='+p+'.services.peek({owner:"browser",id:"workspace"});window.bc='+p+'.services.peek({owner:"browser",id:"control"});bw.initialize()');
 const taskId=await c.evaluate('bw.snapshot().tasks[0].id');await c.evaluate(p+'.openWorkbench({feature:"browser",section:"multi-ai",resourceId:'+json(taskId)+'},window)');await until('!!'+root);
 c=await exerciseWorkspaceDelivery({c,p,root,click,type,until,button,check,runtime,taskId});check('no-host-exceptions',errors.length===0,errors);
 await fs.writeFile(path.join(runtime.evidence,'delivery.json'),json({source,rows,errors,bytes:{main:(await fs.stat('main.js')).size,styles:(await fs.stat('styles.css')).size}},null,2));
 console.log(json({passed:rows.length,evidence:runtime.evidence}));
}catch(error){if(runtime){c=runtime.connection;await runtime.shot('delivery-failure').catch(()=>{});await fs.writeFile(path.join(runtime.evidence,'delivery-failure.json'),json({rows,errors,error:String(error),body:await c.evaluate('document.body.innerText').catch(()=>''),assistant:await c.evaluate('window.deliveryAssistant?.snapshot()').catch(()=>null)},null,2))}throw error}
finally{await runtime?.stop()}
