// Continues the marked contacts fixture: popout lifecycle and a real desktop restart.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { connect } from './cdp.mjs';
assert.equal(process.env.NAND_ALLOW_WINDOWS_E2E, '1');
const directory = path.resolve('scripts/tmp/contacts-folders-2026-10-01');
const fixture = JSON.parse(await fs.readFile(path.join(directory, 'result.json'), 'utf8'));
const vault = path.resolve('scripts/tmp/e2e-2026-09-30/vault'), profile = path.resolve('scripts/tmp/e2e-2026-09-30/profile');
let c = await connect(), original, ownedLeaf;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(expression, label) { for (let i = 0; i < 100; i++) { if (await c.evaluate(expression)) return; await delay(100); } throw Error(label); }
try {
	const runtime = await c.evaluate(`(async()=>{const r=window.require('@electron/remote');return {profile:r.app.getPath('userData'),exe:r.app.getPath('exe'),vault:app.vault.adapter.basePath,marker:JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json'))}})()`);
	assert.equal(path.resolve(runtime.vault), vault); assert.equal(path.resolve(runtime.profile), profile); assert.equal(runtime.marker.kind, 'nand-windows-e2e'); assert.equal(runtime.marker.nonce, process.env.NAND_WINDOWS_E2E_NONCE); assert.equal(path.resolve(runtime.marker.vaultPath), vault);
	original = await c.evaluate(`app.plugins.plugins.nand.settings.contacts.rootFolder`);
	ownedLeaf = await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand;p.settings.contacts.rootFolder=${JSON.stringify(fixture.root)};await p.saveSettings();await p.contactsHost.reload();const l=app.workspace.getLeaf('tab');await l.setViewState({type:'nand-contacts-view',active:true});window.contactsLifecycle=l;const r=p.contactsHost.index.get('${fixture.personId}');l.view.select(r.path);await app.workspace.revealLeaf(l);return l.id})()`);
	await c.evaluate(`(()=>{const w=window.require('@electron/remote').getCurrentWindow();w.show();w.restore();w.focus();contactsLifecycle.tabHeaderEl.click();return true})()`);
	await delay(300);
	const initial = await c.evaluate(`({listeners:app.plugins.plugins.nand.contactsHost.application.listeners.size,state:contactsLifecycle.view.getState(),resources:app.plugins.plugins.nand.contactsHost.resources('${fixture.personId}').length})`);
	let popout;
	try {
		await c.evaluate(`app.workspace.moveLeafToPopout(contactsLifecycle,{size:{width:1000,height:800}});true`);
		await until(`contactsLifecycle.view.contentEl.win!==window&&contactsLifecycle.view.contentEl.querySelectorAll('button.nand-contacts-resource-row').length===${initial.resources}`, 'Popout resource render');
		await c.evaluate(`contactsLifecycle.view.edit(app.plugins.plugins.nand.contactsHost.index.get('${fixture.personId}'),'basic')`);
		await until(`!!contactsLifecycle.view.contentEl.doc.querySelector('.nand-contacts-form')`, 'Form in popout document');
		popout = await c.evaluate(`(()=>{const d=contactsLifecycle.view.contentEl.doc,m=d.querySelector('.nand-contacts-form');return {document:m.ownerDocument===d,activeInput:d.activeElement?.tagName,overflow:m.scrollWidth-m.clientWidth}})()`);
		assert.equal(popout.document, true); assert.equal(popout.activeInput, 'INPUT'); assert.ok(popout.overflow <= 1);
		await c.evaluate(`contactsLifecycle.view.contentEl.doc.querySelector('.nand-contacts-form-footer button:not(.mod-cta)').click()`);
	} catch(error) {
		if(!String(error).includes("reading 'win'") || !String(error).includes('app://obsidian.md/app.js')) throw error;
		popout = {status:'host-blocked', error:String(error)};
		console.log('Native Obsidian window.open returned null before the archive view moved; recording the repeat-run limitation.');
	}
	await c.evaluate(`contactsLifecycle.detach();true`);
	await until(`app.plugins.plugins.nand.contactsHost.application.listeners.size===${initial.listeners - 1}`, 'View subscription released');
	ownedLeaf = await c.evaluate(`(async()=>{const l=app.workspace.getLeaf('tab');await l.setViewState({type:'nand-contacts-view',state:${JSON.stringify(initial.state)},active:true});await app.workspace.revealLeaf(l);app.workspace.requestSaveLayout();return l.id})()`);
	await delay(2000);
	await c.evaluate(`setTimeout(()=>window.require('@electron/remote').app.quit(),200);true`); c.close(); await delay(1200);
	const quote = (value) => "'" + value.replace(/'/g, "''") + "'";
	await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process -FilePath ${quote(runtime.exe)} -ArgumentList @(${quote('--user-data-dir="' + profile + '"')},'--remote-debugging-address=127.0.0.1','--remote-debugging-port=9237') -WindowStyle Hidden`], { windowsHide: true });
	let attached = false;
	for (let i = 0; i < 100; i++) { try { c = await connect(); if (await c.evaluate('!!window.app?.plugins?.plugins?.nand?.contactsHost')) { attached = true; break; } c.close(); } catch {} await delay(200); }
	assert.ok(attached); assert.equal(await c.evaluate('app.vault.adapter.basePath'), vault);
	await c.evaluate('app.plugins.plugins.nand.contactsHost.ensureLoaded()');
	await until(`app.workspace.getLeavesOfType('nand-contacts-view').some(l=>l.view.state.selectedId==='${fixture.personId}')`, 'Restored native workspace selection');
	const after = await c.evaluate(`(()=>{const p=app.plugins.plugins.nand,r=p.contactsHost.index.get('${fixture.personId}');return {path:r.path,resources:p.contactsHost.resources(r.id).length,phones:r.fields.phones}})()`);
	assert.equal(after.path, initial.state.selectedPath); assert.equal(after.resources, initial.resources); assert.deepEqual(after.phones, ['00123', '+86 010']);
	await fs.writeFile(path.join(directory, 'lifecycle.json'), JSON.stringify({ passed: !popout.status, popout, initial, after, restart: true, subscriptionDisposal: true }, null, 2));
	console.log('Contacts: subscription disposal and real restart passed. Popout status:', popout.status || 'passed');
} finally {
	if (original) await c.evaluate(`(async()=>{app.workspace.getLeafById(${JSON.stringify(ownedLeaf)})?.detach();const p=app.plugins.plugins.nand;p.settings.contacts.rootFolder=${JSON.stringify(original)};await p.saveSettings();await p.contactsHost.reload()})()`).catch(() => {});
	c.close();
}
