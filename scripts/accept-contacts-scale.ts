/** Disk-backed measurements, kept outside test:all. Host rendering is measured in Obsidian separately. */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { cpus, freemem, platform, release, tmpdir, totalmem } from 'node:os';
import { join } from 'node:path';
import { ContactsIndex, emptyQuery } from '../src/modules/archives/core/index-store';
import { newRecord } from '../src/modules/archives/core/model';
import { createMarkdown, parseRecord } from '../src/modules/archives/core/persist/markdown';

const round = (value: number) => Math.round(value * 100) / 100;
function percentiles(values: number[]) {
	values.sort((a, b) => a - b);
	return { p50Ms: round(values[Math.ceil(values.length * 0.5) - 1]!), p95Ms: round(values[Math.ceil(values.length * 0.95) - 1]!) };
}
const token = (index: number) => `needle-${String(index).padStart(5, '0')}-end`;
function bodyOf(bytes: number, index: number): string {
	if (!bytes) return '';
	const prefix = `Body ${token(index)}\n`;
	const remaining = bytes - Buffer.byteLength(prefix);
	const body = prefix + '甲'.repeat(Math.floor(remaining / 3)) + 'a'.repeat(remaining % 3);
	assert.equal(Buffer.byteLength(body), bytes);
	return body;
}

async function main(): Promise<void> {
	const root = await mkdtemp(join(tmpdir(), 'nand-contacts-scale-'));
	const hardware = { platform: platform(), release: release(), arch: process.arch, node: process.version,
		cpu: cpus()[0]?.model, logicalCpus: cpus().length, totalMemoryBytes: totalmem(), freeMemoryBytes: freemem() };
	const samples = [];
	try {
		for (const count of [100, 1000, 5000]) for (const bodyBytes of [0, 2048, 20480]) {
			const dir = join(root, `${count}-${bodyBytes}`);
			await mkdir(dir);
			const paths: string[] = [];
			let fileBytes = 0;
			for (let i = 0; i < count; i++) {
				const record = newRecord(i % 2 ? 'company' : 'person');
				record.fields.name = `Scale ${String(i).padStart(5, '0')}`;
				record.fields.tags = [`group-${i % 10}`];
				record.prose.notes = `Note ${token(i)}`;
				record.path = join(dir, `${i}.md`);
				const markdown = `${createMarkdown(record)}\n\n${bodyOf(bodyBytes, i)}`;
				await writeFile(record.path, markdown);
				fileBytes += Buffer.byteLength(markdown);
				paths.push(record.path);
			}
			globalThis.gc?.();
			const before = process.memoryUsage();
			const index = new ContactsIndex();
			const started = performance.now();
			// Match the production rebuild's batch size; disk reads, parsing and indexing are all timed.
			for (let i = 0; i < paths.length; i += 20) await Promise.all(paths.slice(i, i + 20).map(async (path) => {
				const record = parseRecord(await readFile(path, 'utf8'), path);
				assert.ok(record, `Unparsed ${path}`);
				index.set(record);
			}));
			const coldIndexMs = round(performance.now() - started);
			globalThis.gc?.();
			const indexed = process.memoryUsage();
			// Removing the fixture makes accidental reads during hot queries fail.
			await rm(dir, { recursive: true, force: true });
			const timings: number[] = [], repeated: number[] = [];
			const workload: Record<string, number[]> = { notes: [], body: [], missing: [], broad: [] };
			for (let n = 0; n < 80; n++) {
				const row = (n * 37) % count;
				const kind = row % 2 ? 'company' : 'person';
				const category = ['notes', 'body', 'missing', 'broad'][n % 4]!;
				const search = category === 'notes' ? `Note ${token(row)}` : category === 'body' ? `Body ${token(row)}`
					: category === 'missing' ? `absent-${n}` : `Scale group-${row % 10}`;
				const query = { ...emptyQuery(), kind, search } as const;
				const expected = category === 'missing' || (category === 'body' && !bodyBytes) ? 0 : category === 'broad' ? count / 10 : 1;
				const at = performance.now();
				const found = index.query(query);
				const elapsed = performance.now() - at;
				timings.push(elapsed);
				workload[category]!.push(elapsed);
				assert.equal(found.length, expected, `${count}/${bodyBytes}/${category}`);
				const cachedAt = performance.now();
				const cached = index.query(query);
				repeated.push(performance.now() - cachedAt);
				assert.deepEqual(cached, found);
			}
			const query = percentiles(timings);
			const sample = { count, people: count / 2, companies: count / 2, bodyBytesPerRecord: bodyBytes, fileBytes, coldIndexMs,
				query: { ...query, samples: timings.length, distinctConsecutiveQueries: true, workload: Object.fromEntries(Object.entries(workload).map(([key, values]) => [key, percentiles(values)])) },
				repeatedQuery: percentiles(repeated), heapDeltaBytes: indexed.heapUsed - before.heapUsed,
				heapUsedBytes: indexed.heapUsed, rssBytes: indexed.rss, gcAvailable: !!globalThis.gc,
				target: count === 1000 && bodyBytes === 2048 ? { p95Ms: 100, passed: query.p95Ms <= 100 } : null };
			samples.push(sample);
			console.error(`${count} records / ${bodyBytes} body bytes: cold ${coldIndexMs} ms, query P95 ${query.p95Ms} ms`);
			index.clear();
		}
	} finally { await rm(root, { recursive: true, force: true }); }
	console.log(JSON.stringify({ hardware, samples, note: 'Fresh in-memory index with warm OS file cache. Files removed before hot queries. Host rendering is a separate Obsidian measurement.' }, null, 2));
	if (samples.some((sample) => sample.target && !sample.target.passed)) process.exitCode = 1;
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
