import {AutomationEditor} from '../../../../../../src/view/automations/editor';
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
const saved:any[]=[]; const agents=[{id:'claude-code',title:'Claude Code',enabled:true,installed:false}];
const service:any={deviceId:'probe',agent:()=>({listAgents:()=>agents}),save:async(d:any)=>saved.push(structuredClone(d)),tick:async()=>{}};
const e:any=new AutomationEditor({} as any,service,async()=>[],'/synthetic-vault'); e.draft.name='probe';e.draft.action.prompt='probe';
await e.save(); observed.saved=saved; observed.available=agents.filter(a=>a.enabled&&a.installed).length;console.log(JSON.stringify(observed));assert.equal(saved.length,0,'#38 empty available-agent list must not save invisible claude-code');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
