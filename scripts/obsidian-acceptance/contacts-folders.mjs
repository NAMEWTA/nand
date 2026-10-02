// Opt-in acceptance. Every write is limited to the marked, isolated test Vault/profile.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { connect } from './cdp.mjs';

assert.equal(process.env.NAND_ALLOW_WINDOWS_E2E, '1');
assert.ok(process.env.NAND_WINDOWS_E2E_NONCE);
const directory = path.resolve('scripts/tmp/contacts-folders-2026-10-01');
const c = await connect(), rows = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const evaluate = c.evaluate;
c.evaluate = (expression) => evaluate(`(()=>eval(${JSON.stringify(expression)}))()`);
const run = c.evaluate;
const until = async (expression, label) => {
	for (let i = 0; i < 80; i++) { const result = await run(expression); if (result) return result; await delay(100); }
	throw Error('Timeout: ' + label);
};
const click = (selector) => run(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.click()})()`);
const field = (label, value) => run(`(()=>{const r=[...document.querySelectorAll('.nand-contacts-form .setting-item')].find(e=>e.querySelector('.setting-item-name')?.textContent===${JSON.stringify(label)}),i=r?.querySelector('input,textarea');if(!i)throw Error('Missing field '+${JSON.stringify(label)});i.value=${JSON.stringify(value)};i.dispatchEvent(new Event('input',{bubbles:true}));return i.type})()`);
const save = async () => { await click('.nand-contacts-form-footer button.mod-cta'); await until(`!document.querySelector('.nand-contacts-form')`, 'saved form'); };
const shot = async (name) => { await delay(350); await fs.writeFile(path.join(directory, name + '.png'), Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); };
const check = (name, details = {}) => { rows.push({ name, passed: true, ...details }); console.log(name); };

function pdfFixture() {
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R >>','<< /Length 0 >>\nstream\n\nendstream'];
 let data='%PDF-1.4\n',offsets=[0];objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(data));data+=(index+1)+' 0 obj\n'+object+'\nendobj\n';});const start=Buffer.byteLength(data);data+='xref\n0 5\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF';return Buffer.from(data).toString('base64');
}
let original, leafId, root;
try {
	const runtime = await run(`(async()=>({vault:app.vault.adapter.basePath,marker:JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json')),electron:process.versions.electron,profile:window.require('@electron/remote').app.getPath('userData')}))()`);
	assert.equal(runtime.marker.kind, 'nand-windows-e2e');
	assert.equal(runtime.marker.nonce, process.env.NAND_WINDOWS_E2E_NONCE);
	assert.equal(path.resolve(runtime.vault), path.resolve(runtime.marker.vaultPath));
	assert.equal(path.resolve(runtime.vault), path.resolve('scripts/tmp/e2e-2026-09-30/vault'));
	assert.equal(path.resolve(runtime.profile), path.resolve('scripts/tmp/e2e-2026-09-30/profile'));
	await fs.mkdir(directory, { recursive: true });
	await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1.25, mobile: false });
	original = await run(`({root:app.plugins.plugins.nand.settings.contacts.rootFolder,language:app.plugins.plugins.nand.settings.language})`);
	await run(`app.plugins.disablePlugin('nand')`);
	for (const file of ['main.js', 'styles.css']) await fs.copyFile(file, path.join(runtime.vault, '.obsidian/plugins/nand', file));
	await run(`app.plugins.enablePlugin('nand')`);
	root = '档案目录验收-' + Date.now();
	leafId = await run(`(async()=>{const p=app.plugins.plugins.nand;p.settings.language='zh';p.settings.contacts.rootFolder=${JSON.stringify(root)};await p.saveSettings();await p.loadSettings();await p.contactsHost.reload();app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();const l=app.workspace.getLeaf('tab');await l.setViewState({type:'nand-contacts-view',active:true});window.contactsAcceptance=l.view;l.tabHeaderEl.click();return l.id})()`);
	await run(`contactsAcceptance.add('person')`);
	assert.equal(await run(`document.activeElement?.getAttribute('aria-labelledby')===document.querySelector('.nand-contacts-form input').getAttribute('aria-labelledby')`), true);
	assert.equal(await run(`document.querySelectorAll('.nand-contacts-form textarea').length`), 0);
	assert.equal(await run(`document.querySelector('.nand-contacts-conflict-actions').hidden`), true);
	await click('.nand-contacts-form-footer button.mod-cta');
	await until(`document.querySelector('.nand-contacts-field-error')?.textContent`, 'name validation');
	await field('姓名', '王天肖'); await field('当前地区', '纽约'); await field('手机号', '+1 212 0001');
	assert.equal(await field('出生日期', '1990-05-20'), 'date');
	// Real composition events: an IME Enter must not commit a partial tag.
	await field('标签', '朋友');
	const composition = await run(`(()=>{const row=[...document.querySelectorAll('.nand-contacts-form .setting-item')].find(e=>e.querySelector('.setting-item-name')?.textContent==='标签'),i=row.querySelector('input');i.dispatchEvent(new CompositionEvent('compositionstart'));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true}));const during=row.querySelectorAll('.nand-contacts-value-chip').length;i.dispatchEvent(new CompositionEvent('compositionend'));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return {during,after:row.querySelectorAll('.nand-contacts-value-chip').length}})()`);
	assert.deepEqual(composition, { during: 0, after: 1 });
	await run(`(()=>{const row=[...document.querySelectorAll('.nand-contacts-form .setting-item')].find(e=>e.querySelector('.setting-item-name')?.textContent==='固定电话'),i=row.querySelector('input'),d=new DataTransfer();d.setData('text',${JSON.stringify('00123\n00123\n+86 010')});i.dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}))})()`);
	await shot('person-form-dark'); await save();
	const person = await run(`structuredClone(app.plugins.plugins.nand.contactsHost.index.get(contactsAcceptance.state.selectedId))`);
	assert.equal(person.path, root + '/个人档案/王天肖/基本信息.md'); assert.deepEqual(person.fields.phones, ['00123', '+86 010']); assert.deepEqual(person.fields.tags, ['朋友']);
	check('native-form-required-focus-ime-paste-create', { path: person.path, composition });
	await run(`contactsAcceptance.add('person')`); await field('姓名', '晶晶'); await save();
	await run(`contactsAcceptance.add('person')`); await field('姓名', '王天肖'); await save();
	const duplicate = await run(`contactsAcceptance.state.selectedPath`); assert.notEqual(duplicate, person.path); assert.match(duplicate, /王天肖-[\w-]+\/基本信息.md$/);
	await run(`contactsAcceptance.add('company')`); await field('企业名称', '示例科技'); await field('固定电话', '001234'); await field('邮箱', 'info@example.com'); await save();
	const company = await run(`structuredClone(app.plugins.plugins.nand.contactsHost.index.get(contactsAcceptance.state.selectedId))`); assert.deepEqual(company.fields.phones, ['001234']); assert.deepEqual(company.fields.emails, ['info@example.com']);
	check('separate-names-and-company-contact-persistence');
	await run(`contactsAcceptance.edit(app.plugins.plugins.nand.contactsHost.index.get('${company.id}'),'basic')`);
	await until(`!!document.querySelector('.nand-contacts-form')`, 'company edit');
	await field('企业地区','面板草稿');
	await run(`(async()=>{const c=app.plugins.plugins.nand.contactsHost,b=await c.snapshot(${JSON.stringify(company.path)}),d=structuredClone(b);d.fields.region='外部修改';await c.save(b,d)})()`);
	await click('.nand-contacts-form-footer button.mod-cta');
	await until(`document.querySelector('.nand-contacts-form .nand-contacts-error')?.textContent`, 'conflict error');
	assert.equal(await run(`document.querySelector('.nand-contacts-conflict-actions').hidden`),false);
	assert.equal(await run(`document.activeElement.value`),'面板草稿');
	await click('.nand-contacts-form-footer button:not(.mod-cta)');
	await run(`[...document.querySelectorAll('.modal-container button.mod-cta')].find(e=>e.textContent==='放弃修改').click()`);
	await until(`!document.querySelector('.nand-contacts-form')`, 'discard conflict draft');
	check('native-conflict-retains-draft-and-focus');
	await run(`contactsAcceptance.select(${JSON.stringify(person.path)});contactsAcceptance.leaf.tabHeaderEl.click()`);
	await run(`contactsAcceptance.newNote(app.plugins.plugins.nand.contactsHost.index.get(${JSON.stringify(person.id)}))`);
	await run(`(()=>{const i=document.querySelector('.modal-content input');i.value='初次沟通';i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.modal-content button.mod-cta').click()})()`);
	await until(`app.workspace.getLeavesOfType('markdown').some(l=>l.view.file?.path===${JSON.stringify(person.folderPath + '/初次沟通.md')})`, 'native note editor');
	await run(`contactsAcceptance.leaf.tabHeaderEl.click()`);
	// Import File objects through the same host callback as file picker and drop.
	await run(`(()=>{const image=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jO1sAAAAASUVORK5CYII='),c=>c.charCodeAt(0));contactsAcceptance.addResources(app.plugins.plugins.nand.contactsHost.index.get(${JSON.stringify(person.id)}),[new File([Uint8Array.from(atob('${pdfFixture()}'),c=>c.charCodeAt(0))],'简历.pdf'),new File([image],'图片.png'),new File(['duplicate'],'简历.pdf')])})()`);
	await until(`app.plugins.plugins.nand.contactsHost.resources(${JSON.stringify(person.id)}).length===4`, 'file imports');
	await run(`(async()=>{await app.vault.createFolder(${JSON.stringify(person.folderPath + '/项目资料')});await app.vault.create(${JSON.stringify(person.folderPath + '/项目资料/合作说明.md')},'# 合作说明');})()`);
	await until(`contactsAcceptance.contentEl.querySelectorAll('button.nand-contacts-resource-row').length===5`, 'nested live resources');
	await shot('detail-dark-wide');
	const firstScreen = await run(`(()=>{const e=contactsAcceptance.contentEl.querySelector('button.nand-contacts-resource-row');return {bottom:e.getBoundingClientRect().bottom,height:innerHeight,overflow:contactsAcceptance.contentEl.scrollWidth-contactsAcceptance.contentEl.clientWidth}})()`);
	assert.ok(firstScreen.bottom > 0 && firstScreen.bottom < firstScreen.height); assert.ok(firstScreen.overflow <= 1);
	check('same-page-live-recursive-resources-native-note', firstScreen);
	await run(`(()=>{const i=contactsAcceptance.contentEl.querySelector('.nand-contacts-resource-toolbar input');i.value='项目资料';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
	await run(`app.vault.create(${JSON.stringify(person.folderPath + '/项目资料/第二份.md')},'two').then(()=>true)`);
	await until(`contactsAcceptance.contentEl.querySelectorAll('button.nand-contacts-resource-row').length===2`, 'search retained');
	const renamedFolder = root + '/个人档案/王天肖重命名';
	await run(`app.fileManager.renameFile(app.vault.getAbstractFileByPath(${JSON.stringify(person.folderPath)}),${JSON.stringify(renamedFolder)})`);
	await until(`contactsAcceptance.state.selectedPath===${JSON.stringify(renamedFolder + '/基本信息.md')}`, 'stable identity after rename');
	assert.equal(await run(`contactsAcceptance.contentEl.querySelector('.nand-contacts-resource-toolbar input').value`), '项目资料');
	check('search-survives-external-files-and-folder-rename');
	// A valid controlled PDF opens in the native viewer.
	await run(`contactsAcceptance.openResource(${JSON.stringify(renamedFolder + '/简历.pdf')})`);
	await until(`app.workspace.getLeavesOfType('pdf').some(l=>l.view.file?.path===${JSON.stringify(renamedFolder + '/简历.pdf')})`, 'native PDF leaf');
	await until(`app.workspace.getLeavesOfType('pdf').some(l=>l.view.file?.path===${JSON.stringify(renamedFolder + '/简历.pdf')}&&l.view.contentEl.querySelector('canvas'))`, 'PDF rendered canvas');
	check('native-pdf-rendering');
	await run(`contactsAcceptance.leaf.tabHeaderEl.click()`);
	for (const dark of [false, true]) {
		await run(`document.body.classList.toggle('theme-dark',${dark});document.body.classList.toggle('theme-light',${!dark});true`);
		await run(`contactsAcceptance.edit(app.plugins.plugins.nand.contactsHost.index.get(${JSON.stringify(person.id)}),'basic')`);
		await until(`!!document.querySelector('.nand-contacts-form')`, 'edit form');
		await c.send('Emulation.setDeviceMetricsOverride', { width: 480, height: 850, deviceScaleFactor: 1.25, mobile: false }); await delay(150);
		const form = await run(`(()=>{const m=document.querySelector('.nand-contacts-form'),b=m.querySelector('.nand-contacts-form-body'),f=m.querySelector('.nand-contacts-form-footer');return {width:m.getBoundingClientRect().width,overflow:m.scrollWidth-m.clientWidth,footer:f.getBoundingClientRect().bottom,height:innerHeight,scroll:b.scrollHeight>b.clientHeight}})()`);
		assert.ok(form.width <= 640); assert.ok(form.overflow <= 1); assert.ok(form.footer <= form.height); assert.ok(form.scroll);
		await shot('form-' + (dark ? 'dark' : 'light') + '-narrow');
		await click('.nand-contacts-form-footer button:not(.mod-cta)'); check('native-form-theme-narrow-' + dark, form);
	}
	await c.send('Emulation.clearDeviceMetricsOverride');
	// Native file-input selection copies a real local file; a drop uses the same import queue.
	const sourcePath = path.join(directory, 'picker-source.txt'); await fs.writeFile(sourcePath, 'local picker source');
	await c.send('Page.setInterceptFileChooserDialog', { enabled: true });
	await run(`contactsAcceptance.addResources(app.plugins.plugins.nand.contactsHost.index.get(${JSON.stringify(person.id)}))`);
	const documentNode = await c.send('DOM.getDocument');
	const inputNode = await c.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '.nand-contacts-view input[type=file]' });
	await c.send('DOM.setFileInputFiles', { nodeId: inputNode.nodeId, files: [sourcePath] });
	await until(`!!app.vault.getFileByPath(${JSON.stringify(renamedFolder + '/picker-source.txt')})`, 'picker copied');
	await c.send('Page.setInterceptFileChooserDialog', { enabled: false });
	assert.equal(await fs.readFile(sourcePath, 'utf8'), 'local picker source');
	await run(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File(['dropped'],'drop.txt'));contactsAcceptance.contentEl.querySelector('.nand-contacts-resources').dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}))})()`);
	await until(`!!app.vault.getFileByPath(${JSON.stringify(renamedFolder + '/drop.txt')})`, 'drop copied');
	check('native-picker-and-file-drop-copy');
	void run(`contactsAcceptance.remove(app.plugins.plugins.nand.contactsHost.index.get('${person.id}'))`);
	await until(`!!document.querySelector('.modal-container button.mod-cta')`, 'whole folder confirmation');
	assert.ok(await run(`document.querySelector('.modal-container').textContent.includes(${JSON.stringify(renamedFolder)})`));
	await run(`[...document.querySelectorAll('.modal-container button')].find(e=>e.textContent==='取消').click()`);
	check('delete-confirmation-shows-folder');
	// Confirmation scope cannot silently grow while the modal is open.
	const ticket = await run(`app.plugins.plugins.nand.contactsHost.deletion(${JSON.stringify(person.id)})`);
	await run(`app.plugins.plugins.nand.contactsHost.createNote(${JSON.stringify(person.id)},'确认后新增')`);
	await assert.rejects(run(`app.plugins.plugins.nand.contactsHost.remove(${JSON.stringify(ticket)})`), /deleteChanged/);
	const fresh = await run(`app.plugins.plugins.nand.contactsHost.deletion(${JSON.stringify(person.id)})`);
	const restore = await run(`(async()=>{const f=app.vault.getAbstractFileByPath(${JSON.stringify(renamedFolder)}),files=[];const walk=async(d)=>{for(const child of d.children){if(child.children)await walk(child);else files.push({path:child.path,bytes:Array.from(new Uint8Array(await app.vault.readBinary(child)))})}};await walk(f);return files})()`);
	await run(`app.plugins.plugins.nand.contactsHost.remove(${JSON.stringify(fresh)})`);
	assert.equal(await run(`!!app.vault.getAbstractFileByPath(${JSON.stringify(renamedFolder)})`), false);
	assert.equal(await run(`!!app.vault.getFileByPath(${JSON.stringify(company.path)})`), true);
	await run(`(async()=>{for(const f of ${JSON.stringify(restore)}){let parent='';for(const segment of f.path.split('/').slice(0,-1)){parent=parent?parent+'/'+segment:segment;if(!app.vault.getAbstractFileByPath(parent))await app.vault.createFolder(parent)}await app.vault.createBinary(f.path,new Uint8Array(f.bytes).buffer)}})()`);
	await until(`!!app.plugins.plugins.nand.contactsHost.index.get(${JSON.stringify(person.id)})`, 'restored stable ID');
	check('whole-folder-delete-scope-and-restore', { resources: fresh.resources });
	await run(`contactsAcceptance.select(${JSON.stringify(renamedFolder + '/基本信息.md')})`);
	const secondId = await run(`(async()=>{const l=app.workspace.getLeaf('split');await l.setViewState({type:'nand-contacts-view',state:{selectedId:${JSON.stringify(person.id)},selectedPath:${JSON.stringify(renamedFolder + '/基本信息.md')}}});return l.id})()`);
	await run(`app.vault.create(${JSON.stringify(renamedFolder + '/分屏.md')},'split').then(()=>true)`);
	await until(`app.workspace.getLeavesOfType('nand-contacts-view').filter(l=>[${JSON.stringify(leafId)},${JSON.stringify(secondId)}].includes(l.id)).every(l=>l.view.contentEl.innerText.includes('分屏.md'))`, 'split live update');
	await shot('detail-split'); await run(`app.workspace.getLeafById(${JSON.stringify(secondId)}).detach()`);
	check('split-pane-live-update');
	await run(`(async()=>{await app.plugins.disablePlugin('nand');await app.plugins.enablePlugin('nand');await app.plugins.plugins.nand.contactsHost.ensureLoaded()})()`);
	assert.equal(await run(`app.plugins.plugins.nand.contactsHost.index.get(${JSON.stringify(person.id)}).folderPath`), renamedFolder);
	check('module-reload-rebuild');
	await fs.writeFile(path.join(directory, 'result.json'), JSON.stringify({ passed: true, runtime, root, personId: person.id, companyId: company.id, rows }, null, 2));
} catch (error) {
	await shot('failure').catch(() => {});
	await fs.writeFile(path.join(directory, 'failure.json'), JSON.stringify({ error: String(error), rows }, null, 2));
	throw error;
} finally {
	await c.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
	if (original) await run(`(async()=>{const p=app.plugins.plugins.nand;p.settings.contacts.rootFolder=${JSON.stringify(original.root)};p.settings.language=${JSON.stringify(original.language)};await p.saveSettings();await p.loadSettings();await p.contactsHost.reload();app.workspace.getLeafById(${JSON.stringify(leafId)})?.detach()})()`).catch(() => {});
	c.close();
}
