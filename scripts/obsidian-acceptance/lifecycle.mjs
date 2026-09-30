import { connect } from './cdp.mjs';
import { language, delay } from './common.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const c = await connect();
try {
	const stopped = await c.evaluate(
		`(async()=>{window.testHost=app.plugins.plugins.nand.terminalHost;window.testService=await testHost.getTerminalService();window.testManager=await testHost.getServerManager();const child=testManager.process;for(const terminal of testService.getAllTerminals())await testService.destroyTerminal(terminal.id);return {exit:child.exitCode!==null||child.signalCode!==null,cleared:testManager.process===null,count:testService.getAllTerminals().length}})()`,
	);
	assert.equal(stopped.exit, true);
	assert.equal(stopped.cleared, true);
	assert.equal(stopped.count, 0);
	await c.evaluate(
		`(async()=>{await testHost.openFreshTerminal();window.testSession=testService.getAllTerminals()[0];window.testPty=testSession.sessionId;window.testEmulator=testSession.emulator;window.testChild=testManager.process;testManager.ws.close(1000,'acceptance reconnect');})()`,
	);
	await delay(300);
	const reconnectDeadline = Date.now() + 15000;
	while (!(await c.evaluate(`testManager.isConnected()&&!testManager.isShuttingDown`)) && Date.now() < reconnectDeadline) {
		await delay(150);
	}
	const reconnected = await c.evaluate(
		`(async()=>{window.testPty=testSession.sessionId;testSession.write('echo nand-reconnect-check\\r');return {sameManager:testManager===await testHost.getServerManager(),sameProcess:testManager.process===testChild,connected:testManager.isConnected(),stopping:testManager.isShuttingDown}})()`,
	);
	assert.ok(reconnected.sameManager && reconnected.sameProcess && reconnected.connected && !reconnected.stopping);
	await language(c, 'en');
	await language(c, 'zh');
	await delay(400);
	const final = await c.evaluate(
		`(()=>{const b=testSession.emulator.buffer.active,lines=[];for(let i=0;i<b.length;i++)lines.push(b.getLine(i)?.translateToString(true));return {alive:testSession.isAlive(),sameSession:testService.getAllTerminals().includes(testSession),samePty:testPty===testSession.sessionId,sameEmulator:testEmulator===testSession.emulator,echo:lines.some(s=>s?.trim()==='nand-reconnect-check')}})()`,
	);
	for (const v of Object.values(final)) assert.equal(v, true);
	await fs.writeFile(
		`${process.env.NAND_ACCEPTANCE_DIR || '/tmp/nand-issue-acceptance'}/lifecycle.json`,
		JSON.stringify({ passed: true, stopped, reconnected, final }, null, 2),
	);
	console.log({ passed: true, stopped, reconnected, final });
} finally {
	c.close();
}
