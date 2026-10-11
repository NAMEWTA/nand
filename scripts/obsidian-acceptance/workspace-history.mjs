import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

export async function inspectLayout({ c, p, root, runtime, check }, name, content) {
 for (const preset of ['system','claude-code','eye-care']) for (const dark of [false,true]) for (const width of [500,800,1500]) {
  await c.evaluate(p+'.theme.update(d=>{d.preset='+JSON.stringify(preset)+'});app.changeTheme('+JSON.stringify(dark?'obsidian':'moonstone')+');true');
  await c.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await c.evaluate(content+'.scrollIntoView({block:"start"});true'); await delay(120);
  const layout=await c.evaluate('(()=>{const e='+root+';return{width:e.clientWidth,scroll:e.scrollWidth,small:[...e.querySelectorAll("button,select,input:not([type=checkbox])")].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().height<32).length}})()');
  check(name+'-'+preset+'-'+(dark?'dark':'light')+'-'+width,layout.width>0&&layout.scroll<=layout.width+1&&layout.small===0,layout);
  if(preset==='system'&&!dark||preset==='eye-care'&&dark&&width===1500)await runtime.shot(name+'-'+preset+'-'+(dark?'dark':'light')+'-'+width);
 }
 await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await c.send('Emulation.setDeviceMetricsOverride',{width:500,height:1000,deviceScaleFactor:1,mobile:true});await delay(120);
 check(name+'-touch-controls-44px',await c.evaluate('[...'+root+'.querySelectorAll("button,select,input:not([type=checkbox]),.nand-browser-workspace-actions>label")].filter(e=>e.getClientRects().length).every(e=>e.getBoundingClientRect().height>=44)'));
 await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});await c.send('Emulation.clearDeviceMetricsOverride');
}

async function lockFile(file, vault) {
 const absolute = path.resolve(file);
 if (process.platform !== 'win32' || !absolute.startsWith(path.resolve(vault) + path.sep)) throw Error('Expected an owned Windows fixture file');
 const command = "$ErrorActionPreference = 'Stop'; $fixtureLock = [System.IO.File]::Open('" + absolute.replaceAll("'", "''") + "', [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read); [Console]::WriteLine('LOCKED'); [Console]::ReadLine() | Out-Null; $fixtureLock.Dispose()";
 const child = spawn('powershell.exe', ['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')], { windowsHide:true,stdio:['pipe','pipe','pipe'] });
 try {
  await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('File lock startup timeout')),10000);child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('LOCKED')){clearTimeout(timer);resolve()}});child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);if(!output.includes('LOCKED'))reject(Error('File lock exited '+code))})});
 } catch (error) { child.kill(); throw error; }
 return async () => { const exited = once(child, 'exit'); child.stdin.end('\n'); await exited; };
}

export async function exerciseWorkspaceHistory({ c, p, root, click, type, until, button, check, runtime, taskId }) {
 const json = JSON.stringify;
 await c.evaluate(p + '.changeLanguage("en")'); await until(root + '.textContent.includes("Task history")');
 const initial = await c.evaluate('bw.snapshot()'), original = initial.tasks.find(task => task.id === taskId);
 const rounds = initial.turns.filter(turn => turn.taskId === taskId), answers = initial.exchanges.filter(exchange => rounds.some(turn => turn.id === exchange.turnId));
 const exportRoot = root + '.querySelector(".nand-browser-workspace-export")';
 await click(exportRoot + '.querySelector("summary")');
 await click(button('Preview Markdown export', exportRoot));
 await until('!!' + exportRoot + '.querySelector("textarea")&&!'+button('Preview Markdown export',exportRoot)+'.disabled');
 const all = await c.evaluate(exportRoot + '.querySelector("textarea").value');
 check('export-all-rounds-keeps-frozen-questions-current-answers-and-completeness', all.includes('Turn 1') && all.includes('Turn 4') && all.includes('First question') && all.includes('Website conversation data') && all.includes('Incomplete') && all.includes('Partial answer') && !all.includes('fixture-only-secret'));
 await c.evaluate('window.historyModule=app.workspace.getLeavesOfType("nand-workbench-view").flatMap(l=>l.view.getNativeSurfaces()).find(s=>s.taskId===' + json(taskId) + ').module;window.historyCopyOriginal=historyModule.copyText;historyModule.copyText=text=>{window.historyCopied=text};true');
 try {
  await click(button('Copy this export', exportRoot));
  await until('!!window.historyCopied');
  check('explicit-copy-passes-exact-reviewed-markdown-to-clipboard-boundary', await c.evaluate('historyCopied===' + json(all)));
 } finally { await c.evaluate('historyModule.copyText=historyCopyOriginal;true'); }
 await click(button('Save export in vault', exportRoot));
 await until(exportRoot + '.textContent.includes("Saved: ")&&!'+button('Save export in vault',exportRoot)+'.disabled');
 const files = await fs.readdir(path.join(runtime.vault, 'NAND/AI Workspace/Exports'));
 check('saved-export-is-exact-new-visible-markdown', files.length === 1 && await fs.readFile(path.join(runtime.vault, 'NAND/AI Workspace/Exports', files[0]), 'utf8') === all);
 await click(exportRoot + '.querySelector("select")');
 for (const [key, code, windowsVirtualKeyCode] of [['ArrowDown', 'ArrowDown', 40], ['Enter', 'Enter', 13]]) for (const type of ['keyDown','keyUp']) await c.send('Input.dispatchKeyEvent', {type,key,code,windowsVirtualKeyCode});
 await click(button('Preview Markdown export', exportRoot));
 await until('!!' + exportRoot + '.querySelector("textarea")');
 const latest = await c.evaluate(exportRoot + '.querySelector("textarea").value');
 check('latest-round-export-does-not-substitute-an-older-complete-answer', latest.includes('Turn 4') && latest.includes('Incomplete') && latest.includes('Partial answer') && !latest.includes('Turn 3') && !latest.includes('Heading'));
 await runtime.shot('history-export-latest');
 await inspectLayout({c,p,root,runtime,check},'history-export',exportRoot);
 await click(button('Task history'));
 const history = root + '.querySelector(".nand-browser-workspace-history")';
 await until('!!' + history);
 const search = history + '.querySelector("input")';
 await type(search, 'First question');
 check('history-search-finds-a-task-by-a-saved-question', await c.evaluate('!!' + button(original.title, history)));
 await type(search, 'not-a-saved-question');
 check('history-search-has-an-explicit-empty-state', await c.evaluate(history + '.textContent.includes("No matching tasks")'));
 await type(search, 'Heading');
 check('history-search-finds-a-task-by-saved-answer-text', await c.evaluate('!!' + button(original.title, history)));
 await type(search, '');
 await click(button('Rename task', history));
 await until('!!document.querySelector(".modal-container .modal input")');
 await type('document.querySelector(".modal-container .modal input")', 'Renamed research');
 for (const type of ['keyDown','keyUp']) await c.send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await until('bw.snapshot().tasks.find(t=>t.id===' + json(taskId) + ').title==="Renamed research"&&!' + button('Rename task',history) + '.disabled');
 check('rename-keeps-task-id-rounds-and-answer-identities', await c.evaluate('JSON.stringify(bw.snapshot().turns)===' + json(JSON.stringify(initial.turns)) + '&&bw.snapshot().exchanges.length===' + initial.exchanges.length));
 await click(button('Pin task', history)); await until('bw.snapshot().tasks[0].pinned');
 await type(root + '.querySelector("input[type=text]")', 'Keep this task');
 await click(button('Create task'));
 await until('bw.snapshot().tasks.length===2&&' + root + '.querySelector("h2").textContent==="Keep this task"');
 await click(button('Task history')); await until('!!' + history);
 check('pinned-history-precedes-a-newer-task', await c.evaluate(history + '.querySelector("section button").textContent==="Renamed research"'));
 await click(button('Renamed research', history)); await until(root + '.querySelector("h2").textContent==="Renamed research"');
 check('history-switch-restores-local-rounds-without-opening-a-website', await c.evaluate('bc.list().length===0&&' + root + '.querySelectorAll(".nand-browser-workspace-turns > article").length===4'));
 await click(button('Task history')); await until('!!' + history);
 const card = '[...' + history + '.querySelectorAll("section")].find(e=>e.querySelector("button")?.textContent==="Renamed research")';
 await click(button('Delete local task', card));
 await until('!!' + button('Confirm local deletion', history));
 check('local-delete-review-lists-round-and-answer-scope-without-mutation', await c.evaluate('bw.snapshot().tasks.length===2&&'+history+'.textContent.includes("4 round documents")&&'+history+'.textContent.includes("4 answer documents")'));
 await runtime.shot('history-local-delete-review');
 await inspectLayout({c,p,root,runtime,check},'history-delete',history+'.querySelector(".nand-browser-workspace-preview")');
 const release = await lockFile(path.join(runtime.vault,'NAND/AI Workspace',taskId,'轮次',rounds[0].id+'.md'), runtime.vault);
 try {
  await click(button('Confirm local deletion', history));
  await until('!!'+root+'.querySelector("[role=alert]")&&!'+button('Retry saving')+'.disabled');
  check('interrupted-deletion-exposes-readable-partial-local-records', await c.evaluate('historyModule.reviewWorkspaceRecovery().then(review=>review.local?.tasks.some(t=>t.id==='+json(taskId)+')&&review.local.turns.length>0&&review.local.exchanges.length===0)'));
 } finally { await release(); }
 await click(button('Retry saving'));
 await until('bw.snapshot().tasks.length===1&&!'+button('Rename task',history)+'.disabled&&!'+root+'.querySelector("[role=alert]")');
 const deletedFiles = [path.join(taskId,'任务.md'), ...rounds.map(turn=>path.join(taskId,'轮次',turn.id+'.md')), ...answers.map(exchange=>path.join(taskId,'回答',exchange.id+'.md'))];
 const texts = await Promise.all(deletedFiles.map(file=>fs.readFile(path.join(runtime.vault,'NAND/AI Workspace',file),'utf8')));
 check('local-deletion-marks-only-reviewed-owned-records-and-preserves-readable-bodies', texts.every(text=>text.includes('nand-deleted: true')) && texts.some(text=>text.includes('First question')) && texts.some(text=>text.includes('Heading')));
 check('local-deletion-preserves-other-task-template-library-and-export', await c.evaluate('bw.snapshot().tasks[0].title==="Keep this task"&&bw.snapshot().turns.length===0&&bw.snapshot().exchanges.length===0&&bw.snapshot().templates.length===' + initial.templates.length + '&&bc.list().length===0') && (await fs.readdir(path.join(runtime.vault,'NAND/AI Workspace/Exports'))).length === 1);
}
