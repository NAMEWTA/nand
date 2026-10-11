import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchFreshVault } from './fresh-vault.mjs';

const p = 'app.plugins.plugins.nand', rows = [];
const surfaces = "app.workspace.getLeavesOfType('nand-workbench-view').flatMap(l=>l.view.getNativeSurfaces())";
const image = color => `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240"><rect width="200" height="240" fill="${color}"/></svg>`;
let runtime, c;
const check = (name, passed) => { rows.push({ name, passed }); assert.ok(passed, name); };
const until = async expression => { const end = Date.now() + 30000; while (Date.now() < end) { if (await c.evaluate(expression)) return; await delay(100); } throw Error('Timed out: ' + expression); };
const cover = `document.querySelector('[data-column="Cover test"] .dashboard-library-card-cover:not(.dashboard-library-card-cover--placeholder)')`;
async function coverBytes() {
 await until(`!!${cover}`);
 return c.evaluate(`(async()=>{const raw=${cover}.style.backgroundImage;const url=raw.slice(4,-1).replace(/^["']|["']$/g,'');return await (await fetch(url)).text()})()`);
}
async function openBoard() {
 await c.evaluate(`${p}.openWorkbench({feature:'dashboard',resourceId:'.nand/content/dashboard.md'},window)`);
 await until(`${surfaces}.some(s=>s.sync?.getData())`);
 await c.evaluate(`window.board=${surfaces}.find(s=>s.sync?.getData());true`);
}
try {
 runtime = await launchFreshVault({ root: process.argv[2], port: 9444, files: {
  '.nand/content/Old/Note.md': '---\n# Keep this cover\ntitle: Windows cover\ncover: "[[pic.svg]]"\n---\n# Windows cover\n',
  '.nand/content/Old/pic.svg': image('red'), '.nand/content/New/pic.svg': image('blue'),
 }, settings: { version: 1, namespaces: {
  app: { language: 'zh', introSeen: true, modules: Object.fromEntries(['home','agent','browser','news','archives','automations','notifications','icons','comments','sync'].map(id => [id, false])) },
 } } }); c = runtime.connection;
 await c.evaluate(`${p}.setModuleEnabled('home',true)`); await openBoard();
 await c.evaluate(`board.sync.addColumn('Cover test','library')`);
 await c.evaluate(`board.sync.updateLibraryConfig('Cover test',{viewMode:'gallery',folders:['Old','New'],filters:[],sortBy:'name',sortDesc:false})`);
 check('gallery-renders-managed-cover-bytes', (await coverBytes()).includes('fill="red"'));
 await c.evaluate(`${p}.managedContent.rename(${p}.managedContent.getFileByPath('.nand/content/Old/Note.md'),'.nand/content/New/Note.md')`);
 await until(`!${p}.managedContent.getFileByPath('.nand/content/Old/Note.md')&&!!${p}.managedContent.getFileByPath('.nand/content/New/Note.md')`);
 await delay(500);
 check('gallery-keeps-original-cover-after-move', (await coverBytes()).includes('fill="red"'));
 const text = await fs.readFile(path.join(runtime.vault,'.nand/content/New/Note.md'),'utf8');
 check('frontmatter-link-preserves-original-image-identity', text.includes('[[/.nand/content/Old/pic.svg]]') && text.includes('# Keep this cover'));
 await c.evaluate(`${cover}.scrollIntoView({block:'center'});true`); await delay(150);
 await runtime.shot('gallery-cover-after-move');
 await runtime.restart(); c = runtime.connection; await openBoard();
 check('gallery-keeps-original-cover-after-restart', (await coverBytes()).includes('fill="red"'));
 check('no-runtime-errors', await c.evaluate('(window.nandAcceptanceErrors??[]).length===0'));
 await c.evaluate(`${cover}.scrollIntoView({block:'center'});true`); await delay(150);
 await runtime.shot('gallery-cover-after-restart');
 await fs.writeFile(path.join(runtime.evidence,'result.json'),JSON.stringify({platform:process.platform,rows},null,2));
} catch (error) {
 if (runtime) { await runtime.shot('failure'); await fs.writeFile(path.join(runtime.evidence,'partial.json'),JSON.stringify({rows,error:String(error),errors:await c.evaluate('window.nandAcceptanceErrors??[]'),body:await c.evaluate('document.body.innerText')},null,2)); } throw error;
} finally { if(runtime){ console.log(JSON.stringify({evidence:runtime.evidence,rows})); await runtime.stop(); } }
