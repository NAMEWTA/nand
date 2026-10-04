import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {connect} from './cdp.mjs';
import {delay,language,dir,shot} from './common.mjs';
const c=await connect(),rows=[];
const types=['nand-dashboard-view','nand-editor-view','nand-contacts-view','nand-automation-view','terminal-view','nand-browser-view'];
const expected={en:['Dashboard','Editor','Archives','Automations','Agents','Browser'],zh:['看板','编辑器','档案','自动化','智能体','浏览器']};
try{
	assert.equal(process.env.NAND_ALLOW_WINDOWS_E2E,'1');
	const runtime=await c.evaluate(`(async()=>({vault:app.vault.adapter.basePath,marker:JSON.parse(await app.vault.adapter.read('.nand-e2e-isolated.json'))}))()`);
	assert.equal(runtime.marker.nonce,process.env.NAND_WINDOWS_E2E_NONCE);assert.equal(runtime.marker.vaultPath,runtime.vault);
	if(process.argv.includes('--verify-restart')){
		const saved=JSON.parse(await fs.readFile(`${dir}/restart-state.json`,'utf8'));
		const after=await c.evaluate(`(${JSON.stringify(saved)}).map(s=>{const l=app.workspace.getLeafById(s.id);return {id:s.id,title:l?.getViewState().title,deferred:l?.isDeferred}})`);
		for(let n=0;n<saved.length;n++){assert.equal(after[n].title,saved[n].title);assert.equal(after[n].deferred,true)}
		await fs.writeFile(`${dir}/restart-result.json`,JSON.stringify({passed:true,after},null,2));console.log('Restart titles passed');
	}else{
		await c.evaluate(`(async()=>{for(const s of window.issueTitleLeaves||[])app.workspace.getLeafById(s.id)?.detach();for(const l of window.issueTitleAnchors||[])l.detach();window.issueTitleOriginalTerminal=app.plugins.plugins.nand.settings.modules.terminal;const p=app.plugins.plugins.nand;p.settings.modules.terminal=false;await p.saveSettings();await p.loadSettings();app.setting.close();window.issueTitleLeaves=[];window.issueTitleAnchors=[];for(let win=0;win<2;win++){const anchor=app.workspace.getLeaf('tab');const anchorPath='R21 title anchor '+win+'.md';let anchorFile=app.vault.getFileByPath(anchorPath);if(!anchorFile)anchorFile=await app.vault.create(anchorPath,'Native title acceptance anchor');await anchor.openFile(anchorFile);issueTitleAnchors.push(anchor);if(win)app.workspace.moveLeafToPopout(anchor,{size:{width:1050,height:800}});for(const type of ${JSON.stringify(types)}){const l=app.workspace.createLeafInParent(anchor.parent,anchor.parent.children.length);await l.setViewState({type,active:false,state:{},title:type});issueTitleLeaves.push({id:l.id,type,win});}app.workspace.setActiveLeaf(anchor,{focus:true});}app.workspace.setActiveLeaf(issueTitleAnchors[0],{focus:true});app.workspace.setActiveLeaf(issueTitleAnchors[1],{focus:true});await new Promise(r=>setTimeout(r,100));await app.plugins.disablePlugin('nand');await app.plugins.enablePlugin('nand');await new Promise(r=>setTimeout(r,400));})()`);
		for(const lang of ['en','zh']){
			await language(c,lang);await delay(400);
			const state=await c.evaluate(`issueTitleLeaves.map(s=>{const l=app.workspace.getLeafById(s.id);return {...s,title:l.getViewState().title,header:l.tabHeaderEl.innerText,deferred:l.isDeferred,main:l.view.containerEl.ownerDocument===document}})`);
			for(const s of state){assert.equal(s.deferred,true);const title=expected[lang][types.indexOf(s.type)];assert.equal(s.title,title);assert.equal(s.header,title);assert.equal(s.main,s.win===0)}
			rows.push({lang,state});await shot(c,`main-${lang}`);
		}
		// A custom persisted title must survive language changes and a process restart.
		await c.evaluate(`(()=>{const l=app.workspace.getLeafById(issueTitleLeaves.find(s=>s.type==='nand-browser-view').id);l.view.title='Custom acceptance page';l.updateHeader();app.workspace.requestSaveLayout()})()`);
		await language(c,'en');await delay(250);
		assert.equal(await c.evaluate(`app.workspace.getLeafById(issueTitleLeaves.find(s=>s.type==='nand-browser-view').id).getViewState().title`),'Custom acceptance page');
		const state=await c.evaluate(`issueTitleLeaves.map(s=>{const l=app.workspace.getLeafById(s.id);return {id:s.id,title:l.getViewState().title,deferred:l.isDeferred}})`);
		await fs.writeFile(`${dir}/restart-state.json`,JSON.stringify(state,null,2));
		await fs.writeFile(`${dir}/result.json`,JSON.stringify({passed:true,rows},null,2));console.log('Two-window titles passed; restart verification prepared');
	}
}catch(error){await fs.writeFile(`${dir}/partial.json`,JSON.stringify({error:String(error),rows},null,2));throw error;}finally{c.close()}
