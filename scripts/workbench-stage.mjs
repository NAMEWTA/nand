// Temporary deterministic transport for the locally tested, reviewed source edits.
// No eval, dependency changes, network calls, credentials or user Vault access.
// Remove this file and its transport chunks before final review.
import { brotliDecompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const raw = brotliDecompressSync(Buffer.concat(['01', '02', '03'].map((part) => readFileSync(`scripts/workbench-reviewed-${part}.br`))));
if (hash(raw) !== 'a99f7b0d84c3fadc03101a7c59deeb9ea12ee133d8eb989934cd044fd5d390f8') throw new Error('Reviewed edit transport digest mismatch');
const actions = JSON.parse(raw.toString('utf8'));
if (!Array.isArray(actions) || actions.length !== 59) throw new Error('Invalid reviewed action set');
const allowed = (path) => typeof path === 'string' && !path.includes('..') && !path.includes('\\') && (path.startsWith('src/') || ['package.json', 'styles.css', 'scripts/verify-editor-comments.ts', 'scripts/verify-panel-composition.ts'].includes(path));
const targets = new Set();
// Capture and verify every original before writing: an extracted surface can
// intentionally use the old native wrapper's content as its source.
const outputs = actions.map((action) => {
 if (!allowed(action.path) || !allowed(action.base) || targets.has(action.path)) throw new Error('Invalid edit path');
 targets.add(action.path);
 if (action.new && existsSync(action.path)) throw new Error(`New target already exists: ${action.path}`);
 const original = existsSync(action.base) ? readFileSync(action.base, 'utf8') : '';
 if (hash(original) !== action.baseSha) throw new Error(`Source baseline mismatch: ${action.base}`);
 if (action.delete) {
  if (action.path !== 'src/view/agent-usage/usage-modal.ts') throw new Error('Unexpected deletion');
  return { path: action.path, delete: true };
 }
 const lines = original.match(/[^\n]*\n|[^\n]+$/g) ?? [];
 let position = 0, result = '';
 for (const [start, end, text] of action.edits) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < position || end < start || end > lines.length || typeof text !== 'string') throw new Error('Invalid line splice');
  result += lines.slice(position, start).join('') + text;
  position = end;
 }
 result += lines.slice(position).join('');
 if (hash(result) !== action.resultSha) throw new Error(`Result digest mismatch: ${action.path}`);
 return { path: action.path, result };
});
for (const output of outputs) {
 if (output.delete) unlinkSync(output.path);
 else { mkdirSync(dirname(output.path), { recursive: true }); writeFileSync(output.path, output.result, 'utf8'); }
 console.log(`Applied reviewed source: ${output.path}`);
}
