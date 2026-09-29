(async()=>{
await app.plugins.disablePlugin('nand');await app.plugins.enablePlugin('nand');
const p=app.plugins.plugins.nand;
app.setting.close();window.focus();
if(!app.vault.getFileByPath('dashboard.md')) await app.vault.create('dashboard.md','# Test dashboard\n');
if(!app.vault.getAbstractFileByPath('Boards'))await app.vault.createFolder('Boards');
if(!app.vault.getFileByPath('Boards/Nested.md'))await app.vault.create('Boards/Nested.md','# Nested dashboard\n');
p.settings.modules.dashboard=true;p.settings.workspaceFiles=['dashboard','Boards/Nested'];p.settings.workspaceNames=['Default board','Nested board'];p.settings.dashboardFile='dashboard';
p.settings.countdownEnabled=true;p.settings.anniversaryEnabled=true;
p.settings.countdowns=Array.from({length:101},(_,i)=>({id:'count-'+i,label:'Countdown '+i,targetDate:'2027-01-01',displayMode:'days',reminderDays:1}));
p.settings.anniversaries=[{id:'ann-target',label:'Anniversary target',startDate:'2020-01-01',precision:'days',annualReminder:true}];
await p.saveSettings();await p.loadSettings();await p.automationHost.service.refresh();await p.automationHost.open();
return {definitions:p.automationHost.service.definitions.filter(d=>d.source?.kind==='widget').length,body:document.body.innerText.slice(-1500)};
})()
