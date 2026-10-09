// Token-level similarity between our sources and a reference tree (k-gram winnowing, as in MOSS).
//
// Reports file paths and numbers only — never source text — so it can be run against a tree whose code
// must not be read: the similarity gate of the terminal's clean-room rule.
//
// Usage:
//   node scripts/check-similarity.mjs --ours <dir>[,<dir>…] --theirs <dir>[,<dir>…]
//        [--k 25] [--window 20] [--top 40] [--min 0.05] [--json <file>]
//
// Two token streams are compared per file:
//   raw         identifiers and literals kept — detects verbatim copying
//   normalized  identifiers → ID, literals → LIT — detects copying with renamed symbols
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : fallback;
};
const ours = option('--ours', '').split(',').filter(Boolean);
const theirs = option('--theirs', '').split(',').filter(Boolean);
const k = Number(option('--k', '25'));
const window = Number(option('--window', '20'));
const top = Number(option('--top', '40'));
const minimum = Number(option('--min', '0.05'));
if (!ours.length || !theirs.length) throw new Error('--ours and --theirs are required');

const EXTENSIONS = /\.(ts|tsx|mts|js|mjs|rs|css)$/;
const SKIP = new Set(['node_modules', '.git', 'target', 'dist', 'tmp']);

function list(root) {
	const files = [];
	const walk = (directory) => {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			if (SKIP.has(entry.name)) continue;
			const file = path.join(directory, entry.name);
			if (entry.isDirectory()) walk(file);
			else if (EXTENSIONS.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(file);
		}
	};
	walk(root);
	return files;
}

const TOKEN = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[A-Za-z_$][\w$]*|\d[\w.]*|[^\s\w]/g;
const KEYWORDS = new Set(('abstract as async await break case catch class const continue default delete do else enum export extends false finally for from function get if implements import in instanceof interface let new null of private protected public readonly return set static super switch this throw true try type typeof undefined var void while yield ' +
	'fn impl pub mod use struct trait match loop mut ref self Self crate move where dyn unsafe').split(' '));

function tokens(text) {
	const raw = [];
	const normalized = [];
	for (const [token] of text.matchAll(TOKEN)) {
		if (token.startsWith('//') || token.startsWith('/*')) continue;
		raw.push(token);
		if (/^["'`]/.test(token) || /^\d/.test(token)) normalized.push('LIT');
		else if (/^[A-Za-z_$]/.test(token)) normalized.push(KEYWORDS.has(token) ? token : 'ID');
		else normalized.push(token);
	}
	return { raw, normalized };
}

const hash = (value) => createHash('sha1').update(value).digest().readUInt32BE(0);

/** k-gram hashes per position, then winnowed fingerprints (minimum hash of each window). */
function fingerprint(stream) {
	const grams = [];
	for (let i = 0; i + k <= stream.length; i += 1) grams.push(hash(stream.slice(i, i + k).join('\u0001')));
	const selected = new Set();
	for (let i = 0; i + window <= grams.length; i += 1) {
		let min = grams[i];
		for (let j = i + 1; j < i + window; j += 1) if (grams[j] < min) min = grams[j];
		selected.add(min);
	}
	if (grams.length && grams.length < window) selected.add(Math.min(...grams));
	return { grams, selected };
}

/** Longest run of consecutive k-grams of `grams` that also occur in `other`, in tokens. */
function longestRun(grams, other) {
	let best = 0;
	let run = 0;
	for (const gram of grams) {
		run = other.has(gram) ? run + 1 : 0;
		if (run > best) best = run;
	}
	return best ? best + k - 1 : 0;
}

function load(roots) {
	return roots.flatMap((root) => list(root).map((file) => {
		const { raw, normalized } = tokens(fs.readFileSync(file, 'utf8'));
		const r = fingerprint(raw);
		const n = fingerprint(normalized);
		return { file, root, tokens: raw.length, raw: r, normalized: n, rawAll: new Set(r.grams), normalizedAll: new Set(n.grams) };
	}));
}

const left = load(ours);
const right = load(theirs);
const index = { raw: new Map(), normalized: new Map() };
for (const [i, file] of right.entries()) {
	for (const mode of ['raw', 'normalized']) {
		for (const print of file[mode].selected) {
			const owners = index[mode].get(print) ?? new Set();
			owners.add(i);
			index[mode].set(print, owners);
		}
	}
}

const results = [];
for (const file of left) {
	if (file.tokens < k) continue;
	const best = {};
	for (const mode of ['raw', 'normalized']) {
		const counts = new Map();
		for (const print of file[mode].selected) for (const owner of index[mode].get(print) ?? []) counts.set(owner, (counts.get(owner) ?? 0) + 1);
		let top1 = { owner: -1, share: 0 };
		for (const [owner, count] of counts) {
			const share = count / Math.max(1, file[mode].selected.size);
			if (share > top1.share) top1 = { owner, share };
		}
		const match = right[top1.owner];
		best[mode] = match
			? { share: Number(top1.share.toFixed(3)), match: path.relative(match.root, match.file), run: longestRun(file[mode].grams, match[`${mode}All`]) }
			: { share: 0, match: null, run: 0 };
	}
	if (best.raw.share >= minimum || best.normalized.share >= minimum) {
		results.push({ file: path.relative(process.cwd(), file.file), tokens: file.tokens, ...best });
	}
}
results.sort((a, b) => b.raw.share - a.raw.share || b.normalized.share - a.normalized.share);

console.log(`compared ${left.length} files against ${right.length} reference files (k=${k}, window=${window}); ${results.length} at or above ${minimum}`);
for (const row of results.slice(0, top)) {
	console.log(`${row.raw.share.toFixed(3)} raw (run ${row.raw.run})  ${row.normalized.share.toFixed(3)} norm (run ${row.normalized.run})  ${row.file}  ~ ${row.raw.match ?? row.normalized.match}`);
}
const jsonPath = option('--json');
if (jsonPath) fs.writeFileSync(jsonPath, `${JSON.stringify({ k, window, minimum, ours, theirs: theirs.map((dir) => path.basename(dir)), results }, null, '\t')}\n`);
