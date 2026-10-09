import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SyncEngine } from '../../src/modules/home/platform/board/sync.ts';
import { DashboardSaveError } from '../../src/modules/home/core/board/save-state.ts';
import { observeDashboardPromise, guardDashboardCallbacks } from '../../src/modules/home/ui/save-feedback.ts';
import { generateDefaultMarkdown } from '../../src/modules/home/core/board/parser/default-document.ts';
import { parse, serialize } from '../../src/modules/home/core/board/parser/index.ts';
import { setLanguage } from '../../src/shared/i18n/index.ts';
import { TFile, Notice } from '../obsidian-stub.ts';
globalThis.window=globalThis;
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function fixture(name='Board'){
 let disk=generateDefaultMarkdown();const copies=new Map(), handlers=new Map();let beforeWrite=async()=>{};
 const file=Object.assign(new TFile(),{path:name+'.md',basename:name,extension:'md'});
 const app={vault:{getFileByPath:p=>p===file.path?file:null,read:async()=>disk,process:async(f,fn)=>{disk=fn(disk);for(const cb of handlers.get('modify')??[])cb(f);return disk;},on:(name,cb)=>{handlers.set(name,[...(handlers.get(name)??[]),cb]);return {name,cb};},offref:ref=>handlers.set(ref.name,(handlers.get(ref.name)??[]).filter(cb=>cb!==ref.cb)),adapter:{exists:async()=>true,mkdir:async()=>{},list:async()=>({files:[...copies.keys()]}),remove:async p=>copies.delete(p),write:async(p,text)=>{await beforeWrite(p,text);copies.set(p,text);}}}};
 const engine=new SyncEngine(app,{dashboardFile:file.path});await engine.init();
 return {engine,copies,app,get disk(){return disk;},set disk(text){disk=text;},set beforeWrite(fn){beforeWrite=fn;},recovery(){return JSON.parse([...copies].find(([p])=>p.includes('/conflicts/'))[1]);}};
}
async function conflict(f){f.disk+='\n<!-- external edit -->\n';await assert.rejects(f.engine.updateBanner({quote:'local'}));}
test('queued A/B/C revisions after a first conflict retain C and external bytes',async()=>{
 const f=await fixture(),entered=deferred(),release=deferred();let held=false;
 f.beforeWrite=async p=>{if(!held&&!p.includes('/conflicts/')){held=true;entered.resolve();await release.promise;}};
 const a=assert.rejects(f.engine.updateBanner({quote:'A'}));await entered.promise;
 const b=assert.rejects(f.engine.updateBanner({quote:'B'})),c=assert.rejects(f.engine.updateBanner({quote:'C'}));f.disk+='\n<!-- outside -->';const outside=f.disk;release.resolve();await Promise.all([a,b,c]);
 assert.equal(f.disk,outside);assert.equal(parse(f.recovery().local).banner.quote,'C');assert.equal(f.recovery().revision,f.engine.getSaveState().localRevision);assert.equal(f.engine.getSaveState().status,'conflict-saved');await f.engine.close();
});
test('an older recovery completion cannot mark a newer edit saved',async()=>{
 const f=await fixture();await conflict(f);const first=deferred(),release=deferred(),second=deferred(),releaseSecond=deferred();let index=0;
 f.beforeWrite=async p=>{if(p.includes('/conflicts/')){index++;if(index===1){first.resolve();await release.promise;}if(index===2){second.resolve();await releaseSecond.promise;}}};
 const a=assert.rejects(f.engine.updateBanner({quote:'older'}));await first.promise;const b=assert.rejects(f.engine.updateBanner({quote:'latest'}));release.resolve();await second.promise;
 assert.equal(f.engine.getSaveState().status,'conflict-pending');assert.ok(f.engine.getSaveState().recoveryRevision<f.engine.getSaveState().localRevision);
 releaseSecond.resolve();await Promise.all([a,b]);assert.equal(parse(f.recovery().local).banner.quote,'latest');await f.engine.close();
});
test('recovery failure remains explicit; retry persists the latest snapshot',async()=>{
 const f=await fixture();await conflict(f);f.beforeWrite=async p=>{if(p.includes('/conflicts/'))throw Error('recovery disk unavailable');};
 await assert.rejects(f.engine.updateBanner({quote:'latest failed'}));assert.equal(f.engine.getSaveState().status,'recovery-error');assert.notEqual(parse(f.recovery().local).banner.quote,'latest failed');
 await assert.rejects(f.engine.reloadFromDisk());assert.equal(f.engine.getData().banner.quote,'latest failed');
 f.beforeWrite=async()=>{};await f.engine.retrySave();assert.equal(parse(f.recovery().local).banner.quote,'latest failed');assert.equal(f.engine.getSaveState().status,'conflict-saved');await f.engine.close();
});
test('normal close drains a quiet change into recovery and separate boards never share copies',async()=>{
 const a=await fixture('A'),b=await fixture('B');await conflict(a);await conflict(b);
 a.engine.toggleCollapseTaskQuiet('demo-todo-1',[0]);await a.engine.close();
 assert.equal(parse(a.recovery().local).columns[1].cards[0].tasks[0].collapsed,true);assert.notEqual(a.recovery().id,b.recovery().id);await b.engine.close();
});
test('reload refuses to discard a newer revision admitted during recovery IO',async()=>{
 const f=await fixture();await conflict(f);const entered=deferred(),release=deferred();let held=false;
 f.beforeWrite=async p=>{if(p.includes('/conflicts/')&&!held){held=true;entered.resolve();await release.promise;}};
 const reload=assert.rejects(f.engine.reloadFromDisk(),e=>e instanceof DashboardSaveError&&e.code==='changed');await entered.promise;
 const edit=assert.rejects(f.engine.updateBanner({quote:'keep during reload'}));release.resolve();await Promise.all([reload,edit]);assert.equal(f.engine.getData().banner.quote,'keep during reload');assert.equal(parse(f.recovery().local).banner.quote,'keep during reload');await f.engine.close();
});
test('observed UI promises still reject to awaiting callers but ignored events do not leak',async()=>{
 const failures=[];const listener=e=>failures.push(e);process.on('unhandledRejection',listener);
 try{const error=new DashboardSaveError('conflict','handled by save state');const promise=Promise.reject(error);assert.equal(observeDashboardPromise(promise),promise);await assert.rejects(promise,e=>e===error);
 const callbacks=guardDashboardCallbacks({onToggle:async()=>{throw error;},settings:{id:1}});callbacks.onToggle();await new Promise(r=>setImmediate(r));assert.deepEqual(failures,[]);assert.deepEqual(callbacks.settings,{id:1});}finally{process.off('unhandledRejection',listener);}
});
test('both languages show actual recovery path and no obsolete directory',async()=>{
 const f=await fixture();await conflict(f);for(const language of ['zh','en','zh']){setLanguage(language);const message=Notice.messages.at(-1);assert.ok(message.includes(f.engine.getSaveState().recoveryPath));assert.ok(!message.includes('.dashboard-backup'));}await f.engine.close();
});
