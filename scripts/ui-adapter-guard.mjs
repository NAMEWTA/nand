import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const inputs = JSON.parse(readFileSync(new URL('./ui-adapter-inputs.json', import.meta.url), 'utf8'));

/** Fail closed both when source text changes and when an entry stops matching onLoad.
 * The manifest records the actual production graph, not just the installed packages.
 * State lives inside setup and resets onStart, including watch rebuilds. */
export function guardedAdapter(name, transforms) {
	return {
		name,
		setup(build) {
			const seen = new Map();
			build.onStart(() => { seen.clear(); });
			for (const [suffix, transform] of Object.entries(transforms)) {
				const expected = inputs[suffix];
				if (!expected) throw new Error(`${name}: missing input manifest for ${suffix}`);
				const filter = new RegExp(`[\\\\/]${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('/', '[\\\\/]')}$`);
				build.onLoad({ filter }, ({ path }) => {
					const source = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
					const digest = createHash('sha256').update(source).digest('hex');
					if (!expected.sha256.includes(digest)) throw new Error(`${name}: unreviewed source ${suffix}`);
					const files = seen.get(suffix) ?? new Set();
					files.add(path);
					seen.set(suffix, files);
					return { contents: transform(source), loader: 'js' };
				});
			}
			build.onEnd((result) => {
				if (result.errors.length) return;
				const errors = [];
				for (const suffix of Object.keys(transforms)) {
					const actual = seen.get(suffix)?.size ?? 0;
					if (actual !== inputs[suffix].files) errors.push({ text: `${name}: ${suffix}: expected ${inputs[suffix].files} matched files, got ${actual}; review entry paths/exports and the dependency graph` });
				}
				return { errors };
			});
		},
	};
}

export function patchText(source, label) {
	return {
		replace(before, after, count = 1) {
			const actual = source.split(before).length - 1;
			if (actual !== count) throw new Error(`${label}: expected ${count} anchors, got ${actual}: ${before}`);
			source = source.replaceAll(before, after);
			return this;
		},
		get source() { return source; },
	};
}
