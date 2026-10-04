// Prepare two persistent fixtures only after validating an ALREADY isolated Vault/profile.
// This script never creates an isolation marker and does not simulate application restart.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { connect } from './cdp.mjs';
import { delay } from './common.mjs';
import { issueConfig, ISSUE_RUNTIME, verifyIssueRuntime, acquireIssueLock, hashBytes } from './issue-fixture.mjs';

const config = issueConfig(), c = await connect();
const failures = [];
let unlock, runtime, dir, baseline;
try {
	runtime = await verifyIssueRuntime(config, await c.evaluate(ISSUE_RUNTIME));
	unlock = await acquireIssueLock(runtime.profile);
	await fs.mkdir(config.dir, { recursive: true });
	dir = await fs.mkdtemp(path.join(config.dir, 'issue-seed-'));
	const run = expression => c.evaluate(expression);
	const deadline = Date.now() + 15000;
	while (!await run('app.plugins.plugins.nand.habitService?.readyForEdits===true')) {
		assert.ok(Date.now() < deadline, 'Habit service did not become ready; do not seed an empty/stale collection');
		await delay(60);
	}
	const marker = '.nand-open-issue-seed.json';
	assert.equal(await run(`app.vault.adapter.exists(${JSON.stringify(marker)})`), false, 'Seeds already exist; verify them instead of overwriting the baseline');
	assert.equal(await run('app.plugins.plugins.nand.habitService.getHabits().length'), 0, 'Use an empty isolated habit collection');
	const seeds = await run(`(async()=>{const s=app.plugins.plugins.nand.habitService,date='2026-10-04';
	 const habits=['Read 20 pages','Exercise 10 minutes'].map(name=>s.addHabit(name));
	 if(habits.some(h=>!h))throw Error('Cannot create fixture habits');
	 s.markDoneMany(habits.map(h=>h.id),date);await s.flush();
	 if(s.saveState.status!=='saved')throw Error('Fixture habits did not persist');
	 return {date,habits,records:s.getDoneOn(date)};})()`);
	const files = await run(`(async()=>{const files=app.vault.getMarkdownFiles().filter(f=>f.path.startsWith('NAND/习惯/'));return Promise.all(files.map(async f=>({path:f.path,text:await app.vault.read(f)})))})()`);
	assert.ok(files.length >= 2, 'Seed Markdown files were not created');
	baseline = { sourceCommit: runtime.sourceCommit, mainSha256: runtime.mainSha256, platform: runtime.platform,
		obsidianVersion: runtime.obsidianVersion, ...seeds, files: files.map(f => ({ path: f.path, sha256: hashBytes(f.text) })) };
	await run(`app.vault.adapter.write(${JSON.stringify(marker)},${JSON.stringify(JSON.stringify(baseline, null, 2))})`);
} catch (error) {
	failures.push(String(error));
} finally {
	try { if (unlock) await unlock(); } catch (error) { failures.push(`Release acceptance lock: ${String(error)}`); }
	c.close();
}
if (dir) await fs.writeFile(path.join(dir, failures.length ? 'seed-partial.json' : 'seed.json'), JSON.stringify({
	runtime, baseline, failures, prepared: failures.length === 0, nativeAcceptancePassed: false,
}, null, 2));
if (failures.length) throw Error(failures.join('\n'));
console.log('Seed data prepared. Verify only after an independently recorded complete Obsidian quit/relaunch.');
