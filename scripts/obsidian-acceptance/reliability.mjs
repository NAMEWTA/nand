// Writes only to the marked, isolated acceptance Vault. Never use a daily Vault.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { connect } from './cdp.mjs';

assert.equal(process.env.NAND_ALLOW_WINDOWS_E2E, '1');
assert.ok(process.env.NAND_WINDOWS_E2E_NONCE);
assert.ok(path.isAbsolute(process.env.NAND_ACCEPTANCE_DIR || ''));
const c = await connect(), rows = [], directory = process.env.NAND_ACCEPTANCE_DIR;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async (expression, label) => {
	for (let i = 0; i < 100; i++) { if (await c.evaluate(expression)) return; await pause(100); }
	throw Error('Timed out: ' + label);
};
try {
	const runtime = await c.evaluate(`(async()=>({vault:app.vault.adapter.basePath,marker:JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json')),profile:window.require('@electron/remote').app.getPath('userData')}))()`);
	assert.equal(runtime.marker.kind, 'nand-windows-e2e'); assert.equal(runtime.marker.nonce, process.env.NAND_WINDOWS_E2E_NONCE);
	assert.equal(path.resolve(runtime.vault), path.resolve(runtime.marker.vaultPath));
	assert.equal(path.resolve(runtime.vault), path.resolve('scripts/tmp/e2e-2026-09-30/vault'));
	assert.equal(path.resolve(runtime.profile), path.resolve('scripts/tmp/e2e-2026-09-30/profile'));
	await fs.mkdir(directory, { recursive: true });
	await c.evaluate(`app.plugins.disablePlugin('nand')`); await pause(200);
	for (const file of ['main.js', 'styles.css', 'manifest.json']) await fs.copyFile(file, path.join(runtime.vault, '.obsidian/plugins/nand', file));
	await c.evaluate(`app.plugins.enablePlugin('nand')`);
	const unique = Date.now(), board = `Refactor-${unique}`, actionId = `acceptance-${unique}`;
	const habit = await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand,h=p.habitService.addHabit('Reliability ${unique}');await p.habitService.flush();const f=app.vault.getMarkdownFiles().find(f=>f.path.startsWith('NAND/习惯/')&&f.path.includes('Reliability ${unique}'));return {id:h.id,path:f.path}})()`);
	await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand,f=app.vault.getFileByPath(${JSON.stringify(habit.path)});await app.vault.process(f,s=>s.replace('---',${JSON.stringify('---\ncustom: preserve-me')})+${JSON.stringify('\nAuthor notes stay here.\n')});p.habitService.renameHabit('${habit.id}','Renamed ${unique}');await p.habitService.flush()})()`);
	const saved = await c.evaluate(`app.vault.read(app.vault.getFileByPath(${JSON.stringify(habit.path)}))`);
	assert.match(saved, /custom: preserve-me/); assert.match(saved, /Author notes stay here/); assert.match(saved, /Renamed/);
	rows.push('Markdown entity save preserves foreign properties and prose');
	const markdown = `---\ncustom: keep-board-property\nquote: "hello --- world"\n---\nAuthor board introduction.\n\n# Work\n\n## Tasks\n- [ ] Example\n`;
	await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand;await app.vault.create('${board}.md',${JSON.stringify(markdown)});p.settings.workspaceFiles=['${board}'];p.settings.language='en';await p.saveSettings();await p.loadSettings();await p.switchWorkspace('${board}');const s=p.automationHost.service;await s.save({id:'${actionId}',name:'Shared operation',enabled:true,deviceId:s.deviceId,revision:1,createdAt:Date.now(),updatedAt:Date.now(),graceMinutes:5,schedule:{kind:'manual'},action:{kind:'notify',body:'Isolated acceptance'},channels:['in-app'],notifyOn:'never'});await p.automationHost.open();const v=app.workspace.getLeavesOfType('nand-automation-view')[0].view;v.panelState.selected='${actionId}';v.draw()})()`);
	await until(`!![...document.querySelectorAll('.nand-automation-view button')].find(b=>b.textContent==='Add to dashboard')`, 'pin action control');
	await c.evaluate(`[...document.querySelectorAll('.nand-automation-view button')].find(b=>b.textContent==='Add to dashboard').click()`);
	await until(`!!document.querySelector('.modal button.mod-cta')`, 'target dashboard picker');
	await c.evaluate(`document.querySelector('.modal button.mod-cta').click()`);
	await until(`!document.querySelector('.modal button.mod-cta')`, 'pin saved');
	const pinned = await c.evaluate(`app.vault.read(app.vault.getFileByPath('${board}.md'))`);
	assert.match(pinned, new RegExp(actionId)); assert.match(pinned, /Author board introduction/); assert.match(pinned, /custom: keep-board-property/);
	await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand,s=p.automationHost.service;await s.run(s.definitions.find(d=>d.id==='${actionId}'));await p.openDashboard()})()`);
	await until(`!![...document.querySelectorAll('.dashboard-qa-run')].find(b=>b.textContent.includes('Shared operation'))`, 'pinned dashboard action');
	await c.evaluate(`(()=>{const pin=document.querySelector('.dashboard-sidebar-pin-btn');if(pin&&!pin.classList.contains('dashboard-sidebar-pin-btn--active'))pin.click()})()`);
	await until(`!![...document.querySelectorAll('.dashboard-qa-run')].find(b=>b.textContent.includes('Shared operation')&&b.getBoundingClientRect().width>40)`, 'action is visibly usable');
	const before = await c.evaluate(`app.plugins.plugins.nand.automationHost.service.state.runs.filter(r=>r.automationId==='${actionId}').length`);
	await c.evaluate(`(()=>{const button=[...document.querySelectorAll('.dashboard-qa-run')].find(b=>b.textContent.includes('Shared operation'));button.click();button.click()})()`);
	await until(`app.plugins.plugins.nand.automationHost.service.state.runs.filter(r=>r.automationId==='${actionId}'&&r.status==='succeeded').length===${before + 1}`, 'double click only starts once');
	await c.evaluate(`(async()=>{const s=app.plugins.plugins.nand.automationHost.service;await s.save({...s.definitions.find(d=>d.id==='${actionId}'),name:'Updated operation'})})()`);
	await until(`!![...document.querySelectorAll('.dashboard-qa-run')].find(b=>b.textContent.includes('Updated operation'))`, 'shared definition refresh');
	rows.push('Center and dashboard share execution; pin uses ID; double click is deduplicated; definition updates propagate');
	for (const light of [false, true]) {
		await c.evaluate(`document.body.classList.toggle('theme-light',${light});document.body.classList.toggle('theme-dark',${!light})`);
		await c.send('Emulation.setDeviceMetricsOverride', { width: light ? 620 : 1280, height: 900, deviceScaleFactor: 1, mobile: false });
		if (light) await c.evaluate(`document.querySelector('.dashboard-mobile-action-btn').click()`);
		await pause(350); await fs.writeFile(path.join(directory, `actions-${light ? 'light-narrow' : 'dark-wide'}.png`), Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
	}
	await c.evaluate(`app.plugins.disablePlugin('nand')`); await pause(200); await c.evaluate(`app.plugins.enablePlugin('nand')`);
	await until(`app.plugins.plugins.nand.habitService?.getHabits().some(h=>h.id==='${habit.id}'&&h.name==='Renamed ${unique}')`, 'habit restored from Markdown');
	await until(`app.plugins.plugins.nand.automationHost?.service.definitions.some(d=>d.id==='${actionId}'&&d.name==='Updated operation')`, 'definition restored from Markdown');
	await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand,s=p.automationHost.service;await s.remove(s.definitions.find(d=>d.id==='${actionId}'));await p.openDashboard()})()`);
	await until(`!![...document.querySelectorAll('.dashboard-qa-run')].find(b=>b.disabled&&b.textContent.includes('Shared operation'))`, 'deleted definition leaves disabled reference');
	assert.equal(await c.evaluate(`app.plugins.plugins.nand.automationHost.service.state.runs.filter(r=>r.automationId==='${actionId}').length`), before + 1);
	rows.push('Reload restores Markdown data; deleting definition retains history and a repairable dashboard reference');
	await fs.writeFile(path.join(directory, 'reliability.json'), JSON.stringify({ runtime, rows }, null, 2));
	console.log(JSON.stringify({ passed: rows.length, rows }, null, 2));
} finally { await c.send('Emulation.clearDeviceMetricsOverride').catch(() => {}); c.close(); }
