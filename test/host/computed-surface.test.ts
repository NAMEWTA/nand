import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArchiveCardGrid } from '../../src/modules/archives/ui/ArchiveCardGrid';
import { PipelineConfig } from '../../src/modules/home/ui/pipeline/PipelineConfig';
import { emptyPipeline } from '../../src/modules/home/core/pipeline/model';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, test, vi } from 'vitest';

// Skill pickers own client-only portals; the configuration's fields, scope and footer are rendered unchanged.
vi.mock('../../src/modules/home/ui/quickbar/SkillList', () => ({ SkillList: () => null }));

const styles = pathToFileURL(path.resolve('styles.css')).href;
const chromeExecutable = process.env.NAND_CHROME_EXECUTABLE ?? [
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(candidate => existsSync(candidate)) ?? 'google-chrome';
const fixtures: string[] = [];
afterEach(() => {
	for (const directory of fixtures.splice(0)) {
		assert.equal(path.dirname(directory), path.resolve(tmpdir()));
		assert.ok(path.basename(directory).startsWith('nand-surface-'));
		// A just-killed Windows Chrome may hold its profile briefly.
		rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});

type ChromeRun = { status: number | null; stdout: string; stderr: string; timedOut: boolean };

/** Run headless Chrome once; a hung browser is killed with its whole process tree so it cannot slow later suites. */
function runChrome(args: string[], deadline: number): Promise<ChromeRun> {
	return new Promise((resolve) => {
		const posix = process.platform !== 'win32';
		const child = spawn(chromeExecutable, args, { windowsHide: true, detached: posix });
		let stdout = '', stderr = '', timedOut = false, settled = false;
		const settle = (status: number | null) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve({ status, stdout, stderr, timedOut });
		};
		child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
		child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
		child.on('error', (error) => { stderr += String(error); settle(null); });
		child.on('close', settle);
		const timer = setTimeout(() => {
			timedOut = true;
			// Killing only chrome.exe leaves renderer/GPU children consuming the runner on Windows.
			if (child.pid === undefined) return;
			if (posix) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ } }
			else spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
			child.once('exit', () => settle(null));
		}, deadline);
	});
}

async function chrome<T>(html: string, windowSize = '1200,800'): Promise<T> {
	// Headless --dump-dom occasionally never exits on Windows runners; a fresh profile normally succeeds at once.
	for (let attempt = 1; ; attempt++) {
		const dir = mkdtempSync(path.join(tmpdir(), 'nand-surface-'));
		fixtures.push(dir);
		const file = path.join(dir, 'page.html');
		writeFileSync(file, html);
		const result = await runChrome([
			'--headless=new',
			'--disable-gpu',
			'--no-sandbox',
			'--allow-file-access-from-files',
			`--user-data-dir=${path.join(dir, 'profile')}`,
			`--window-size=${windowSize}`,
			'--virtual-time-budget=2000',
			'--dump-dom',
			pathToFileURL(file).href,
		], 30_000);
		if (result.timedOut && attempt < 2) continue;
		assert.ok(!result.timedOut, `Chrome did not exit within 30s after ${attempt} attempts`);
		assert.equal(result.status, 0, result.stderr);
		const match = /<pre id="out">([^<]*)<\/pre>/.exec(result.stdout);
		assert.ok(match, result.stdout.slice(-500));
		return JSON.parse(match[1]!.replaceAll('&quot;', '"')) as T;
	}
}

test('a 288px desktop column keeps the quick note at content height', async () => {
	const measured = await chrome<{ height: number; flex: string; main: number; gap: number }>(`<!doctype html>
<html><head><link rel="stylesheet" href="${styles}"></head>
<body>
<div id="nand-ui-root"><div class="nand-ui nand-dashboard-root flex h-full min-h-0 flex-col" data-layout="stacked" style="width:288px;height:1950px">
  <div class="dashboard-main flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-4 pt-2">
    <div class="dashboard-quicknote flex shrink-0 items-center gap-2 px-3 py-2"><span class="dashboard-quicknote-chip">Today</span><span>capture</span></div>
    <div class="dashboard-stacked-scroll min-h-0 flex-1 overflow-y-auto"><div class="next">week</div></div>
  </div>
</div></div>
<pre id="out"></pre>
<script>
const q = document.querySelector('.dashboard-quicknote');
const next = q.nextElementSibling;
const cs = getComputedStyle(q);
const qr = q.getBoundingClientRect();
const nr = next.getBoundingClientRect();
document.getElementById('out').textContent = JSON.stringify({
  height: Math.round(qr.height),
  flex: cs.flex,
  main: Math.round(q.parentElement.getBoundingClientRect().height),
  gap: Math.round(nr.top - qr.bottom),
});
</script></body></html>`);
	assert.ok(measured.height > 20 && measured.height < 80, JSON.stringify(measured));
	assert.equal(measured.flex, '0 0 auto');
	assert.ok(measured.main > 1000, JSON.stringify(measured));
	assert.ok(measured.gap >= 0 && measured.gap < 24, JSON.stringify(measured));
}, 75_000); // Two 30s Chrome attempts (a hung browser is retried once), including cold startup.

type Tone = { text: string; background: string };

test('archive text and paper differ in light and dark', async () => {
	const measured = await chrome<{ light: Tone; dark: Tone }>(`<!doctype html>
<html><head><link rel="stylesheet" href="${styles}"></head>
<body class="theme-light">
<div class="nand-ui bg-background text-foreground" data-palette="orca" data-p9-archive><button class="text-foreground" data-p9-row>王</button></div>
<pre id="out"></pre>
<script>
function tone() {
  const button = document.querySelector('[data-p9-row]');
  const surface = document.querySelector('[data-p9-archive]');
  return { text: getComputedStyle(button).color, background: getComputedStyle(surface).backgroundColor };
}
const light = tone();
document.body.classList.replace('theme-light', 'theme-dark');
const dark = tone();
document.getElementById('out').textContent = JSON.stringify({ light, dark });
</script></body></html>`);
	assert.notEqual(measured.light.text, measured.light.background);
	assert.notEqual(measured.dark.text, measured.dark.background);
	assert.notEqual(measured.light.text, measured.dark.text);
	assert.notEqual(measured.light.background, measured.dark.background);
}, 75_000);

test('pipeline configuration keeps vertical fields and separated footer actions', async () => {
	const initial = {
		...emptyPipeline(),
		stages: [{ id: 'draft', label: 'Draft', value: 'draft' }],
		skills: [{
			id: 'review', label: 'Review', agentId: 'codex', skillName: 'review', promptTemplate: '{{input}}',
			directSend: false, destination: { kind: 'fresh' as const, cwd: '' },
			scope: 'card' as const, stages: [],
		}],
	};
	const markup = renderToStaticMarkup(createElement(PipelineConfig, { initial, save: async () => {}, close: () => {} }));
	const measured = await chrome<{ stacks: Array<{ display: string; direction: string; gap: string }>; scope: { display: string; direction: string; gap: string }; footer: { display: string; wrap: string; gap: string; separation: number }; legacy: number }>(`<!doctype html>
<html><head><link rel="stylesheet" href="${styles}"></head>
<body style="--size-4-1:4px;--size-4-2:8px"><div class="nand-ui" style="width:480px">${markup}</div><pre id="out"></pre>
<script>
const root = document.querySelector('.nand-pipeline-config');
const measure = e => { const s = getComputedStyle(e); return { display:s.display, direction:s.flexDirection, gap:s.gap }; };
const footer = root.lastElementChild, buttons = footer.querySelectorAll('button');
document.getElementById('out').textContent = JSON.stringify({
 stacks: [root, ...root.querySelectorAll('fieldset')].map(measure),
 scope: measure(root.querySelector('select').parentElement),
 footer: { ...measure(footer), wrap:getComputedStyle(footer).flexWrap, separation:buttons[1].getBoundingClientRect().left-buttons[0].getBoundingClientRect().right },
 legacy: [...root.querySelectorAll('[class]'), root].flatMap(e => [...e.classList]).filter(name => name.startsWith('nand-ui-') || name === 'nand-field').length,
});
</script></body></html>`);
	assert.equal(measured.stacks.length, 3);
	for (const stack of measured.stacks) assert.deepEqual(stack, { display: 'flex', direction: 'column', gap: '8px' });
	assert.deepEqual(measured.scope, { display: 'flex', direction: 'column', gap: '4px' });
	assert.equal(measured.footer.display, 'flex');
	assert.equal(measured.footer.wrap, 'wrap');
	assert.equal(measured.footer.gap, '8px');
	assert.equal(measured.footer.separation, 8);
	assert.equal(measured.legacy, 0);
}, 75_000);

test('editor conflict actions retain compact host styling outside the React scope', async () => {
	const measured = await chrome<{ display: string; wrap: string; gap: string; margin: string; font: string; padding: string; height: number; separation: number; host: string }>(`<!doctype html>
<html><head><style>button { height:32px; padding:4px 12px; font-size:16px; }</style><link rel="stylesheet" href="${styles}"></head>
<body style="--size-4-1:4px;--size-4-2:8px;--font-interface:Arial;--font-ui-smaller:12px">
<div class="cm-editor"><span class="nand-sync-conflict-actions"><button class="nand-sync-conflict-button">Keep upper</button><button class="nand-sync-conflict-button">Keep lower</button></span><button id="host">Host control</button></div><pre id="out"></pre>
<script>
const bar = document.querySelector('.nand-sync-conflict-actions'), buttons = bar.querySelectorAll('button');
const b = getComputedStyle(bar), s = getComputedStyle(buttons[0]);
document.getElementById('out').textContent = JSON.stringify({ display:b.display, wrap:b.flexWrap, gap:b.gap, margin:b.marginInlineStart,
 font:s.fontSize, padding:s.padding, height:buttons[0].getBoundingClientRect().height,
 separation:buttons[1].getBoundingClientRect().left-buttons[0].getBoundingClientRect().right, host:getComputedStyle(document.getElementById('host')).height });
</script></body></html>`);
	assert.equal(measured.display, 'inline-flex');
	assert.equal(measured.wrap, 'wrap');
	assert.equal(measured.gap, '4px');
	assert.equal(measured.margin, '8px');
	assert.equal(measured.font, '12px');
	assert.equal(measured.padding, '0px 8px');
	assert.equal(measured.separation, 4);
	assert.ok(measured.height < 32, JSON.stringify(measured));
	assert.equal(measured.host, '32px');
}, 75_000);


test('archive cards follow their container width and respect the five/six-column cap', async () => {
 const cards = Array.from({ length: 8 }, (_, i) => createElement('button', { key: i, className: 'min-w-0 whitespace-normal p-4 [overflow-wrap:anywhere]' }, 'Readable person name ' + i));
 const markup = [5, 6].map(columns => `<section data-cap="${columns}" style="width:500px">${renderToStaticMarkup(createElement(ArchiveCardGrid, { columns, children: cards }))}</section>`).join('');
 const measured = await chrome<Array<{ cap: number; width: number; tracks: number; card: number; overflow: number }>>(`<!doctype html>
 <html><head><link rel="stylesheet" href="${styles}"></head><body><div class="nand-ui">${markup}</div><pre id="out"></pre><script>
 const results=[];
 for(const section of document.querySelectorAll('section')) for(const width of [240,500,900,2200]) {
  section.style.width=width+'px';const grid=section.firstElementChild, card=grid.firstElementChild;
  results.push({cap:Number(section.dataset.cap),width,tracks:getComputedStyle(grid).gridTemplateColumns.split(' ').length,card:card.getBoundingClientRect().width,overflow:card.scrollWidth-card.clientWidth});
 }
 document.getElementById('out').textContent=JSON.stringify(results);
 </script></body></html>`, '1600,900');
 for(const item of measured) {
  assert.equal(item.tracks, item.width < 544 ? 1 : item.width === 900 ? 3 : item.cap, JSON.stringify(item));
  assert.ok(item.card >= Math.min(272,item.width), JSON.stringify(item));
  assert.equal(item.overflow,0,JSON.stringify(item));
 }
}, 75_000);
