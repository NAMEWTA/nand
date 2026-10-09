// Style statistics for styles.css author sources: size, !important, literal colors, z-index, duplicates.
//
// Usage:
//   node scripts/check-styles.mjs                 print a summary
//   node scripts/check-styles.mjs --json <file>   also write the full report as JSON
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const { sources } = JSON.parse(fs.readFileSync(path.join(root, 'src/styles.json'), 'utf8'));

const count = (text, pattern) => (text.match(pattern) ?? []).length;
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');

/** Top-level rule preludes (outside @media/@container), used to find selectors declared more than once. */
function topLevelSelectors(text) {
	const selectors = [];
	let depth = 0;
	let prelude = '';
	for (const char of text) {
		if (char === '{') {
			if (depth === 0 && !prelude.trim().startsWith('@')) selectors.push(prelude.trim().replace(/\s+/g, ' '));
			depth += 1;
			prelude = '';
		} else if (char === '}') {
			depth = Math.max(0, depth - 1);
			prelude = '';
		} else if (char === ';' && depth === 0) prelude = '';
		else prelude += char;
	}
	return selectors;
}

const files = [];
const selectorOwners = new Map();
let maxZ = 0;
for (const source of sources) {
	const raw = fs.readFileSync(path.join(root, source), 'utf8');
	const text = stripComments(raw);
	for (const match of text.matchAll(/z-index\s*:\s*(-?\d+)/g)) maxZ = Math.max(maxZ, Number(match[1]));
	for (const selector of topLevelSelectors(text)) {
		const owners = selectorOwners.get(selector) ?? [];
		owners.push(source);
		selectorOwners.set(selector, owners);
	}
	files.push({
		source,
		bytes: Buffer.byteLength(raw),
		important: count(text, /!important/g),
		hex: count(text, /#[0-9a-fA-F]{3,8}\b/g),
		rgb: count(text, /\brgba?\(/g),
		has: count(text, /:has\(/g),
		zIndex: count(text, /z-index\s*:/g),
	});
}

const sum = (key) => files.reduce((total, file) => total + file[key], 0);
const duplicates = [...selectorOwners].filter(([, owners]) => owners.length > 1).map(([selector, owners]) => ({ selector, owners }));
const report = {
	files: files.length,
	bytes: sum('bytes'),
	important: sum('important'),
	hex: sum('hex'),
	rgb: sum('rgb'),
	has: sum('has'),
	zIndexDeclarations: sum('zIndex'),
	maxZIndex: maxZ,
	duplicateTopLevelSelectors: duplicates.length,
	largest: [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 15),
	duplicates,
	perFile: files,
};

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`${report.files} sources, ${kb(report.bytes)}; !important ${report.important}; hex ${report.hex}; rgb() ${report.rgb}; :has ${report.has}; z-index ${report.zIndexDeclarations} (max ${report.maxZIndex}); duplicate top-level selectors ${report.duplicateTopLevelSelectors}`);
for (const file of report.largest.slice(0, 10)) console.log(`  ${kb(file.bytes).padStart(9)}  ${file.source}`);

const jsonIndex = process.argv.indexOf('--json');
if (jsonIndex >= 0) fs.writeFileSync(process.argv[jsonIndex + 1], `${JSON.stringify(report, null, '\t')}\n`);
