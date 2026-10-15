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
const cover = name => `document.querySelector('[data-column="Cover test"] [data-file-path$="/${name}.md"] .dashboard-library-card-cover:not(.dashboard-library-card-cover--placeholder)')`;
async function coverBytes(name = 'Note') {
 await until(`!!${cover(name)}`);
 return c.evaluate(`(async()=>{const raw=${cover(name)}.style.backgroundImage;const url=raw.slice(4,-1).replace(/^["']|["']$/g,'');return await (await fetch(url)).text()})()`);
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
  '.nand/content/Old/HTML.md': '---\ntitle: "pic.svg"\ncover: '+JSON.stringify("<img src='pic&apos;s.svg'>")+'\n---\n<img src="pic.svg">\n<img src="pic&apos;s.svg">\n',
  '.nand/content/Old/Alias.md': '---\ncover: &img pic.svg\ntitle: *img\n---\n',
  '.nand/content/Old/AliasUse.md': '---\nasset: &img pic.svg\ncover: *img\ntitle: *img\n---\n',
  '.nand/content/Cyclic.md': '---\nlist: &self [*self]\n---\nKeep cyclic array\n',
  '.nand/content/CyclicObject.md': '---\nloop: &self {self: *self}\n---\nKeep cyclic object\n',
  ".nand/content/Old/pic's.svg": image('green'), ".nand/content/New/pic's.svg": image('blue'),
 }, settings: { version: 1, namespaces: {
  app: { language: 'zh', introSeen: true, modules: Object.fromEntries(['home','agent','browser','archives','automations','notifications','icons','comments','sync'].map(id => [id, false])) },
 } } }); c = runtime.connection;
 await c.evaluate(`${p}.setModuleEnabled('home',true)`); await openBoard();
 await c.evaluate(`board.sync.addColumn('Cover test','library')`);
 await c.evaluate(`board.sync.updateLibraryConfig('Cover test',{viewMode:'gallery',folders:['Old','New'],filters:[],sortBy:'name',sortDesc:false})`);
 check('gallery-renders-managed-cover-bytes', (await coverBytes()).includes('fill="red"'));
 check('gallery-renders-quoted-html-cover', (await coverBytes('HTML')).includes('fill="green"'));
 for (const name of ['Alias','AliasUse']) check('gallery-renders-shared-anchor:'+name, (await coverBytes(name)).includes('fill="red"'));
 await c.evaluate(`${p}.managedContent.rename(${p}.managedContent.getFileByPath('.nand/content/Old/Note.md'),'.nand/content/New/Note.md')`);
 await c.evaluate(`${p}.managedContent.rename(${p}.managedContent.getFileByPath('.nand/content/Old/HTML.md'),'.nand/content/New/HTML.md')`);
 for (const name of ['Alias','AliasUse']) await c.evaluate(`${p}.managedContent.rename(${p}.managedContent.getFileByPath('.nand/content/Old/${name}.md'),'.nand/content/New/${name}.md')`);
 await until(`!${p}.managedContent.getFileByPath('.nand/content/Old/Note.md')&&!!${p}.managedContent.getFileByPath('.nand/content/New/Note.md')`);
 await delay(500);
 check('gallery-keeps-original-cover-after-move', (await coverBytes()).includes('fill="red"'));
 check('gallery-keeps-quoted-html-cover-after-move', (await coverBytes('HTML')).includes('fill="green"'));
 for (const name of ['Alias','AliasUse']) {
  check('gallery-keeps-anchor-cover-after-move:'+name, (await coverBytes(name)).includes('fill="red"'));
  check('ordinary-anchor-title-kept:'+name, await c.evaluate(`${p}.managedContent.getMetadata(${p}.managedContent.getFileByPath('.nand/content/New/${name}.md')).frontmatter.title==='pic.svg'`));
 }
 const text = await fs.readFile(path.join(runtime.vault,'.nand/content/New/Note.md'),'utf8');
 check('frontmatter-link-preserves-original-image-identity', text.includes('[[/.nand/content/Old/pic.svg]]') && text.includes('# Keep this cover'));
 const html = await fs.readFile(path.join(runtime.vault,'.nand/content/New/HTML.md'),'utf8');
 check('html-images-updated-and-ordinary-title-preserved', html.includes('title: "pic.svg"') && html.includes('<img src="/.nand/content/Old/pic.svg">') && html.includes('<img src="/.nand/content/Old/pic&#39;s.svg">'));
 await c.evaluate(`${cover('HTML')}.scrollIntoView({block:'center'});true`); await delay(150);
 await runtime.shot('gallery-cover-after-move');
 await runtime.restart(); c = runtime.connection; await openBoard();
 check('gallery-keeps-original-cover-after-restart', (await coverBytes()).includes('fill="red"'));
 check('gallery-keeps-quoted-html-cover-after-restart', (await coverBytes('HTML')).includes('fill="green"'));
 for (const name of ['Alias','AliasUse']) check('gallery-keeps-anchor-cover-after-restart:'+name, (await coverBytes(name)).includes('fill="red"'));
 check('cyclic-properties-stay-intact-without-hiding-normal-gallery', (await fs.readFile(path.join(runtime.vault,'.nand/content/Cyclic.md'),'utf8'))==='---\nlist: &self [*self]\n---\nKeep cyclic array\n' && (await fs.readFile(path.join(runtime.vault,'.nand/content/CyclicObject.md'),'utf8'))==='---\nloop: &self {self: *self}\n---\nKeep cyclic object\n');
 check('no-runtime-errors', await c.evaluate('(window.nandAcceptanceErrors??[]).length===0'));
 await c.evaluate(`${cover('HTML')}.scrollIntoView({block:'center'});true`); await delay(150);
 await runtime.shot('gallery-cover-after-restart');
 await fs.writeFile(path.join(runtime.evidence,'result.json'),JSON.stringify({platform:process.platform,rows},null,2));
} catch (error) {
 if (runtime) { await runtime.shot('failure'); await fs.writeFile(path.join(runtime.evidence,'partial.json'),JSON.stringify({rows,error:String(error),errors:await c.evaluate('window.nandAcceptanceErrors??[]'),body:await c.evaluate('document.body.innerText')},null,2)); } throw error;
} finally { if(runtime){ console.log(JSON.stringify({evidence:runtime.evidence,rows})); await runtime.stop(); } }
