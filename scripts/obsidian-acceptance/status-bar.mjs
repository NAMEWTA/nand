// Acceptance: NAND's usage and status entries live in Obsidian's own status bar.
// HOME, CLI homes and XDG dirs are pointed at the fixture; the real ~/.codex/hooks.json and ~/.claude/settings.json mtimes are asserted unchanged.
// Run from the repo root after `pnpm build`:
//   NAND_SB_FIXTURE=/tmp/nand-statusbar-01 NAND_SB_CDP_PORT=19571 [NAND_SB_MINIMAL_DIR=~/refs/obsidian-minimal-9.0.2] node scripts/obsidian-acceptance/status-bar.mjs
import fs from 'node:fs/promises';
import os from 'node:os';
import { openSync, closeSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { connect } from './cdp.mjs';
const root = process.env.NAND_SB_FIXTURE;
assert.ok(root && root.startsWith('/tmp/nand-statusbar-'));
await fs.mkdir(root);
const vault = path.join(root, 'vault'), profile = path.join(root, 'profile'), evidence = path.join(root, 'evidence');
const pluginDir = path.join(vault, '.obsidian/plugins/nand');
for (const dir of [pluginDir, profile, evidence, path.join(vault, '.nand/config'), path.join(root, 'config')]) await fs.mkdir(dir, { recursive: true });
for (const file of ['main.js', 'styles.css', 'manifest.json']) await fs.copyFile(file, path.join(pluginDir, file));
await fs.writeFile(path.join(vault, '.obsidian/community-plugins.json'), '["nand"]');
const minimalDir = process.env.NAND_SB_MINIMAL_DIR;
if (minimalDir) {
	const themeDir = path.join(vault, '.obsidian/themes/Minimal');
	await fs.mkdir(themeDir, { recursive: true });
	for (const file of ['theme.css', 'manifest.json', 'LICENSE']) await fs.copyFile(path.join(minimalDir, file), path.join(themeDir, file));
	await fs.writeFile(path.join(vault, '.obsidian/appearance.json'), JSON.stringify({ cssTheme: 'Minimal' }));
}
const modules = { home: true, archives: false, comments: false, browser: false, agent: false, icons: false, sync: false, automations: false, notifications: true };
await fs.writeFile(path.join(vault, '.nand/config/settings.json'), JSON.stringify({ version: 1, namespaces: { app: { language: 'en', introSeen: true, modules } } }));
await fs.writeFile(path.join(vault, 'Welcome.md'), '# NAND status bar fixture\n');
await fs.writeFile(path.join(profile, 'obsidian.json'), JSON.stringify({ updateDisabled: true, vaults: { abcdef1234567890: { path: vault, ts: Date.now(), open: true } } }));
// Never touch the real home: HOME and every CLI/XDG location live under the fixture. The real CLI
// configs are only stat()ed, before and after, to prove nothing wrote to them.
const realHome = os.homedir();
const guarded = [path.join(realHome, '.codex/hooks.json'), path.join(realHome, '.claude/settings.json')];
const mtimes = async () => Object.fromEntries(await Promise.all(guarded.map(async (file) => [file, await fs.stat(file).then((stat) => stat.mtimeMs, () => null)])));
const mtimesBefore = await mtimes();
const home = path.join(root, 'home');
const isolated = {
	HOME: home,
	USERPROFILE: home,
	CODEX_HOME: path.join(home, '.codex'),
	CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
	GROK_HOME: path.join(home, '.grok'),
	GEMINI_CLI_HOME: path.join(home, '.gemini'),
	XDG_CONFIG_HOME: path.join(root, 'config'),
	XDG_DATA_HOME: path.join(home, '.local/share'),
	XDG_CACHE_HOME: path.join(home, '.cache'),
	XDG_STATE_HOME: path.join(home, '.local/state'),
	XDG_RUNTIME_DIR: path.join(root, 'run'),
};
for (const [name, value] of Object.entries(isolated)) {
	assert.ok(value.startsWith(root + path.sep), `${name} must stay inside the fixture`);
	await fs.mkdir(value, { recursive: true, mode: 0o700 });
}
const port = process.env.NAND_SB_CDP_PORT || '19571';
process.env.NAND_CDP_URL = 'http://127.0.0.1:' + port;
function start() {
	const log = openSync(path.join(evidence, 'app.log'), 'a');
	const child = spawn('/opt/Obsidian/obsidian', ['--no-sandbox', '--disable-gpu', '--user-data-dir=' + profile, '--remote-debugging-port=' + port], { env: { ...process.env, ...isolated }, stdio: ['ignore', log, log] });
	closeSync(log);
	return child;
}
let proc = start();
let c;
const results = [], errors = [];
async function waitFor(fn, name) {
	for (let i = 0; i < 600; i++) {
		if (await fn().catch(() => false)) return;
		await delay(100);
	}
	throw new Error('Timeout: ' + name);
}
const center = (connection, selector, text) => connection.evaluate(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => ${text ? 'e.textContent.includes(' + JSON.stringify(text) + ')' : 'true'}); if (!e) throw Error('Missing ' + ${JSON.stringify(selector)}); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
async function mouse(connection, point, button = 'left') {
	await connection.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
	await connection.send('Input.dispatchMouseEvent', { type: 'mousePressed', button, clickCount: 1, ...point });
	await connection.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button, clickCount: 1, ...point });
	await delay(300);
}
const click = async (connection, selector, text) => mouse(connection, await center(connection, selector, text));
const rightClick = async (connection, selector, text) => mouse(connection, await center(connection, selector, text), 'right');
async function escape(connection) {
	await connection.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
	await connection.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
	await delay(300);
}
async function shot(connection, name, clip) {
	const { data } = await connection.send('Page.captureScreenshot', clip ? { clip: { ...clip, scale: 1 } } : {});
	await fs.writeFile(path.join(evidence, name + '.png'), Buffer.from(data, 'base64'));
}
const barClip = (connection) => connection.evaluate(`(() => { const r = document.querySelector('.status-bar').getBoundingClientRect(); return { x: Math.max(0, r.right - 760), y: Math.max(0, r.top - 4), width: Math.min(760, r.width), height: r.height + 8 }; })()`);
const menuTitles = (connection) => connection.evaluate(`[...document.querySelectorAll('.menu .menu-item')].map(e => ({ title: e.querySelector('.menu-item-title')?.textContent, checked: !!e.querySelector('.menu-item-icon .svg-icon') }))`);
// Deterministic fixtures through the service registry: no CLI credentials or remote quota API is touched.
const fixture = `(() => {
	const p = app.plugins.plugins.nand, peek = p.services.peek.bind(p.services);
	if (!window.__sb) {
		window.__sb = { observed: 0, refreshed: 0 };
		const listeners = new Set();
		const snapshot = { refreshing: false, providers: [
			{ id: 'claude-code', name: 'Claude', windows: [{ label: '5h', usedPercent: 78 }, { label: '7d', usedPercent: 94 }] },
			{ id: 'codex', name: 'Codex', windows: [{ label: '5h', usedPercent: 100, resetsAt: Date.now() + 3600000 }, { label: '7d', usedPercent: 80 }] },
			{ id: 'gemini', name: 'Gemini', windows: [{ label: 'Pro', usedPercent: 40 }] },
		] };
		window.__sb.usage = { snapshot: () => snapshot, subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); }, refresh: async () => { window.__sb.refreshed++; }, setDisplay() {}, observeWindow: () => { window.__sb.observed++; return () => { window.__sb.observed--; }; } };
		window.__sb.inbox = { unread: 3, subscribe: () => () => {} };
		window.__sb.agent = { title: () => undefined, panel: () => ({ sections: [] }), status: () => window.__sb.agentOff ? [] : [{ id: 's1', status: 'waiting' }, { id: 's2', status: 'running' }, { id: 's3', status: 'running' }], subscribe: () => () => {} };
		window.__sb.restore = () => { p.services.peek = peek; p.workbenchRefresh(); };
	}
	p.services.peek = (key) => key.owner === 'agent' && key.id === 'usage' ? window.__sb.usage : key.owner === 'notifications' && key.id === 'inbox' ? window.__sb.inbox : key.owner === 'agent' && key.id === 'workbench' ? window.__sb.agent : peek(key);
	p.workbenchRefresh();
	return true;
})()`;
const state = (connection) => connection.evaluate(`({
	usage: !!document.querySelector('.status-bar .nand-status-usage:not([hidden])'),
	usageText: document.querySelector('.status-bar .nand-status-usage:not([hidden])')?.textContent ?? null,
	segments: [...document.querySelectorAll('.status-bar [data-status-segment]')].map((e) => ({ id: e.dataset.statusSegment, text: e.textContent, tone: e.dataset.tone, label: e.querySelector('button')?.getAttribute('aria-label') })),
	roots: document.querySelectorAll('.nand-status-usage-root').length,
	leaves: app.workspace.getLeavesOfType('nand-workbench-view').length,
	settings: app.plugins.plugins.nand?.appSettings?.get().statusBar,
})`);

try {
	await waitFor(async () => { c = await connect(); return true; }, 'CDP');
	c.on('Runtime.exceptionThrown', (event) => errors.push(event.exceptionDetails));
	await c.send('Runtime.enable');
	await waitFor(async () => { await c.evaluate(`(()=>{[...document.querySelectorAll('button')].find(e=>e.textContent==='Trust author and enable plugins')?.click();return true;})()`); return c.evaluate(`!!globalThis.app?.plugins.plugins.nand?.appSettings`); }, 'plugin');
	assert.equal(await c.evaluate('app.vault.adapter.basePath'), vault);
	await waitFor(() => c.evaluate(`!!app.workspace.layoutReady && !!app.plugins.plugins.nand.workbench`), 'workbench composed');
	await c.evaluate(`require('@electron/remote').getCurrentWindow().setSize(1500, 900); true`);
	await delay(500);
	// 1. No workbench leaf exists, yet usage and status entries are in the bottom bar.
	await c.evaluate(fixture);
	await waitFor(() => c.evaluate(`!!document.querySelector('.status-bar .nand-status-usage button')`), 'usage item');
	let s = await state(c);
	assert.equal(s.leaves, 0, 'workbench is closed');
	assert.ok(s.usage && s.usageText.includes('94%') && s.usageText.includes('100%'), JSON.stringify(s));
	assert.deepEqual(s.segments.map((x) => x.id), ['agents-waiting', 'agents-running', 'notifications']);
	assert.equal(s.segments[2].text, '3');
	assert.equal(await c.evaluate('window.__sb.observed'), 1, 'usage item observes its window');
	assert.equal(await c.evaluate(`document.querySelectorAll('.nand-status-bar,[data-shell-region=status]').length`), 0);
	const metrics = await c.evaluate(`(() => { const bar = document.querySelector('.status-bar').getBoundingClientRect(), item = document.querySelector('.status-bar .nand-status-usage button').getBoundingClientRect(), native = document.querySelector('.status-bar .status-bar-item:not(.nand-status-item):not(.nand-status-usage)'); return { bar: bar.height, item: item.height, within: item.top >= bar.top - 1 && item.bottom <= bar.bottom + 1, font: getComputedStyle(document.querySelector('.status-bar .nand-status-usage button')).fontSize, barFont: getComputedStyle(document.querySelector('.status-bar')).fontSize, family: getComputedStyle(document.querySelector('.status-bar .nand-status-usage .nand-ui')).fontFamily === getComputedStyle(document.querySelector('.status-bar')).fontFamily }; })()`);
	results.push({ closedWorkbench: s, metrics });
	assert.ok(metrics.within, JSON.stringify(metrics));
	for (const theme of ['theme-light', 'theme-dark']) {
		await c.evaluate(`app.vault.setConfig('theme', '${theme === 'theme-light' ? 'moonstone' : 'obsidian'}'); app.updateTheme(); true`);
		await waitFor(() => c.evaluate(`document.body.classList.contains('${theme}')`), 'theme ' + theme);
		await delay(400);
		await shot(c, `${theme}-bar`, await barClip(c));
		await click(c, '.status-bar .nand-status-usage button');
		await waitFor(() => c.evaluate(`!!document.querySelector('[data-slot=dropdown-menu-content]')`), 'roster');
		const panel = await c.evaluate(`(() => { const e = document.querySelector('[data-slot=dropdown-menu-content]'); const r = e.getBoundingClientRect(); const bar = document.querySelector('.status-bar').getBoundingClientRect(); return { portal: !!e.closest('.nand-portal-root'), ui: !!e.closest('.nand-ui'), above: r.bottom <= bar.top + 1, inside: r.left >= 0 && r.right <= innerWidth, text: e.textContent }; })()`);
		assert.ok(panel.portal && panel.ui && panel.above && panel.inside, JSON.stringify(panel));
		assert.ok(panel.text.includes('Claude') && panel.text.includes('Codex') && panel.text.includes('Gemini'));
		results.push({ theme, panel: { ...panel, text: undefined } });
		await shot(c, `${theme}-roster`);
		if (theme === 'theme-dark') {
			await click(c, '[data-slot=dropdown-menu-content] [role=menuitem][aria-label="Refresh usage data"]');
			assert.ok((await c.evaluate('window.__sb.refreshed')) >= 1, 'refresh reaches the service');
		}
		await escape(c);
		assert.equal(await c.evaluate(`!!document.querySelector('[data-slot=dropdown-menu-content]')`), false);
	}
	// Items that come and go are reused: the plugin's host registrations must not grow with every cycle.
	const registrations = () => c.evaluate('app.plugins.plugins.nand._events.length');
	const before = await registrations();
	for (let i = 0; i < 25; i++) {
		await c.evaluate(`window.__sb.agentOff = ${i % 2 === 0}; app.plugins.plugins.nand.workbenchRefresh(); true`);
		await waitFor(() => c.evaluate(`document.querySelectorAll('.status-bar [data-status-segment^=agents-]').length === ${i % 2 === 0 ? 0 : 2}`), 'agent segments toggle ' + i);
	}
	await c.evaluate(`window.__sb.agentOff = false; app.plugins.plugins.nand.workbenchRefresh(); true`);
	await waitFor(() => c.evaluate(`document.querySelectorAll('.status-bar [data-status-segment^=agents-]').length === 2`), 'agent segments restored');
	const after = await registrations();
	assert.ok(after - before <= 2, `host registrations grew from ${before} to ${after}`);
	results.push({ registrations: { before, after } });
	// 2. A status entry opens its page, even with no workbench leaf.
	await click(c, '.status-bar [data-status-segment=notifications] button');
	await waitFor(() => c.evaluate(`app.workspace.getLeavesOfType('nand-workbench-view')[0].view.getState().target.feature === 'notifications'`), 'segment click navigates');
	await c.evaluate(`app.workspace.detachLeavesOfType('nand-workbench-view'); true`);
	await delay(300);
	// 2. The panel can open the workbench on the usage page.
	await click(c, '.status-bar .nand-status-usage button');
	await click(c, '[data-slot=dropdown-menu-content] [role=menuitem]', 'Usage details and history');
	await waitFor(() => c.evaluate(`app.workspace.getLeavesOfType('nand-workbench-view').length === 1`), 'workbench opened from usage');
	assert.equal(await c.evaluate(`app.workspace.getLeavesOfType('nand-workbench-view')[0].view.getState().target.feature`), 'terminal');
	await c.evaluate(`app.workspace.detachLeavesOfType('nand-workbench-view'); true`);
	await delay(300);
	s = await state(c);
	assert.ok(s.usage && s.segments.length === 3, 'items survive closing the workbench');
	// 3. Right-click: native menu with checkable entries; hiding is stored in app.statusBar.segments.
	await rightClick(c, '.status-bar [data-status-segment=notifications] button');
	const menu = await menuTitles(c);
	await shot(c, 'status-context');
	for (const title of ['Usage', 'Waiting for input', 'Running agents', 'Automations', 'Automation errors', 'Git sync', 'Unsaved dashboard', 'Notifications']) assert.ok(menu.some((m) => m.title === title && m.checked), `menu entry ${title}: ${JSON.stringify(menu)}`);
	assert.ok(menu.some((m) => m.title === 'Usage detail · Detailed') && menu.some((m) => m.title === 'Usage values · Remaining'));
	await click(c, '.menu .menu-item', 'Notifications');
	await waitFor(() => c.evaluate(`!document.querySelector('.status-bar [data-status-segment=notifications]')`), 'notifications hidden');
	assert.equal((await state(c)).settings.segments.notifications, false);
	// Usage display / mode from the same menu.
	await rightClick(c, '.status-bar .nand-status-usage button');
	await click(c, '.menu .menu-item', 'Usage values · Remaining');
	await waitFor(() => c.evaluate(`document.querySelector('.status-bar .nand-status-usage').textContent.includes('22%')`), 'remaining values');
	await rightClick(c, '.status-bar .nand-status-usage button');
	await click(c, '.menu .menu-item', 'Usage detail · Compact');
	await waitFor(() => c.evaluate(`app.plugins.plugins.nand.appSettings.get().statusBar.usageMode === 'compact'`), 'compact');
	await shot(c, 'compact-remaining', await barClip(c));
	// 4. Hiding usage removes the React root; the preference survives a restart.
	await rightClick(c, '.status-bar .nand-status-usage button');
	await click(c, '.menu .menu-item', 'Usage');
	await waitFor(() => c.evaluate(`!document.querySelector('.status-bar .nand-status-usage:not([hidden])')`), 'usage hidden');
	s = await state(c);
	assert.equal(s.roots, 0);
	assert.equal(await c.evaluate('window.__sb.observed'), 0, 'window observation released');
	// Settings are written asynchronously: poll until the file holds the expected value (a half-written
	// file fails to parse and is retried), so a slow disk write is not reported as a persistence failure.
	let config;
	const persistedSegments = async () => {
		try {
			config = JSON.parse(await fs.readFile(path.join(vault, '.nand/config/settings.json'), 'utf8'));
			const segments = config.namespaces?.app?.statusBar?.segments;
			return segments?.notifications === false && segments?.usage === false;
		} catch {
			return false;
		}
	};
	await waitFor(persistedSegments, 'settings.json persisted notifications and usage hidden');
	assert.deepEqual(config.namespaces.app.statusBar.segments, { notifications: false, usage: false });
	assert.ok(!('visible' in config.namespaces.app.statusBar) && !('mirrorToObsidian' in config.namespaces.app.statusBar));
	results.push({ persisted: config.namespaces.app.statusBar });
	await c.evaluate(`setTimeout(()=>require('@electron/remote').app.quit(),50);true`);
	c.close();
	c = null;
	await waitFor(async () => proc.exitCode !== null, 'app shutdown');
	proc = start();
	await waitFor(async () => { c = await connect(); return true; }, 'restarted CDP');
	c.on('Runtime.exceptionThrown', (event) => errors.push(event.exceptionDetails));
	await c.send('Runtime.enable');
	await waitFor(() => c.evaluate(`!!globalThis.app?.plugins.plugins.nand?.appSettings && !!app.workspace.layoutReady && !!app.plugins.plugins.nand.workbench`), 'restarted plugin');
	await c.evaluate(`require('@electron/remote').getCurrentWindow().setSize(1500, 900); true`);
	await c.evaluate(fixture);
	await delay(800);
	s = await state(c);
	assert.equal(s.usage, false, 'usage stays hidden after restart');
	assert.deepEqual(s.segments.map((x) => x.id), ['agents-waiting', 'agents-running']);
	assert.deepEqual(s.settings.segments, { notifications: false, usage: false });
	// Re-show both from the settings page (same preferences, other entry point).
	await c.evaluate(`app.plugins.plugins.nand.openWorkbenchSettings('general').then(()=>true)`);
	await waitFor(() => c.evaluate(`!!document.querySelector('.nand-settings-page')`), 'settings');
	assert.equal(await c.evaluate(`[...document.querySelectorAll('.nand-settings-page [role=switch]')].some(e => /show status bar|mirror/i.test(e.getAttribute('aria-label') ?? ''))`), false, 'retired switches are gone');
	await c.evaluate(`document.querySelector('.nand-settings-page [role=switch][aria-label="Show Usage"]').click(); true`);
	await waitFor(() => c.evaluate(`!!document.querySelector('.status-bar .nand-status-usage button')`), 'usage shown from settings');
	await shot(c, 'settings-status-bar');
	await c.evaluate(`app.workspace.detachLeavesOfType('nand-workbench-view'); true`);
	// 5. Language follows.
	await c.evaluate(`app.plugins.plugins.nand.changeLanguage('zh').then(()=>true)`);
	await waitFor(() => c.evaluate(`document.querySelector('.status-bar [data-status-segment=agents-waiting] button')?.getAttribute('aria-label')?.includes('等待')`), 'zh segment label');
	assert.ok(await c.evaluate(`!!document.querySelector('.status-bar .nand-status-usage button[aria-label="用量"]')`));
	await c.evaluate(`app.plugins.plugins.nand.changeLanguage('en').then(()=>true)`);
	// 6. Services vanish: usage and agent segments leave without a workbench.
	await c.evaluate(`window.__sb.restore(); true`);
	await waitFor(() => c.evaluate(`!document.querySelector('.status-bar .nand-status-usage:not([hidden]),.status-bar [data-status-segment]')`), 'entries leave with their services');
	await c.evaluate(fixture);
	await waitFor(() => c.evaluate(`!!document.querySelector('.status-bar .nand-status-usage:not([hidden])')`), 'entries return');
	// 7. Unloading the plugin removes every item, root and portal.
	await c.evaluate(`app.plugins.disablePlugin('nand').then(()=>true)`);
	await delay(500);
	const gone = await c.evaluate(`({ items: document.querySelectorAll('.nand-status-item,.nand-status-usage').length, roots: document.querySelectorAll('.nand-status-usage-root').length, portals: document.querySelectorAll('.nand-portal-root').length, bar: document.querySelectorAll('.status-bar .status-bar-item').length })`);
	assert.deepEqual({ items: gone.items, roots: gone.roots, portals: gone.portals }, { items: 0, roots: 0, portals: 0 });
	results.push({ unloaded: gone });
	assert.deepEqual(await mtimes(), mtimesBefore, 'real ~/.codex/hooks.json and ~/.claude/settings.json are untouched');
	results.push({ realConfigUntouched: mtimesBefore });
	await fs.writeFile(path.join(evidence, 'result.json'), JSON.stringify({ passed: true, results, errors }, null, 2));
	assert.equal(errors.length, 0, JSON.stringify(errors));
	console.log(evidence);
} catch (error) {
	if (c) { try { await shot(c, 'failure'); console.error(JSON.stringify(await c.evaluate(`({ ready: !!app.workspace.layoutReady, state: app.workspace.getLeavesOfType('nand-workbench-view')[0]?.view.getState(), notices: [...document.querySelectorAll('.notice')].map(e=>e.textContent), unavailable: document.querySelector('[role=status],[role=alert]')?.textContent, notifications: app.plugins.plugins.nand?.moduleState?.('notifications') })`))); } catch {} }
	await fs.writeFile(path.join(evidence, 'result.json'), JSON.stringify({ passed: false, error: String(error), results, errors }, null, 2));
	throw error;
} finally {
	try { c?.close(); } catch {}
	if (proc.exitCode === null) proc.kill('SIGTERM');
}
