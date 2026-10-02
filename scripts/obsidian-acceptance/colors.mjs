import { build } from 'esbuild';
import { connect } from './cdp.mjs';
import { metrics, language, init, escape, delay } from './common.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const c = await connect(),
	rows = [],
	dir = process.env.NAND_ACCEPTANCE_DIR || '/tmp/nand-issue-acceptance';
const bundle = (
	await build({
		stdin: {
			contents: `export { h, render } from 'preact'; export { ReminderPicker } from './src/view/dashboard/cards/ReminderPicker'; export { applyControlContrast } from './src/view/dashboard/appearance/appearance';`,
			resolveDir: process.cwd(),
			loader: 'ts',
		},
		bundle: true,
		write: false,
		format: 'iife',
		globalName: 'NandAudit',
		external: ['obsidian'],
	})
).outputFiles[0].text;
async function check(selector, icon = false) {
	const x = await c.evaluate(`auditContrast(document.querySelector(${JSON.stringify(selector)}))`);
	assert.ok(x.ratio >= (icon ? 3 : 4.5), JSON.stringify({ selector, ...x }));
	return { selector, ...x };
}
try {
	await c.evaluate(`window.closePicker?.()`);
	await init(c);
	await metrics(c, 1280, 850);
	await c.evaluate(
		`(async()=>{app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();await app.plugins.plugins.nand.openDashboard();await new Promise(r=>setTimeout(r,300));window.board=app.workspace.getLeavesOfType('nand-dashboard-view')[0].view;board.plugin.settings.readingEnabled=true;board.plugin.settings.widgetHabitEnabled=true;board.sidebarPinned=true;board.render(board.data);await board.readingService.addActiveBook({title:'Contrast test book',author:'Local fixture',coverUrl:'',isbn:'',totalPages:100,currentPage:0});})()`,
	);
	await c.evaluate(
		`(()=>{const require=id=>{if(id==='obsidian')return {Scope:app.scope.constructor};throw Error(id)};${bundle};window.NandAudit=NandAudit;})()`,
	);
	await c.evaluate(
		`window.auditColor=s=>{const c=document.createElement('canvas'),x=c.getContext('2d');c.width=c.height=1;x.clearRect(0,0,1,1);x.fillStyle=s;x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v)};window.auditOver=(a,b)=>[...a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])),1];window.auditLum=a=>a.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((v,x,i)=>v+x*[.2126,.7152,.0722][i],0);window.auditRatio=(a,b)=>(Math.max(auditLum(a),auditLum(b))+.05)/(Math.min(auditLum(a),auditLum(b))+.05);window.auditBackground=e=>{let chain=[];for(let n=e;n;n=n.parentElement)chain.push(n);let out=[255,255,255,1];for(const n of chain.reverse()){const s=getComputedStyle(n);const bg=n.matches('.nand-dashboard-root[data-theme]')&&s.backgroundImage!=='none'?(s.getPropertyValue('--db-bg')||s.backgroundColor):s.backgroundColor;out=auditOver(auditColor(bg),out);}return out};window.auditContrast=e=>{if(!e)throw Error('Missing control');const s=getComputedStyle(e),bg=auditBackground(e),fg=auditOver(auditColor(s.color),bg);return {ratio:auditRatio(fg,bg),fg,bg,text:e.textContent}};`,
	);
	for (const mode of ['light', 'dark'])
		for (const preset of [
			'mono',
			'earth',
			'nordic',
			'tundra',
			'blossom',
			'matcha',
			'lilac',
			'onyx',
			'volt',
			'neon',
			'magma',
			'aurora',
			'island',
		]) {
			await c.evaluate(
				`document.body.classList.toggle('theme-dark','${mode}'==='dark');document.body.classList.toggle('theme-light','${mode}'==='light');board.plugin.settings.stylePreset='${preset}';board.render(board.data);app.workspace.trigger('css-change');`,
			);
			await delay(250);
			const banner = await c.evaluate(
				`(()=>{const overlay=getComputedStyle(document.querySelector('.dashboard-banner-overlay')),colors=overlay.backgroundImage.match(/rgba?\\([^)]+\\)/g);if(!colors)throw Error('Missing banner scrim');const alpha=Math.min(...colors.map(s=>auditColor(s)[3])),bg=auditOver([0,0,0,alpha],[255,255,255,1]);return {scrim:overlay.backgroundImage,worstCaseRatio:['.dashboard-banner-quote','.dashboard-banner-author'].map(s=>auditRatio(auditOver(auditColor(getComputedStyle(document.querySelector(s)).color),bg),bg))}})()`,
			);
			assert.ok(banner.worstCaseRatio.every((r) => r >= 4.5));
			rows.push({ kind: 'banner', mode, preset, ...banner });
			const button = '.dashboard-sidebar-pomodoro-main-btn';
			const pomodoro = { idle: await check(button) };
			const point = await c.evaluate(`(()=>{const e=document.querySelector('${button}');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
			await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
			await delay(200);
			pomodoro.hover = await check(button);
			await c.evaluate(`document.querySelector('${button}').classList.add('dashboard-sidebar-pomodoro-main-btn--running')`);
			await delay(200);
			pomodoro.runningHover = await check(button);
			await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
			await delay(200);
			pomodoro.running = await check(button);
			await c.evaluate(`document.querySelector('${button}').classList.remove('dashboard-sidebar-pomodoro-main-btn--running')`);
			rows.push({ kind: 'pomodoro', mode, preset, ...pomodoro });
			for (const color of ['#eeeeee', '#171717', '#e05b45', '#ef4f8a']) {
				await c.evaluate(`board.contentEl.style.setProperty('--db-accent','${color}');NandAudit.applyControlContrast(board.contentEl)`);
				const states = {};
				for (const [name, running, hover] of [['idle',false,false],['hover',false,true],['runningHover',true,true],['running',true,false]]) {
					await c.evaluate(`document.querySelector('${button}').classList.toggle('dashboard-sidebar-pomodoro-main-btn--running',${running})`);
					await c.send('Input.dispatchMouseEvent', {type:'mouseMoved', ...(hover ? point : {x:0,y:0})});
					await delay(200);
					states[name] = await check(button);
				}
				rows.push({kind:'custom-accent',mode,preset,color,...states});
			}
			await c.evaluate(`document.querySelector('${button}').classList.remove('dashboard-sidebar-pomodoro-main-btn--running');board.render(board.data)`);
			if (!['matcha', 'lilac'].includes(preset)) continue;
			const controls = [await check('.dashboard-sidebar-week-cell--today .dashboard-sidebar-week-date')];
			await c.evaluate(
				`window.pickerHost=document.body.createDiv();window.pickerAnchor=document.querySelector('.dashboard-banner-edit-btn');window.pickerSaved=null;window.closePicker=()=>{NandAudit.render(null,pickerHost);pickerHost.remove()};NandAudit.render(NandAudit.h(NandAudit.ReminderPicker,{anchor:pickerAnchor,save:v=>window.pickerSaved=v,close:closePicker}),pickerHost);`,
			);
			await delay(250);
			controls.push(await check('.dashboard-task-reminder-popup .mod-cta'));
			await c.evaluate(`document.querySelector('.dashboard-task-reminder-popup .mod-cta').click()`);
			assert.ok(await c.evaluate(`!!pickerSaved&&!document.querySelector('.dashboard-task-reminder-popup')`));
			await c.evaluate(`void board.deleteColumn(board.data.columns[0].name)`);
			await delay(250);
			controls.push(await check('.dashboard-confirm-delete'));
			await c.evaluate(`document.querySelector('.dashboard-confirm-cancel').click()`);
			await c.evaluate(`document.querySelector('.dashboard-reading-add-btn').click()`);
			await delay(250);
			controls.push(await check('.dashboard-reading-book-manual-btn'));
			await escape(c);
			await c.evaluate(`document.querySelector('.dashboard-reading-book-card-edit').click()`);
			await delay(250);
			controls.push(await check('.dashboard-reading-end-btn--confirm'));
			const r = await c.evaluate(`auditRect(document.querySelector('.dashboard-reading-end-btn--delete'))`);
			await c.send('Input.dispatchMouseEvent', {
				type: 'mouseMoved',
				x: r.x + r.width / 2,
				y: r.y + r.height / 2,
			});
			await delay(250);
			controls.push(await check('.dashboard-reading-end-btn--delete'));
			await escape(c);
			await c.evaluate(`document.querySelector('.dashboard-reading-stats-btn').click()`);
			await delay(250);
			controls.push(await check('.dashboard-reading-stats-range-btn--active'));
			await escape(c);
			controls.push(await check('.dashboard-reading-book-card-btn--play svg', true));
			await c.evaluate(`document.querySelector('.dashboard-reading-book-card-btn--play').click()`);
			await delay(250);
			controls.push(await check('.dashboard-reading-book-card-btn--pause svg', true));
			await c.evaluate(`document.querySelector('.dashboard-reading-book-card-btn--pause').click()`);
			await delay(250);
			rows.push({ kind: 'controls', mode, preset, controls });
			await fs.writeFile(
				`${dir}/dashboard-${preset}-${mode}.png`,
				Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'),
			);
		}
	// Host theme changes update foreground tokens without reconstructing the dashboard.
	await c.evaluate(
		`board.plugin.settings.stylePreset='matcha';document.body.classList.remove('theme-dark');document.body.classList.add('theme-light');board.render(board.data);window.beforeThemeRoot=board.contentEl;document.body.classList.remove('theme-light');document.body.classList.add('theme-dark');app.workspace.trigger('css-change');`,
	);
	await delay(250);
	assert.equal(
		await c.evaluate(
			`board.contentEl===beforeThemeRoot && getComputedStyle(board.contentEl).getPropertyValue('--db-text-on-accent').trim()==='#000000'`,
		),
		true,
	);
	// Bright/dark patterned backdrop: keep the actual banner overlay and text untouched.
	await c.evaluate(
		`document.querySelector('.dashboard-banner').style.backgroundImage='linear-gradient(90deg,white,black,white)'`,
	);
	await fs.writeFile(
		`${dir}/banner-pattern.png`,
		Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'),
	);
	await c.evaluate(`board.render(board.data)`);
	await fs.writeFile(`${dir}/colors.json`, JSON.stringify({ passed: true, rows }, null, 2));
	console.log({ passed: true, cases: rows.length });
} catch (error) {
	await fs.writeFile(`${dir}/colors-partial.json`, JSON.stringify({ error: String(error), rows }, null, 2));
	throw error;
} finally {
	c.close();
}
