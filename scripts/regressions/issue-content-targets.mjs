import assert from 'node:assert/strict';
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
