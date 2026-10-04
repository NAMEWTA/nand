import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

function edit(file, from, to, all = false) {
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.includes(from), `Missing patch anchor in ${file}: ${from.slice(0, 100)}`);
  fs.writeFileSync(file, all ? text.replaceAll(from, to) : text.replace(from, to));
}
function put(file, text) {
  assert.ok(!fs.existsSync(file), `Refusing to overwrite ${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text);
}
function messages(file, en, zh) {
  for (const [language, values] of Object.entries({ en, zh })) {
    edit(file, `\t${language}: {`, `\t${language}: {\n` + Object.entries(values).map(([key, value]) => `\t\t${JSON.stringify(key)}: ${JSON.stringify(value)},`).join('\n'));
  }
}

// #119: share actual card semantics; do not infer eligibility from translated labels.
put('src/core/dashboard/card-kind.ts', `/** The same precedence is used by rendered cards and background task delivery. */
export function cardKind(section: string, type: string): 'memo' | 'task' | 'project' {
  return section === 'memo' || (section === 'sticky' && (type === 'generic' || type === 'note'))
    ? 'memo' : type === 'task' || section === 'todo' ? 'task' : 'project';
}
const querySections = new Set(['library', 'folder', 'alltasks', 'calendar', 'dataview', 'weread', 'images', 'videos', 'web', 'dashboard']);
export function canReceiveTask(column: { name: string; sectionType?: string }, card: { type: string }): boolean {
  const section = column.sectionType ?? column.name.toLowerCase();
  return !querySections.has(section) && !['weather', 'tracker', 'web'].includes(card.type) && cardKind(section, card.type) === 'task';
}
`);
{
  const file = 'src/view/dashboard/cards/CardPanel.tsx';
  const text = fs.readFileSync(file, 'utf8');
  const begin = text.indexOf('export function cardKind('), end = text.indexOf('export function CardPanel(', begin);
  assert.ok(begin >= 0 && end > begin);
  fs.writeFileSync(file, `import { cardKind } from '../../../core/dashboard/card-kind';\nexport { cardKind } from '../../../core/dashboard/card-kind';\n` + text.slice(0, begin) + text.slice(end));
}
{
  const file = 'src/platform/obsidian/dashboard/automation.ts';
  edit(file, "import { AutomationError }", "import { canReceiveTask } from '../../../core/dashboard/card-kind';\nimport { AutomationError }");
  edit(file, "\t\t\tfor (const column of data.columns)\n\t\t\t\tfor (const card of column.cards)\n\t\t\t\t\tresult.push({", "\t\t\tconst counts = new Map<string, number>();\n\t\t\tfor (const column of data.columns) for (const card of column.cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1);\n\t\t\tfor (const column of data.columns)\n\t\t\t\tfor (const card of column.cards)\n\t\t\t\t\tif (counts.get(card.id) === 1 && canReceiveTask(column, card)) result.push({");
  edit(file, "const matches = data.columns.flatMap((c) => c.cards).filter((c) => c.id === action.cardId);\n\t\t\tconst card = matches.length === 1 ? matches[0] : undefined;\n\t\t\tif (!card) throw new AutomationError('sourceMissing');", "const matches = data.columns.flatMap(column => column.cards.map(card => ({ column, card }))).filter(entry => entry.card.id === action.cardId);\n\t\t\tconst target = matches.length === 1 ? matches[0] : undefined;\n\t\t\tif (!target) throw new AutomationError('sourceMissing');\n\t\t\tif (!canReceiveTask(target.column, target.card)) throw new AutomationError('taskTargetInvalid');\n\t\t\tconst card = target.card;");
  edit('src/view/automations/editor.ts', "\t\t\t\t\tif (generation !== this.generation) return;\n\t\t\t\t\trow.addDropdown", "\t\t\t\t\tif (generation !== this.generation) return;\n\t\t\t\t\tif (!targets.length) row.setDesc(t('automation.noTaskTargets'));\n\t\t\t\t\trow.addDropdown");
  // save() already re-reads targets. Keep that check and the cleared-target semantics.
  messages('src/shared/i18n/automation.ts', {
    'automation.taskTargetInvalid': 'This card cannot receive to-dos. Choose a to-do card and save the automation again.',
    'automation.noTaskTargets': 'No to-do cards are available. Add a to-do card to a registered dashboard first.'
  }, {
    'automation.taskTargetInvalid': '该卡片不能接收待办。请选择待办卡片后重新保存自动化。',
    'automation.noTaskTargets': '没有可用的待办卡片。请先在已注册看板中添加待办卡片。'
  });
}

// #117: metadata-only filtering, before truncation, shared by all three surfaces.
put('src/core/dashboard/recent-doc-policy.ts', `export interface RecentDocScope {
  dashboardFile?: string;
  workspaceFiles?: readonly string[];
  contacts?: { rootFolder: string };
}
/** Explicit managed collections, not every note under a directory named NAND. */
const managedRoots = ['NAND/习惯', 'NAND/番茄钟', 'NAND/记账', 'NAND/阅读', 'NAND/自动化'] as const;
function clean(value: string): string { return value.replace(/\\\\/g, '/').replace(/^\\/+|\\/+$/g, ''); }
function markdown(value: string): string { const p = clean(value); return /\\.md$/i.test(p) ? p : p + '.md'; }
export function isRecentUserDocument(filePath: string, scope: RecentDocScope): boolean {
  const p = clean(filePath);
  if (!p || p.split('/').some(part => part.startsWith('.'))) return false;
  if (managedRoots.some(root => p.startsWith(root + '/'))) return false;
  if ([scope.dashboardFile, ...(scope.workspaceFiles ?? [])].some(board => !!board && p === markdown(board))) return false;
  const root = clean(scope.contacts?.rootFolder ?? '档案');
  if (root && p.startsWith(root + '/')) {
    const tail = p.slice(root.length + 1).split('/');
    if (tail.length === 1 && tail[0] === '档案格式说明.md') return false;
    if (tail.length === 3 && (tail[0] === '个人档案' || tail[0] === '企业档案') && tail[2] === '基本信息.md') return false;
  }
  return true;
}
`);
edit('src/view/dashboard/ui/recent.ts', "import { App } from 'obsidian';", "import { App } from 'obsidian';\nimport { isRecentUserDocument, type RecentDocScope } from '../../../core/dashboard/recent-doc-policy';");
edit('src/view/dashboard/ui/recent.ts', 'getRecentDocs(app: App, count: number)', 'getRecentDocs(app: App, count: number, scope: RecentDocScope = {})');
edit('src/view/dashboard/ui/recent.ts', ".filter((f) => !f.path.startsWith('.'))\n\t\t.sort((a, b) => b.stat.mtime - a.stat.mtime)", ".filter((f) => isRecentUserDocument(f.path, scope))\n\t\t.sort((a, b) => b.stat.mtime - a.stat.mtime || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))");
for (const file of ['sidebar.ts', 'mobile.ts', 'vault-refresh.ts']) edit('src/view/dashboard/view/' + file, 'getRecentDocs(this.app, this.plugin.settings.recentDocCount)', 'getRecentDocs(this.app, this.plugin.settings.recentDocCount, this.plugin.settings)', true);
edit('src/view/dashboard/host.ts', 'settings: DashboardSettings & { modules: { dashboard: boolean } };', 'settings: DashboardSettings & { modules: { dashboard: boolean }; contacts?: { rootFolder: string } };');

// #118: creation-time content and language-neutral NEW defaults; persisted paths are never rewritten.
put('src/core/dashboard/default-paths.ts', `/** Defaults for missing/empty preferences. Existing explicit paths retain their identity. */
export const DEFAULT_TASK_ARCHIVE_PATH = 'Archive/Done.md';
export const DEFAULT_HIGHLIGHT_IMPORT_PATH = 'Weread/Highlights';
`);
const defaultsFile = 'src/core/dashboard/parser/default-document.ts';
edit(defaultsFile, "const todoName = t('renderer.typeTodo');", "const todoName = t('renderer.typeTodo');\n\tconst projectsName = t('default.projectsName');\n\tconst libraryName = t('default.libraryName');");
edit(defaultsFile, 'banner: DEFAULT_BANNER,', "banner: { ...DEFAULT_BANNER, images: [...(DEFAULT_BANNER.images ?? [])], quote: t('default.bannerQuote'), author: 'NAND' },");
for (const [from, to] of [["name: 'Projects'", 'name: projectsName'], ["column: 'Projects'", 'column: projectsName'], ["name: 'Library'", 'name: libraryName'], ["column: 'Library'", 'column: libraryName'], ["title: 'Reading'", "title: t('default.reading')"], ["title: 'To Read'", "title: t('default.toRead')"], ["title: 'Done'", "title: t('default.done')"]]) edit(defaultsFile, from, to, true);
messages('src/shared/i18n/default-dashboard-content.ts', {
  'default.projectsName': 'Projects', 'default.libraryName': 'Library', 'default.reading': 'Reading', 'default.toRead': 'To read', 'default.done': 'Done', 'default.bannerQuote': 'Keep a little progress visible every day.'
}, {
  'default.projectsName': '项目', 'default.libraryName': '书库', 'default.reading': '在读', 'default.toRead': '待读', 'default.done': '已读', 'default.bannerQuote': '每天留下一点看得见的进步。'
});
edit('src/shared/i18n/default-dashboard-content.ts', '提示：Dashboard 文件路径', '提示：看板文件路径');
edit('src/shared/i18n/default-dashboard-content.ts', 'Tip: Dashboard File Path', 'Tip: Dashboard file path');
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
for (const file of walk('src')) {
  if (!/\\.tsx?$/.test(file) || file.endsWith('.test.ts') || file.includes('shared/')) continue;
  let text = fs.readFileSync(file, 'utf8'); const names = [];
  for (const [value, name] of [["'归档/已完成.md'", 'DEFAULT_TASK_ARCHIVE_PATH'], ["'Weread/划线'", 'DEFAULT_HIGHLIGHT_IMPORT_PATH'], ["'Archive/Done.md'", 'DEFAULT_TASK_ARCHIVE_PATH']]) {
    if (file.endsWith('default-paths.ts')) continue;
    if (text.includes(value)) { text = text.replaceAll(value, name); if (!names.includes(name)) names.push(name); }
  }
  if (names.length) {
    let relative = path.relative(path.dirname(file), 'src/core/dashboard/default-paths').replaceAll('\\\\', '/'); if (!relative.startsWith('.')) relative = './' + relative;
    text = 'import { ' + names.join(', ') + " } from '" + relative + "';\n" + text;
    fs.writeFileSync(file, text);
  }
}
{
  const file = 'src/shared/i18n/workspace-switcher.ts';
  edit(file, '创建时间 and type are always set', 'the fixed property keys \\"创建时间\\" and \\"type\\" are always set');
  edit(file, 'built-in default: 创建时间 + type: memo.', 'built-in default with the fixed key \\"创建时间\\" and literal \\"type: memo\\".');
  edit(file, '（如 归档/已完成.md）', '（如 Archive/Done.md）');
}

// #120: modify the owning CSS blocks, without changing the BrowserPage lifecycle.
function cssRule(selector, properties) {
  const file = 'styles.css'; let text = fs.readFileSync(file, 'utf8');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp('(^|\\n)([ \\t]*' + escaped + '[ \\t]*\\{)([^}]*)(\\})');
  const found = text.match(pattern); assert.ok(found, 'Missing exact CSS rule: ' + selector);
  text = text.replace(pattern, (_all, start, opening, body, closing) => {
    for (const [key, value] of Object.entries(properties)) {
      body = body.replace(new RegExp('(^|[;\\n])([ \\t]*)' + key + '\\s*:[^;]*;', 'g'), '$1');
      body = body.trimEnd() + '\n\t' + key + ': ' + value + ';\n';
    }
    return start + opening + body + closing;
  }); fs.writeFileSync(file, text);
}
cssRule('.nand-browser-toolbar', { 'flex-wrap': 'wrap', 'height': 'auto', 'max-height': 'none', 'flex-shrink': '0', 'min-width': '0', 'overflow': 'visible' });
cssRule('.nand-browser-address-wrap', { 'flex': '1 0 min(100%, 18rem)', 'min-width': '0', 'max-width': '100%' });
cssRule('.dashboard-quicknote-nav', { 'min-width': '0', 'flex-wrap': 'wrap', 'overflow': 'visible' });
cssRule('.dashboard-quicknote-empty', { 'min-width': '0', 'max-width': '100%', 'flex-wrap': 'wrap', 'white-space': 'normal' });
cssRule('.dashboard-quicknote-empty-text', { 'min-width': '0', 'flex': '1 1 12rem', 'white-space': 'normal', 'overflow-wrap': 'anywhere' });
cssRule('.dashboard-quicknote-empty-btn', { 'flex': '0 0 auto', 'white-space': 'nowrap', 'max-width': '100%' });

// Regression runner uses the existing Node/Obsidian test contract, no new dependency or gate.
put('scripts/regressions/issue-content-targets.mjs', `import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardKind, canReceiveTask } from '../../src/core/dashboard/card-kind.ts';
import { isRecentUserDocument } from '../../src/core/dashboard/recent-doc-policy.ts';
import { DEFAULT_TASK_ARCHIVE_PATH, DEFAULT_HIGHLIGHT_IMPORT_PATH } from '../../src/core/dashboard/default-paths.ts';
import { generateDefaultMarkdown } from '../../src/core/dashboard/parser/default-document.ts';
import { parse, serialize } from '../../src/core/dashboard/parser/index.ts';
import { DashboardAutomationSource } from '../../src/platform/obsidian/dashboard/automation.ts';
import { setLanguage } from '../../src/shared/i18n/index.ts';
import { TFile } from '../obsidian-stub.ts';
import fs from 'node:fs';

for (const [section, type, expected] of [['todo','task',true],['sticky','task',true],['sticky','note',false],['memo','task',false],['projects','project',false],['projects','task',true],['todo','web',false],['todo','weather',false],['todo','tracker',false],['library','task',false]]) {
  test('task eligibility ' + section + '/' + type, () => assert.equal(canReceiveTask({name:'用户标题',sectionType:section},{type}), expected));
}
test('rendering semantics preserve memo precedence', () => { assert.equal(cardKind('memo','task'),'memo'); assert.equal(cardKind('sticky','task'),'task'); });
const scope = { dashboardFile:'Boards/Current', workspaceFiles:['Boards/Other.md'], contacts:{rootFolder:'People'} };
for (const p of ['NAND/习惯/a/习惯.md','NAND/番茄钟/活动.md','NAND/记账/records.md','NAND/阅读/a.md','NAND/自动化/a/操作.md','Boards/Current.md','Boards/Other.md','People/档案格式说明.md','People/个人档案/A/基本信息.md','People/企业档案/B/基本信息.md','.nand/test.md','Notes/.hidden/note.md']) test('exclude exact managed scope ' + p,()=>assert.equal(isRecentUserDocument(p,scope),false));
for (const p of ['NAND/技术笔记/note.md','NAND-笔记/习惯.md','Notes/活动.md','Notes/dashboard.md','Notes/2026-10-04.md','People/个人档案/A/资料.md','People/个人档案/A/sub/基本信息.md']) test('keep user material ' + p,()=>assert.equal(isRecentUserDocument(p,scope),true));
test('custom roots and workspace preferences are evaluated, not cached globally',()=>{assert.equal(isRecentUserDocument('People/个人档案/A/基本信息.md',{contacts:{rootFolder:'Elsewhere'}}),true); assert.equal(isRecentUserDocument('Boards/Current.md',{}),true);});
test('new defaults are language neutral and three recent-document call sites pass their host scope',()=>{
  assert.equal(DEFAULT_TASK_ARCHIVE_PATH,'Archive/Done.md');assert.equal(DEFAULT_HIGHLIGHT_IMPORT_PATH,'Weread/Highlights');
  for(const file of ['sidebar.ts','mobile.ts','vault-refresh.ts']) assert.ok(fs.readFileSync('src/view/dashboard/view/'+file,'utf8').includes('getRecentDocs(this.app, this.plugin.settings.recentDocCount, this.plugin.settings)'));
});
for (const language of ['zh','en','zh']) test('default document uses creation-time language '+language,()=>{
  setLanguage(language);const data=parse(generateDefaultMarkdown());
  assert.deepEqual(data.columns.map(c=>c.name),language==='zh'?['备忘','待办','项目','书库']:['Memo','Todo','Projects','Library']);
  assert.deepEqual(data.columns[3].cards.map(c=>c.title),language==='zh'?['在读','待读','已读']:['Reading','To read','Done']);
  assert.equal(data.columns[3].sectionType,'projects');
  for(const col of data.columns) for(const card of col.cards) assert.equal(card.column,col.name);
  const raw=serialize(data);setLanguage(language==='zh'?'en':'zh');assert.equal(serialize(parse(raw)),raw);
});
function sourceFixture(){
  setLanguage('en');let disk=generateDefaultMarkdown(),enabled=true;
  const file=Object.assign(new TFile(),{path:'Board.md',basename:'Board',stat:{mtime:1,size:1}});
  const app={workspace:{getLeavesOfType:()=>[]},vault:{getFileByPath:p=>p==='Board.md'?file:null,read:async()=>disk,process:async(_f,fn)=>{disk=fn(disk);return disk;}}};
  const source=new DashboardAutomationSource(app,()=>({dashboardFile:'Board',workspaceFiles:[]}), 'test',async()=>{},()=>enabled);
  return {source,get disk(){return disk;},set disk(value){disk=value;},disable(){enabled=false;}};
}
test('only two default targets and direct delivery cannot write a memo',async()=>{
  const f=sourceFixture();assert.deepEqual((await f.source.targets()).map(t=>t.cardId),['demo-todo-1','demo-todo-2']);
  const before=f.disk;await assert.rejects(f.source.createTask({kind:'create-task',path:'Board.md',cardId:'demo-memo-1',text:'must not write'},'bad'),e=>e.code==='taskTargetInvalid');assert.equal(f.disk,before);
});
test('legal delivery is idempotent; a target changing type fails without writes',async()=>{
  const f=sourceFixture(), action={kind:'create-task',path:'Board.md',cardId:'demo-todo-1',text:'one task'};
  await f.source.createTask(action,'once');const saved=f.disk;await f.source.createTask(action,'once');assert.equal(f.disk,saved);
  const data=parse(f.disk);data.columns[1].sectionType='memo';f.disk=serialize(data);const before=f.disk;
  await assert.rejects(f.source.createTask(action,'new'),e=>e.code==='taskTargetInvalid');assert.equal(f.disk,before);
});
test('duplicate IDs are neither candidates nor writable and disabled modules expose no targets',async()=>{
  const f=sourceFixture(),data=parse(f.disk);data.columns[0].cards[0].id='demo-todo-1';f.disk=serialize(data);
  assert.ok(!(await f.source.targets()).some(t=>t.cardId==='demo-todo-1'));
  await assert.rejects(f.source.createTask({kind:'create-task',path:'Board.md',cardId:'demo-todo-1',text:'x'},'new'),e=>e.code==='sourceMissing');
  f.disable();assert.deepEqual(await f.source.targets(),[]);
});
`);
edit('scripts/run-safety-regressions.mjs', "\t'issue-acceptance',", "\t'issue-acceptance',\n\t'issue-content-targets',");
console.log('Applied issue production repairs #117/#118/#119/#120 and executable regressions. Native acceptance remains separate.');
