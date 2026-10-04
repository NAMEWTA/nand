// Opt-in native API/UI acceptance. All generated plugins, notes and attachments stay in the marked test Vault.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { builtinModules } from 'node:module';
import { build } from 'esbuild';
import { connect } from './cdp.mjs';
import { delay, language, escape, shot } from './common.mjs';
assert.equal(process.env.NAND_ALLOW_BROWSER_E2E, '1');
assert.ok(process.env.NAND_WINDOWS_E2E_NONCE);
assert.ok(path.isAbsolute(process.env.NAND_ACCEPTANCE_DIR || ''));
assert.ok(process.env.NAND_EXPECT_MAIN_SHA);
const dir = process.env.NAND_ACCEPTANCE_DIR;
await fs.mkdir(dir, { recursive: true });
const c = await connect(), checks = [];
const check = (name, result = {}) => { checks.push({ name, passed: true, ...result }); console.log(name, JSON.stringify(result)); };
const run = expression => c.evaluate(`(()=>eval(${JSON.stringify(expression)}))()`);
async function until(expression, label, timeout = 10000) {
	const deadline = Date.now() + timeout;
	do { const result = await run(expression); if (result) return result; await delay(60); } while (Date.now() < deadline);
	throw Error(`Timed out: ${label}`);
}
const fixture = http.createServer((_req, res) => { res.setHeader('Content-Type','text/html'); res.end('<!doctype html><title>Issue fixture</title><h1>NAND fixture</h1><p>domain domain</p><input aria-label="Website input">'); });
const helperId = 'nand-issue-acceptance';
let helperPath, runtime;
try {
	runtime = await run(`(async()=>({vault:app.vault.adapter.basePath,marker:JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json')),profile:window.require('@electron/remote').app.getPath('userData'),version:app.version,sha:window.require('crypto').createHash('sha256').update(window.require('fs').readFileSync(app.vault.adapter.basePath+'/.obsidian/plugins/nand/main.js')).digest('hex')}))()`);
	assert.equal(runtime.marker.nonce, process.env.NAND_WINDOWS_E2E_NONCE);
	assert.equal(path.resolve(runtime.marker.vaultPath), path.resolve(runtime.vault));
	assert.equal(runtime.sha, process.env.NAND_EXPECT_MAIN_SHA);
	assert.equal(createHash('sha256').update(await fs.readFile('main.js')).digest('hex'), runtime.sha);
	await run(`app.setting.close()`);
	await language(c, 'en');
	await escape(c);
	await until(`app.plugins.plugins.nand.habitService?.isLoading===false`, 'habit startup');
	const habits = await run(`app.plugins.plugins.nand.habitService.getHabits()`);
	assert.ok(habits.some(h => h.name === 'Read 20 pages'));
	check('native-startup-habit-present', { habits });
	if (process.argv.includes('--startup-only')) {
		await fs.writeFile(path.join(dir,'startup.json'),JSON.stringify({runtime,checks},null,2));
	} else {
		await run(`app.plugins.plugins.nand.openDashboard()`);
		await until(`!!app.workspace.getLeavesOfType('nand-dashboard-view')[0]?.view.data`, 'dashboard data');
		await run(`(()=>{const l=app.workspace.getLeavesOfType('nand-dashboard-view')[0];l.tabHeaderEl.click();l.view.sidebarPinned=true;l.view.render(l.view.data)})()`);
		await until(`document.querySelector('.dashboard-sidebar-habit')?.textContent.includes('Read 20 pages')`, 'habit widget');
		assert.equal(await run(`document.querySelectorAll('.dashboard-sidebar-habit .nand-save-status--saved,.dashboard-sidebar-pomodoro .nand-save-status--saved').length`),0);
		check('native-widgets-no-persistent-saved-label');

		// Exercise production picker classes with the REAL Obsidian API, not the Node test stub.
		helperPath = path.join(runtime.vault,'.obsidian/plugins',helperId); await fs.mkdir(helperPath,{recursive:true});
		const entry = `import {Plugin} from 'obsidian';
import {RecentSessionModal} from './src/view/terminal/recent-session-modal';
import {AutomationSessionPicker} from './src/view/automations/session-picker';
import {IconPickerModal} from './src/view/dashboard/ui/icon-picker-modal';
import {pickContextMaterial} from './src/view/terminal/context-material-picker';
import {chooseRecord} from './src/view/contacts/forms';
import {ThemeStudioModal} from './src/view/dashboard/appearance/theme-studio-modal';
import {setLanguage} from './src/shared/i18n';
export default class extends Plugin {
 async onload(){const marker=JSON.parse(await this.app.vault.adapter.read('.nand-e2e-isolated.json'));if(marker.nonce!==${JSON.stringify(runtime.marker.nonce)})throw Error('Wrong test Vault');}
 openPicker(kind){const p=this.app.plugins.plugins.nand;setLanguage(p.settings.language);this.result=undefined;
 if(kind==='recent')this.modal=new RecentSessionModal(this.app,p.terminalHost?._terminalService?.getAllTerminals()??[],x=>{this.result=x.id});
 if(kind==='automation')this.modal=new AutomationSessionPicker(this.app,[],x=>{this.result=x.id});
 if(kind==='icons')this.modal=new IconPickerModal(this.app,x=>{this.result=x});
 if(kind==='person'||kind==='company'){void chooseRecord(p.contactsHost,kind).then(x=>{this.result=x?.id??null});return;}
 if(kind==='context'){void pickContextMaterial(this.app).then(x=>{this.result=x??null});return;}
 if(kind==='background'){this.modal=new ThemeStudioModal(this.app,{settings:p.settings,saveSettings:()=>p.saveSettings()});this.modal.open();this.modal.contentEl.querySelector('.dashboard-theme-studio-browse').click();return;}
 this.modal.open(); }
 onunload(){this.modal?.close();}
}`;
		const helper = await build({stdin:{contents:entry,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',target:'es2021',write:false,external:['obsidian','electron','@electron/remote','@codemirror/*','@lezer/*',...builtinModules,...builtinModules.map(n=>'node:'+n)],loader:{'.svg':'text','.md':'text'}});
		await fs.writeFile(path.join(helperPath,'main.js'),helper.outputFiles[0].contents);
		await fs.writeFile(path.join(helperPath,'manifest.json'),JSON.stringify({id:helperId,name:'NAND isolated acceptance',version:'0.0.0',minAppVersion:'1.12.0',isDesktopOnly:true,description:'Isolated acceptance only.',author:'NAND tests'}));
		await run(`(async()=>{await app.plugins.loadManifests();await app.plugins.enablePlugin('${helperId}')})()`);
		for(const kind of ['recent','automation','icons','person','company','context','background']) {
			await run(`app.plugins.plugins['${helperId}'].openPicker(${JSON.stringify(kind)})`);
			await until(`!!activeDocument.querySelector('.prompt-input')`,'native picker '+kind);
			await run(`(()=>{const i=activeDocument.querySelector('.prompt-input');i.value='query 中文';i.dispatchEvent(new i.win.Event('input',{bubbles:true}))})()`);
			await language(c,'zh');
			assert.equal(await run(`activeDocument.querySelector('.prompt-input').value`),'query 中文');
			await language(c,'en');
			const placeholder=await run(`activeDocument.querySelector('.prompt-input').placeholder`);
			assert.ok(placeholder && !placeholder.includes('terminalAgent.') && !placeholder.includes('contacts.'));
			await escape(c);
			await until(`!activeDocument.querySelector('.prompt-input')`,'picker closes '+kind);
			if(kind==='background'){await run(`app.plugins.plugins['${helperId}'].modal.close()`);}
			if(kind==='context'||kind==='person'||kind==='company') await until(`app.plugins.plugins['${helperId}'].result===null`,'cancel resolves '+kind);
			check('native-picker-'+kind,{placeholder});
		}
		await run(`app.plugins.disablePlugin('${helperId}')`);

		// Original immediate-disable/enable comment deletion race, using real commands and buttons.
		for(let n=0;n<3;n++) {
			const note=`Comment reload ${n}.md`;
			await run(`(async()=>{let f=app.vault.getFileByPath(${JSON.stringify(note)});if(!f)f=await app.vault.create(${JSON.stringify(note)},'alpha beta gamma');const l=app.workspace.getLeaf('tab');await l.openFile(f);app.workspace.setActiveLeaf(l,{focus:true});l.view.editor.setSelection({line:0,ch:0},{line:0,ch:5});app.commands.executeCommandById('nand:add-comment-to-selection')})()`);
			await until(`!!activeDocument.querySelector('.nand-editor-comment-prompt')`,'comment prompt');
			await run(`(()=>{const i=activeDocument.querySelector('.nand-editor-comment-prompt');i.value='Delete me ${n}';i.dispatchEvent(new i.win.Event('input',{bubbles:true}));activeDocument.querySelector('.nand-editor-comment-prompt-row .mod-cta').click()})()`);
			await until(`(async()=>{try{return JSON.parse(await app.vault.adapter.read('.nand/editor/comments/index.json')).files[${JSON.stringify(note)}]?.total===1}catch{return false}})()`,'comment persisted');
			await run(`app.plugins.plugins.nand.openEditorView()`);
			await until(`!!document.querySelector('.nand-editor-comment-more')`,'comment card');
			await run(`(async()=>{document.querySelector('.nand-editor-comment-more').click();const item=[...activeDocument.querySelectorAll('.menu-item')].find(e=>e.textContent.includes('Delete'));if(!item)throw Error('Delete menu missing');item.click();await app.plugins.disablePlugin('nand');await app.plugins.enablePlugin('nand');await app.plugins.plugins.nand.openEditorView()})()`);
			await delay(400);
			const result=await run(`(async()=>({cards:document.querySelectorAll('.nand-editor-comment').length,index:JSON.parse(await app.vault.adapter.read('.nand/editor/comments/index.json')).files[${JSON.stringify(note)}]??null,pending:await app.vault.adapter.exists('.nand/editor/comments/pending.json'),body:await app.vault.read(app.vault.getFileByPath(${JSON.stringify(note)}))}))()`);
			assert.equal(result.cards,0);assert.equal(result.index,null);assert.equal(result.pending,false);assert.equal(result.body,'alpha beta gamma');
			check('native-comment-immediate-reload-'+n,result);
		}

		// Real Chromium/Electron focus and localized ribbon behavior.
		await run(`app.workspace.getLeavesOfType('nand-browser-view').forEach(l=>l.detach())`);
		await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));
		const page=await run(`app.plugins.plugins.nand.browserHost.open({url:'http://127.0.0.1:${fixture.address().port}',target:'tab'})`);
		await until(`!!app.plugins.plugins.nand.browserHost.pages.get('${page}')?.guest`,'browser guest');
		await until(`(()=>{const b=document.querySelector('.nand-browser-panel [title="Find in page"]');return !!b&&!b.disabled})()`,'find enabled');
		await run(`(()=>{const panel=document.querySelector('.nand-browser-panel[data-page-id="${page}"]');panel.querySelector('input.nand-browser-address').focus();panel.querySelector('[title="Find in page"]').click()})()`);
		await until(`document.activeElement===document.querySelector('.nand-browser-find input')`,'find gains focus');
		await c.send('Input.insertText',{text:'domain'});
		assert.equal(await run(`document.querySelector('.nand-browser-find input').value`),'domain');
		await escape(c); await until(`!document.querySelector('.nand-browser-find')`,'Esc closes find');
		await run(`document.querySelector('input.nand-browser-address').focus()`);
		const focus=await run(`(()=>{const i=document.querySelector('input.nand-browser-address');return {input:getComputedStyle(i).outlineStyle,outer:getComputedStyle(i.closest('form')).outlineStyle}})()`);
		assert.equal(focus.input,'none');assert.equal(focus.outer,'solid');
		const ribbon=await run(`app.workspace.leftRibbon.items.find(i=>i.id.includes('ribbon-globe'))?.id`);assert.ok(ribbon);
		await language(c,'zh');assert.equal(await run(`app.workspace.leftRibbon.items.find(i=>i.id===${JSON.stringify(ribbon)}).title`),'打开网页');
		await language(c,'en');assert.equal(await run(`app.workspace.leftRibbon.items.find(i=>i.id===${JSON.stringify(ribbon)}).title`),'Open web page');
		check('native-browser-focus-escape-and-ribbon',{focus,ribbon});
		await shot(c,'open-issues-browser');
		await fs.writeFile(path.join(dir,'open-issues.json'),JSON.stringify({runtime,checks},null,2));
	}
} catch(error) {
	await fs.writeFile(path.join(dir,'open-issues-partial.json'),JSON.stringify({runtime,checks,error:String(error)},null,2));
	throw error;
} finally {
	try{await run(`app.plugins.plugins['${helperId}']&&app.plugins.disablePlugin('${helperId}')`);}catch{}
	if(helperPath)await fs.rm(helperPath,{recursive:true,force:true});
	fixture.closeAllConnections();fixture.close();c.close();
}
