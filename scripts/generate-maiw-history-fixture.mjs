// Executes the pinned reference export function with deterministic database rows, without installing MAIW or opening accounts.
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { transform } from 'esbuild';

const reference = process.argv[2];
if (!reference) throw Error('Pass the local MAIW reference checkout');
const commit = 'b6b83ca90f0f67fbf25a676e7a8f6b8b34327800';
const source = execFileSync('git', ['-C', reference, 'show', commit + ':src/db/history-transfer.ts'], {encoding:'utf8'});
const start = source.indexOf('export async function exportHistoryJsonl('), end = source.indexOf('export async function importHistoryJsonl(');
if (start < 0 || end <= start) throw Error('Pinned reference export function not found');
const { code } = await transform(source.slice(start,end).replace(/^export /,''), { loader:'ts', target:'es2021' });
const at = '2026-09-01T08:00:00.000Z';
const sessions = [{id:'source-session',title:'Imported research',createdAt:at,contentUpdatedAt:at,lastOpenedAt:at,pinnedAt:at,source:'local',workspace:{layoutMode:'adaptive',panels:[{panelId:'panel-ds',providerId:'deepseek',url:'https://chat.deepseek.com/a/chat/s/preserved?entry=home',order:0,selected:false,widthRatio:2.5}],updatedAt:at}}];
const turns = [
 {id:'source-turn-one',sessionId:'source-session',sequence:1,prompt:'Check sources\n\nCompare the evidence.',userQuestion:'Compare the evidence.',appliedPromptTemplates:[{id:'source-template',name:'Evidence',content:'Check sources',order:0}],createdAt:at,status:'completed'},
 {id:'source-turn-two',sessionId:'source-session',sequence:2,prompt:'What remains uncertain?',createdAt:'2026-09-01T08:01:00.000Z',status:'partial'},
];
const exchanges = [
 {id:'source-exchange-one',sessionId:'source-session',turnId:'source-turn-one',panelId:'panel-ds',providerId:'deepseek',providerName:'DeepSeek',targetIndex:0,submitStatus:'submitted',responseStatus:'completed',responseText:'A saved answer.',responseMarkdown:'# Saved answer\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```ts\nconst n = 1;\n```\n\n$x^2$',captureId:'source-capture',responseRevision:2,responseObservedAt:at,terminalReason:'completed',captureSource:'native-copy',nativeMimeType:'text/markdown',submittedAt:at,completedAt:at},
 {id:'source-exchange-two',sessionId:'source-session',turnId:'source-turn-two',panelId:'removed-claude-panel',providerId:'claude',providerName:'Claude',targetIndex:0,submitStatus:'submitted',responseStatus:'partial',responseMarkdown:'Partial historical answer.',terminalReason:'interrupted',captureSource:'dom',message:'Page closed'},
];
const collection = rows => ({ orderBy: key => ({ toArray: async () => rows.toSorted((a,b)=>String(a[key]).localeCompare(String(b[key]))) }), toArray: async () => rows });
class FixedDate extends Date { constructor() { super(at); } }
const run = new Function('db','HISTORY_FORMAT_VERSION','Date',code+'\nreturn exportHistoryJsonl();');
const jsonl = await run({sessions:collection(sessions),turns:collection(turns),exchanges:collection(exchanges)},3,FixedDate);
const directory = new URL('../src/modules/browser/core/workspace/fixtures/',import.meta.url);
await fs.mkdir(directory,{recursive:true});await fs.writeFile(new URL('maiw-v3.jsonl',directory),jsonl);
console.log(JSON.stringify({reference:commit,method:'Actual pinned exportHistoryJsonl body, TypeScript erased, deterministic in-memory database rows',sessions:sessions.length,turns:turns.length,exchanges:exchanges.length,bytes:Buffer.byteLength(jsonl)}));
