import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArchiveCardGrid } from '../../src/modules/archives/ui/ArchiveCardGrid';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, test } from 'vitest';

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
		rmSync(directory, { recursive: true, force: true });
	}
});

function chrome<T>(html: string, windowSize = '1200,800'): T {
	const dir = mkdtempSync(path.join(tmpdir(), 'nand-surface-'));
	fixtures.push(dir);
	const file = path.join(dir, 'page.html');
	writeFileSync(file, html);
	const result = spawnSync(
		chromeExecutable,
		[
			'--headless=new',
			'--disable-gpu',
			'--no-sandbox',
			'--allow-file-access-from-files',
			`--user-data-dir=${path.join(dir, 'profile')}`,
			`--window-size=${windowSize}`,
			'--virtual-time-budget=2000',
			'--dump-dom',
			pathToFileURL(file).href,
		],
		{ encoding: 'utf8', timeout: 30_000, windowsHide: true },
	);
	if (result.error) throw result.error;
	assert.equal(result.status, 0, result.stderr);
	const match = /<pre id="out">([^<]*)<\/pre>/.exec(result.stdout);
	assert.ok(match, result.stdout.slice(-500));
	return JSON.parse(match[1]!.replaceAll('&quot;', '"')) as T;
}

test('a 288px desktop column keeps the quick note at content height', () => {
	const measured = chrome<{ height: number; flex: string; main: number; gap: number }>(`<!doctype html>
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
}, 35_000); // Real Chrome has its own 30s process deadline, including cold startup.

type Tone = { text: string; background: string };

test('archive text and paper differ in light and dark', () => {
	const measured = chrome<{ light: Tone; dark: Tone }>(`<!doctype html>
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
}, 35_000);


test('archive cards follow their container width and respect the five/six-column cap', () => {
 const cards = Array.from({ length: 8 }, (_, i) => createElement('button', { key: i, className: 'min-w-0 whitespace-normal p-4 [overflow-wrap:anywhere]' }, 'Readable person name ' + i));
 const markup = [5, 6].map(columns => `<section data-cap="${columns}" style="width:500px">${renderToStaticMarkup(createElement(ArchiveCardGrid, { columns, children: cards }))}</section>`).join('');
 const measured = chrome<Array<{ cap: number; width: number; tracks: number; card: number; overflow: number }>>(`<!doctype html>
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
}, 35_000);
