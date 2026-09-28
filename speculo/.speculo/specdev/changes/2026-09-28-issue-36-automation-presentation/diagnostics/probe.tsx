import {AutomationsPanel} from '../../../../../../src/view/automations/AutomationsPanel';
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
setLanguage('zh');const d:any={id:'once',name:'Finished reminder',enabled:true,deviceId:'probe',revision:1,schedule:{kind:'once',at:1000},action:{kind:'notify',body:'body'},channels:['in-app'],notifyOn:'always',graceMinutes:720,createdAt:0,updatedAt:0};
const service:any={definitions:[d],state:{runs:[],cursors:{'once:1':1000}},deviceId:'probe',agent:()=>undefined};const el=hostEl();render(h(AutomationsPanel,{host:{service} as any,state:{selected:'once',search:'',filter:'',agentFilter:''},refresh(){},actions:{} as any}),el);observed.text=el.querySelector('.nand-automation-list')!.textContent;console.log(JSON.stringify(observed));assert.ok(!observed.text.includes(t('automation.pending')),'#36 consumed once reminder after history clear must not display pending');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
