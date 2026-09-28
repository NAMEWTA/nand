import {readFileSync} from 'node:fs';import {DEFAULT_SETTINGS} from '../../../../../../../src/plugin/settings/model';import {DashboardAutomationSource} from '../../../../../../../src/platform/obsidian/dashboard/automation';
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
const settings:any=structuredClone(DEFAULT_SETTINGS); settings.dashboardFile=process.env.PROBE_PATH||'dashboard';settings.workspaceFiles=[];settings.countdownEnabled=true;settings.anniversaryEnabled=false; settings.countdowns=[{id:'probe',label:'Countdown',targetDate:'2027-01-01',reminderDays:1}];
class DashboardView { focusWidget(id:string){observed.focused=id;return true;} } const leaf={view:new DashboardView(),loadIfDeferred:async()=>{}}; const file={path:'dashboard.md'};const app:any={vault:{getFileByPath:(p:string)=>p===file.path?file:null,read:async()=>''},workspace:{getLeavesOfType:(type:string)=>type==='nand-dashboard-view'?[leaf]:[],revealLeaf:async()=>{observed.revealed=true}}};
const source=new DashboardAutomationSource(app,()=>settings,'probe',async()=>{},()=>true);const rows=await source.list(); const ref=rows.find(d=>d.source?.kind==='widget')!.source!;
// Exact production open callback is evaluated separately from composition; only host/Vault boundary is injected.
const text=readFileSync('src/plugin/workflows/automation-host.ts','utf8');const fragment=text.slice(text.indexOf('open: async (source) => {')+6,text.indexOf(',\n\t\tcreateTask:'));
const plugin:any={switchWorkspace:async(p:string)=>observed.switched=p,openDashboard:async()=>observed.opened=true};const open=new Function('app','plugin','t','ContactsView','CONTACTS_VIEW_TYPE','dashboard','DashboardView','DASHBOARD_VIEW_TYPE','return ('+fragment+')')(app,plugin,t,class {},'nand-contacts-view',source,DashboardView,'nand-dashboard-view');
try{await open(ref)}catch(e){observed.error=String(e)}; observed.ref=ref;console.log(JSON.stringify(observed));assert.equal(observed.opened,true,'#39 default widget source must open its existing dashboard.md');assert.equal(observed.revealed,true);assert.equal(observed.focused,'widget:probe');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
