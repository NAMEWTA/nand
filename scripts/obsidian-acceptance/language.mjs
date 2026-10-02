// Explicitly opted-in, marker-owned isolated Vault only. No authenticated CLI calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { connect } from './cdp.mjs';

assert.equal(process.env.NAND_ALLOW_WINDOWS_E2E, '1');
assert.ok(process.env.NAND_WINDOWS_E2E_NONCE);
const directory = process.env.NAND_ACCEPTANCE_DIR;
assert.ok(directory && path.isAbsolute(directory));
const c = await connect(), checks = [];
const expectedChecks = 12;
let navigations = 0;
const server = createServer((request, response) => {
	if (request.url === '/') navigations++;
	response.setHeader('Content-Type', 'text/html; charset=utf-8');
	response.end('<!doctype html><title>NAND language fixture</title><input id="draft" value="original"><p>Fixture page</p>');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(expression, label) {
	for (let index = 0; index < 80; index++) { const value = await c.evaluate(expression); if (value) return value; await pause(100); }
	throw Error('Timed out: ' + label);
}
async function shot(name) {
	await pause(200);
	await fs.writeFile(path.join(directory, name + '.png'), Buffer.from((await (settingsClient || c).send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
}
async function language(value) {
	await c.evaluate(`app.plugins.plugins.nand.changeLanguage(${JSON.stringify(value)})`);
	await pause(80);
}
let original, runtime, settingsClient;
try {
	runtime = await c.evaluate(`(()=>{const fs=window.require('fs'),path=window.require('path'),crypto=window.require('crypto'),vault=app.vault.adapter.basePath;return {vault,marker:JSON.parse(fs.readFileSync(path.join(vault,'.nand-e2e-isolated.json'),'utf8')),mainSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(vault,'.obsidian/plugins/nand/main.js'))).digest('hex'),electron:process.versions.electron,userAgent:navigator.userAgent,node:process.versions.node,platform:process.platform,arch:process.arch}})()`);
	assert.equal(runtime.marker.kind, 'nand-windows-e2e');
	assert.equal(runtime.marker.nonce, process.env.NAND_WINDOWS_E2E_NONCE);
	assert.equal(path.resolve(runtime.marker.vaultPath), path.resolve(runtime.vault));
	if (process.env.NAND_EXPECT_MAIN_SHA) assert.equal(runtime.mainSha256, process.env.NAND_EXPECT_MAIN_SHA);
	await fs.mkdir(directory, { recursive: true });
	original = await c.evaluate(`(()=>{const p=app.plugins.plugins.nand;window.nandLanguageTest={leaves:[],modules:{...p.settings.modules}};return {language:p.settings.language,modules:{...p.settings.modules},themeLight:document.body.classList.contains('theme-light')}})()`);
	await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand;await p.changeLanguage('zh');p.openHome()})()`);
	await until(`app.plugins.plugins.nand.settingsTab.containerEl.querySelector('[data-nand-language]')`, 'Home language selector');
	settingsClient = await connect(await c.evaluate('app.plugins.plugins.nand.settingsTab.containerEl.ownerDocument.defaultView.location.href'));
	assert.equal(await c.evaluate(`app.plugins.plugins.nand.settingsTab.containerEl.querySelectorAll('[data-nand-language]').length`), 1);
	assert.equal(await c.evaluate(`app.plugins.plugins.nand.settingsTab.containerEl.querySelector('[data-nand-language]').value`), 'zh');
	await c.evaluate(`(()=>{const input=app.plugins.plugins.nand.settingsTab.containerEl.querySelector('[data-nand-language]');input.value='en';input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
	await until(`app.plugins.plugins.nand.settings.language==='en'&&!app.plugins.plugins.nand.settingsTab.containerEl.querySelector('[data-nand-language]').disabled&&app.plugins.plugins.nand.settingsTab.containerEl.querySelector('.nand-home-settings').textContent.includes('General settings')`, 'persisted dropdown switch');
	checks.push({ name: 'declarative-home-language', passed: true });
	await c.evaluate(`(()=>{const p=app.plugins.plugins.nand;p.settingsTab.renderFallback();p.settings.modules=Object.fromEntries(Object.keys(p.settings.modules).map(key=>[key,false]));p.settingsTab.renderFallback()})()`);
	assert.equal(await c.evaluate(`app.plugins.plugins.nand.settingsTab.containerEl.querySelectorAll('[data-nand-language]').length`), 1);
	await c.evaluate(`(()=>{const p=app.plugins.plugins.nand;p.settings.modules={...nandLanguageTest.modules};p.settingsTab.refresh()})()`);
	checks.push({ name: 'fallback-home-with-all-modules-hidden', passed: true });
	await c.evaluate(`(()=>{const p=app.plugins.plugins.nand;nandLanguageTest.save=p.settingsStore.save;p.settingsStore.save=async()=>{throw Error('Isolated language write failure')};const input=app.plugins.plugins.nand.settingsTab.containerEl.querySelector('[data-nand-language]');input.value='zh';input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
	await pause(200);
	assert.equal(await c.evaluate(`app.plugins.plugins.nand.settings.language`), 'en');
	assert.equal(await c.evaluate(`app.plugins.plugins.nand.settingsTab.containerEl.querySelector('[data-nand-language]').value`), 'en');
	assert.equal(await c.evaluate(`app.plugins.plugins.nand.settingsTab.containerEl.querySelector('[data-nand-language]').disabled`), false);
	await c.evaluate(`(()=>{const p=app.plugins.plugins.nand;p.settingsStore.save=nandLanguageTest.save;delete nandLanguageTest.save})()`);
	await language('zh');
	checks.push({ name: 'failed-save-retains-language-and-retry', passed: true });
	// The deliberate failure Notice expires naturally before capturing the recovered UI.
	await pause(5200);
	for (const [value, light, width] of [['zh', true, 620], ['en', false, 1280]]) {
		await language(value);
		await c.evaluate(`(()=>{app.plugins.plugins.nand.openHome();document.body.classList.toggle('theme-light',${light});document.body.classList.toggle('theme-dark',${!light})})()`);
		await settingsClient.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
		assert.equal(await c.evaluate(`(()=>{const e=app.plugins.plugins.nand.settingsTab.containerEl.querySelector('.nand-home-settings');return e.scrollWidth<=e.clientWidth+2})()`), true);
		await shot(`home-${value}-${width}`);
	}
	checks.push({ name: 'light-narrow-dark-wide', passed: true });
	settingsClient.close(); settingsClient = undefined;
	await c.evaluate(`(()=>{app.setting.close();app.plugins.plugins.nand.automationHost.edit();const root=document.querySelector('.nand-automation-editor'),input=root.querySelector('input[type=text]'),prompt=root.querySelector('textarea');input.value='Unsubmitted 标题';input.dispatchEvent(new Event('input',{bubbles:true}));prompt.value='Unsubmitted prompt 中文';prompt.dispatchEvent(new Event('input',{bubbles:true}));prompt.focus();prompt.setSelectionRange(3,8)})()`);
	await language('zh');
	assert.deepEqual(await c.evaluate(`(()=>{const root=document.querySelector('.nand-automation-editor'),input=root.querySelector('input[type=text]'),prompt=root.querySelector('textarea');return {name:input.value,prompt:prompt.value,selection:[prompt.selectionStart,prompt.selectionEnd],focused:document.activeElement===prompt,translated:root.textContent.includes('名称')}})()`), { name: 'Unsubmitted 标题', prompt: 'Unsubmitted prompt 中文', selection: [3,8], focused: true, translated: true });
	await shot('automation-draft-zh');
	await c.evaluate(`Array.from(document.querySelectorAll('.nand-automation-editor button')).find(b=>b.textContent==='取消').click()`);
	checks.push({ name: 'automation-draft-focus-selection-survive', passed: true });
	await c.evaluate(`(async()=>{const leaf=app.workspace.getLeaf('tab');await leaf.setViewState({type:'nand-contacts-view',active:true});nandLanguageTest.leaves.push(leaf);leaf.view.add('person');const input=document.querySelector('.nand-contacts-form input');input.value='未保存联系人';input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
	await language('en');
	assert.equal(await c.evaluate(`document.querySelector('.nand-contacts-form input').value`), '未保存联系人');
	assert.equal(await c.evaluate(`document.querySelector('.nand-contacts-form').textContent.includes('Save')`), true);
	await shot('contacts-draft-en');
	await c.evaluate(`Array.from(document.querySelectorAll('.nand-contacts-form button')).find(b=>b.textContent==='Cancel').click()`);
	await until(`Array.from(document.querySelectorAll('.modal button')).some(b=>b.textContent==='Discard changes')`, 'discard confirmation');
	await c.evaluate(`(()=>{nandLanguageTest.discardButton=Array.from(document.querySelectorAll('.modal button')).find(b=>b.textContent==='Discard changes');nandLanguageTest.discardButton.focus()})()`);
	await language('zh'); await language('en');
	assert.equal(await c.evaluate(`document.activeElement===nandLanguageTest.discardButton`), true);
	await c.evaluate(`nandLanguageTest.discardButton.click()`);
	await until(`!document.querySelector('.nand-contacts-form')`, 'contact editor closed after discard');
	checks.push({ name: 'contacts-draft-survives', passed: true });
	await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand;nandLanguageTest.quickCaptureEnabled=p.settings.quickCaptureEnabled;nandLanguageTest.quickNotesEnabled=p.settings.quickNotesEnabled;p.settings.quickNotesEnabled=true;p.settings.quickCaptureEnabled=true;const leaf=app.workspace.getLeaf('tab');await leaf.setViewState({type:'nand-dashboard-view',active:true});await leaf.loadIfDeferred?.();nandLanguageTest.board=leaf;nandLanguageTest.leaves.push(leaf)})()`);
	await until(`nandLanguageTest.board.view.contentEl?.querySelector('.dashboard-quicknote-capture-input')`, 'dashboard capture');
	await c.evaluate(`(()=>{const input=nandLanguageTest.board.view.contentEl.querySelector('.dashboard-quicknote-capture-input');nandLanguageTest.capture=input;input.value='未提交看板 draft';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();input.setSelectionRange(2,6)})()`);
	await language('zh'); await language('en');
	assert.deepEqual(await c.evaluate(`(()=>{const input=nandLanguageTest.board.view.contentEl.querySelector('.dashboard-quicknote-capture-input');return {same:input===nandLanguageTest.capture,value:input.value,focused:input===document.activeElement,selection:[input.selectionStart,input.selectionEnd]}})()`), {same:true,value:'未提交看板 draft',focused:true,selection:[2,6]});
	checks.push({ name: 'dashboard-keeps-mounted-input-and-draft', passed: true });
	await language('zh');
	await c.evaluate(`(()=>{const v=nandLanguageTest.board.view;v.openBannerEditModal({...v.data,banner:{...v.data.banner,mode:'quote',quotes:[{quote:'Original quote',author:'Source'}]}});const input=document.querySelector('.modal textarea');nandLanguageTest.bannerDraft=input;input.value='横幅未保存草稿';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();input.setSelectionRange(1,4)})()`);
	await language('en');
	assert.deepEqual(await c.evaluate(`(()=>{const input=nandLanguageTest.bannerDraft;return {connected:input.isConnected,value:input.value,focused:input===document.activeElement,translated:!!Array.from(document.querySelectorAll('.modal button')).find(b=>b.textContent==='Cancel')}})()`), {connected:true,value:'横幅未保存草稿',focused:true,translated:true});
	assert.equal(await c.evaluate(`Array.from(document.querySelectorAll('.dashboard-modal-mode-btn')).every(b=>!/[\u4e00-\u9fff]/.test(b.textContent))`), true);
	await shot('native-banner-draft-en');
	await c.evaluate(`Array.from(document.querySelectorAll('.modal button')).find(b=>b.textContent==='Cancel').click()`);
	checks.push({ name: 'native-modal-labels-preserve-input-node-and-draft', passed: true });
	await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand;await p.openBrowser({url:${JSON.stringify(url)}});nandLanguageTest.browser=app.workspace.getLeavesOfType('nand-browser-view').find(l=>l.view.state.url===${JSON.stringify(url)});nandLanguageTest.leaves.push(nandLanguageTest.browser)})()`);
	await until(`nandLanguageTest.browser?.view.contentEl.querySelector('webview')?.getWebContentsId()`, 'browser guest');
	await pause(350);
	const browserBefore = await c.evaluate(`nandLanguageTest.browser.view.contentEl.querySelector('webview').getWebContentsId()`);
	const before = navigations;
	await language('zh'); await language('en');
	assert.equal(await c.evaluate(`nandLanguageTest.browser.view.contentEl.querySelector('webview').getWebContentsId()`), browserBefore);
	assert.equal(navigations, before);
	checks.push({ name: 'browser-language-keeps-guest-and-navigation', passed: true });
	await c.evaluate(`(async()=>{const p=app.plugins.plugins.nand;nandLanguageTest.service=await p.terminalHost.getTerminalService();nandLanguageTest.terminal=await nandLanguageTest.service.createTerminal({shellType:'powershell',shellArgs:['-NoProfile','-NoLogo'],cwd:app.vault.adapter.basePath,title:'Language fixture'})})()`);
	await until(`nandLanguageTest.terminal?.isAlive()`, 'owned shell');
	const terminalId = await c.evaluate(`nandLanguageTest.terminal.id`);
	await language('zh'); await language('en');
	assert.equal(await c.evaluate(`nandLanguageTest.service.getTerminal(${JSON.stringify(terminalId)})===nandLanguageTest.terminal&&nandLanguageTest.terminal.isAlive()`), true);
	await c.evaluate(`nandLanguageTest.service.destroyTerminal(nandLanguageTest.terminal.id)`);
	checks.push({ name: 'language-keeps-native-session', passed: true });
	await c.evaluate(`(async()=>{const leaf=app.workspace.getLeaf('split');await leaf.setViewState({type:'nand-automation-view',active:true});nandLanguageTest.leaves.push(leaf);nandLanguageTest.popout=leaf;app.workspace.moveLeafToPopout(leaf,{size:{width:960,height:740}})})()`);
	await until(`nandLanguageTest.popout.view.containerEl.ownerDocument!==document`, 'popout');
	await language('zh');
	assert.equal(await c.evaluate(`nandLanguageTest.popout.view.getDisplayText()`), '自动化');
	await language('en');
	assert.equal(await c.evaluate(`nandLanguageTest.popout.view.getDisplayText()`), 'Automations');
	checks.push({ name: 'split-and-popout-language', passed: true });
	await c.evaluate(`(()=>{for(const leaf of nandLanguageTest.leaves)leaf?.detach();nandLanguageTest.leaves=[]})()`);
	await c.evaluate(`(async()=>{await app.plugins.disablePlugin('nand');await app.plugins.enablePlugin('nand')})()`);
	await until(`app.plugins.plugins.nand?.settings.language==='en'`, 'English after plugin reload');
	checks.push({ name: 'english-persisted-across-plugin-reload', passed: true });
} finally {
	try {
		if (original) await c.evaluate(`(async()=>{const a=window.nandLanguageTest,p=app.plugins.plugins.nand;if(a?.save&&p?.settingsStore)p.settingsStore.save=a.save;if(a?.terminal?.isAlive())await a.service.destroyTerminal(a.terminal.id);for(const leaf of a?.leaves??[])leaf?.detach();if(p){if(a?.quickCaptureEnabled!==undefined)p.settings.quickCaptureEnabled=a.quickCaptureEnabled;if(a?.quickNotesEnabled!==undefined)p.settings.quickNotesEnabled=a.quickNotesEnabled;p.settings.modules=${JSON.stringify(original.modules)};await p.changeLanguage(${JSON.stringify(original.language)});}document.body.classList.toggle('theme-light',${!!original?.themeLight});document.body.classList.toggle('theme-dark',${!original?.themeLight});delete window.nandLanguageTest})()`);
		await c.send('Emulation.clearDeviceMetricsOverride');
		await fs.writeFile(path.join(directory, 'acceptance.json'), JSON.stringify({ date: new Date().toISOString(), runtime, checks, passed: checks.length === expectedChecks && checks.every(row => row.passed) }, null, 2));
	} finally { settingsClient?.close(); c.close(); server.close(); }
}
assert.equal(checks.length, expectedChecks);
console.log(JSON.stringify({ passed: true, checks: checks.length }));
