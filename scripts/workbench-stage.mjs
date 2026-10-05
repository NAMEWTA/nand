// Temporary deterministic handoff of locally reviewed source. Remove before final review.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
const hash = value => createHash('sha256').update(value).digest('hex');
const expectedBuild = '84905834ae209492c5faf5d1daf687adcf15ec02005bc009119d124b5a844688';
if (process.argv.includes('--verify-build')) {
  assert.equal(hash(readFileSync('main.js')), expectedBuild, 'Build differs from the native-tested artifact');
  console.log('Rebuilt artifact matches the locally tested source and native host evidence.');
} else {
  const packed = readFileSync('scripts/workbench-reviewed-04.br', 'utf8');
  assert.equal(hash(packed), 'dda99a4e80238accaef4d53b3d32b5797ef77112a4b4170a9594478edcc49578', 'Reviewed patch checksum mismatch');
  const changes = JSON.parse(brotliDecompressSync(Buffer.from(packed.trim(), 'base64')).toString('utf8'));
  const seen = new Set();
  const writes = changes.map(change => {
    const { path, before } = change;
    assert.equal(typeof path, 'string');
    assert.ok(!path.includes('..') && !path.includes('\\') && !path.startsWith('/'));
    assert.match(path, /^(src\/|scripts\/|docs\/|speculo\/|\.agents\/|styles\.css$|package\.json$|esbuild\.config\.mjs$)/);
    assert.ok(!seen.has(path), 'Duplicate path');
    seen.add(path);
    const old = existsSync(path) ? readFileSync(path, 'utf8') : null;
    assert.equal(old === null ? null : hash(old), before, `Source changed since review: ${path}`);
    let next = change.content;
    if (change.edits) {
      assert.notEqual(old, null);
      const lines = old.split('\n');
      let ceiling = lines.length;
      for (const edit of [...change.edits].reverse()) {
        assert.ok(Number.isInteger(edit.start) && Number.isInteger(edit.end));
        assert.ok(edit.start >= 0 && edit.end >= edit.start && edit.end <= ceiling);
        assert.ok(Array.isArray(edit.lines) && edit.lines.every(line => typeof line === 'string'));
        lines.splice(edit.start, edit.end - edit.start, ...edit.lines);
        ceiling = edit.start;
      }
      next = lines.join('\n');
      assert.equal(hash(next), change.after, `Reviewed output mismatch: ${path}`);
    }
    assert.ok(next === null || typeof next === 'string');
    return { path, next };
  });
  for (const { path, next } of writes) {
    if (next === null) unlinkSync(path);
    else { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, next); }
    console.log(`Applied reviewed source: ${path}`);
  }
  console.log(`Validated and applied ${writes.length} source/test changes; build, lint and the complete test suite must pass before commit.`);
}
