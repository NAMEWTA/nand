import assert from 'node:assert/strict';
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

function chrome<T>(html: string): T {
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
			'--window-size=1200,800',
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
<div class="nand-dashboard-root" data-layout="stacked" style="width:288px;height:1950px">
  <div class="dashboard-main">
    <div class="dashboard-quicknote"><span class="dashboard-quicknote-chip">Today</span><span>capture</span></div>
    <div class="dashboard-scroll-region"><div class="next">week</div></div>
  </div>
</div>
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
<body class="nand-theme--claude-code theme-light">
<div class="nand-contacts-surface"><button class="nand-contacts-row-name">王</button></div>
<pre id="out"></pre>
<script>
function tone() {
  const button = document.querySelector('.nand-contacts-row-name');
  const surface = document.querySelector('.nand-contacts-surface');
  surface.style.background = 'var(--background-primary)';
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
