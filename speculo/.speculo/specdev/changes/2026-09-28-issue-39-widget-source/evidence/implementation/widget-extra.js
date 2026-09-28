(async()=>{
const p=app.plugins.plugins.nand, delay=ms=>new Promise(r=>setTimeout(r,ms)), result=[];
// Keep a stale automation selection visible while the underlying widget is removed.
await p.automationHost.open();await delay(100);const row=[...document.querySelectorAll('.nand-automation-list button')].find(e=>e.textContent.startsWith('Countdown 100'));row.click();await delay(60);
const saved=p.settings.countdowns;p.settings.countdowns=saved.filter(e=>e.id!=='count-100');document.querySelector('.nand-automation-detail button').click();await delay(100);
const notice=[...document.querySelectorAll('.notice')].at(-1)?.textContent;if(notice!=='此小组件不可用，可能已被删除或关闭')throw Error('Wrong missing-widget error: '+notice);result.push({case:'automation stale widget',notice});p.settings.countdowns=saved;
const before=JSON.stringify(p.settings.countdowns.map(e=>e.automation));
// A real file deletion must not recreate a missing dashboard.
const removed=await app.vault.create('Boards/Removed.md','# Temporary source');p.settings.workspaceFiles.push('Boards/Removed');await app.vault.delete(removed);let error;try{await p.automationHost.service.sources.open({kind:'widget',path:'Boards/Removed',id:'widget:count-100'});}catch(e){error=e.message;}if(app.vault.getFileByPath('Boards/Removed.md')||error!=='来源看板已被删除或移出工作区')throw Error('Deleted file recreated or wrong message');p.settings.workspaceFiles=p.settings.workspaceFiles.filter(f=>f!=='Boards/Removed');result.push({case:'deleted file stays deleted',error});
// Existing task-source routing still opens the exact path.
await p.automationHost.service.sources.open({kind:'dashboard',path:'dashboard.md',id:'task-regression'});result.push({case:'task source',dashboard:p.settings.dashboardFile});
// Existing run notification still opens automation history from the inbox.
p.automationHost.inbox();await delay(100);const record=[...document.querySelectorAll('.modal .setting-item')].find(e=>e.querySelector('.setting-item-name')?.textContent.includes('synthetic-preserved-zh-0'));record.querySelector('button').click();await delay(700);if(app.workspace.activeLeaf.view.getViewType()!=='nand-automation-view'||document.querySelectorAll('.modal-container').length)throw Error('Run target failed');result.push({case:'run notification',view:app.workspace.activeLeaf.view.getViewType()});
if(JSON.stringify(p.settings.countdowns.map(e=>e.automation))!==before)throw Error('Reminder metadata changed');await p.saveSettings();
const path='.nand/notifications/'+app.loadLocalStorage('nand.automation.device')+'.json';const inbox=JSON.parse(await app.vault.adapter.read(path));for(const id of ['deletedWidget','deletedFile','disabled'])if(inbox.records.find(r=>r.id==='widget-test-'+id).read)throw Error('Failed source incorrectly marked read');
return {result,widgetMetadata:p.settings.countdowns.map(e=>e.automation),notificationBodies:inbox.records.filter(r=>r.id.startsWith('widget-test')).map(r=>[r.id,r.body,r.read]),definitions:p.automationHost.service.definitions.filter(d=>d.source?.kind==='widget').length};
})()
