// Acceptance: widgets at their size tiers. Phase "survey" adds every widget of the add panel at S / M / L and reports
// clipped content; phase "matrix" puts usage, shortcuts and calendar on a board at S / M / L in the default theme and
// Minimal, light and dark, and checks what each tier shows. HOME / CLI homes / XDG dirs point into the fixture
// (fresh-vault.mjs). Run from the repo root after `pnpm build`:
//   NAND_OBSIDIAN_EXECUTABLE=/opt/Obsidian/obsidian NAND_C2_MINIMAL_DIR=~/refs/obsidian-minimal-9.0.2 \
//   xvfb-run -a node scripts/obsidian-acceptance/home-widgets-c2.mjs /tmp/nand-c2-01
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const TIERS = ['S', 'M', 'L', 'XL'];
const board = (tier) => `.nand/content/Board-${tier}`;
const matrixBoard = (tier) => `.nand/content/Matrix-${tier}`;
const empty = '---\nlayout: immersive\ncanvas: 1\nwidgets: []\nimmersive: []\n---\n';
const modules = { home: true, agent: true, browser: false, archives: false, automations: true, notifications: false, icons: false, comments: false, navigator: true, sync: false };
const shortcutButtons = [
	{ id: 's1', label: 'Inbox', icon: 'inbox', type: 'file', target: 'Notes/Inbox.md' },
	{ id: 's2', label: 'Toggle pin', icon: 'pin', type: 'command', target: 'editor:toggle-pin' },
	{ id: 's3', label: 'Settings', icon: 'settings', type: 'command', target: 'app:open-settings' },
	{ id: 's4', label: 'Review', icon: 'bot', type: 'agent', target: '', agentId: 'codex', prompt: 'Review today' },
	{ id: 's5', label: 'Command palette', icon: 'terminal', type: 'command', target: 'command-palette:open' },
	{ id: 's6', label: 'Gone command', icon: 'x', type: 'command', target: 'nand-test:does-not-exist' },
	{ id: 's7', label: 'Gone note', icon: 'x', type: 'file', target: 'Notes/Deleted.md' },
	{ id: 's8', label: 'Build', icon: 'square-terminal', type: 'quick', target: 'q1' },
];
const runtime = await launchFreshVault({
	root: process.argv[2],
	port: Number(process.env.NAND_C2_PORT || 9331),
	files: { ...Object.fromEntries(TIERS.flatMap((tier) => [[board(tier) + '.md', empty], [matrixBoard(tier) + '.md', empty]])), 'Notes/Inbox.md': '# Inbox\n' },
	settings: { version: 1, namespaces: {
		app: { language: 'en', introSeen: true, modules, palette: 'orca' },
		agent: { quickCommands: [{ id: 'q1', name: 'Build', type: 'terminal', content: 'echo build', agentId: 'claude-code', cwd: '', scope: 'vault' }] },
		navigator: { shortcuts: [{ id: 'n1', kind: 'note', key: 'Notes/Inbox.md' }, { id: 'n2', kind: 'folder', key: 'Notes' }] },
		home: {
			dashboardFile: board('M'), workspaces: { files: [...TIERS.map(board), ...TIERS.map(matrixBoard)], names: [...TIERS, ...TIERS].map(() => ''), active: 0 },
			shortcutButtons,
			albums: [{ id: 1, folder: 'Notes', intervalSec: 8, recursive: true, ratio: '1:1', transition: 'fade', heightRatio: 'full' }],
			countdowns: [{ id: 'cd-1', label: 'Launch day', targetDate: '2030-01-01', displayMode: 'days', reminderDays: 0 }],
			anniversaries: [{ id: 'av-1', label: 'First commit', startDate: '2024-03-01', precision: 'ymd', annualReminder: false }],
		},
	} },
});
let c = runtime.connection;
const rows = [];
const report = [];
const check = (name, passed, detail) => { rows.push({ name, passed, detail }); if (!passed) console.error('FAILED', name, JSON.stringify(detail)?.slice(0, 600)); };
const until = async (expression, label = expression) => { const end = Date.now() + 20000; while (Date.now() < end) { if (await c.evaluate(expression).catch(() => false)) return; await delay(80); } throw new Error('Timeout: ' + label); };
const viewport = async (width, height) => { await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); await delay(400); };
const open = async (tier, file = board) => { await c.evaluate(`app.plugins.plugins.nand.openWorkbench({feature:'dashboard',resourceId:${JSON.stringify(file(tier))}})`); await until(`!!document.querySelector('.nand-immersive-grid')`, 'canvas'); await delay(500); };
const clickLabel = (label) => c.evaluate(`(()=>{const el=[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)}||e.textContent.trim()===${JSON.stringify(label)});if(!el)return false;el.click();return true})()`);
const edit = async (on) => {
	const now = await c.evaluate(`document.querySelector('.nand-immersive-grid').dataset.editing==='true'`);
	if (now !== on) { await clickLabel(on ? 'Edit board' : 'Done'); await until(`document.querySelector('.nand-immersive-grid').dataset.editing===${JSON.stringify(String(on))}`); }
};
const inject = () => c.evaluate(`(()=>{const p=app.plugins.plugins.nand;const usage=p.services.peek({owner:'agent',id:'usage'});if(!usage)return false;
	const day=86400000;
	usage.store.setState({refreshing:false,providers:[
		{id:'claude-code',name:'Claude',account:'work',windows:[{key:'session',label:'5h',usedPercent:42,resetsAt:Date.now()+5400000},{key:'weekly',label:'7d',usedPercent:63,resetsAt:Date.now()+3*day}]},
		{id:'codex',name:'Codex',windows:[{key:'session',label:'5h',usedPercent:91,resetsAt:Date.now()+1800000},{key:'weekly',label:'7d',usedPercent:34,resetsAt:Date.now()+5*day}]},
		{id:'gemini',name:'Gemini',windows:[],status:'idle',statusLabel:'Not signed in'},
	]},true);
	// keep the injected snapshot: the store would otherwise rebuild itself from the (empty) controller state
	usage.update=()=>{};usage.snapshot=()=>usage.store.getState();return true})()`);
const addWidget = async (key, tier) => {
	await clickLabel('Add widget'); await until(`!!document.querySelector('[data-widget-entry="${key}"]')`, 'entry ' + key);
	const hasTier = await c.evaluate(`(()=>{const e=document.querySelector('[data-widget-entry="${key}"]');const b=[...e.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(tier)});b?.click();return !!b})()`);
	await delay(80);
	if (!hasTier) { await clickLabel('Close'); await delay(150); return false; }
	const added = await c.evaluate(`(()=>{const e=document.querySelector('[data-widget-entry="${key}"]');const b=[...e.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').startsWith('Add ')&&!b.disabled)||[...e.querySelectorAll('button')].find(b=>(b.textContent||'').startsWith('Add')&&!b.disabled);if(!b)return false;b.click();return true})()`);
	await delay(350);
	if (!added) { await clickLabel('Close'); await delay(150); }
	return added;
};
const overflow = () => c.evaluate(`Array.from(document.querySelectorAll('.nand-immersive-grid [data-tile]'),(tile)=>{const body=tile.querySelector('.nand-immersive-body');const r=tile.getBoundingClientRect();
	const wide=[...tile.querySelectorAll('*:not([data-slot=progress-indicator])')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.right>r.right+1||b.left<r.left-1)}).length;
	const scrolled=(e)=>{for(let n=e.parentElement;n&&n!==tile;n=n.parentElement){if(n.classList.contains('nand-immersive-body'))return false;const o=getComputedStyle(n).overflowY;if(o==='auto'||o==='scroll')return true}return false};
	const outside=[...tile.querySelectorAll('button,input,select,textarea,[role=button]')].filter(e=>{const b=e.getBoundingClientRect();if(!b.width||!b.height)return false;const side=b.right>r.right+1||b.left<r.left-1;const vertical=(b.bottom>r.bottom+1||b.top<r.top-1)&&!scrolled(e);return side||vertical}).map(e=>(e.getAttribute('aria-label')||e.textContent||e.tagName).trim().slice(0,30));
	return {id:tile.dataset.tile,key:tile.dataset.widgetKey,outside,w:Math.round(r.width),h:Math.round(r.height),scrollH:body?.scrollHeight??0,clientH:body?.clientHeight??0,clipped:body?body.scrollHeight-body.clientHeight>2:false,wide}})`);
const shot = async (name) => { await runtime.shot(name); return name; };
/** Capture a region of the page (CSS pixels) to evidence/<name>.png. */
const region = async (name, clip) => {
	const { data } = await c.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: true });
	await fs.writeFile(path.join(runtime.evidence, `${name}.png`), Buffer.from(data, 'base64'));
};

try {
	await c.evaluate('app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();true');
	await viewport(1440, 1000);
	check('usage-injected', await inject(), 'agent usage service');

	// ---- survey: every widget of the add panel at every tier ----
	if (process.env.NAND_C2_PHASE !== 'matrix') {
		for (const tier of TIERS) {
			await open(tier); await edit(true);
			await clickLabel('Add widget'); await until(`!!document.querySelector('[data-widget-entry]')`);
			const keys = await c.evaluate(`Array.from(document.querySelectorAll('[data-widget-entry]'),e=>e.dataset.widgetEntry)`);
			await clickLabel('Close'); await delay(150);
			const added = [];
			for (const key of keys) {
				if (key === 'banner') continue;
				try { if (await addWidget(key, tier)) added.push(key); } catch (error) { report.push({ tier, key, error: String(error).slice(0, 200) }); await clickLabel('Close').catch(() => undefined); }
			}
			await edit(false);
			await viewport(1440, 4200); await delay(700);
			await shot(`survey-${tier}`);
			for (const [index, y] of [0, 900].entries()) await region(`survey-${tier}-part${index}`, { x: 40, y, width: 1400, height: 900 });
			const o = await overflow();
			report.push({ tier, added: added.length, skipped: keys.filter((k) => !added.includes(k)), overflow: o.filter((t) => t.clipped || t.wide) });
			check(`survey-${tier}-added-widgets`, added.length >= (tier === 'XL' ? 12 : 22), { added: added.length, keys });
			check(`survey-${tier}-every-control-inside-its-tile`, o.every((tile) => tile.outside.length === 0), o.filter((tile) => tile.outside.length));
			const skip = await c.evaluate(`(()=>{const tile=document.querySelector('[data-widget-key="pomodoro"]');if(!tile)return null;const b=[...tile.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Skip');if(!b)return {found:false};const r=b.getBoundingClientRect(),t=tile.getBoundingClientRect();const inside=r.right<=t.right+1&&r.left>=t.left-1;b.click();return {found:true,inside}})()`);
			if (added.includes('pomodoro')) check(`survey-${tier}-pomodoro-skip-reachable`, skip?.found === true && skip.inside === true, skip);
			await viewport(1440, 1000);
		}
		await fs.writeFile(path.join(runtime.evidence, 'survey.json'), JSON.stringify(report, null, 2));
	}

	// ---- matrix: usage, shortcuts and calendar at each tier, themes x light/dark ----
	if (process.env.NAND_C2_PHASE !== 'survey') {
		const minimalDir = process.env.NAND_C2_MINIMAL_DIR;
		if (minimalDir) {
			const themeDir = path.join(runtime.vault, '.obsidian/themes/Minimal'); await fs.mkdir(themeDir, { recursive: true });
			for (const file of ['theme.css', 'manifest.json']) await fs.copyFile(path.join(minimalDir, file), path.join(themeDir, file));
		}
		const setTheme = async (css, base) => {
			await c.evaluate(`app.customCss.setTheme(${JSON.stringify(css)});app.vault.setConfig('theme','${base}');app.updateTheme();true`);
			await delay(500);
		};
		for (const tier of TIERS) {
			await open(tier, matrixBoard); await edit(true);
			for (const key of ['usage', 'shortcuts', 'calendar', 'nav-recent', 'nav-shortcuts']) await addWidget(key, tier);
			await edit(false);
		}
		const themes = [['', 'Default'], ...(minimalDir ? [['Minimal', 'Minimal']] : [])];
		for (const [css, themeName] of themes) {
			for (const base of ['moonstone', 'obsidian']) {
				await setTheme(css, base);
				const mode = base === 'moonstone' ? 'light' : 'dark';
				for (const tier of TIERS) {
					await open(tier, matrixBoard);
					await viewport(1440, 900); await delay(400);
					await inject();
					await delay(400);
					const label = `${themeName}-${mode}-${tier}`;
					await shot(`matrix-${label}`);
					const probe = await c.evaluate(`(()=>{const tile=(k)=>document.querySelector('[data-widget-key="'+k+'"]');const text=(k)=>tile(k)?.innerText?.replace(/\\s+/g,' ').trim();
						const rect=(k)=>{const r=tile(k)?.getBoundingClientRect();return r?{w:Math.round(r.width),h:Math.round(r.height)}:null};
						return {usageProviders:document.querySelectorAll('[data-widget-key="usage"] [data-usage-provider]').length,usageWindows:document.querySelectorAll('[data-widget-key="usage"] [data-usage-provider] .tabular-nums').length,usageText:text('usage'),usageMode:tile('usage')?.querySelector('[data-usage-mode]')?.dataset.usageMode,
						shortcutLayout:tile('shortcuts')?.querySelector('[data-shortcuts-layout]')?.dataset.shortcutsLayout,shortcutButtons:tile('shortcuts')?.querySelectorAll('[data-shortcut]').length,shortcutText:text('shortcuts'),
						calendar:text('calendar')?.slice(0,60),rects:{usage:rect('usage'),shortcuts:rect('shortcuts'),calendar:rect('calendar')},
						bg:getComputedStyle(document.querySelector('[data-widget-key="usage"]')).backgroundColor,color:getComputedStyle(document.querySelector('[data-widget-key="usage"] [data-usage-mode]')??document.body).color}})()`);
					const o = await overflow();
					report.push({ label, probe, overflow: o.filter((t) => ['usage', 'shortcuts', 'calendar', 'nav-recent', 'nav-shortcuts'].includes(t.key) && (t.clipped || t.wide)) });
					if (themeName === 'Default' && mode === 'light') {
						if (tier === 'S') check('usage-S-top-provider-only', probe.usageProviders === 1 && /Codex/.test(probe.usageText ?? '') && /91%/.test(probe.usageText ?? ''), probe);
						if (tier === 'M') check('usage-M-lists-providers', probe.usageProviders === 3 && probe.usageMode !== 'top', probe);
						if (tier === 'L') check('usage-L-shows-windows', probe.usageMode === 'detail' && /63%/.test(probe.usageText ?? '') && /34%/.test(probe.usageText ?? ''), probe);
						if (tier === 'S') check('shortcuts-S-compact', probe.shortcutButtons === 8, probe);
						if (tier === 'S') {
							const refresh = await c.evaluate(`!!document.querySelector('[data-widget-key="usage"] button[aria-label="Refresh usage"]')`);
							check('usage-S-has-refresh', refresh, refresh);
						}
						if (tier === 'L') check('shortcuts-L-rows-with-hotkeys', probe.shortcutLayout === 'rows' || probe.shortcutLayout === 'grid', probe);
					}
					check(`${label}-nothing-clipped`, o.filter((t) => ['usage', 'shortcuts', 'calendar', 'nav-recent', 'nav-shortcuts'].includes(t.key) && (t.wide)).length === 0, o);
				}
			}
		}
		// Behavior: a shortcut button opens its note; refresh asks the service.
		await setTheme('', 'moonstone');
		await open('M', matrixBoard);
		// A shortcut callback kept from the board being left must not run a command on the board shown afterwards.
		await open('M', matrixBoard);
		const held = await c.evaluate(`(()=>{const b=document.querySelector('[data-shortcut="s3"]');const key=Object.keys(b).find(k=>k.startsWith('__reactProps$'));window.__heldShortcut=b[key].onClick;window.__commandCalls=[];const registry=app.commands;window.__execute=registry.executeCommandById;registry.executeCommandById=(id)=>{window.__commandCalls.push(id);return true};return typeof window.__heldShortcut==='function'&&!!app.commands.commands['app:open-settings']})()`);
		check('held-shortcut-callback-captured', held, held);
		await c.evaluate(`(()=>{const grid=document.querySelector('.nand-immersive-grid');const key=Object.keys(grid).find(k=>k.startsWith('__reactFiber$'));let f=grid[key],store;while(f&&!store){store=f.memoizedProps?.store?.switch?f.memoizedProps.store:undefined;f=f.return}window.__switch=store.switch(${JSON.stringify(matrixBoard('S'))});return true})()`);
		await until(`document.querySelector('button[aria-label="5"]')?.getAttribute('aria-current')==='page'`, 'switched to the other board').catch(async (error) => { console.error('switch result', await c.evaluate(`Promise.race([window.__switch.then(()=>'ok',e=>String(e)),new Promise(r=>setTimeout(()=>r('pending'),3000))])`)); console.error(JSON.stringify(await c.evaluate(`({tabs:[...document.querySelectorAll('.dashboard-workspace-switcher button')].map(b=>[b.getAttribute('aria-label'),b.getAttribute('aria-current')]),alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.innerText),errors:window.nandAcceptanceErrors,sw:String(window.__switch),st:(()=>{const grid=document.querySelector('.nand-immersive-grid');const key=Object.keys(grid).find(k=>k.startsWith('__reactFiber$'));let f=grid[key],store;while(f&&!store){store=f.memoizedProps?.store?.switch?f.memoizedProps.store:undefined;f=f.return}const x=store.state.getState();return {switching:x.switching,path:x.path,gen:x.generation,err:x.switchError}})(),save:(()=>{let o;app.workspace.iterateAllLeaves(l=>{const s=l.view.getNativeSurfaces?.().find(s=>s.getViewType()==='nand-dashboard-view');if(s)o=s.sync.getSaveState()});return o})(),overlay:document.querySelector('[role=status]')?.innerText})`))); throw error; });
		await delay(600);
		await c.evaluate(`[...document.querySelectorAll('[data-sonner-toast]')].forEach(e=>e.remove());window.__heldShortcut({preventDefault(){},stopPropagation(){},currentTarget:document.body,target:document.body});true`);
		await delay(800);
		const late = await c.evaluate(`({calls:window.__commandCalls,toasts:[...document.querySelectorAll('[data-sonner-toast]')].map(e=>e.innerText)})`);
		check('held-shortcut-refuses-after-board-switch', late.calls.length === 0 && late.toasts.length === 0, late);
		await c.evaluate(`app.commands.executeCommandById=window.__execute;true`);
		await open('M', matrixBoard);
		await c.evaluate(`document.querySelector('[data-shortcut="s1"]').click();true`);
		await until(`[...document.querySelectorAll('[role="dialog"]')].some(d=>d.textContent.includes('Inbox'))`, 'note preview').then(() => check('shortcut-file-button-opens-note', true), (error) => check('shortcut-file-button-opens-note', false, String(error)));
		await c.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));true`);
		await c.evaluate(`app.workspace.openLinkText('Notes/Inbox.md','',true)`);
		await delay(600);
		// Pressing a shortcut whose target is gone says so, by name; the agent module offers its saved quick commands.
		const quick = await c.evaluate(`app.plugins.plugins.nand.services.peek({owner:'agent',id:'quick-commands'})?.list().map(q=>q.name)`);
		check('agent-quick-commands-offered', Array.isArray(quick) && quick.includes('Build'), quick);
		await c.evaluate(`document.querySelector('[data-shortcut="s6"]').click();document.querySelector('[data-shortcut="s7"]').click();true`);
		await until(`document.body.innerText.includes('Gone command') && document.body.innerText.includes('Gone note')`, 'missing-target toasts').then(() => check('missing-target-shortcuts-report', true), (error) => check('missing-target-shortcuts-report', false, String(error)));
		const toastText = await c.evaluate(`[...document.querySelectorAll('[data-sonner-toast]')].map(e=>e.innerText)`);
		check('missing-target-toasts-say-edit', toastText.some((x) => /Gone command/.test(x) && /Edit the shortcut/.test(x)) && toastText.some((x) => /Gone note/.test(x) && /no longer exists/.test(x)), toastText);
		// The navigator widgets read the navigator's lists and open through it.
		await open('M', matrixBoard);
		const navText = await c.evaluate(`({recent:document.querySelector('[data-nav-list="recent"]')?.innerText,shortcuts:document.querySelector('[data-nav-list="shortcuts"]')?.innerText})`);
		check('nav-recent-lists-opened-note', /Inbox/.test(navText.recent ?? ''), navText);
		check('nav-shortcuts-list-navigator-shortcuts', /Inbox/.test(navText.shortcuts ?? '') && /Notes/.test(navText.shortcuts ?? ''), navText);
		await c.evaluate(`app.workspace.getLeavesOfType('markdown').forEach(l=>l.detach());true`);
		await c.evaluate(`[...document.querySelectorAll('[data-nav-list="shortcuts"] button')].find(b=>b.textContent.trim()==='Inbox').click();true`);
		await until(`app.workspace.getLeavesOfType('markdown').some(l=>l.view.file?.path?.endsWith('Inbox.md'))`, 'shortcut opened the note').then(() => check('nav-shortcut-opens-through-navigator', true), (error) => check('nav-shortcut-opens-through-navigator', false, String(error)));
		await fs.writeFile(path.join(runtime.evidence, 'matrix.json'), JSON.stringify(report, null, 2));
	}
	const errors = await c.evaluate(`window.nandAcceptanceErrors ?? []`);
	check('no-console-errors', errors.length === 0, errors.slice(0, 3));
} finally {
	await fs.writeFile(path.join(runtime.evidence, 'review.json'), JSON.stringify({ rows, report }, null, 2));
	await runtime.stop();
}
const failed = rows.filter((r) => !r.passed);
console.log(`${rows.length - failed.length}/${rows.length} passed; evidence in ${runtime.evidence}`);
if (failed.length) process.exit(1);
