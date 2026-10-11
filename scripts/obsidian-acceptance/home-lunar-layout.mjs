// Real Windows Obsidian: issue #150, translated lunar metadata and the fortune button.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const runtime = await launchFreshVault({
 root: process.argv[2], port: 9276,
 files: { 'Board.md': '---\nlayout: stacked\nwidgets:\n  - memberId: lunar\n    provider: home\n    kind: lunar\n    instanceId: default\n---\n## Notes\n### Welcome\nLunar layout acceptance.\n' },
 settings: { version: 1, namespaces: {
  app: { language: 'en', introSeen: true, modules: { home: true, agent: false, automations: false, news: false, browser: false, archives: false, notifications: false, sync: false, comments: false, icons: false } },
  home: { dashboardFile: 'Board', workspaceFiles: ['Board'], workspaceNames: ['Board'], widgetLunarEnabled: true, widgetWeatherEnabled: false, widgetMusicEnabled: false, pomodoroEnabled: false },
 } },
});
const c = runtime.connection, rows = [];
try {
 await c.evaluate(`app.workspace.leftSplit.collapse();app.workspace.rightSplit.collapse();app.plugins.plugins.nand.openWorkbench({feature:'dashboard',resourceId:'Board'})`);
 for (const language of ['en', 'zh']) for (const preset of ['system', 'claude-code', 'eye-care']) for (const dark of [false, true]) for (const width of [500, 800, 1500]) {
  await c.evaluate(`app.plugins.plugins.nand.appSettings.update(d=>{d.language=${JSON.stringify(language)}});app.plugins.plugins.nand.theme.update(d=>{d.preset=${JSON.stringify(preset)}});app.changeTheme(${JSON.stringify(dark ? 'obsidian' : 'moonstone')});true`);
  await c.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  const deadline = Date.now() + 20000;
  while (!await c.evaluate(`!!document.querySelector('.dashboard-sidebar-lunar-meta')`)) { assert.ok(Date.now() < deadline, 'lunar widget renders'); await delay(100); }
  await c.evaluate("(()=>{const b=document.querySelector('.dashboard-sidebar-pin-btn');if(b&&!b.classList.contains('dashboard-sidebar-pin-btn--active'))b.click();document.querySelector('.dashboard-sidebar-lunar')?.scrollIntoView({block:'nearest'});})()");
  await delay(250);
  const detail = await c.evaluate(`(()=>{const card=document.querySelector('.dashboard-sidebar-lunar'),button=card.querySelector('.dashboard-sidebar-lunar-fortune-btn'),b=button.getBoundingClientRect(),meta=card.querySelector('.dashboard-sidebar-lunar-meta');const rects=[...meta.querySelectorAll('span')].flatMap(e=>{const r=document.createRange();r.selectNodeContents(e);return [...r.getClientRects()]});return{button:{width:b.width,height:b.height},visible:getComputedStyle(button).visibility==='visible',text:meta.textContent,overlap:rects.some(r=>r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top),overflow:card.scrollWidth>card.clientWidth+1||card.scrollHeight>card.clientHeight+1}})()`);
  const name = `${language}-${preset}-${dark ? 'dark' : 'light'}-${width}`;
  const passed = !detail.overlap && !detail.overflow && ((width < 960 && detail.button.width === 0) || (detail.visible && detail.button.width >= 32 && detail.button.height >= 32));
  rows.push({ name, passed, detail });
  await runtime.shot(`lunar-layout-${name}`);
  assert.ok(passed, name + ': ' + JSON.stringify(detail));
 }
 assert.ok(rows.some(row => row.detail.button.width >= 32), 'matrix includes visible lunar widgets');
 assert.deepEqual(await c.evaluate('nandAcceptanceErrors'), []);
} finally {
 await fs.writeFile(path.join(runtime.evidence, 'review.json'), JSON.stringify({ rows, unverified: ['Non-Windows hosts', 'Physical mobile hardware'] }, null, 2));
 console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length, failed: rows.filter(row => !row.passed) }));
 await runtime.stop();
}
