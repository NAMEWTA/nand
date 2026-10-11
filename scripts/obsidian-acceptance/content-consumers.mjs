import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

await build({ entryPoints: ['src/modules/archives/core/model.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'scripts/tmp/content-consumer-fixture.cjs', logLevel: 'silent' });
const { newRecord } = createRequire(import.meta.url)('../tmp/content-consumer-fixture.cjs');
const draft = newRecord('person'); draft.fields.name = 'Windows acceptance'; draft.prose.notes = 'Keep this annotation';
const p = 'app.plugins.plugins.nand', rows = [];
let runtime, c;
const until = async expression => { const end = Date.now() + 30000; while (Date.now() < end) { if (await c.evaluate(expression)) return; await delay(100); } throw Error('Timed out: ' + expression); };
const check = (name, passed) => { rows.push({ name, passed }); assert.ok(passed, name); };
const surfaces = "app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces())";
try {
 runtime = await launchFreshVault({ root: process.argv[2], port: 9443, settings: { version: 1, namespaces: {
  app: { language: 'zh', introSeen: true, modules: Object.fromEntries(['home','agent','browser','news','archives','automations','notifications','icons','comments','sync'].map(id => [id, false])) },
  news: { analysisEnabled: false, autoRefresh: false, sources: [] },
 } } }); c = runtime.connection;
 await c.evaluate(`${p}.setModuleEnabled('home',true)`);
 await c.evaluate(`${p}.openWorkbench({feature:'dashboard'},window)`);
 await until(`${surfaces}.some(s=>s.sync?.getData())`);
 await c.evaluate(`window.board=${surfaces}.find(s=>s.sync?.getData()); board.sync.updateBanner({quote:'Saved through the native board'})`);
 check('board-edits-hidden-default-document', (await fs.readFile(path.join(runtime.vault, '.nand/content/dashboard.md'), 'utf8')).includes('Saved through the native board'));
 await c.evaluate(`board.plugin.createWorkspace('Second','side')`);
 const boardPath = await c.evaluate(`board.plugin.settings.dashboardFile+'.md'`);
 check('new-board-is-hidden-and-indexed', boardPath.startsWith('.nand/content/') && await c.evaluate(`${p}.managedContent.getFileByPath(${JSON.stringify(boardPath)})?.kind==='managed'`));
 await c.evaluate(`${p}.setModuleEnabled('archives',true)`); await c.evaluate(`${p}.openWorkbench({feature:'contacts'},window)`);
 await until(`${surfaces}.some(s=>s.controller)`);
 const record = await c.evaluate(`(async()=>{window.archives=${surfaces}.find(s=>s.controller).controller;await archives.ensureLoaded();return archives.create(${JSON.stringify(draft)})})()`);
 check('native-archive-create-writes-markdown', record.path.startsWith('.nand/content/') && (await fs.readFile(path.join(runtime.vault, record.path), 'utf8')).includes('Keep this annotation'));
 const attachment = await c.evaluate(`archives.createNote(${JSON.stringify(record.id)},'Related note')`);
 check('archive-attached-note-is-managed', attachment.startsWith(record.folderPath + '/') && await c.evaluate(`${p}.managedContent.getFileByPath(${JSON.stringify(attachment)})?.kind==='managed'`));
 await c.evaluate(`${p}.setModuleEnabled('news',true)`); await c.evaluate(`${p}.openWorkbench({feature:'news',section:'all'},window)`);
 await until(`${surfaces}.some(s=>s.getViewType()==='nand-news-view')`);
 await c.evaluate(`window.news=${surfaces}.find(s=>s.getViewType()==='nand-news-view').service; news.ready`);
 const material = { id: 'acceptance-material', sourceId: 'local', sourceItemId: 'one', title: 'Windows fixture', originalUrl: 'https://example.invalid/local', canonicalKey: 'https://example.invalid/local', bodyExcerpt: 'Local fixture only', revision: 1, contentHash: 'fixture', discoveredAt: Date.now() };
 await c.evaluate(`news.saveFavorite(${JSON.stringify(material)},'News annotation')`);
 const favorite = await c.evaluate(`news.favoriteLocation('acceptance-material')`);
 check('news-favorite-is-hidden-markdown', favorite.startsWith('.nand/content/') && (await fs.readFile(path.join(runtime.vault, favorite), 'utf8')).includes('News annotation'));
 check('no-errors-before-restart', await c.evaluate('(window.nandAcceptanceErrors??[]).length===0'));
 await runtime.shot('native-content-consumers'); await runtime.restart(); c = runtime.connection;
 await c.evaluate(`${p}.openWorkbench({feature:'contacts',resourceId:${JSON.stringify(record.path)}},window)`);
 await until(`${surfaces}.some(s=>s.controller&&!s.controller.loading)`);
 check('archive-identity-survives-restart', await c.evaluate(`${surfaces}.find(s=>s.controller).controller.index.get(${JSON.stringify(record.id)})?.path===${JSON.stringify(record.path)}`));
 check('board-registry-survives-restart', await c.evaluate(`${p}.settingsNamespace('home').get().dashboardFile+'.md'===${JSON.stringify(boardPath)}`));
 check('no-errors-after-restart', await c.evaluate('(window.nandAcceptanceErrors??[]).length===0'));
 await fs.writeFile(path.join(runtime.evidence, 'result.json'), JSON.stringify({ platform: process.platform, rows }, null, 2));
} catch (error) {
 if (runtime) { await runtime.shot('failure'); await fs.writeFile(path.join(runtime.evidence, 'partial.json'), JSON.stringify({ rows, error: String(error), errors: await c.evaluate('window.nandAcceptanceErrors??[]'), body: await c.evaluate('document.body.innerText') }, null, 2)); } throw error;
} finally { if (runtime) { console.log(JSON.stringify({ evidence: runtime.evidence, rows })); await runtime.stop(); } }
