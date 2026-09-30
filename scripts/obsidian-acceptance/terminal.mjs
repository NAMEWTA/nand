import { connect } from './cdp.mjs';
import { metrics, language, init, delay } from './common.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const c = await connect(),
	rows = [],
	dir = process.env.NAND_ACCEPTANCE_DIR || '/tmp/nand-issue-acceptance';
await fs.mkdir(dir, { recursive: true });
try {
	await init(c);
	await c.evaluate(
		`app.setting.close();app.workspace.setActiveLeaf(app.workspace.getLeavesOfType('terminal-view')[0]);window.terminalBefore=app.workspace.getLeavesOfType('terminal-view')[0].view.terminalInstance;window.xtermBefore=document.querySelector('.terminal-container .xterm');`,
	);
	for (const lang of ['en', 'zh']) {
		await language(c, lang);
		for (const [width, height, sidebars] of [
			[1280, 800, true],
			[1100, 740, true],
			[1000, 740, false],
			[800, 500, false],
		]) {
			await metrics(c, width, height);
			await c.evaluate(`app.workspace.leftSplit.${sidebars ? 'expand' : 'collapse'}()`);
			await c.evaluate(`app.workspace.rightSplit.${sidebars ? 'expand' : 'collapse'}()`);
			await delay(200);
			const row = await c.evaluate(
				`(()=>{const q=s=>document.querySelector(s),workbench=q('.nand-agent-workbench');return {leaf:auditRect(workbench),terminal:auditRect(q('.terminal-container')),texts:[...workbench.querySelectorAll('.nand-agent-nav button,.nand-agent-workbench-title,.nand-session-row-id,.nand-session-row-status,.nand-ui-list-item-title')].map(auditRect),sameTerminal:terminalBefore===app.workspace.getLeavesOfType('terminal-view')[0].view.terminalInstance,sameXterm:xtermBefore===q('.terminal-container .xterm')}})()`,
			);
			delete row.leaf.text;
			delete row.terminal.text;
			assert.ok(row.sameTerminal && row.sameXterm);
			assert.ok(row.terminal.width >= row.leaf.width - 20, JSON.stringify(row));
			assert.ok(row.terminal.height >= 120, JSON.stringify(row));
			for (const r of row.texts) {
				assert.ok(r.width > 0);
				assert.ok(r.scroll <= r.client + 1, JSON.stringify({ width, lang, r }));
				assert.ok(r.height <= 60, JSON.stringify(r));
			}
			rows.push({ lang, width, height, sidebars, ...row });
			await fs.writeFile(
				`${dir}/terminal-${lang}-${width}.png`,
				Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'),
			);
			await c.evaluate(`document.querySelector('.nand-agent-session-toggle').click()`);
			await delay(100);
			const collapsed = await c.evaluate(
				`({expanded:document.querySelector('.nand-agent-session-toggle').getAttribute('aria-expanded'),height:document.querySelector('.terminal-container').clientHeight,same:xtermBefore===document.querySelector('.terminal-container .xterm')})`,
			);
			assert.equal(collapsed.expanded, 'false');
			assert.ok(collapsed.height > row.terminal.height);
			assert.ok(collapsed.same);
			await c.evaluate(`document.querySelector('.nand-agent-session-toggle').click()`);
			await delay(100);
		}
	}
	await fs.writeFile(`${dir}/terminal.json`, JSON.stringify({ passed: true, rows }, null, 2));
	console.log({ passed: true, cases: rows.length });
} finally {
	c.close();
}
