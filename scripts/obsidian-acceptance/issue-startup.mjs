// One verification per independent real app start. Never reload the plugin to make habits appear.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { connect } from './cdp.mjs';
import { delay } from './common.mjs';
import { issueConfig, ISSUE_RUNTIME, verifyIssueRuntime, acquireIssueLock, hashBytes } from './issue-fixture.mjs';

const config = issueConfig(), c = await connect();
const failures = [];
let runtime, unlock, dir, result;
try {
	runtime = await verifyIssueRuntime(config, await c.evaluate(ISSUE_RUNTIME));
	unlock = await acquireIssueLock(runtime.profile);
	await fs.mkdir(config.dir, { recursive: true });
	dir = await fs.mkdtemp(path.join(config.dir, 'issue-startup-'));
	const deadline = Date.now() + 15000;
	while (!await c.evaluate('app.plugins.plugins.nand.habitService?.readyForEdits===true')) {
		assert.ok(Date.now() < deadline, 'Habit startup did not become ready');
		await delay(60);
	}
	result = await c.evaluate(`(async()=>{const baseline=JSON.parse(await app.vault.adapter.read('.nand-open-issue-seed.json')),s=app.plugins.plugins.nand.habitService;
	 return {baseline,habits:s.getHabits(),records:s.getDoneOn(baseline.date),files:await Promise.all(baseline.files.map(async f=>({path:f.path,text:await app.vault.adapter.read(f.path)}))),
	 process:{pid:window.require('process').pid,uptime:window.require('process').uptime()},titles:app.workspace.getLeavesOfType('nand-editor-view').map(l=>({deferred:l.isDeferred,title:l.view.getDisplayText()}))};})()`);
	assert.equal(result.baseline.mainSha256, runtime.mainSha256, 'Run with the seed build or explicitly reseed the isolated fixture');
	assert.deepEqual(result.habits.map(h => ({ id: h.id, name: h.name })), result.baseline.habits.map(h => ({ id: h.id, name: h.name })));
	assert.deepEqual([...result.records].sort(), [...result.baseline.records].sort());
	assert.deepEqual(result.files.map(f => ({ path: f.path, sha256: hashBytes(f.text) })), result.baseline.files);
} catch (error) {
	failures.push(String(error));
} finally {
	try { if (unlock) await unlock(); } catch (error) { failures.push(`Release acceptance lock: ${String(error)}`); }
	c.close();
}
if (dir) await fs.writeFile(path.join(dir, failures.length ? 'startup-partial.json' : 'startup.json'), JSON.stringify({
	runtime, process: result?.process, passed: failures.length === 0, failures,
	checks: failures.length ? [] : ['stable-habit-ids', 'retained-checkins', 'byte-identical-habit-files'],
	restartProof: 'not-asserted: pair this check with independently recorded app exit and new process identity',
	titles: result?.titles,
}, null, 2));
if (failures.length) throw Error(failures.join('\n'));
