import {NativeHistory} from '../../../../../../src/platform/obsidian/ai-vault/service';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseHTML } from 'linkedom';
import { h, render } from 'preact';
import { setLanguage, t } from '../../../../../../src/shared/i18n/index';
import { Notice, Setting, Modal } from 'obsidian';
const {document,window}=parseHTML('<html><body></body></html>');
Object.assign(globalThis,{document,window});
window.require=createRequire(process.cwd()+'/package.json');
const delay=(ms=100)=>new Promise(r=>setTimeout(r,ms));
const hostEl=()=>{const el=document.createElement('div');document.body.append(el);return el};
const observed:any={};
async function main(){
const files=new Map<string,string>();const adapter:any={exists:async(p:string)=>files.has(p),read:async(p:string)=>files.get(p),write:async(p:string,s:string)=>files.set(p,s),mkdir:async(p:string)=>files.set(p,'')};
const history:any=new NativeHistory({loadLocalStorage:()=> 'probe',vault:{adapter}} as any,{} as any,()=>({}) as any,'');history.read=async(s:any)=>({...s,text:'synthetic transcript'});
const path=await history.export({key:'test',agentId:'codex',sessionId:'test',title:'Test'} as any);observed.path=path;observed.content=files.get(path);console.log(JSON.stringify(observed));assert.ok(!path.split('/').some((s:string)=>s.startsWith('.')),'#40 exported note must have an Obsidian-visible path');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
