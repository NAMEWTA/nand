/** Upgrade guards: exercise the exact production transforms, including missed paths. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { build, transform } from 'esbuild';
import postcss from 'postcss';
import { scopeTailwind } from './scope-tailwind.mjs';
import { adaptSonnerStyles, sonnerStyles } from './sonner-styles.mjs';
import { modalTransforms, radixOwnerDocument } from './radix-owner-document.mjs';
import { pluginBuildOptions } from './esbuild-options.mjs';

const manifest = JSON.parse(readFileSync(new URL('./ui-adapter-inputs.json', import.meta.url), 'utf8'));
let checks = 0;
const pnpm = path.resolve('node_modules/.pnpm');
const transforms = { 'sonner/dist/index.mjs': adaptSonnerStyles, ...modalTransforms };
for (const [suffix, adapt] of Object.entries(transforms)) {
	const sources = new Set();
	for (const name of readdirSync(pnpm)) {
		try { sources.add(readFileSync(path.join(pnpm, name, 'node_modules', suffix), 'utf8').replace(/\r\n/g, '\n')); } catch {}
	}
	assert(sources.size > 0, suffix);
	for (const source of sources) {
		const output = adapt(source);
		assert.notEqual(output, source); await transform(output, { loader: 'js' }); checks++;
		// Removing all exact anchors must throw instead of silently emitting the old module.
		assert.throws(() => adapt('export const changedRelease = true;')); checks++;
		if (suffix.startsWith('sonner')) {
			assert(!output.includes('__insertCSS'));
			assert.throws(() => adapt(source + '\n__insertCSS("unexpected extra call");\n')); checks++;
		}
	}
}
// Optimized Tailwind may spell pseudo-elements with a single colon. Scope must
// precede the pseudo-element; otherwise Chrome ignores the entire declaration.
for (const pseudo of [':before', ':after', '::before', '::after']) {
	const selector = `.before\\:w-px${pseudo}`;
	const scoped = (await postcss([scopeTailwind()]).process(`${selector}{width:1px}`, { from: undefined })).css;
	assert(scoped.includes(`:not(#\\#)${pseudo}`));
	assert(!scoped.includes(`${pseudo}:is(`));
	checks++;
}
// Full graph is the positive fixture for exact match counts (including both Radix versions).
const options = pluginBuildOptions({ production: true });
await build({ ...options, write: false, logLevel: 'silent' }); checks++;
const fixture = mkdtempSync(path.join(os.tmpdir(), 'nand-ui-adapters-'));
try {
	async function failure(plugin, files, expected) {
		const entryPoints = files.map(([name, source]) => {
			const file = path.join(fixture, name); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, source); return file;
		});
		await assert.rejects(build({ entryPoints, outdir: path.join(fixture, 'out'), bundle: true, write: false, plugins: [plugin], packages: 'external', logLevel: 'silent' }), expected);
		checks++;
	}
	for (const [plugin, suffix] of [[sonnerStyles, 'sonner/dist/index.mjs'], [radixOwnerDocument, '@radix-ui/react-focus-scope/dist/index.mjs']]) {
		const expected = new RegExp(suffix.replaceAll('.', '\\.') + ': expected .* got 0');
		await failure(plugin, [[suffix.replace('index.mjs', 'renamed.mjs'), 'export const renamed = true;']], expected);
		await failure(plugin, [[suffix.replace('index.mjs', 'index.js'), 'exports.cjs = true;']], expected);
		await failure(plugin, [[suffix, 'export const changedRelease = true;']], /unreviewed source/);
		// Extra physical copies are also a graph change, even when source hashes match.
		const packageDir = readdirSync(pnpm).find(name => { try { readFileSync(path.join(pnpm, name, 'node_modules', suffix)); return true; } catch { return false; } });
		const source = readFileSync(path.join(pnpm, packageDir, 'node_modules', suffix), 'utf8');
		const copies = Array.from({ length: manifest[suffix].files + 1 }, (_, i) => [`copy-${i}/${suffix}`, source]);
		await failure(plugin, copies, /expected .* matched files, got/);
	}
} finally { rmSync(fixture, { recursive: true, force: true }); }
console.log(`UI adapters: ${checks} positive/negative checks passed (source, anchors, renamed/CJS entries, extra copies, full graph).`);
