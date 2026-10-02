import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { createWindowsFixture, removeWindowsFixture } from './pty-windows-fixture.mjs';

assert.equal(process.platform, 'win32', 'This integration exercises Windows ConPTY and Jobs');
const binary = path.resolve(process.argv[2] || 'processes/rust-terminal-servers/target/x86_64-pc-windows-msvc/release/rust-terminal-servers.exe');
const artifactBase = process.env.NAND_PTY_WINDOWS_ARTIFACT_DIR;
if (artifactBase) await fs.mkdir(artifactBase, { recursive: true });
const ownedFixture = await createWindowsFixture(artifactBase || os.tmpdir());
const fixture = ownedFixture.directory;
const powershell = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const encode = text => Buffer.from(text, 'utf16le').toString('base64');
const quote = text => "'" + text.replaceAll("'", "''") + "'";
const servers = [], clients = [], ownedProcesses = [], checks = [];
const until = async (predicate, label, milliseconds = 15000) => {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) { if (await predicate()) return; await delay(20); }
  throw Error(`Timed out: ${label}`);
};
const inspect = pid => {
  assert.ok(Number.isInteger(pid) && pid > 0);
  const result = spawnSync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
    `Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' | Select-Object ProcessId,ParentProcessId,Name,CommandLine,CreationDate | ConvertTo-Json -Compress`], { windowsHide: true, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
};
const descendants = server => {
  const result = spawnSync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
    `@(Get-CimInstance Win32_Process -Filter 'ParentProcessId = ${server.pid}' | Select-Object ProcessId,Name,CommandLine) | ConvertTo-Json -Compress`], { windowsHide: true, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const rows = result.stdout.trim() ? JSON.parse(result.stdout) : [];
  return Array.isArray(rows) ? rows : [rows];
};
const startServer = async () => {
  const processHandle = spawn(binary, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const token = randomBytes(32).toString('hex');
  processHandle.stdin.end(token + '\n');
  const server = { process: processHandle, pid: processHandle.pid, token, logs: '' }; servers.push(server);
  processHandle.stderr.on('data', data => { server.logs += data.toString(); });
  const [data] = await Promise.race([once(processHandle.stdout, 'data'), delay(15000, undefined, { ref: false }).then(() => { throw Error('Server startup timed out'); })]);
  Object.assign(server, JSON.parse(data.toString().trim()));
  return server;
};
const connect = async server => {
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}`); ws.binaryType = 'arraybuffer';
  const client = { ws, events: [], output: new Map(), decoders: new Map(), cursorTail: new Map(), order: [], closed: false }; clients.push(client);
  ws.addEventListener('close', () => { client.closed = true; });
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  client.send = message => ws.send(JSON.stringify(message));
  ws.addEventListener('message', event => {
    if (typeof event.data === 'string') {
      const message = JSON.parse(event.data); client.events.push(message); client.order.push({ type: message.type, sessionId: message.session_id });
    } else {
      const frame = Buffer.from(event.data), size = frame[0], id = frame.subarray(1, 1 + size).toString();
      if (!client.decoders.has(id)) client.decoders.set(id, new TextDecoder());
      client.send({ module: 'pty', type: 'consumed', session_id: id, bytes: frame.length - 1 - size });
      const text = client.decoders.get(id).decode(frame.subarray(1 + size), { stream: true });
      client.output.set(id, (client.output.get(id) || '') + text); client.order.push({ type: 'output', sessionId: id });
      // Match production headless xterm's response to ConPTY's inherited cursor query.
      const pending = (client.cursorTail.get(id) || '') + text;
      for (const match of pending.matchAll(/\x1b\[6n/g)) {
        void match;
        ws.send(Buffer.concat([Buffer.from([size]), Buffer.from(id), Buffer.from('\x1b[1;1R')]));
      }
      client.cursorTail.set(id, pending.slice(-3));
    }
  });
  client.send({ type: 'auth', protocol: 2, token: server.token });
  await until(() => client.events.some(event => event.type === 'authenticated'), 'authenticated connection');
  client.init = async (script, extras = {}) => {
    const position = client.events.length;
    client.send({ module: 'pty', type: 'init', shell_type: 'powershell', shell_args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encode(script)], cwd: fixture, ...extras });
    await until(() => client.events.slice(position).some(event => event.type === 'init_complete' || event.type === 'error'), 'PTY identity');
    const result = client.events.slice(position).find(event => event.type === 'init_complete' || event.type === 'error');
    assert.equal(result.type, 'init_complete', JSON.stringify(result));
    return result.session_id;
  };
  client.exit = async id => {
    await until(() => client.events.some(event => event.type === 'exit' && event.session_id === id), `exit for ${id}`);
    return client.events.find(event => event.type === 'exit' && event.session_id === id);
  };
  client.destroy = id => client.send({ module: 'pty', type: 'destroy', session_id: id });
  client.write = (id, text) => ws.send(Buffer.concat([Buffer.from([Buffer.byteLength(id)]), Buffer.from(id), Buffer.from(text)]));
  return client;
};
const tree = async (client, flood = false) => {
  const marker = `NAND_PTY_CHILD_${crypto.randomUUID()}`;
  const childScript = encode(`Start-Sleep -Seconds 120 # ${marker}`);
  const ongoing = flood ? "[Console]::Write('STREAM' * 2048); Start-Sleep -Milliseconds 20" : "Write-Output 'TREE-RUNNING'; Start-Sleep -Milliseconds 100";
  const id = await client.init(`Write-Output ('PARENT:' + $PID); $p = Start-Process -FilePath ${quote(powershell)} -ArgumentList '-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',${quote(childScript)} -WindowStyle Hidden -PassThru; Write-Output ('CHILD:' + $p.Id); while ($true) { ${ongoing} }`);
  await until(() => /CHILD:(\d+)/.test(client.output.get(id) || ''), 'owned child output');
  const text = client.output.get(id), parentPid = Number(/PARENT:(\d+)/.exec(text)[1]), childPid = Number(/CHILD:(\d+)/.exec(text)[1]);
  const parent = inspect(parentPid), child = inspect(childPid);
  assert.equal(child?.ParentProcessId, parentPid); assert.ok(child.CommandLine.includes(childScript)); assert.equal(parent?.Name.toLowerCase(), 'powershell.exe');
  ownedProcesses.push(parent, child);
  return { id, parent, child };
};
const gone = async tree => until(() => !inspect(tree.parent.ProcessId) && !inspect(tree.child.ProcessId), 'owned process tree termination');
const check = async (name, run) => {
  await run(); checks.push({ name, status: 'passed' }); console.log(`PASS ${name}`);
};
const request = async (client, message) => {
  client.send(message); await until(() => client.events.some(event => event.requestId === message.requestId), message.type);
  const response = client.events.find(event => event.requestId === message.requestId); assert.equal(response.error, undefined); return response.data;
};

let success = false;
try {
  const server = await startServer(); let client = await connect(server);
  await check('missing, wrong and outdated credentials never admit a PTY request', async () => {
    for (const message of [{ module: 'pty', type: 'init' }, { type: 'auth', protocol: 2, token: '0'.repeat(64) }, { type: 'auth', protocol: 1, token: server.token }]) {
      const socket = new WebSocket(`ws://127.0.0.1:${server.port}`), responses = [];
      socket.addEventListener('message', event => responses.push(event.data));
      const closed = new Promise(resolve => socket.addEventListener('close', resolve, { once: true }));
      await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
      socket.send(JSON.stringify(message));
      await Promise.race([closed, delay(6000).then(() => { socket.close(); throw Error('Unauthenticated connection did not close'); })]);
      assert.ok(!responses.some(value => String(value).includes('init_complete')));
    }
  });
  await check('output before one real exit; complete large final output; repeated destroy', async () => {
    const id = await client.init("[Console]::Write('BEGIN-NAND-OUTPUT'); [Console]::Write('x' * 300000); [Console]::WriteLine('FINAL-NAND-OUTPUT'); exit 23", { cols: 200 });
    assert.equal((await client.exit(id)).code, 23);
    const text = client.output.get(id); assert.ok(text.includes('BEGIN-NAND-OUTPUT')); assert.ok(text.includes('FINAL-NAND-OUTPUT'));
    const body = text.split('BEGIN-NAND-OUTPUT')[1].split('FINAL-NAND-OUTPUT')[0];
    // ConPTY can redraw existing screen cells, so raw VT output contains extra
    // copies. Require the large payload and final marker before the exit event.
    assert.ok((body.match(/x/g) || []).length >= 300000);
    const order = client.order.filter(event => event.sessionId === id);
    assert.equal(order[0].type, 'init_complete'); assert.equal(order.at(-1).type, 'exit');
    client.destroy(id); client.destroy(id);
    const next = await client.init("Write-Output 'REOPEN-AFTER-EXIT'; exit 0"); assert.equal((await client.exit(next)).code, 0);
    assert.equal(client.events.filter(event => event.session_id === id && event.type === 'exit').length, 1);
  });
  await check('UTF-8 cwd environment and shell arguments', async () => {
    const cwd = path.join(fixture, '中文路径'); await fs.mkdir(cwd);
    const id = await client.init("[Console]::OutputEncoding = [Text.UTF8Encoding]::new(); Write-Output '原生终端中文'; Write-Output $pwd.Path; Write-Output $env:NAND_PTY_MARKER; exit 7", { cwd, env: { NAND_PTY_MARKER: 'passed-environment' } });
    assert.equal((await client.exit(id)).code, 7);
    const text = client.output.get(id); assert.ok(text.includes('原生终端中文')); assert.ok(text.includes('中文路径')); assert.ok(text.includes('passed-environment'));
  });
  await check('job admission under repeated immediate launches', async () => {
    for (let n = 0; n < 12; n++) {
      const id = await client.init(`Write-Output 'FAST-${n}'; exit ${n}`);
      assert.equal((await client.exit(id)).code, n); assert.ok(client.output.get(id).includes(`FAST-${n}`)); client.destroy(id);
    }
  });
  await check('Ctrl+C interrupts a long command while preserving its interactive shell', async () => {
    for (const shell of ['cmd', 'powershell']) {
      const id = await client.init('', { shell_type: shell, shell_args: shell === 'cmd' ? ['/d'] : ['-NoLogo', '-NoProfile'] });
      const prefix = shell === 'powershell' ? '& ' : '';
      const executable = '"' + powershell + '"';
      client.write(id, `${prefix}${executable} -NoLogo -NoProfile -NonInteractive -EncodedCommand ${encode("Write-Output 'NAND-INTERRUPT-BEGIN'; Start-Sleep -Seconds 120")}\r`);
      await until(() => client.output.get(id)?.includes('NAND-INTERRUPT-BEGIN'), `${shell} long command started`);
      client.write(id, '\x03');
      await delay(300);
      client.write(id, `${prefix}${executable} -NoLogo -NoProfile -NonInteractive -EncodedCommand ${encode("Write-Output 'NAND-AFTER-INTERRUPT'")}\r`);
      await until(() => client.output.get(id)?.includes('NAND-AFTER-INTERRUPT'), `${shell} accepts next command after Ctrl+C`);
      assert.ok(!client.events.some(event => event.type === 'exit' && event.session_id === id));
      client.write(id, 'exit\r'); assert.equal((await client.exit(id)).code, 0);
    }
  });
  await check('two concurrent session trees remain isolated during destroy', async () => {
    const first = await tree(client), second = await tree(client);
    client.destroy(first.id); client.destroy(first.id); await gone(first);
    assert.ok(inspect(second.parent.ProcessId)); assert.ok(inspect(second.child.ProcessId));
    const previous = client.output.get(second.id).length;
    await until(() => client.output.get(second.id).length > previous, 'second session keeps producing output');
    client.destroy(second.id); await gone(second);
  });
  await check('native parent exit terminates its remaining hidden descendants', async () => {
    const childScript = encode('Start-Sleep -Seconds 120 # NAND_PTY_ORPHAN_AFTER_EXIT');
    const id = await client.init(`$p = Start-Process -FilePath ${quote(powershell)} -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand',${quote(childScript)} -WindowStyle Hidden -PassThru; Write-Output ('CHILD:' + $p.Id); exit 9`);
    assert.equal((await client.exit(id)).code, 9);
    const pid = Number(/CHILD:(\d+)/.exec(client.output.get(id))[1]); assert.equal(inspect(pid), null);
  });
  await check('missing shell rejects initialization and service remains reusable', async () => {
    const position = client.events.length;
    client.send({ module: 'pty', type: 'init', shell_type: `custom:${path.join(fixture, 'missing-shell.exe')}`, cwd: fixture });
    await until(() => client.events.slice(position).some(event => event.type === 'error'), 'missing shell error');
    assert.ok(!client.events.slice(position).some(event => event.type === 'init_complete'));
    const id = await client.init("Write-Output 'AFTER-FAILED-LAUNCH'; exit 0"); assert.equal((await client.exit(id)).code, 0);
  });
  await check('disconnect during initialization releases job and permits a fresh client', async () => {
    const early = await connect(server);
    early.send({ module: 'pty', type: 'init', shell_type: 'powershell', shell_args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encode('Start-Sleep -Seconds 120')], cwd: fixture });
    early.ws.close(); await until(() => early.closed, 'early client closed');
    await until(() => descendants(server).every(process => !process.CommandLine?.includes('--pty-job-host')), 'early host cleanup');
    const fresh = await connect(server); const id = await fresh.init("Write-Output 'AFTER-EARLY-CLOSE'; exit 0"); assert.equal((await fresh.exit(id)).code, 0); fresh.ws.close();
  });
  await check('disconnect with active output releases the whole owned tree', async () => {
    const running = await tree(client, true); client.ws.close(); await until(() => client.closed, 'output client disconnected'); await gone(running);
    client = await connect(server); const id = await client.init("Write-Output 'AFTER-OUTPUT-CLOSE'; exit 0"); assert.equal((await client.exit(id)).code, 0);
  });
  await check('history scan stays concurrent with PTY; full read integrity and cancellation', async () => {
    const sourceRoot = path.join(fixture, 'native'); await fs.mkdir(sourceRoot);
    const source = path.join(sourceRoot, 'session.jsonl');
    const header = JSON.stringify({ type: 'session_meta', payload: { id: 'windows-history', cwd: fixture } }) + '\n';
    const message = JSON.stringify({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ text: 'history needle ' + 'x'.repeat(2000) }] } }) + '\n';
    await fs.writeFile(source, header + message.repeat(16000));
    const scope = { vault: fixture, index: path.join(fixture, '.nand', 'terminal-agent', 'test', 'index.sqlite') };
    const scan = { module: 'agent_data', type: 'scan', ...scope, roots: [{ agentId: 'codex', path: sourceRoot, accountKey: '{}' }] };
    client.send({ ...scan, requestId: 'scan' }); const id = await client.init("Write-Output 'CONCURRENT-PTY'; exit 0");
    await until(() => client.events.some(event => event.requestId === 'scan'), 'history scan');
    assert.equal(client.events.find(event => event.requestId === 'scan').error, undefined);
    assert.equal((await client.exit(id)).code, 0); assert.ok(client.output.get(id).includes('CONCURRENT-PTY'));
    const page = await request(client, { module: 'agent_data', type: 'query', requestId: 'query', ...scope, query: 'needle' });
    assert.equal(page.total, 1); assert.equal('text' in page.rows[0], false); assert.equal(page.usage.known, false);
    const hash = createHash('sha256').update(await fs.readFile(source)).digest('hex');
    const transcript = await request(client, { module: 'agent_data', type: 'read', requestId: 'read', ...scope, key: page.rows[0].key });
    assert.equal(transcript.sessionId, 'windows-history'); assert.ok(transcript.text.includes('history needle')); assert.ok(transcript.text.length > 32000000);
    assert.equal(createHash('sha256').update(await fs.readFile(source)).digest('hex'), hash);
    await fs.appendFile(source, message); client.send({ ...scan, requestId: 'cancel' }); client.send({ module: 'agent_data', type: 'cancel', requestId: 'cancel' });
    await until(() => client.events.some(event => event.requestId === 'cancel'), 'history cancellation');
    assert.equal(client.events.find(event => event.requestId === 'cancel').error, 'cancelled');
  });
  await check('server termination closes all job handles and service can restart', async () => {
    const running = await tree(client); server.process.kill('SIGKILL'); await once(server.process, 'close'); await gone(running);
    const restarted = await startServer(), fresh = await connect(restarted);
    const id = await fresh.init("Write-Output 'AFTER-SERVER-RESTART'; exit 0"); assert.equal((await fresh.exit(id)).code, 0);
  });
  success = true;
} finally {
  for (const client of clients) if (!client.closed) client.ws.close();
  for (const server of servers) if (server.process.exitCode === null) server.process.kill('SIGKILL');
  // Cleanup only recorded fixture children, checking the full identity against PID reuse.
  for (const original of ownedProcesses) {
    const current = inspect(original.ProcessId);
    if (current && current.CreationDate === original.CreationDate && current.CommandLine === original.CommandLine) process.kill(current.ProcessId, 'SIGKILL');
  }
  const summary = { binary, fixture, success, checks, servers: servers.map(server => ({ pid: server.pid, port: server.port, log: server.logs })), clients: clients.map(client => ({ output: Object.fromEntries([...client.output].map(([id, text]) => [id, { length: text.length, sha256: createHash('sha256').update(text).digest('hex'), prefix: text.slice(0, 160), suffix: text.slice(-160) }])), events: client.events.map(event => event.data?.text ? { ...event, data: { ...event.data, text: undefined, textLength: event.data.text.length, textSha256: createHash('sha256').update(event.data.text).digest('hex') } } : event) })) };
  await fs.writeFile(path.join(fixture, 'result.json'), JSON.stringify(summary, null, 2));
  console.log(`Windows PTY artifacts: ${fixture}`);
  if (success && !artifactBase) {
    await removeWindowsFixture(ownedFixture);
  }
}
console.log(`Windows PTY/history integration passed (${checks.length} checks)`);
