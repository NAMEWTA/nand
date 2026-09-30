import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { createHash } from 'node:crypto';

// Only generated transcripts and a generated legacy index are used. A separate
// directory per run lets the same benchmark exercise transactional migration.
const binary = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3] || 'scripts/tmp/orca-history-benchmark');
await fs.mkdir(output, { recursive: true });
const fixture = await fs.mkdtemp(path.join(output, 'history-bench-'));
const server = spawn(binary, [], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let ws;
const results = [];
const environment = { platform: process.platform, arch: process.arch, node: process.version, cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, memoryBytes: os.totalmem() };
const binarySha256 = createHash('sha256').update(await fs.readFile(binary)).digest('hex');
const nativeResources = () => {
  if (process.platform !== 'win32') return null;
  const shell = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const result = spawnSync(shell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `Get-Process -Id ${server.pid} | Select-Object @{n='cpuMs';e={$_.TotalProcessorTime.TotalMilliseconds}},WorkingSet64,PrivateMemorySize64,PeakWorkingSet64 | ConvertTo-Json -Compress`], { windowsHide: true, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim());
};
try {
  const [data] = await once(server.stdout, 'data');
  const { port } = JSON.parse(data.toString().trim());
  ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await once(ws, 'open');
  const pending = new Map();
  ws.addEventListener('message', event => {
    if (typeof event.data !== 'string') return;
    const value = JSON.parse(event.data), job = pending.get(value.requestId);
    if (!job) return;
    pending.delete(value.requestId);
    clearTimeout(job.timer);
    value.error ? job.reject(Error(value.error)) : job.resolve({ data: value.data, bytes: Buffer.byteLength(event.data) });
  });
  const request = payload => new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => { pending.delete(requestId); reject(Error('Benchmark request timed out')); }, 120000);
    const raw = JSON.stringify({ module: 'agent_data', type: 'query', ...payload, requestId });
    pending.set(requestId, { resolve: result => resolve({ ...result, requestBytes: Buffer.byteLength(raw) }), reject, timer });
    ws.send(raw);
  });
  for (const count of [500, 5000, 20000]) {
    const vault = path.join(fixture, String(count));
    const index = path.join(vault, '.nand', 'terminal-agent', 'bench', 'index.sqlite');
    await fs.mkdir(path.dirname(index), { recursive: true });
    const db = new DatabaseSync(index);
    db.exec('CREATE TABLE history (key TEXT PRIMARY KEY, source TEXT NOT NULL, stamp TEXT NOT NULL, data TEXT NOT NULL, body TEXT NOT NULL, modified INTEGER NOT NULL); BEGIN;');
    const insert = db.prepare('INSERT INTO history VALUES (?,?,?,?,?,?)');
    let fullBytes = 0;
    for (let n = 0; n < count; n++) {
      const row = { key: String(n), agentId: 'codex', accountKey: 'fixture-account', sessionId: String(n), cwd: vault, title: `Fixture ${n}`, transcriptPath: path.join(vault, `fixture-${n}.jsonl`), modifiedAtMs: n, text: `substring needle ${'x'.repeat(10240)}`, usage: { input: 2, output: 1, cacheRead: 0, cacheWrite: 0, cost: null, known: true } };
      const raw = JSON.stringify(row); fullBytes += Buffer.byteLength(raw);
      insert.run(row.key, row.transcriptPath, 'fixture', raw, `${row.title}\n${row.cwd}\n${row.text}`, n);
    }
    db.exec('COMMIT;'); db.close();
    const samples = [], scope = { vault, index, query: 'needle', offset: 100 };
    const firstAt = performance.now();
    await request(scope); // Warm SQLite/OS caches and migrate the legacy schema.
    const firstMs = performance.now() - firstAt;
    const nativeBefore = nativeResources(), clientBefore = process.resourceUsage();
    let response;
    const sampleAt = performance.now();
    for (let n = 0; n < 20; n++) {
      const at = performance.now(); response = await request(scope); samples.push(performance.now() - at);
      assert.equal(response.data.total, count); assert.equal(response.data.rows.length, 100);
      if (performance.now() - sampleAt > 90000) break; // Explicit bounded sampling on slow baselines.
    }
    samples.sort((a,b) => a-b);
    const migrated = new DatabaseSync(index);
    const hasSummary = migrated.prepare('PRAGMA table_info(history)').all().some(column => column.name === 'summary');
    const parsedBytes = hasSummary ? migrated.prepare('SELECT SUM(length(CAST(summary AS BLOB))) AS bytes FROM (SELECT summary FROM history ORDER BY modified DESC,key ASC LIMIT 100 OFFSET 100)').get().bytes : fullBytes;
    migrated.close();
    const nativeAfter = nativeResources(), clientAfter = process.resourceUsage();
    const result = { count, transcriptBytesPerRow: 10240, samples: samples.length, requests: samples.length + 1, firstMs, p50Ms: samples[Math.floor(samples.length*.5)], p95Ms: samples[Math.min(samples.length-1, Math.ceil(samples.length*.95)-1)], requestBytes: response.requestBytes, responseParseBytes: response.bytes, nativeSessionParseBytes: parsedBytes, nativeParseMeasurement: 'serialized selected SQLite data/summary bytes; schema determines selected row count', schema: hasSummary ? 'summary' : 'legacy', nativeCpuMs: nativeAfter ? nativeAfter.cpuMs - nativeBefore.cpuMs : null, nativeWorkingSetBytes: nativeAfter?.WorkingSet64, nativePrivateBytes: nativeAfter?.PrivateMemorySize64, nativePeakWorkingSetBytes: nativeAfter?.PeakWorkingSet64, clientCpuMs: (clientAfter.userCPUTime + clientAfter.systemCPUTime - clientBefore.userCPUTime - clientBefore.systemCPUTime) / 1000, clientMaxRssKiB: clientAfter.maxRSS, samplesMs: samples };
    results.push(result); console.log(JSON.stringify(result));
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ binary, binarySha256, environment, measuredAt: new Date().toISOString(), fixture, results }, null, 2));
  }
} finally {
  ws?.close();
  if (server.exitCode === null && server.signalCode === null) { server.kill(); await once(server, 'exit'); }
}
