import {HistorySidebar} from '../../../../../../src/view/terminal/workbench';
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
setLanguage('zh'); const session:any={key:'one',agentId:'codex',title:'Synthetic',modifiedAtMs:1790550000000,usage:{known:false},accountKey:'{}'};
const history:any={scan:async()=>[],query:async()=>({rows:[session],total:111}),meta:()=>({}),read:async()=>({...session,text:'sample'})};const el=hostEl();render(h(HistorySidebar,{history,host:{app:{}} as any}),el);await delay(250);observed.pagination=el.querySelector('.nand-history-pagination')?.textContent;observed.date=el.querySelector('.nand-history-row small')?.textContent;console.log(JSON.stringify(observed));render(null,el);assert.ok(!observed.pagination?.includes('1 / 111'),'#41 pagination must distinguish item range from page count');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
