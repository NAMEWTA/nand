// Real PTY and downloader fault injection, restricted to an explicitly marked isolated Vault.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { connect } from './cdp.mjs';
import { delay, language } from './common.mjs';
assert.equal(process.env.NAND_ALLOW_BROWSER_E2E,'1');
assert.ok(process.env.NAND_WINDOWS_E2E_NONCE);
assert.ok(path.isAbsolute(process.env.NAND_ACCEPTANCE_DIR||''));
assert.ok(path.isAbsolute(process.env.NAND_ACCEPTANCE_BINARY||''));
const dir=process.env.NAND_ACCEPTANCE_DIR;
await fs.mkdir(dir,{recursive:true});
const binary=await fs.readFile(process.env.NAND_ACCEPTANCE_BINARY);
const checksum=createHash('sha256').update(binary).digest('hex');
let available=false;
const fixture=http.createServer((req,res)=>{
	if(!available){res.writeHead(404);res.end('missing fixture release');return;}
	if(req.url==='/server.sha256'){res.end(checksum+'  server\n');return;}
	res.end(binary);
});
await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${fixture.address().port}`;
const c=await connect(),checks=[],sessions=[];
const run=expression=>c.evaluate(`(()=>eval(${JSON.stringify(expression)}))()`);
async function until(expression,label,timeout=10000){const end=Date.now()+timeout;do{const result=await run(expression);if(result)return result;await delay(60)}while(Date.now()<end);throw Error('Timed out: '+label)}
const check=(name,value={})=>{checks.push({name,passed:true,...value});console.log(name,JSON.stringify(value))};
let runtime;
try{
	runtime=await run(`(async()=>({vault:app.vault.adapter.basePath,marker:JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json')),version:app.plugins.plugins.nand.manifest.version}))()`);
	assert.equal(runtime.marker.nonce,process.env.NAND_WINDOWS_E2E_NONCE);
	assert.equal(path.resolve(runtime.marker.vaultPath),path.resolve(runtime.vault));
	await run(`app.setting.close()`);
	await language(c,'en');
	await run(`(async()=>{window.repairService=await app.plugins.plugins.nand.terminalHost.getTerminalService();window.repairManager=await app.plugins.plugins.nand.terminalHost.getServerManager();await repairManager.shutdown();window.repairDownloader=repairManager.binaryDownloader;window.repairOriginalInfo=repairDownloader.getBinaryInfo;repairDownloader.getBinaryInfo=()=>({filename:'server',url:'${base}/server',checksumUrl:'${base}/server.sha256'});})()`);
	const target=await run(`repairDownloader.getBinaryPath()`);
	assert.ok(path.resolve(target).startsWith(path.resolve(runtime.vault)+path.sep));
	await fs.rm(target,{force:true});
	await fs.rm(path.join(path.dirname(target),'.rust-terminal-servers.version.json'),{force:true});
	for(let attempt=0;attempt<2;attempt++){
		const error=await run(`repairService.createTerminal().then(()=>null,e=>String(e.message))`);
		assert.match(error,/HTTP 404/);assert.doesNotMatch(error,/[\u4e00-\u9fff]/);
		await delay(180);
		const notices=await run(`[...document.querySelectorAll('.notice')].map(e=>e.textContent).filter(t=>t.includes('HTTP 404'))`);
		assert.equal(notices.length,1,'Retries replace the existing failure notice instead of stacking it');
		check('native-download-failure-retry-'+attempt,{error,notices});
	}
	// Repair in place, with no plugin reload and no version metadata. The checksum endpoint authenticates these fixture bytes.
	available=true;
	await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,binary,{mode:0o755});await fs.chmod(target,0o755);
	await run(`repairManager.ensureServer()`);
	assert.equal(await run(`repairManager.isConnected()`),true);
	await delay(180);
	assert.equal(await run(`[...document.querySelectorAll('.notice')].filter(e=>e.textContent.includes('HTTP 404')).length`),0);
	check('native-manual-repair-protocol2-without-reload',{version:runtime.version,binarySha256:checksum});
	await run(`repairDownloader.getBinaryInfo=repairOriginalInfo`);
	// Session environment assertions expose counts only, never credentials.
	async function session(agent){
		const id=await run(`(async()=>{const t=await repairService.createTerminal({shellType:'custom:/bin/bash',shellArgs:['--noprofile','--norc'],${agent?"agentId:'codex',":''}cwd:${JSON.stringify(runtime.vault)}});window.repairOutputs??={};repairOutputs[t.id]='';t.onOutput(s=>repairOutputs[t.id]+=s);return t.id})()`);sessions.push(id);
		const command = 'printf "\\nNAND_ENV_COUNT=%s\\n" "$(env | grep -c \'^NAND_BROWSER_\')"\r';
		await run(`repairService.getTerminal(${JSON.stringify(id)}).write(${JSON.stringify(command)})`);
		await until(`/NAND_ENV_COUNT=[0-9]+/.test(repairOutputs['${id}'])`,'terminal environment');
		return {id,count:await run(`Number(repairOutputs['${id}'].match(/NAND_ENV_COUNT=([0-9]+)/)[1])`)};
	}
	const plain=await session(false);assert.equal(plain.count,0);
	const agent=await session(true);assert.equal(agent.count,4);
	const after=await session(false);assert.equal(after.count,0);
	check('native-shell-agent-shell-credential-boundary',{counts:[plain.count,agent.count,after.count]});
	await run(`app.plugins.plugins.nand.terminalHost.openAutomationTerminal('${plain.id}')`);
	await until(`app.workspace.getLeavesOfType('terminal-view').some(l=>l.view.getTerminalInstance?.()?.id==='${plain.id}')`,'terminal view');
	await run(`app.commands.executeCommandById('nand:terminal-quick-switch')`);
	await until(`!!activeDocument.querySelector('.prompt-input')`,'real recent-session command');
	const candidates=await run(`activeDocument.querySelectorAll('.suggestion-item').length`);assert.ok(candidates>=3);
	await run(`activeDocument.querySelector('.suggestion-item').click()`);
	await until(`!activeDocument.querySelector('.prompt-input')`,'session selection closes');
	check('native-terminal-picker-selects-a-live-session',{candidates});
	const resources=await run(`(async()=>{const host=app.plugins.plugins.nand.browserHost;await host.environment();const bridge=host.bridge;return {directory:bridge.directory,endpoint:bridge.endpoint,attachments:bridge.writeArtifact('data:image/png;base64,aGVsbG8=','acceptance retained reference')}})()`);
	await run(`app.plugins.plugins.nand.browserHost.setEnabled(false)`);
	await assert.rejects(fs.stat(resources.directory));
	if(process.platform!=='win32')await assert.rejects(fs.stat(resources.endpoint));
	for(const item of resources.attachments)await fs.stat(item);
	await run(`app.plugins.plugins.nand.browserHost.setEnabled(true)`);
	check('native-browser-disable-cleans-run-retains-attachments');
	await fs.writeFile(path.join(dir,'terminal-repair.json'),JSON.stringify({runtime,checks},null,2));
}catch(error){await fs.writeFile(path.join(dir,'terminal-repair-partial.json'),JSON.stringify({runtime,checks,error:String(error)},null,2));throw error}
finally{
	try{await run(`(async()=>{if(window.repairDownloader&&window.repairOriginalInfo)repairDownloader.getBinaryInfo=repairOriginalInfo;for(const id of ${JSON.stringify(sessions)})await window.repairService?.destroyTerminal(id)})()`)}catch{}
	fixture.closeAllConnections();fixture.close();c.close();
}
