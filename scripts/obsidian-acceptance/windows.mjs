// Real Obsidian + Windows native PTY acceptance. Never run against a daily vault.
// Requires explicit opt-in and an exact marker in the actual CDP-connected vault:
// NAND_ALLOW_WINDOWS_E2E=1, NAND_WINDOWS_E2E_NONCE=<marker nonce>,
// NAND_ACCEPTANCE_DIR=<absolute evidence directory>.
// Marker: .nand-e2e-isolated.json, {kind:"nand-windows-e2e",nonce,vaultPath}.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { connect } from './cdp.mjs';

assert.equal(process.env.NAND_ALLOW_WINDOWS_E2E, '1', 'Explicit Windows E2E opt-in required');
assert.ok(process.env.NAND_WINDOWS_E2E_NONCE, 'Exact isolated vault nonce required');
assert.ok(process.env.NAND_ACCEPTANCE_DIR && path.isAbsolute(process.env.NAND_ACCEPTANCE_DIR), 'Absolute evidence directory required');
const dir = process.env.NAND_ACCEPTANCE_DIR;
const c = await connect();
const rows = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ownedChildren = [];
let runtime;

async function until(expression, label, timeout = 8000) {
	const deadline = Date.now() + timeout;
	do {
		const result = await c.evaluate(expression);
		if (result) return result;
		await delay(150);
	} while (Date.now() < deadline);
	throw Error(`Timed out: ${label}`);
}
async function snapshot(name) {
	await fs.writeFile(path.join(dir, `${name}.png`), Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
}
function queryProcess(pid) {
	assert.ok(Number.isSafeInteger(pid) && pid > 0);
	const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}' | Select-Object ProcessId,ParentProcessId,CommandLine,CreationDate | ConvertTo-Json -Compress`], { encoding: 'utf8', windowsHide: true }).trim();
	return output ? JSON.parse(output) : null;
}
async function openPowerShell() {
	await c.evaluate(`app.commands.executeCommandById('nand:new-terminal-powershell')`);
	await until(`(async()=>{const p=app.plugins.plugins.nand,s=await p.terminalHost.getTerminalService(),v=app.workspace.getLeavesOfType('terminal-view')[0]?.view;const id=v?.terminalInstance?.id;window.nandE2ETerm=s.getAllTerminals().find(t=>t.id===id);if(nandE2ETerm&&!nandE2EOwnedIds.includes(nandE2ETerm.id))nandE2EOwnedIds.push(nandE2ETerm.id);return !!nandE2ETerm?.emulator&&nandE2ETerm.isAlive()})()`, 'PowerShell initialized');
	await until(`nandE2ELines().some(s=>s.startsWith('PS ')&&s.includes('>'))`, 'PowerShell prompt');
	return c.evaluate(`({id:nandE2ETerm.id,sessionId:nandE2ETerm.sessionId,shellType:nandE2ETerm.shellType})`);
}
async function write(command) {
	await c.evaluate(`nandE2ETerm.write(${JSON.stringify(command + String.fromCharCode(13))})`);
}
async function closeVisibleTerminal() {
	await c.evaluate(`(()=>{const entry=[...document.querySelectorAll('[data-terminal-id]')].find(e=>e.dataset.terminalId===nandE2ETerm.id),e=entry?.closest('.nand-session-row')?.querySelector('.nand-session-more');if(!e)throw Error('Visible terminal actions button missing');e.click()})()`);
	await until(`!![...document.querySelectorAll('.menu-item')].find(e=>/^(End session|结束会话)$/.test(e.textContent.trim()))`, 'end-session menu action');
	await c.evaluate(`[...document.querySelectorAll('.menu-item')].find(e=>/^(End session|结束会话)$/.test(e.textContent.trim())).click()`);
	await until(`!!document.querySelector('.modal button.mod-warning')`, 'close confirmation');
	await c.evaluate(`document.querySelector('.modal button.mod-warning').click()`);
	await until(`(async()=>{const s=await app.plugins.plugins.nand.terminalHost.getTerminalService();return s.getAllTerminals().length===0})()`, 'last terminal closed');
	await until(`(async()=>!(await app.plugins.plugins.nand.terminalHost.getServerManager()).process)()`, 'native server stopped');
}

try {
	runtime = await c.evaluate(`(async()=>{const adapter=app.vault.adapter;const marker=JSON.parse(await adapter.read('.nand-e2e-isolated.json'));return {vaultPath:adapter.basePath,marker,platform:window.require('process').platform,plugin:!!app.plugins.plugins.nand}})()`);
	assert.equal(runtime.platform, 'win32');
	assert.equal(runtime.marker.kind, 'nand-windows-e2e');
	assert.equal(runtime.marker.nonce, process.env.NAND_WINDOWS_E2E_NONCE);
	assert.equal(path.win32.resolve(runtime.marker.vaultPath).toLowerCase(), path.win32.resolve(runtime.vaultPath).toLowerCase());
	assert.equal(runtime.plugin, true, 'NAND must already be deployed');
	await fs.mkdir(dir, { recursive: true });
	const prerequisites = await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand,s=await p.terminalHost.getTerminalService();return {module:p.settings.modules.terminal,offline:p.terminalHost.settings.serverConnection.offlineMode,sessions:s.getAllTerminals().length,agentsDisabled:Object.values(p.terminalHost.settings.agentSettings.agents).every(a=>!a.enabled)}})()`);
	assert.equal(prerequisites.module, true);
	assert.equal(prerequisites.offline, true, 'Use the matching local native binary in offline mode');
	assert.equal(prerequisites.agentsDisabled, true, 'Disable authenticated agents in the test vault');
	assert.equal(prerequisites.sessions, 0, 'Close existing test terminals before this run');
	await c.evaluate(`window.nandE2EOwnedIds=[];window.nandE2ELines=()=>{const b=nandE2ETerm.emulator.buffer.active,r=[];for(let i=0;i<b.length;i++)r.push(b.getLine(i)?.translateToString(true)||'');return r};true`);
	const initial = await openPowerShell();
	await write('Write-Output NAND_WINDOWS_EXIT_CHECK; exit 7');
	await until(`nandE2ETerm.exited&&!nandE2ETerm.isAlive()`, 'native shell exit event');
	const exit = await c.evaluate(`({alive:nandE2ETerm.isAlive(),exited:nandE2ETerm.exited,native:nandE2ETerm.nativeState,output:nandE2ELines().join(String.fromCharCode(10))})`);
	assert.ok(exit.output.split('\n').some((s) => s.trim() === 'NAND_WINDOWS_EXIT_CHECK'));
	await snapshot('windows-exit');
	await closeVisibleTerminal();
	rows.push({ name: 'powershell-exit', trigger: 'NAND command entry + real PTY input + visible Close/confirmation', initial, ...exit, passed: true });

	const reopened = await openPowerShell();
	await write('Write-Output NAND_WINDOWS_INTERRUPT_START; Start-Sleep -Seconds 600');
	await until(`nandE2ELines().some(s=>s.trim()==='NAND_WINDOWS_INTERRUPT_START')`, 'long command started');
	await c.evaluate(`document.querySelector('.terminal-container .xterm-helper-textarea').focus()`);
	for (const type of ['keyDown', 'keyUp']) await c.send('Input.dispatchKeyEvent', { type, key: 'c', code: 'KeyC', windowsVirtualKeyCode: 67, modifiers: 2 });
	await delay(400);
	assert.equal(await c.evaluate('nandE2ETerm.isAlive()'), true, 'Ctrl+C must preserve the shell');
	await write('Write-Output NAND_WINDOWS_INTERRUPT_AFTER');
	await until(`nandE2ELines().some(s=>s.trim()==='NAND_WINDOWS_INTERRUPT_AFTER')`, 'shell command after real xterm Ctrl+C');
	const interrupt = await c.evaluate(`({alive:nandE2ETerm.isAlive(),output:nandE2ELines().join(String.fromCharCode(10))})`);
	await snapshot('windows-interrupt');
	rows.push({ name: 'reopen-and-ctrl-c', trigger: 'Reopen after last close; real xterm focus + CDP Control+C keyboard event', reopened, ...interrupt, passed: true });

	await write(`$nandE2EShell = (Get-Process -Id $PID).Path; $nandE2EChild = Start-Process -FilePath $nandE2EShell -ArgumentList '-NoProfile','-Command','Start-Sleep -Seconds 600' -WindowStyle Hidden -PassThru; Write-Output ('NAND_WINDOWS_CHILD_PID=' + $nandE2EChild.Id)`);
	const childPid = await until(`(()=>{const line=nandE2ELines().find(s=>/^NAND_WINDOWS_CHILD_PID=[0-9]+$/.test(s.trim()));return line?Number(line.trim().split('=')[1]):null})()`, 'owned child PID');
	const identity = queryProcess(childPid);
	assert.ok(identity?.CommandLine?.includes('Start-Sleep -Seconds 600'));
	ownedChildren.push(identity);
	await closeVisibleTerminal();
	const childAfter = queryProcess(childPid);
	assert.equal(childAfter, null, 'Close must stop the owned descendant');
	rows.push({ name: 'close-process-tree', trigger: 'Real PTY creates a hidden owned child; visible Close/confirmation', identity, childAfter, passed: true });
	await fs.writeFile(path.join(dir, 'windows.json'), JSON.stringify({ passed: true, runtime, rows }, null, 2));
	console.log(JSON.stringify({ passed: true, cases: rows.length }));
} catch (error) {
	if (runtime?.marker?.nonce === process.env.NAND_WINDOWS_E2E_NONCE) {
		await fs.mkdir(dir, { recursive: true });
		await fs.writeFile(path.join(dir, 'windows-error.json'), JSON.stringify({ passed: false, error: String(error), runtime, rows }, null, 2));
	}
	throw error;
} finally {
	try {
		try {
			if (runtime?.marker?.nonce === process.env.NAND_WINDOWS_E2E_NONCE) {
				await c.evaluate(`(async()=>{const host=app.plugins.plugins.nand?.terminalHost;if(!host)return;const service=await host.getTerminalService();for(const id of window.nandE2EOwnedIds||[])if(service.getTerminal(id))await service.destroyTerminal(id)})()`);
			}
		} finally {
			for (const identity of ownedChildren) {
				const current = queryProcess(identity.ProcessId);
				if (current && current.CreationDate === identity.CreationDate && current.ParentProcessId === identity.ParentProcessId && current.CommandLine === identity.CommandLine) process.kill(identity.ProcessId);
			}
		}
	} finally {
		c.close();
	}
}
