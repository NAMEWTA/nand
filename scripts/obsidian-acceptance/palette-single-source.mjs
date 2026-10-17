// Acceptance: NAND's palette and font are set once per window on <body>, so every NAND surface agrees.
// HOME, CLI homes and XDG dirs are pointed at the fixture; nothing reads or writes the real home.
// Run from the repo root after `pnpm build`:
//   NAND_PAL_FIXTURE=/tmp/nand-palette-01 NAND_PAL_CDP_PORT=19623 NAND_PAL_MINIMAL_DIR=~/refs/obsidian-minimal-9.0.2 xvfb-run -a node scripts/obsidian-acceptance/palette-single-source.mjs
import fs from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { connect } from './cdp.mjs';
const root = process.env.NAND_PAL_FIXTURE;
assert.ok(root && root.startsWith('/tmp/nand-palette-'));
await fs.mkdir(root);
const vault = path.join(root, 'vault'), profile = path.join(root, 'profile'), evidence = path.join(root, 'evidence');
const pluginDir = path.join(vault, '.obsidian/plugins/nand');
for (const dir of [pluginDir, profile, evidence, path.join(vault, '.nand/config'), path.join(root, 'config')]) await fs.mkdir(dir, { recursive: true });
for (const file of ['main.js', 'styles.css', 'manifest.json']) await fs.copyFile(file, path.join(pluginDir, file));
await fs.writeFile(path.join(vault, '.obsidian/community-plugins.json'), '["nand"]');
const minimalDir = process.env.NAND_PAL_MINIMAL_DIR;
assert.ok(minimalDir, 'NAND_PAL_MINIMAL_DIR is required');
const themeDir = path.join(vault, '.obsidian/themes/Minimal');
await fs.mkdir(themeDir, { recursive: true });
for (const file of ['theme.css', 'manifest.json', 'LICENSE']) await fs.copyFile(path.join(minimalDir, file), path.join(themeDir, file));
const modules = { home: true, archives: false, comments: true, browser: false, agent: true, icons: false, sync: false, automations: false, notifications: false };
await fs.writeFile(path.join(vault, '.nand/config/settings.json'), JSON.stringify({ version: 1, namespaces: { app: { language: 'en', introSeen: true, modules, palette: 'orca' } } }));
await fs.writeFile(path.join(vault, 'Welcome.md'), '# Palette fixture\n\nSome text.\n');
await fs.writeFile(path.join(profile, 'obsidian.json'), JSON.stringify({ updateDisabled: true, vaults: { abcdef1234567890: { path: vault, ts: Date.now(), open: true } } }));
const home = path.join(root, 'home');
const isolated = {
	HOME: home, USERPROFILE: home,
	CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
	GROK_HOME: path.join(home, '.grok'), GEMINI_CLI_HOME: path.join(home, '.gemini'),
	XDG_CONFIG_HOME: path.join(root, 'config'), XDG_DATA_HOME: path.join(home, '.local/share'),
	XDG_CACHE_HOME: path.join(home, '.cache'), XDG_STATE_HOME: path.join(home, '.local/state'),
	XDG_RUNTIME_DIR: path.join(root, 'run'),
};
for (const [name, value] of Object.entries(isolated)) {
	assert.ok(value.startsWith(root + path.sep), `${name} must stay inside the fixture`);
	await fs.mkdir(value, { recursive: true, mode: 0o700 });
}
const port = process.env.NAND_PAL_CDP_PORT || '19623';
process.env.NAND_CDP_URL = 'http://127.0.0.1:' + port;
const log = openSync(path.join(evidence, 'app.log'), 'a');
const proc = spawn('/opt/Obsidian/obsidian', ['--no-sandbox', '--disable-gpu', '--user-data-dir=' + profile, '--remote-debugging-port=' + port], { env: { ...process.env, ...isolated }, stdio: ['ignore', log, log] });
closeSync(log);
let c;
const results = [], errors = [];
async function waitFor(fn, name) {
	for (let i = 0; i < 600; i++) {
		if (await fn().catch(() => false)) return;
		await delay(100);
	}
	throw new Error('Timeout: ' + name);
}
async function shot(name) {
	const { data } = await c.send('Page.captureScreenshot');
	await fs.writeFile(path.join(evidence, name + '.png'), Buffer.from(data, 'base64'));
}
const nand = (code) => c.evaluate(`(async () => { const p = app.plugins.plugins.nand; ${code} })()`);
// Every .nand-ui of a window must resolve the same tokens; the probe is a standalone one appended straight under <body>.
const TOKENS = ['--background', '--foreground', '--primary', '--destructive', '--destructive-foreground', '--status-success', '--status-warning', '--agent-question', '--chart-1'];
const scan = (target) => c.evaluate(`(() => {
	const doc = ${target === 'popout' ? 'window.__popout.document' : 'document'};
	const win = doc.defaultView;
	const probe = doc.body.createDiv({ cls: 'nand-ui' });
	const nested = probe.createDiv({ cls: 'nand-ui' });
	const read = (el) => Object.fromEntries(${JSON.stringify(TOKENS)}.map((name) => [name, win.getComputedStyle(el).getPropertyValue(name).trim()]));
	const surfaces = [...doc.querySelectorAll('.nand-ui')].filter((el) => el !== probe && el !== nested).map((el) => ({ cls: el.className.toString().slice(0, 60), tokens: read(el), font: win.getComputedStyle(el).getPropertyValue('--nd-font-sans').trim().slice(0, 24) }));
	const out = { palette: doc.body.getAttribute('data-nand-palette'), font: doc.body.getAttribute('data-nand-font'), probe: read(probe), nested: read(nested), surfaces, host: win.getComputedStyle(doc.body).getPropertyValue('--interactive-accent').trim() };
	probe.remove();
	return out;
})()`);
const ORCA = {
	'theme-light': { '--background': '#ffffff', '--primary': '#171717', '--destructive': '#e40014', '--destructive-foreground': '#ffffff', '--agent-question': 'oklch(64.6% 0.222 41.116)', '--chart-1': 'oklch(80.9% 0.105 251.813)' },
	'theme-dark': { '--background': '#0a0a0a', '--primary': '#e5e5e5', '--destructive': '#ff6568', '--destructive-foreground': '#0a0a0a', '--agent-question': 'oklch(70.5% 0.213 47.604)', '--chart-1': 'oklch(80.9% 0.105 251.813)' },
};
function verify(label, scanned, palette, theme) {
	const expected = palette === 'orca' ? ORCA[theme] : null;
	const sets = [scanned.probe, scanned.nested, ...scanned.surfaces.map((s) => s.tokens)];
	for (const tokens of sets) {
		assert.deepEqual(tokens, scanned.probe, `${label}: every .nand-ui resolves the same tokens ${JSON.stringify(scanned.surfaces)}`);
		if (expected) for (const [name, value] of Object.entries(expected)) assert.equal(tokens[name], value, `${label}: ${name}`);
		else assert.equal(tokens['--primary'], scanned.host, `${label}: host palette follows --interactive-accent`);
	}
}
try {
	for (let i = 0; i < 600 && !c; i++) { try { c = await connect(); } catch { await delay(100); } }
	assert.ok(c, 'CDP');
	c.on('Runtime.exceptionThrown', (event) => errors.push(event.exceptionDetails));
	await c.send('Runtime.enable');
	await waitFor(async () => { await c.evaluate(`(()=>{[...document.querySelectorAll('button')].find(e=>e.textContent==='Trust author and enable plugins')?.click();return true;})()`); return c.evaluate(`!!globalThis.app?.plugins.plugins.nand?.appSettings`); }, 'plugin');
	await waitFor(() => c.evaluate(`!!app.workspace.layoutReady && !!app.plugins.plugins.nand.workbench`), 'workbench composed');
	await c.evaluate(`require('@electron/remote').getCurrentWindow().setSize(1500, 900); true`);

	// The attribute exists as soon as the plugin loads, with no workbench open.
	assert.equal(await c.evaluate(`app.workspace.getLeavesOfType('nand-workbench-view').length`), 0);
	assert.equal(await c.evaluate(`document.body.getAttribute('data-nand-palette')`), 'orca');
	results.push({ beforeWorkbench: await scan('main') });

	// A real popout window: wait until the leaf actually lives in another document.
	await c.evaluate(`(async () => { const leaf = app.workspace.openPopoutLeaf(); await leaf.openFile(app.vault.getFiles()[0]); window.__leaf = leaf; return true; })()`);
	await waitFor(() => c.evaluate(`window.__leaf.view.containerEl.ownerDocument !== document`), 'leaf moved into the popout document');
	await c.evaluate(`window.__popout = window.__leaf.view.containerEl.ownerDocument.defaultView; true`);
	assert.equal(await c.evaluate(`window.__popout !== window && window.__popout.document !== document`), true, 'popout is a different window');
	await waitFor(() => c.evaluate(`window.__popout.document.body.getAttribute('data-nand-palette') === 'orca'`), 'popout attributes');

	const surfaces = [
		['home', `await p.openWorkbench({ feature: 'dashboard' }, window)`, '[data-type="nand-workbench-view"] .nand-ui'],
		['agent', `await p.openWorkbench({ feature: 'terminal' }, window)`, '[data-type="nand-workbench-view"] .nand-ui .bg-sidebar'],
		['settings', `await p.openWorkbench({ feature: 'settings', section: 'general' }, window)`, '[data-type="nand-workbench-view"] .nand-settings-page'],
		['comments', `await app.workspace.getRightLeaf(false).setViewState({ type: 'nand-comments-view', active: true })`, '[data-type="nand-comments-view"] .nand-ui'],
	];
	const matrix = [['orca', 'moonstone', '', 'theme-light'], ['orca', 'obsidian', '', 'theme-dark'], ['orca', 'moonstone', 'Minimal', 'theme-light'], ['orca', 'obsidian', 'Minimal', 'theme-dark'],
		['host', 'moonstone', '', 'theme-light'], ['host', 'obsidian', '', 'theme-dark'], ['host', 'moonstone', 'Minimal', 'theme-light'], ['host', 'obsidian', 'Minimal', 'theme-dark']];
	for (const [palette, base, css, theme] of matrix) {
		const name = `${palette}-${css || 'default'}-${theme}`;
		await nand(`await p.appSettings.update((d) => { d.palette = ${JSON.stringify(palette)}; }, { persist: 'immediate' }); return true;`);
		await c.evaluate(`app.customCss.setTheme(${JSON.stringify(css)}); app.vault.setConfig('theme', '${base}'); app.updateTheme(); true`);
		await waitFor(() => c.evaluate(`document.body.classList.contains('${theme}') && document.body.getAttribute('data-nand-palette') === '${palette}' && window.__popout.document.body.getAttribute('data-nand-palette') === '${palette}'`), 'theme ' + name);
		await delay(500);
		for (const [surface, open, expected] of surfaces) {
			await nand(`${open}; return true;`);
			await waitFor(() => c.evaluate(`!!document.querySelector(${JSON.stringify(expected)})`), `${name}/${surface} mounted`);
			await delay(700);
			const main = await scan('main');
			assert.ok(main.surfaces.length > 0, `${name}/${surface}: a NAND surface is mounted`);
			verify(`${name}/${surface}`, main, palette, theme);
			await shot(`${name}-${surface}`);
			results.push({ name, surface, count: main.surfaces.length, primary: main.probe['--primary'] });
		}
		verify(`${name}/popout`, await scan('popout'), palette, theme);
	}

	// Font follows the same attribute.
	await nand(`await p.appSettings.update((d) => { d.font = 'host'; }, { persist: 'immediate' }); return true;`);
	await waitFor(() => c.evaluate(`document.body.getAttribute('data-nand-font') === 'host' && window.__popout.document.body.getAttribute('data-nand-font') === 'host'`), 'font');
	const hostFont = await scan('main');
	assert.ok(hostFont.surfaces.every((s) => !s.font.startsWith('"Geist"')), JSON.stringify(hostFont.surfaces));
	await nand(`await p.appSettings.update((d) => { d.font = 'geist'; }, { persist: 'immediate' }); return true;`);

	const bodies = () => c.evaluate(`[document.body, window.__popout.document.body].map((b) => [b.getAttribute('data-nand-palette'), b.getAttribute('data-nand-font')])`);
	const update = (palette, font) => nand(`await p.appSettings.update((d) => { d.palette = ${JSON.stringify(palette)}; d.font = ${JSON.stringify(font)}; d.devGallery = true; }, { persist: 'immediate' }); return true;`);
	const bodiesAre = async (expected) => JSON.stringify(await bodies()) === JSON.stringify(expected);
	const openGallery = async () => {
		await nand(`await p.openWorkbench({ feature: 'settings', section: 'components' }, window); return true;`);
		await waitFor(() => c.evaluate(`!!document.querySelector('[data-slot=component-gallery]')`), 'gallery');
	};
	const contrast = () => c.evaluate(`(() => {
		const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
		const pixel = (css, under) => { ctx.clearRect(0, 0, 1, 1); if (under) { ctx.fillStyle = under; ctx.fillRect(0, 0, 1, 1); } ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
		const lum = (rgb) => rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
		const el = [...document.querySelectorAll('[data-slot=component-gallery] button')].find((b) => /bg-destructive/.test(b.className));
		const cs = getComputedStyle(el), base = getComputedStyle(el.closest('.nand-ui')).getPropertyValue('--background').trim();
		const bg = pixel(cs.backgroundColor, base), fg = pixel(cs.color, 'rgb(' + bg.join(',') + ')');
		const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
		return { fg, bg, ratio: (hi + 0.05) / (lo + 0.05) };
	})()`);

	// Component gallery: a plain sample page that follows the global setting; it writes no attribute anywhere.
	const galleryTokens = () => c.evaluate(`({ primary: getComputedStyle(document.querySelector('[data-slot=component-gallery]')).getPropertyValue('--primary').trim(), accent: getComputedStyle(document.body).getPropertyValue('--interactive-accent').trim() })`);
	const noPreviewAttributes = () => c.evaluate(`!document.querySelector('[data-nand-preview-palette],[data-nand-preview-font]') && ![...document.querySelectorAll('.nand-portal-root')].some((e) => [...e.attributes].some((a) => a.name !== 'class'))`);
	await c.evaluate(`app.customCss.setTheme(''); app.vault.setConfig('theme', 'obsidian'); app.updateTheme(); true`);
	await update('orca', 'geist');
	await waitFor(() => bodiesAre([['orca', 'geist'], ['orca', 'geist']]), 'orca/geist everywhere');
	await openGallery();
	assert.equal((await galleryTokens()).primary, '#e5e5e5', 'gallery follows the global Orca palette');
	assert.equal(await noPreviewAttributes(), true, 'no preview attribute on the gallery or the shared portal root');
	await shot('gallery-orca');
	const dark = await contrast();
	assert.ok(dark.ratio >= 4.5, 'destructive button (dark) ' + JSON.stringify(dark));
	await c.evaluate(`app.vault.setConfig('theme', 'moonstone'); app.updateTheme(); true`);
	await waitFor(() => c.evaluate(`document.body.classList.contains('theme-light')`), 'light');
	await delay(400);
	const light = await contrast();
	assert.ok(light.ratio >= 4.5, 'destructive button (light) ' + JSON.stringify(light));
	results.push({ destructiveContrast: { dark, light } });
	await c.evaluate(`app.vault.setConfig('theme', 'obsidian'); app.updateTheme(); true`);
	await update('host', 'geist');
	await waitFor(async () => { const t = await galleryTokens(); return t.primary === t.accent; }, 'gallery follows the host palette');
	assert.equal(await noPreviewAttributes(), true);
	await update('orca', 'host');
	await waitFor(() => bodiesAre([['orca', 'host'], ['orca', 'host']]), 'setting reaches both windows');
	await nand(`await p.openWorkbench({ feature: 'dashboard' }, window); return true;`);
	await delay(500);
	assert.deepEqual(await bodies(), [['orca', 'host'], ['orca', 'host']], 'leaving the gallery changes nothing');
	assert.equal(await noPreviewAttributes(), true);

	// Unloading with the gallery open leaves nothing behind in either window.
	await openGallery();
	await c.evaluate(`void app.plugins.disablePlugin('nand'); true`);
	await waitFor(() => bodiesAre([[null, null], [null, null]]), 'attributes removed on unload');
	await delay(800);
	assert.deepEqual(await bodies(), [[null, null], [null, null]], 'nothing re-writes the attributes after unload');

	// Re-enabling while the popout still exists: it is adopted without any window-open event, and follows later updates.
	await c.evaluate(`void app.plugins.enablePlugin('nand'); true`);
	await waitFor(() => c.evaluate(`!!app.plugins.plugins.nand?.appSettings && !!app.plugins.plugins.nand.workbench`), 'plugin re-enabled');
	await waitFor(() => bodiesAre([['orca', 'host'], ['orca', 'host']]), 're-enabled plugin adopts the existing popout');
	await update('host', 'geist');
	await waitFor(() => bodiesAre([['host', 'geist'], ['host', 'geist']]), 'popout follows updates after re-enable');
	results.push({ reenableExistingPopout: await bodies() });

	// Finally unload again.
	await c.evaluate(`void app.plugins.disablePlugin('nand'); true`);
	await waitFor(() => bodiesAre([[null, null], [null, null]]), 'attributes removed on final unload');
	await fs.writeFile(path.join(evidence, 'result.json'), JSON.stringify({ passed: true, results, errors }, null, 2));
	assert.equal(errors.length, 0, JSON.stringify(errors));
	console.log(evidence);
} catch (error) {
	if (c) { try { await shot('failure'); } catch {} }
	await fs.writeFile(path.join(evidence, 'result.json'), JSON.stringify({ passed: false, error: String(error), results, errors }, null, 2));
	throw error;
} finally {
	try { c?.close(); } catch {}
	if (proc.exitCode === null) proc.kill('SIGTERM');
}
