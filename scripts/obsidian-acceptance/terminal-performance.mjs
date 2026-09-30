// Real Obsidian renderer benchmark; synthetic VT output is explicit, not a CLI throughput claim.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { connect } from './cdp.mjs';

assert.equal(process.env.NAND_ALLOW_WINDOWS_E2E, '1');
assert.ok(process.env.NAND_WINDOWS_E2E_NONCE);
assert.ok(path.isAbsolute(process.env.NAND_ACCEPTANCE_DIR || ''));
const c = await connect();
const rows = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const quantile = (values, p) => [...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
const deviceScaleFactor = Number(process.env.NAND_PERF_DEVICE_SCALE_FACTOR || 1);
assert.ok(Number.isFinite(deviceScaleFactor) && deviceScaleFactor > 0 && deviceScaleFactor <= 4);
let authorized = false;
try {
	const runtime = await c.evaluate(`(async()=>{const marker=JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json'));const h=app.plugins.plugins.nand.terminalHost,s=await h.getTerminalService();return {marker,vault:app.vault.adapter.basePath,sessions:s.getAllTerminals().length,offline:h.settings.serverConnection.offlineMode,agentsDisabled:Object.values(h.settings.agentSettings.agents).every(a=>!a.enabled)}})()`);
	assert.equal(runtime.marker.kind, 'nand-windows-e2e');
	assert.equal(runtime.marker.nonce, process.env.NAND_WINDOWS_E2E_NONCE);
	assert.equal(path.resolve(runtime.marker.vaultPath).toLowerCase(), path.resolve(runtime.vault).toLowerCase());
	assert.ok(runtime.offline && runtime.agentsDisabled);
	assert.equal(runtime.sessions, 0, 'Benchmark needs an empty isolated service');
	authorized = true;
	await c.evaluate(`(()=>{const w=app.plugins.plugins.nand.terminalHost.getBrowserWindowForDomWindow(window);if(!w)throw Error('Test window unavailable');w.show();w.restore();w.focus()})()`);
	await delay(200);
	assert.equal(await c.evaluate(`document.visibilityState`), 'visible', 'Measure an actually visible Obsidian window');
	await c.send('Performance.enable');
	await c.evaluate(`window.nandPerf={owned:[],renderers:[],timer:null};true`);
	await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand;window.nandPerf.host=p.terminalHost;window.nandPerf.service=await p.terminalHost.getTerminalService();let leaf=app.workspace.getLeavesOfType('terminal-view')[0];if(!leaf){leaf=app.workspace.getLeaf('tab');await leaf.setViewState({type:'terminal-view',active:true});}await app.workspace.revealLeaf(leaf);window.nandPerf.view=leaf.view;app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse()})()`);
	await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor,mobile:false});
	for (const count of [1,10,30]) {
		await c.evaluate(`(async()=>{const f=nandPerf;while(f.owned.length<${count}){const s=await f.service.createTerminal();f.owned.push(s.id);await f.view.selectPtySession(s);f.renderers.push(await f.host.getTerminalRenderer(s));}await f.view.selectPtySession(f.service.getTerminal(f.owned[0]));})()`);
		await delay(300);
		const samples = [];
		for (let index=0;index<20;index++) {
			samples.push(await c.evaluate(`(async()=>{if(document.visibilityState!=='visible')throw Error('Test window hidden during measurement');const f=nandPerf,start=performance.now();await f.view.selectPtySession(f.service.getTerminal(f.owned[${index%count}]));await new Promise((resolve,reject)=>{const win=f.view.contentEl.win,timer=win.setTimeout(()=>reject(Error('Visible frame timed out')),2000);win.requestAnimationFrame(()=>win.requestAnimationFrame(()=>{win.clearTimeout(timer);resolve()}));});return performance.now()-start})()`));
		}
		await c.evaluate(`(()=>{const f=nandPerf;f.ticks=0;f.bytes=0;f.chunk='NAND benchmark output '.repeat(180)+'\\r\\n';f.timer=setInterval(()=>{f.ticks++;for(const id of f.owned){const s=f.service.getTerminal(id);if(s){s.paint(f.chunk);f.bytes+=f.chunk.length;}}},100);window.require('process').getCPUUsage();return true})()`);
		const before = (await c.send('Performance.getMetrics')).metrics;
		await delay(3000);
		const sample = await c.evaluate(`(async()=>{const f=nandPerf;clearInterval(f.timer);f.timer=null;const process=window.require('process');return {ticks:f.ticks,bytes:f.bytes,cpu:process.getCPUUsage(),memory:await process.getProcessMemoryInfo(),browserSubscriptions:f.owned.reduce((n,id)=>n+(f.service.getTerminal(id)?.outputs?.size||0),0),webglContexts:f.renderers.filter(r=>r.rendererType==='webgl'&&!!r.renderer).length,alive:f.owned.filter(id=>f.service.getTerminal(id)?.isAlive()).length}})()`);
		const after = (await c.send('Performance.getMetrics')).metrics;
		const value = (set,name) => set.find(m=>m.name===name)?.value || 0;
		rows.push({count,switchP50Ms:quantile(samples,.5),switchP95Ms:quantile(samples,.95),samplesMs:samples,...sample,rendererTaskSeconds:value(after,'TaskDuration')-value(before,'TaskDuration'),jsHeapBytes:value(after,'JSHeapUsedSize'),workload:'Synthetic VT injection into authoritative headless sessions at 10Hz; real browser renderers and native idle shells'});
		console.log(JSON.stringify(rows.at(-1)));
		if (process.env.NAND_PERF_EXPECT_OPTIMIZED === '1') {
			assert.equal(sample.browserSubscriptions,1,'Only the visible presentation consumes output');
			assert.ok(sample.webglContexts<=3,'At most one visible and two retained hidden WebGL contexts');
			assert.ok(quantile(samples,.95)<=150,'Warm terminal switch p95 must be <=150ms');
		}
	}
	await fs.mkdir(process.env.NAND_ACCEPTANCE_DIR,{recursive:true});
	await fs.writeFile(path.join(process.env.NAND_ACCEPTANCE_DIR, 'terminal-performance.json'),JSON.stringify({runtime,viewport:{width:1280,height:800,deviceScaleFactor},rows},null,2));
} finally {
	try {
		if (authorized) await c.evaluate(`(async()=>{const f=window.nandPerf;if(!f)return;clearInterval(f.timer);f.view.releaseTerminalInstance();for(const id of f.owned)if(f.service.getTerminal(id))await f.service.destroyTerminal(id);if(f.owned.some(id=>f.service.getTerminal(id)))throw Error('Fixture sessions remain');delete window.nandPerf;})()`);
	} finally { c.close(); }
}
