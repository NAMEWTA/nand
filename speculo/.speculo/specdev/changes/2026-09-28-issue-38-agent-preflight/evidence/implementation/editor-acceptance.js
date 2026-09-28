(async()=>{
 const p=app.plugins.plugins.nand, h=p.terminalHost, s=p.automationHost.service;
 const assert=(value,message)=>{if(!value)throw Error(message)};
 const wait=()=>new Promise(r=>setTimeout(r,120));
 const close=async()=>{for(const b of document.querySelectorAll('.modal button'))if(['取消','Cancel'].includes(b.textContent))b.click();await new Promise(r=>setTimeout(r,350));};
 const agentSelect=modal=>[...modal.querySelectorAll('.setting-item')].find(row=>['运行智能体','Run agent'].includes(row.querySelector('.setting-item-name')?.textContent))?.querySelector('select');
 const set=(input,value)=>{input.value=value;input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));};
 const output=[];
 for(const language of ['zh','en','zh']){
  await close();p.settings.language=language;await p.saveSettings();await p.loadSettings();
  for(const a of Object.values(h.settings.agentSettings.agents))a.enabled=false;
  p.automationHost.edit();await wait();let modal=document.querySelector('.modal');
  const before=s.definitions.length;
  set(modal.querySelector('input'),'synthetic-empty-'+language);set(modal.querySelector('textarea'),'preserve this prompt');
  [...modal.querySelectorAll('button')].find(b=>['保存','Save'].includes(b.textContent))?.click();await wait();
  assert(s.definitions.length===before,'Empty available set saved');assert(document.querySelector('.modal'),'Rejected draft closed');
  output.push({language,emptyNotice:[...document.querySelectorAll('.notice')].map(n=>n.textContent),emptyOptions:agentSelect(modal).value});
  await close();h.settings.agentSettings.agents.codex.enabled=true;h.settings.agentSettings.agents.codex.cliPath='/tmp/nand-obsidian-e2e/synthetic-cli';await h.saveSettings();
  p.automationHost.edit();await wait();modal=document.querySelector('.modal');
  const select=agentSelect(modal);assert(select.value==='codex','Actual select and draft default disagree');
  const title='synthetic-preserved-'+language+'-'+before;
  set(modal.querySelector('input'),title);set(modal.querySelector('textarea'),'User prompt preserved 中文');
  [...modal.querySelectorAll('button')].find(b=>['保存','Save'].includes(b.textContent))?.click();await wait();
  const saved=s.definitions.find(d=>d.name===title);assert(saved?.action.agentId==='codex','Selected agent did not persist');assert(saved.action.prompt==='User prompt preserved 中文','Prompt altered');
  h.settings.agentSettings.agents.codex.enabled=false;
  p.automationHost.edit(undefined,undefined,saved);await wait();modal=document.querySelector('.modal');
  assert(agentSelect(modal).value==='codex','Stale agent silently replaced');
  assert(modal.textContent.includes(language==='en'?'selected agent is unavailable':'所选智能体不可用'),'Stale selection is not explained');
  [...modal.querySelectorAll('button')].find(b=>['保存','Save'].includes(b.textContent))?.click();await wait();
  assert(document.querySelector('.modal'),'Invalid edit closed');await close();
  h.settings.agentSettings.agents.codex.enabled=true;h.settings.agentSettings.yoloAcknowledged=false;
  const run=await s.run(saved);assert(run.errorCode==='permissionRequired','Runtime did not persist permission failure');
  output.push({language,title,agent:saved.action.agentId,prompt:saved.action.prompt,runCode:run.errorCode,status:run.status});
 }
 await h.saveSettings();return {obsidian:'1.13.7',vault:app.vault.adapter.getBasePath(),output,persisted:s.definitions.filter(d=>d.name.startsWith('synthetic-preserved')).length};
})()
