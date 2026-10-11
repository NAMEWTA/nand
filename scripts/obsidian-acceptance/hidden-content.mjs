// Real Windows host: hidden content migration, native links, editing, attachments and restart.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';
import { connect } from './cdp.mjs';

const p = 'app.plugins.plugins.nand', rows = [], errors = [];
const note = '---\nnand-type: person\nnand-id: acceptance-person\nname: Acceptance\n---\n# Acceptance\n\n## Details\n\nneedle-hidden-content\n\n![[pixel.png]]\n';
const source = 'People/Acceptance/基本信息.md', target = '.nand/content/' + source;
const sourceFiles = { [source]: note, 'People/Acceptance/附件.md': 'Attachment markdown', 'Ordinary.md': 'Ordinary stays visible. [[People/Acceptance/基本信息#Details]]', 'People/ordinary.md': 'Unmarked neighbour stays visible', 'Boards/work.md': '---\nwidgets: []\n---\n## Notes\n' };
let runtime, c;
const check = (name, passed, detail) => { rows.push({ name, passed: !!passed, ...(detail === undefined ? {} : { detail }) }); assert.ok(passed, name); };
const until = async (read, name = 'condition') => { const deadline = Date.now() + 30000; while (Date.now() < deadline) { if (await read()) return; await delay(100); } throw new Error('Timed out: ' + name); };
const visible = selector => `[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0)`;
const editor = visible('.nand-content-editor');
const open = resource => c.evaluate(`${p}.openWorkbench({feature:'content',${resource ? 'resourceId:' + JSON.stringify(resource) : ''}},window)`);
const type = async text => { await c.evaluate(`${editor}.focus(); ${editor}.select(); true`); await c.send('Input.insertText', { text }); };
const monitor = async connection => {
 connection.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.exception?.description ?? event.exceptionDetails.text));
 connection.on('Runtime.consoleAPICalled', event => { if (event.type === 'error') errors.push(event.args.map(arg => arg.description ?? arg.value).join(' ')); });
 await connection.send('Runtime.enable');
};
try {
 runtime = await launchFreshVault({ root: process.argv[2], port: 9442, files: sourceFiles, settings: { version: 1, namespaces: {
  app: { language: 'zh', introSeen: true, modules: Object.fromEntries(['home','agent','browser','news','archives','automations','notifications','icons','comments','sync'].map(id => [id, false])) },
  home: { dashboardFile: 'Boards/work', workspaceFiles: ['Boards/work'], workspaceNames: ['Work'] },
 } } }); c = runtime.connection; await monitor(c);
 const manifestPath = path.join(runtime.vault, '.nand/migrations/content/manifest.json');
 const receipt = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
 check('migration-complete-with-owned-files', receipt.stage === 'complete' && receipt.files.length === 3, receipt.files);
 for (const name of [source, 'People/Acceptance/附件.md', 'Boards/work.md']) {
  const retained = await fs.readFile(path.join(runtime.vault, '.nand/migrations/content/originals', name));
  const migrated = await fs.readFile(path.join(runtime.vault, '.nand/content', name));
  check('verified-retained-source:' + name, retained.equals(migrated) && createHash('sha256').update(retained).digest('hex') === receipt.files.find(item => item.source === name).hash && !await fs.stat(path.join(runtime.vault, name)).catch(() => null));
 }
 check('ordinary-neighbours-remain', await fs.readFile(path.join(runtime.vault, 'Ordinary.md'), 'utf8') === sourceFiles['Ordinary.md'] && await fs.readFile(path.join(runtime.vault, 'People/ordinary.md'), 'utf8') === sourceFiles['People/ordinary.md']);
 check('hidden-index-is-independent-of-native-vault', await c.evaluate(`${p}.managedContent.getFileByPath(${JSON.stringify(target)}).kind==='managed' && app.vault.getFileByPath(${JSON.stringify(target)})===null`));
 // Binary created through the real adapter; no UTF-8 approximation or fake TFile.
 const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64');
 await c.evaluate(`${p}.managedContent.createBinary('.nand/content/People/Acceptance/pixel.png', Uint8Array.from(${JSON.stringify([...png])}).buffer)`);
 check('binary-attachment-bytes', (await fs.readFile(path.join(runtime.vault, '.nand/content/People/Acceptance/pixel.png'))).equals(png));
 await open(target); await until(() => c.evaluate(`!!${editor}`), 'editor');
 const saved = note + '\nSaved in native Windows editor.\n'; await type(saved);
 await until(async () => await fs.readFile(path.join(runtime.vault, target), 'utf8') === saved, 'autosave');
 check('native-input-autosaves-under-vault', true);
 await c.evaluate(`[...document.querySelectorAll('.nand-content-page button')].find(e=>e.textContent==='预览').click();true`);
 await until(() => c.evaluate(`!!document.querySelector('.nand-content-body img')?.naturalWidth`), 'relative attachment preview');
 check('relative-attachment-preview', true);
 await runtime.shot('content-preview');
 await open(); await until(() => c.evaluate(`!!${visible('.nand-content-page input[type=search]')}`), 'search');
 await c.evaluate(`(()=>{const input=${visible('.nand-content-page input[type=search]')};input.value='needle-hidden-content';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await until(() => c.evaluate(`document.querySelectorAll('.nand-content-results button').length===1`), 'body search');
 check('search-reads-hidden-markdown-body', await c.evaluate(`document.querySelector('.nand-content-results button').textContent.includes('基本信息')`));
 await c.evaluate(`(async()=>{const leaf=app.workspace.getLeaf('tab');await leaf.openFile(app.vault.getFileByPath('Ordinary.md'),{state:{mode:'preview'}})})()`);
 await until(() => c.evaluate(`!!document.querySelector('.markdown-reading-view a[data-href^=".nand/content/"]')`), 'ordinary link repair');
 await c.evaluate(`document.querySelector('.markdown-reading-view a[data-href^=".nand/content/"]').click();true`);
 await until(() => c.evaluate(`!!${visible('.nand-content-body h2')}`), 'heading preview');
 check('ordinary-wikilink-opens-managed-heading', await c.evaluate(`${visible('.nand-content-body h2')}.textContent==='Details'`));
 for (const preset of ['system', 'claude-code', 'eye-care']) {
  await c.evaluate(`${p}.theme.update(d=>{d.preset=${JSON.stringify(preset)}},{persist:'immediate'})`);
  for (const mode of ['light', 'dark']) {
   await c.evaluate(`app.changeTheme(${JSON.stringify(mode === 'dark' ? 'obsidian' : 'moonstone')})`);
   for (const width of [1100, 780, 500]) {
    await c.send('Emulation.setDeviceMetricsOverride', { width, height: 760, deviceScaleFactor: 1, mobile: false }); await delay(160);
    const detail = await c.evaluate(`(()=>{const page=${visible('.nand-content-page')}, r=page.getBoundingClientRect(),body=page.querySelector('.nand-content-body');return{width:r.width,scroll:page.scrollWidth,client:page.clientWidth,bodyScroll:body.scrollWidth,bodyClient:body.clientWidth,buttons:[...page.querySelectorAll('button')].map(b=>({height:b.getBoundingClientRect().height,width:b.getBoundingClientRect().width})).filter(b=>b.width>0&&b.height>0)}})()`);
    check(`layout:${preset}:${mode}:${width}`, detail.width > 150 && detail.scroll <= detail.client + 2 && detail.bodyScroll <= detail.bodyClient + 2 && detail.buttons.every(b => b.height >= 32 && b.width >= 32), detail);
    await runtime.shot(`content-${preset}-${mode}-${width}`);
   }
  }
 }
 await c.send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 760, deviceScaleFactor: 1, mobile: false });
 await c.send('Emulation.setTouchEmulationEnabled', { enabled: true }); await delay(200);
 check('coarse-controls-44px', await c.evaluate(`(()=>{const page=${visible('.nand-content-page')};return [...page.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0&&b.getBoundingClientRect().height>0).every(b=>b.getBoundingClientRect().height>=44)})()`));
 await c.send('Emulation.setTouchEmulationEnabled', { enabled: false });
 // Move the existing content page into a real popout and open the same document in the main window.
 const ids = new Set((await (await fetch(process.env.NAND_CDP_URL + '/json')).json()).map(item => item.id));
 await c.evaluate(`window.contentLeaf=app.workspace.getLeavesOfType('nand-workbench-view').find(l=>l.view.containerEl.win===window);app.workspace.moveLeafToPopout(contentLeaf,{width:1000,height:760});true`);
 await until(() => c.evaluate('contentLeaf.view.containerEl.win!==window'), 'popout');
 const popupTarget = (await (await fetch(process.env.NAND_CDP_URL + '/json')).json()).find(item => item.type === 'page' && !ids.has(item.id));
 assert.ok(popupTarget); const popup = await connect(popupTarget.url, popupTarget.id); await monitor(popup);
 await open(target); await until(() => c.evaluate(`!!${editor}`), 'main editor after popout');
 const second = saved + '\nShared across windows.\n'; await type(second);
 await until(async () => await fs.readFile(path.join(runtime.vault, target), 'utf8') === second, 'shared autosave');
 check('popout-shares-live-draft', await popup.evaluate(`document.querySelector('.nand-content-page').textContent.includes('Shared across windows.')`));
 popup.close();
 errors.push(...await c.evaluate('window.nandAcceptanceErrors ?? []'));
 await runtime.restart(); c = runtime.connection; await monitor(c);
 await open(target); await until(() => c.evaluate(`!!${editor}`), 'restarted editor');
 check('restart-retains-edits-and-receipt', await c.evaluate(`${editor}.value===${JSON.stringify(second)}`) && JSON.stringify(JSON.parse(await fs.readFile(manifestPath, 'utf8'))) === JSON.stringify(receipt));
 // A persistent draft survives a conflicting external edit and an abrupt process exit.
 await type(second + '\nunsaved-recovery-needle\n');
 const outside = second + '\nexternal edit must survive\n'; await fs.writeFile(path.join(runtime.vault, target), outside);
 await until(() => c.evaluate(`document.querySelector('.nand-content-status').textContent.includes('conflict')`), 'visible save conflict');
 check('external-edit-never-overwritten', await fs.readFile(path.join(runtime.vault, target), 'utf8') === outside);
 await runtime.crashRestart(); c = runtime.connection; await monitor(c);
 await open(target); await until(() => c.evaluate(`!!${editor}`), 'recovered editor');
 check('crash-reopens-unsaved-draft', await c.evaluate(`${editor}.value.includes('unsaved-recovery-needle')`) && await fs.readFile(path.join(runtime.vault, target), 'utf8') === outside);
 // Resolve the deliberate conflict without leaving an expected close failure in this isolated fixture.
 await type(outside); await delay(800);
 errors.push(...await c.evaluate('window.nandAcceptanceErrors ?? []'));
 check('no-runtime-errors', errors.length === 0, errors);
 await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ platform: process.platform, rows, realAccounts: 'unverified' }, null, 2));
} catch (error) {
 if (runtime) { await runtime.shot('failure').catch(() => {}); await fs.writeFile(path.join(runtime.evidence, 'partial.json'), JSON.stringify({ rows, error: String(error), body: await c?.evaluate('document.body.innerText').catch(() => ''), errors: await c?.evaluate('nandAcceptanceErrors').catch(() => []) }, null, 2)); }
 throw error;
} finally { if (runtime) { console.log(JSON.stringify({ evidence: runtime.evidence, checks: rows.length, failed: rows.filter(row => !row.passed) })); await runtime.stop(); } }
