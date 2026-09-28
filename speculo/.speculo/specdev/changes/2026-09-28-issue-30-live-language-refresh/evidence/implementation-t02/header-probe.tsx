import {AutomationView} from '../../../../../../../src/view/automations/view';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseHTML } from 'linkedom';
import { h, render } from 'preact';
import { setLanguage, t } from '../../../../../../../src/shared/i18n/index';
import { Notice, Setting, Modal } from 'obsidian';
const {document,window}=parseHTML('<html><body></body></html>');
Object.assign(globalThis,{document,window});
window.require=createRequire(process.cwd()+'/package.json');
const delay=(ms=100)=>new Promise(r=>setTimeout(r,ms));
const hostEl=()=>{const el=document.createElement('div');document.body.append(el);return el};
const observed:any={};
async function main(){
setLanguage('zh');let headers=0,draws=0;const root={};let windowTitles=0;const view:any=new AutomationView({updateHeader(){headers++},getContainer:()=>root} as any,{service:{subscribe:()=>()=>{}}} as any);view.app={workspace:{rootSplit:root,updateTitle(){windowTitles++}}};view.contentEl=Object.assign(hostEl(),{addClass(){},onWindowMigrated:()=>()=>{}});view.draw=()=>draws++;await view.onOpen();const before=view.getDisplayText();setLanguage('en');observed.before=before;observed.current=view.getDisplayText();observed.draws=draws;observed.headerUpdates=headers;observed.windowUpdates=windowTitles;console.log(JSON.stringify(observed));assert.ok(headers>0,'#30 language event must refresh existing native leaf header as well as content');assert.equal(windowTitles,1);
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
