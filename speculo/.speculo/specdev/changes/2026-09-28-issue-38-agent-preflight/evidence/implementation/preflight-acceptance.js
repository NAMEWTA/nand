(async()=>{const p=app.plugins.plugins.nand,h=p.terminalHost,r=h.getAutomationRuntime();const output=[];
for(const language of ['en','zh']){
 p.settings.language=language;await p.saveSettings();await p.loadSettings();
 const settings=h.settings.agentSettings;settings.globalPermissionMode='yolo';settings.yoloAcknowledged=false;
 const action={kind:'agent',agentId:'pi',cwd:'/tmp/nand-obsidian-e2e/vault/missing',prompt:'synthetic preflight only',sessionMode:'fresh'};
 const reject=async expected=>{try{await r.start(action,{id:'synthetic-e2e',trigger:'scheduled',title:'Synthetic'});throw Error('Unexpected launch')}catch(e){if(e.code!==expected)throw e;output.push({language,expected,actual:e.code,message:e.message});}};
 settings.agents.pi.enabled=false;await reject('agentDisabled');settings.agents.pi.enabled=true;settings.agents.pi.cliPath='/tmp/nand-obsidian-e2e/missing-cli';await reject('cliMissing');
 action.agentId='codex';settings.agents.codex.enabled=true;settings.agents.codex.cliPath='/tmp/nand-obsidian-e2e/synthetic-cli';await reject('cwdInvalid');
 action.cwd='/tmp';await reject('cwdInvalid');action.cwd='/tmp/nand-obsidian-e2e/vault';await reject('permissionRequired');
 settings.yoloAcknowledged=true;action.sessionMode='specific';await reject('sessionMissing');
 settings.agents.pi.enabled=false;settings.yoloAcknowledged=false;
}
await h.saveSettings();if(r.live.size!==0)throw Error('Rejected preflight retained a live slot');return {output,liveSlots:r.live.size};})()
