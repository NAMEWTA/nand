import { connect } from './cdp.mjs';
import { metrics, language, init, escape, delay } from './common.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const c = await connect(),
	rows = [],
	dir = process.env.NAND_ACCEPTANCE_DIR || '/tmp/nand-issue-acceptance';
try {
	await init(c);
	await metrics(c, 1100, 800);
	await c.evaluate(
		`(async()=>{app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();await app.plugins.plugins.nand.openContacts()})()`,
	);
	for (const lang of ['en', 'zh']) {
		await language(c, lang);
		for (const kind of ['person', 'company']) {
			await c.evaluate(
				`(()=>{const v=app.workspace.getLeavesOfType('nand-contacts-view')[0].view;v.changeKind('${kind}');v.filters();})()`,
			);
			await delay(100);
			const groups = await c.evaluate(
				`([...document.querySelectorAll('.nand-contacts-filter-group')].map(e=>({label:e.getAttribute('aria-label'),box:auditRect(e),heading:auditRect(e.querySelector('.setting-item-heading')),option:auditRect(e.querySelector('.nand-contacts-placeholder')||e.querySelector('.setting-item:not(.setting-item-heading)'))})))`,
			);
			assert.equal(groups.length, kind === 'person' ? 5 : 2);
			for (let i = 0; i < groups.length; i++) {
				const g = groups[i];
				assert.ok(g.box.text.includes(g.label));
				assert.ok(g.option.y - g.heading.bottom <= 16, JSON.stringify(g));
				assert.ok(g.option.bottom <= g.box.bottom);
				if (i < groups.length - 1) {
					const next = groups[i + 1];
					assert.ok(next.heading.y - g.option.bottom >= 20);
				}
			}
			rows.push({ lang, kind, groups });
			await fs.writeFile(
				`${dir}/filters-${lang}-${kind}.png`,
				Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'),
			);
			await escape(c);
		}
	}
	await fs.writeFile(`${dir}/filters.json`, JSON.stringify({ passed: true, rows }, null, 2));
	console.log({ passed: true, cases: rows.length });
} finally {
	c.close();
}
