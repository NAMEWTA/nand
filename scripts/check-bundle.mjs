// Bundle analysis: which inputs are evaluated at plugin startup and which only behind `import()`.
//
// esbuild (CJS, no splitting) wraps modules that are reachable only through dynamic imports in lazy
// initializers, so their top-level code runs on first import. Every static edge from the entry pulls the
// target into the startup set. This script rebuilds in memory with a metafile and reports both sets.
//
// Usage:
//   node scripts/check-bundle.mjs                 print a summary
//   node scripts/check-bundle.mjs --json <file>   also write the full report as JSON
//   node scripts/check-bundle.mjs --files         list every startup input by size
//   node scripts/check-bundle.mjs --budget <file> compare against budgets (fails with --enforce)
import esbuild from 'esbuild';
import fs from 'node:fs';
import { pluginBuildOptions } from './esbuild-options.mjs';

const args = process.argv.slice(2);
const option = (name) => {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
};

const result = await esbuild.build({
	...pluginBuildOptions({ production: true }),
	write: false,
	metafile: true,
	logLevel: 'silent',
});
const { inputs, outputs } = result.metafile;
const output = outputs['main.js'];
if (!output) throw new Error('main.js missing from the metafile');
const bytes = (input) => output.inputs[input]?.bytesInOutput ?? 0;

/** Follow edges from the entry; `dynamic-import` edges start the lazy set instead. */
function reachable(entry, followDynamic) {
	const seen = new Set();
	const stack = [entry];
	while (stack.length) {
		const current = stack.pop();
		if (seen.has(current)) continue;
		seen.add(current);
		for (const edge of inputs[current]?.imports ?? []) {
			if (edge.external) continue;
			if (!followDynamic && edge.kind === 'dynamic-import') continue;
			stack.push(edge.path);
		}
	}
	return seen;
}

const entry = Object.keys(inputs).find((input) => input.endsWith('src/app/main.ts'));
if (!entry) throw new Error('entry src/app/main.ts missing from the metafile');
const eager = reachable(entry, false);
const all = reachable(entry, true);

/** `src/modules/home/ui/x.ts` → `src/modules/home/ui`; `src/app/x.ts` → `src/app`; `node_modules/.pnpm/a@1/node_modules/a/x.js` → `npm:a`. */
function area(input) {
	const pkg = /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/.exec(input);
	if (pkg) return `npm:${pkg[1]}`;
	const parts = input.split('/');
	if (parts[0] !== 'src') return parts[0];
	return parts.slice(0, parts[1] === 'modules' ? 4 : 2).join('/');
}

function summarize(set) {
	const groups = new Map();
	let total = 0;
	for (const input of set) {
		const size = bytes(input);
		total += size;
		groups.set(area(input), (groups.get(area(input)) ?? 0) + size);
	}
	const sorted = [...groups].sort((a, b) => b[1] - a[1]).map(([name, size]) => ({ name, bytes: size }));
	return { inputs: set.size, bytes: total, areas: sorted };
}

const lazy = new Set([...all].filter((input) => !eager.has(input)));

/**
 * Activation closure of each module: what activating it evaluates on top of the startup set: `module.ts` and its
 * static imports, plus `import()` targets in `module.ts` other than page and settings-page loaders. Pages,
 * settings pages and second-level `import()`s (heavy data, dialogs) load later and are reported as `deferred`.
 */
const modules = {};
for (const input of Object.keys(inputs)) {
	const match = /^src\/modules\/([^/]+)\/module\.ts$/.exec(input);
	if (!match) continue;
	// Code loaded by `import()` inside module.ts is activation code, except page loaders (`*-page.ts`: workbench, records and settings pages load on first use).
	const activationRoots = [input, ...(inputs[input]?.imports ?? []).filter((edge) => edge.kind === 'dynamic-import' && !edge.external && !/-page\.tsx?$/.test(edge.path)).map((edge) => edge.path)];
	const activation = [...new Set(activationRoots.flatMap((root) => [...reachable(root, false)]))].filter((item) => !eager.has(item));
	const deferred = [...reachable(input, true)].filter((item) => !eager.has(item) && !activation.includes(item));
	modules[match[1]] = { activation: activation.reduce((sum, item) => sum + bytes(item), 0), deferred: deferred.reduce((sum, item) => sum + bytes(item), 0) };
}

const report = {
	output: { bytes: output.bytes },
	eager: summarize(eager),
	lazy: summarize(lazy),
	modules,
};

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`main.js ${kb(report.output.bytes)}`);
console.log(`startup-evaluated ${kb(report.eager.bytes)} (${report.eager.inputs} inputs); lazy ${kb(report.lazy.bytes)} (${report.lazy.inputs} inputs)`);
console.log('top startup areas:');
for (const { name, bytes: size } of report.eager.areas.slice(0, 20)) console.log(`  ${kb(size).padStart(10)}  ${name}`);

if (args.includes('--files')) {
	console.log('startup inputs:');
	for (const input of [...eager].sort((a, b) => bytes(b) - bytes(a))) console.log(`  ${kb(bytes(input)).padStart(10)}  ${input}`);
}

console.log('module activation (+ deferred pages and import() targets):');
for (const [id, size] of Object.entries(modules).sort()) console.log(`  ${id.padEnd(14)}${kb(size.activation).padStart(10)}  (+ ${kb(size.deferred)})`);

const jsonPath = option('--json');
if (jsonPath) fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, '\t')}\n`);

const budgetPath = option('--budget');
if (budgetPath) {
	const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
	const failures = [];
	if (budget.outputBytes && report.output.bytes > budget.outputBytes) failures.push(`main.js ${report.output.bytes} > ${budget.outputBytes}`);
	if (budget.eagerBytes && report.eager.bytes > budget.eagerBytes) failures.push(`startup-evaluated ${report.eager.bytes} > ${budget.eagerBytes}`);
	const styles = fs.statSync('styles.css').size;
	if (budget.stylesBytes && styles > budget.stylesBytes) failures.push(`styles.css ${styles} > ${budget.stylesBytes}`);
	for (const [id, limit] of Object.entries(budget.moduleActivationBytes ?? {})) {
		const size = report.modules[id]?.activation ?? 0;
		if (size > limit) failures.push(`${id} activation ${size} > ${limit}`);
	}
	for (const name of budget.forbiddenEagerAreas ?? []) {
		const hit = report.eager.areas.find((item) => item.name === name);
		if (hit) failures.push(`${name} (${hit.bytes} bytes) is evaluated at startup`);
	}
	if (failures.length) {
		console.log(`budget: ${failures.length} over`);
		for (const failure of failures) console.log(`  ${failure}`);
		if (args.includes('--enforce')) process.exit(1);
	} else console.log('budget: within limits');
}
