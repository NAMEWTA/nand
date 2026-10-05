import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'src/view/styles/order.json');
const outPath = path.join(root, 'styles.css');

function readSources() {
	const order = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
	if (!Array.isArray(order.sources) || order.sources.length === 0) throw new Error('order.json sources must be a non-empty array');
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
	const built = Buffer.concat(sources.map((rel) => fs.readFileSync(path.join(root, rel))));
	if (check) {
		const current = fs.readFileSync(outPath);
		if (!built.equals(current)) {
			console.error(`styles.css does not match ${sources.length} ordered author sources`);
			process.exitCode = 1;
		} else console.log(`styles.css matches ${sources.length} ordered author sources (${built.length} bytes)`);
	} else {
		fs.writeFileSync(outPath, built);
		console.log(`wrote styles.css from ${sources.length} ordered author sources (${built.length} bytes)`);
	}
}
