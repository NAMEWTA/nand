import {connect} from './cdp.mjs';import fs from 'node:fs/promises';
const c=await connect();const dir='/srv/nand/speculo/.speculo/specdev/changes/2026-09-28-issue-38-agent-preflight/evidence/implementation';
try{
 for(const language of ['zh','en']){
  await c.evaluate(`(async()=>{for(const b of document.querySelectorAll('.modal button'))if(['取消','Cancel'].includes(b.textContent))b.click();await new Promise(r=>setTimeout(r,350));const p=app.plugins.plugins.nand;p.settings.language='${language}';await p.saveSettings();await p.loadSettings();p.terminalHost.settings.agentSettings.agents.codex.enabled=false;const d=p.automationHost.service.definitions.find(d=>d.name.startsWith('synthetic-preserved'));p.automationHost.edit(undefined,undefined,d);await new Promise(r=>setTimeout(r,200));return true})()`);
  const shot=await c.send('Page.captureScreenshot',{format:'png'});await fs.writeFile(`${dir}/obsidian-stale-${language}.png`,Buffer.from(shot.data,'base64'));
 }
 await c.evaluate(`(async()=>{for(const b of document.querySelectorAll('.modal button'))if(['取消','Cancel'].includes(b.textContent))b.click();const p=app.plugins.plugins.nand;p.settings.language='zh';await p.saveSettings();await p.loadSettings();p.terminalHost.settings.agentSettings.agents.codex.enabled=true;await p.terminalHost.saveSettings();return true})()`);
}finally{c.close();}
