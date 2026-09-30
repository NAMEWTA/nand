import { connect } from './cdp.mjs';
import { language, delay, init, escape } from './common.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const c = await connect(),
	rows = [];
try {
	await init(c);
	await c.evaluate(
		`(async()=>{await app.plugins.plugins.nand.openContacts();await new Promise(r=>setTimeout(r,100));window.contactView=app.workspace.getLeavesOfType('nand-contacts-view')[0].view;const fields={name:'Filter acceptance',birthday:'',birthplace:'',region:'North',website:'',aliases:[],mobiles:[],phones:[],wechat:[],emails:[],tags:['Work']};window.fixtureContact=await contactView.controller.create({id:crypto.randomUUID(),kind:'person',path:'',fields,employments:[],relations:[],prose:{traits:'',habits:'',notes:''},raw:'',modified:0,errors:[]});contactView.changeKind('person');})()`,
	);
	for (const lang of ['zh', 'en']) {
		await language(c, lang);
		await c.evaluate(`contactView.filters()`);
		await delay(150);
		const result = await c.evaluate(
			`(()=>{const groups=[...document.querySelectorAll('.nand-contacts-filter-group')];return groups.map(e=>({title:e.getAttribute('aria-label'),heading:auditRect(e.querySelector('.setting-item-heading')),options:[...e.querySelectorAll('.setting-item:not(.setting-item-heading),.nand-contacts-placeholder')].map(auditRect)}))})()`,
		);
		assert.equal(result.length, 5);
		assert.ok(result.some((g) => g.options.some((o) => o.text === 'North')));
		for (const g of result) assert.ok(g.options[0].y - g.heading.bottom < 16);
		await c.evaluate(`document.querySelector('.nand-contacts-filter-group .checkbox-container').click()`);
		await escape(c);
		assert.deepEqual(await c.evaluate(`contactView.state.query.regions`), []);
		await c.evaluate(
			`contactView.filters();document.querySelector('.nand-contacts-filter-group .checkbox-container').click();document.querySelector('.modal.nand-contacts-filter button.mod-cta').click()`,
		);
		await delay(100);
		assert.deepEqual(await c.evaluate(`contactView.state.query.regions`), ['North']);
		rows.push({ lang, groups: result, cancelPreserves: true, applyUpdates: true });
		await c.evaluate(`contactView.state.query.regions=[]`);
	}
	await fs.writeFile(
		`${process.env.NAND_ACCEPTANCE_DIR || '/tmp/nand-issue-acceptance'}/filter-options.json`,
		JSON.stringify({ passed: true, rows }, null, 2),
	);
	console.log({ passed: true, cases: rows.length });
} finally {
	await c.evaluate(`(async()=>{if(window.fixtureContact)await contactView.controller.remove(fixtureContact);})()`);
	c.close();
}
