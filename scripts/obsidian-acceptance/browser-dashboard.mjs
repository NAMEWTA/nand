// Real shortcut UI and Markdown persistence. Runs only in an explicitly marked test vault.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { connect } from './cdp.mjs';

assert.equal(process.env.NAND_ALLOW_BROWSER_E2E, '1');
assert.ok(process.env.NAND_WINDOWS_E2E_NONCE);
assert.ok(path.isAbsolute(process.env.NAND_ACCEPTANCE_DIR || ''));
const c = await connect();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(fn, label) {
	for (let i = 0; i < 100; i++) { const value = await fn(); if (value) return value; await delay(100); }
	throw Error(`Timed out: ${label}`);
}
const server = http.createServer((_req, res) => res.end('<title>Shortcut fixture</title><h1>NAND shortcut fixture</h1>'));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/shortcut?preserve=1`;
const initialMarkdown = '# Browser acceptance\n\n## Shortcuts\ntype: sticky\n\n';
const board = (expression) => c.evaluate(`(()=>{const view=app.workspace.getLeavesOfType('nand-dashboard-view')[0].view,doc=view.contentEl.doc;return (${expression})})()`);
const owned = [];
let saved, fixturePath;
try {
	const runtime = await c.evaluate(`(async()=>({marker:JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json')),vault:app.vault.adapter.basePath}))()`);
	assert.equal(runtime.marker.kind, 'nand-windows-e2e');
	assert.equal(runtime.marker.nonce, process.env.NAND_WINDOWS_E2E_NONCE);
	assert.equal(path.resolve(runtime.vault), path.resolve(runtime.marker.vaultPath));
	saved = await c.evaluate(`(()=>{const p=app.plugins.plugins.nand;return {dashboardFile:p.settings.dashboardFile,workspaceFiles:p.settings.workspaceFiles,workspaceNames:p.settings.workspaceNames}})()`);
	fixturePath = await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand;await p.createWorkspace('Browser acceptance '+Date.now());const file=p.settings.dashboardFile+'.md';await app.vault.modify(app.vault.getFileByPath(file),${JSON.stringify(initialMarkdown)});await p.openDashboard();await p.reloadAllDashboards();return file})()`);
	await until(() => board(`view.data?.columns.some(c=>c.name==='Shortcuts')`), 'shortcut board');
	await board(`view.openStickyCardTypeModal('Shortcuts')`);
	await until(() => board(`(()=>{const button=[...doc.querySelectorAll('.widget-type-btn')].find(e=>e.textContent.includes('Web shortcut'));if(!button)return false;button.click();return true})()`), 'shortcut type');
	await until(() => board(`!!doc.querySelector('.modal-content input[placeholder="https://example.com"]')`), 'shortcut form');
	await board(`(()=>{const modal=doc.querySelector('.modal-content:has(input[placeholder="https://example.com"])'),fields=modal.querySelectorAll('input');fields[0].value='Acceptance shortcut';fields[0].dispatchEvent(new fields[0].win.Event('input',{bubbles:true}));fields[1].value=${JSON.stringify(url)};fields[1].dispatchEvent(new fields[1].win.Event('input',{bubbles:true}));modal.querySelector('button.mod-cta').click()})()`);
	await until(() => board(`!!view.contentEl.querySelector('.nand-browser-shortcut-open')`), 'saved card');
	await until(async () => (await c.evaluate(`app.vault.adapter.read(${JSON.stringify(fixturePath)})`)).includes('type: web'), 'card written to Markdown');
	let markdown = await c.evaluate(`app.vault.adapter.read(${JSON.stringify(fixturePath)})`);
	assert.match(markdown, /type: web/); assert.match(markdown, /openIn: modal/); assert.ok(markdown.includes(url));
	await board(`view.contentEl.querySelector('.nand-browser-shortcut-open').click()`);
	const modalPage = await until(() => c.evaluate(`(()=>{const b=app.plugins.plugins.nand.browserHost;return [...b.pages.values()].find(p=>p.state.url===${JSON.stringify(url)}&&p.webview.closest('.nand-browser-modal'))?.state.id})()`), 'default browser modal');
	owned.push(modalPage);
	await until(() => c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${modalPage}')?.guest?.executeJavaScript('document.title === "Shortcut fixture"')`), 'modal fixture loaded');
	await c.evaluate(`app.plugins.plugins.nand.browserHost.execute('tab.close',{page:'${modalPage}'})`);
	await board(`view.contentEl.querySelector('.nand-browser-shortcut .nand-ui-icon-btn').click()`);
	await until(() => board(`(()=>{const item=[...doc.querySelectorAll('.menu-item')].find(e=>e.textContent.includes('Configure web shortcut'));if(!item)return false;item.click();return true})()`), 'configure shortcut');
	await until(() => board(`!!doc.querySelector('.modal-content input[placeholder="https://example.com"]')`), 'edit form');
	await board(`(()=>{const modal=doc.querySelector('.modal-content:has(input[placeholder="https://example.com"])'),select=modal.querySelector('select');select.value='tab';select.dispatchEvent(new select.win.Event('change',{bubbles:true}));modal.querySelector('button.mod-cta').click()})()`);
	await until(async () => (await c.evaluate(`app.vault.adapter.read(${JSON.stringify(fixturePath)})`)).includes('openIn: tab'), 'tab saved');
	await c.evaluate(`app.plugins.plugins.nand.reloadAllDashboards()`);
	await until(() => board(`view.data?.columns[0]?.cards[0]?.openIn==='tab'`), 'reloaded tab card');
	await board(`view.contentEl.querySelector('.nand-browser-shortcut-open').click()`);
	const tabPage = await until(() => c.evaluate(`(()=>{const b=app.plugins.plugins.nand.browserHost;return [...b.pages.values()].find(p=>p.state.url===${JSON.stringify(url)}&&p.webview.closest('.nand-browser-view'))?.state.id})()`), 'native tab from saved card');
	owned.push(tabPage);
	await until(() => c.evaluate(`app.plugins.plugins.nand.browserHost.pages.get('${tabPage}')?.guest?.executeJavaScript('document.title === "Shortcut fixture"')`), 'tab fixture loaded');
	markdown = await c.evaluate(`app.vault.adapter.read(${JSON.stringify(fixturePath)})`);
	assert.match(markdown, /Acceptance shortcut/); assert.ok(markdown.includes(url));
	await fs.mkdir(process.env.NAND_ACCEPTANCE_DIR, { recursive: true });
	const result = { passed: true, fixturePath, checks: ['native shortcut form', 'default modal', 'Markdown URL and target round trip', 'edit configuration', 'reload and open native tab'] };
	await fs.writeFile(path.join(process.env.NAND_ACCEPTANCE_DIR, 'dashboard.json'), JSON.stringify(result, null, 2));
	console.log(result);
} finally {
	for (const id of owned) try { await c.evaluate(`app.plugins.plugins.nand.browserHost.execute('tab.close',{page:${JSON.stringify(id)}})`); } catch {}
	if (saved) await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand;p.settings={...p.settings,...${JSON.stringify(saved)}};await p.saveSettings();await p.repointAllViews()})()`);
	// Keep the generated fixture as evidence; never remove user files.
	c.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
}
