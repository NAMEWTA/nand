// #141: actual desktop viewports and a narrow leaf in a wide Obsidian window.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const board = '---\nbanner:\n  quote: "Small steps each day make room for meaningful progress."\n  author: "Layout fixture"\n---\n\n## Review section\n\n### Visible card\n\nContent follows the shortcut bar.\n';
const runtime = await launchFreshVault({ root: process.argv[2], port: 9260, files: { 'dashboard.md': board, 'Welcome.md': '# Fixture note\n' }, settings: { version: 1, namespaces: {
	app: { language: 'en', introSeen: true, modules: { home: true, archives: false, automations: false, icons: false, agent: false, browser: false, news: false, sync: false, comments: false, notifications: false } },
	home: { quickNotesEnabled: true, widgetLunarEnabled: false, widgetWeatherEnabled: false, widgetMusicEnabled: false, widgetQuickActionsEnabled: false, pomodoroEnabled: false },
} } });
const c = runtime.connection, rows = [];
const check = (name, passed, detail) => rows.push({ name, passed, detail });
const until = async expression => {
	const deadline = Date.now() + 15000;
	while (Date.now() < deadline) { if (await c.evaluate(expression)) return; await delay(60); }
	throw Error(`Condition timed out: ${expression}`);
};
const press = async key => {
	const windowsVirtualKeyCode = { Tab:9, Enter:13, Escape:27 }[key];
	await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode, ...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{}) });
	await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode });
	await delay(60);
};
const measure = () => c.evaluate(`(()=>{
	const root=document.querySelector('.nand-dashboard-root'), q=root.querySelector('.dashboard-main > .dashboard-quicknote');
	const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
	const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
	const buttons=[...root.querySelectorAll('.dashboard-workspace-btn')].map(e=>({tag:e.tagName,label:e.getAttribute('aria-label'),...rect(e)}));
	const quote=root.querySelector('.dashboard-banner-quote'), range=document.createRange();range.selectNodeContents(quote);
	const lines=[...range.getClientRects()].map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom}));
	return {viewport:innerWidth,root:rect(root),quicknote:rect(q),basis:getComputedStyle(q).flexBasis,region:rect(q.nextElementSibling),
		calendar:rect(root.querySelector('.nand-workbench-home-overview')),banner:rect(root.querySelector('.dashboard-banner')),
		quote:rect(quote),lines,buttons,overlap:buttons.some(b=>lines.some(l=>overlap(b,l))),
		capture:q.querySelector('textarea')?rect(q.querySelector('textarea')):null,
		horizontalOverflow:q.scrollWidth>q.clientWidth+1,layout:root.dataset.layout};
})()`);
try {
	await c.evaluate(`app.workspace.leftSplit.expand();app.workspace.rightSplit.collapse();app.plugins.plugins.nand.openWorkbench({feature:'dashboard'})`);
	await until(`!!document.querySelector('.dashboard-main > .dashboard-quicknote')`);
	await c.evaluate(`window.homeLeaf=app.workspace.getLeavesOfType('nand-workbench-view')[0];true`);
	for (const language of ['en', 'zh']) {
		await c.evaluate(`app.plugins.plugins.nand.changeLanguage(${JSON.stringify(language)})`);
		for (const width of [639, 640, 641, 660, 1400]) {
			await c.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: false });
			await delay(150);
			for (const state of ['empty', 'populated', 'capture']) {
				const presets = state === 'empty' ? [] : [{ id: 'review', label: 'Create a note', icon: 'file-plus', templatePath: '', folder: '', filename: '{{date}}' }];
				await c.evaluate(`app.plugins.plugins.nand.settingsNamespace('home').update(d=>{d.quickNotePresets=${JSON.stringify(presets)};d.quickCaptureEnabled=${state === 'capture'}});homeLeaf.view.getNativeSurfaces().find(s=>s.getViewType()==='nand-dashboard-view').refresh()`);
				await delay(200);
				await until(`!!document.querySelector('.dashboard-main > .dashboard-quicknote')`);
				let collapsed;
				if (state === 'capture') {
					await until(`!!document.querySelector('.dashboard-quicknote-capture-input')`);
					collapsed=await measure();
					await c.evaluate(`(()=>{const e=document.querySelector('.dashboard-quicknote-capture-input');e.value=${JSON.stringify('Line one\nLine two\nLine three\nLine four\nLine five')};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
					await delay(80);
				}
				const m = await measure();
				check(`${language}-${width}-${state}-natural-height`, m.basis==='auto'&&m.quicknote.height<300&&m.region.top-m.quicknote.bottom<24&&m.calendar.top<740&&!m.horizontalOverflow, m);
				check(`${language}-${width}-${state}-quote-clear`, !m.overlap&&m.lines.every(l=>l.top>=m.banner.top&&l.bottom<=m.banner.bottom), {banner:m.banner,lines:m.lines,buttons:m.buttons});
				check(`${language}-${width}-${state}-button-targets`,m.buttons.every(b=>b.tag==='BUTTON'&&b.label&&b.width>=32&&b.height>=32));
				if (collapsed) check(`${language}-${width}-capture-grows`, m.quicknote.height>collapsed.quicknote.height&&m.capture.height>collapsed.capture.height, {before:collapsed.quicknote,after:m.quicknote});
				if (width===640||width===641) await runtime.shot(`home-${language}-${width}-${state}`);
			}
		}
		await c.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 740, deviceScaleFactor: 1, mobile: false });
		await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'settings',section:'general'})`);
		await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard'})`);
		await until(`!!document.querySelector('.dashboard-main > .dashboard-quicknote')`);
		const returned=await measure();
		check(`${language}-return-home`, returned.basis==='auto'&&returned.quicknote.height<300,returned);
	}
	await c.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 740, deviceScaleFactor: 1, mobile: false });
	await c.evaluate(`(async()=>{window.otherLeaf=app.workspace.getLeaf('split','vertical');await otherLeaf.openFile(app.vault.getAbstractFileByPath('Welcome.md'));homeLeaf.containerEl.style.flex='0 0 320px';await app.workspace.revealLeaf(homeLeaf);})()`);
	await delay(200);
	const narrow=await measure();
	check('wide-window-narrow-leaf', narrow.viewport===1400&&narrow.root.width<360&&narrow.basis==='auto'&&narrow.quicknote.height<300&&!narrow.horizontalOverflow&&!narrow.overlap,narrow);
	await runtime.shot('home-wide-narrow-leaf');
	await c.evaluate(`otherLeaf.detach();homeLeaf.containerEl.style.removeProperty('flex');true`);
	await c.send('Emulation.setDeviceMetricsOverride', { width: 640, height: 740, deviceScaleFactor: 1, mobile: false });
	await c.send('Page.bringToFront');
	await delay(250);
	await c.evaluate(`document.querySelector('.dashboard-workspace-btn').focus()`);
	await press('Tab');
	const focus=await c.evaluate(`({add:document.activeElement.matches('.dashboard-workspace-add-btn'),outline:getComputedStyle(document.activeElement).outlineStyle,tag:document.activeElement.outerHTML})`);
	check('workspace-add-keyboard-focus',focus.add&&focus.outline!=='none',focus);
	await press('Enter');
	await until(`!!document.querySelector('.nand-dialog input')`);
	check('workspace-add-keyboard-activation',await c.evaluate(`document.activeElement.matches('.nand-dialog input')`));
	await press('Escape');
	for (const preset of ['system','claude-code','eye-care']) for (const dark of [false,true]) {
		await c.evaluate(`app.plugins.plugins.nand.theme.update(d=>{d.preset=${JSON.stringify(preset)}});app.changeTheme(${JSON.stringify(dark?'obsidian':'moonstone')});true`);
		for (const width of [640,850,1400]) {
			await c.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: false });
			await delay(150);
			const m=await measure();
			check(`${preset}-${dark?'dark':'light'}-${width}`,m.basis==='auto'&&m.quicknote.height<300&&!m.horizontalOverflow&&!m.overlap,m);
			await runtime.shot(`home-${preset}-${dark?'dark':'light'}-${width}`);
		}
	}
	await c.evaluate(`document.querySelector('.dashboard-banner-pin-btn').click()`);
	await delay(100);
	const collapsed=await measure();
	check('collapsed-switcher-clear-of-quicknote',collapsed.buttons.every(b=>b.bottom<=collapsed.quicknote.top),collapsed);
	await c.evaluate(`document.querySelector('.dashboard-banner-pin-btn').click()`);
	check('board-open-does-not-rewrite', await fs.readFile(path.join(runtime.vault,'dashboard.md'),'utf8')===board);
	const errors=await c.evaluate('window.nandAcceptanceErrors');
	check('no-runtime-errors',errors.length===0,errors);
	await fs.writeFile(path.join(runtime.evidence,'review.json'),JSON.stringify({platform:process.platform,rows,unverified:['Actual phone host']},null,2));
	const failed=rows.filter(r=>!r.passed);console.log(JSON.stringify({evidence:runtime.evidence,checks:rows.length,failed:failed.map(r=>r.name)},null,2));
	assert.equal(failed.length,0);
} catch(error) {
	await fs.writeFile(path.join(runtime.evidence,'partial-review.json'),JSON.stringify(rows,null,2));
	await runtime.shot('failure').catch(()=>undefined);
	throw error;
} finally { await runtime.stop(); }
