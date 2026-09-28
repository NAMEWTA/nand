import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket from 'ws';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

const binary = process.argv[2] || 'processes/rust-terminal-servers/target/release/rust-terminal-servers';
const child = spawn(binary, [], { stdio: ['ignore', 'pipe', 'pipe'] });
let ws;
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'nand-pty-history-'));
const timer = setTimeout(() => { child.kill('SIGKILL'); process.exitCode = 1; }, 20000);
try {
 const [chunk] = await once(child.stdout, 'data');
 const { port } = JSON.parse(chunk.toString().trim());
 ws = new WebSocket(`ws://127.0.0.1:${port}`); await once(ws, 'open');
 const messages = []; let output = '';
 ws.on('message', (data, binary) => { if (binary) { const bytes = Buffer.from(data); output += bytes.subarray(1 + bytes[0]).toString(); } else messages.push(JSON.parse(data.toString())); });
 const until = async predicate => { for (let n = 0; n < 300; n++) { if (predicate()) return; await delay(10); } throw Error('timeout: '+JSON.stringify(messages)); };
 ws.send(JSON.stringify({ module: 'pty', type: 'init', shell_type: 'custom:/bin/sh', shell_args: ['-c', 'printf automation-test; exit 7'] }));
 await until(() => messages.some(m => m.type === 'exit'));
 const init = messages.find(m => m.type === 'init_complete'), exit = messages.find(m => m.type === 'exit');
 assert.ok(init?.session_id); assert.equal(init.exit_status, true); assert.equal(exit?.session_id, init.session_id); assert.equal(exit.code, 7); assert.ok(output.includes('automation-test'));
 assert.ok(messages.indexOf(init) < messages.indexOf(exit));
 messages.length = 0; output = '';
 ws.send(JSON.stringify({ module: 'pty', type: 'init', shell_type: 'custom:/bin/sh', shell_args: ['-c', 'exit 0'] }));
 await until(() => messages.some(m => m.type === 'exit')); assert.equal(messages.find(m => m.type === 'exit').code, 0);
 messages.length = 0;
 ws.send(JSON.stringify({ module: 'pty', type: 'init', shell_type: 'custom:/bin/sh', shell_args: ['-c', 'sleep 60 & echo CHILD:$!; wait'] }));
 await until(() => /CHILD:(\d+)/.test(output));
 const pid = Number(/CHILD:(\d+)/.exec(output)[1]);
 const live = messages.find(m => m.type === 'init_complete');
 ws.send(JSON.stringify({ module: 'pty', type: 'destroy', session_id: live.session_id }));
 await delay(200);
 let alive = false;
 try { process.kill(pid, 0); alive = true; } catch {}
 if (alive) { process.kill(pid, 'SIGKILL'); throw Error('PTY destroy left a live child process'); }
 // Exercise the real agent_data WebSocket route concurrently with a PTY.
 const source = path.join(temporary, 'native'); await fs.mkdir(source);
 const header = JSON.stringify({ type:'session_meta', payload:{ id:'one', cwd:temporary } }) + '\n';
 const message = JSON.stringify({ type:'response_item', payload:{ type:'message', role:'user', content:[{text:'history needle ' + 'x'.repeat(2000)}] } }) + '\n';
 await fs.writeFile(path.join(source, 'session.jsonl'), header + message.repeat(16000));
 const scope = {vault:temporary,index:path.join(temporary,'.nand','terminal-agent','test','index.sqlite')};
 const scan = {module:'agent_data',type:'scan',...scope,roots:[{agentId:'codex',path:source,accountKey:'{}'}]};
 messages.length = 0; output = '';
 ws.send(JSON.stringify({...scan,requestId:'history-scan'}));
 ws.send(JSON.stringify({module:'pty',type:'init',shell_type:'custom:/bin/sh',shell_args:['-c','printf pty-during-scan; exit 0']}));
 await until(() => messages.some(m=>m.requestId==='history-scan') && messages.some(m=>m.type==='exit'));
 assert.ok(output.includes('pty-during-scan'));
 assert.ok(messages.findIndex(m=>m.type==='init_complete') < messages.findIndex(m=>m.requestId==='history-scan'), 'History parsing blocked PTY initialization');
 assert.equal(messages.find(m=>m.requestId==='history-scan').error, undefined);
 ws.send(JSON.stringify({module:'agent_data',type:'query',requestId:'history-query',...scope,query:'needle'}));
 await until(() => messages.some(m=>m.requestId==='history-query'));
 const page = messages.find(m=>m.requestId==='history-query'); assert.equal(page.data.total,1); assert.equal(page.data.rows[0].text,'');
 const beforeRead = createHash('sha256').update(await fs.readFile(path.join(source, 'session.jsonl'))).digest('hex');
 ws.send(JSON.stringify({module:'agent_data',type:'read',requestId:'history-read',...scope,key:page.data.rows[0].key}));
 await until(() => messages.some(m=>m.requestId==='history-read'));
 const transcript = messages.find(m=>m.requestId==='history-read');
 assert.equal(transcript.error, undefined);
 assert.ok(transcript.data.text.includes('history needle'));
 assert.equal(transcript.data.sessionId, 'one');
 assert.equal(createHash('sha256').update(await fs.readFile(path.join(source, 'session.jsonl'))).digest('hex'), beforeRead, 'History read changed the native transcript');
 assert.equal(page.data.usage.known, false, 'Unknown usage must not be reported as measured');
 assert.ok(!messages.some(m=>m.code==='PARSE_ERROR'), 'History requests leaked into the PTY protocol');
 await fs.appendFile(path.join(source,'session.jsonl'),message);
 ws.send(JSON.stringify({...scan,requestId:'history-cancel'}));
 ws.send(JSON.stringify({module:'agent_data',type:'cancel',requestId:'history-cancel'}));
 await until(() => messages.some(m=>m.requestId==='history-cancel'));
 assert.equal(messages.find(m=>m.requestId==='history-cancel').error,'cancelled');
 console.log('PTY/history integration passed: output, exit ordering and codes, process-tree cancellation, concurrent history scan, query, full transcript read, native source integrity, unknown usage and cancellation');
} finally {
 clearTimeout(timer); ws?.terminate(); child.kill('SIGKILL');
 await fs.rm(temporary, {recursive:true,force:true});
}
