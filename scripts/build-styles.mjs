import fs from 'node:fs';
import path from 'node:path';
import { normalizeBuildText } from './build-text-resources.mjs';

const root = process.cwd();
const manifestPath = path.join(root, 'src/styles.json');
const outPath = path.join(root, 'styles.css');

function readSources() {
	const order = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
	if (!Array.isArray(order.sources) || order.sources.length === 0) throw new Error('src/styles.json sources must be a non-empty array');
	const seen = new Set();
	for (const rel of order.sources) {
		if (typeof rel !== 'string' || path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) throw new Error(`bad source ${rel}`);
		if (seen.has(rel)) throw new Error(`duplicate source ${rel}`);
		seen.add(rel);
	}
	return order.sources;
}

const check = process.argv.includes('--check');
const write = process.argv.includes('--write');
if (check === write) {
	console.error('Use exactly one of --check or --write');
	process.exitCode = 2;
} else {
	const sources = readSources();
	const built = sources.map((rel) => normalizeBuildText(fs.readFileSync(path.join(root, rel), 'utf8'))).join('');
	if (check) {
		const current = normalizeBuildText(fs.readFileSync(outPath, 'utf8'));
		if (built !== current) {
			console.error(`styles.css does not match ${sources.length} ordered author sources`);
			process.exitCode = 1;
		} else console.log(`styles.css matches ${sources.length} ordered author sources (${Buffer.byteLength(built)} bytes)`);
	} else {
		fs.writeFileSync(outPath, built);
		console.log(`wrote styles.css from ${sources.length} ordered author sources (${Buffer.byteLength(built)} bytes)`);
	}
}
