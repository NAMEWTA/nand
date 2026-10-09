import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';

const repo = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

/** `.svg` and `.md` imports are bundled as text, matching the esbuild loaders in scripts/esbuild-options.mjs. */
const textResources: Plugin = {
	name: 'nand-text-resources',
	enforce: 'pre',
	load(id: string) {
		const file = id.split('?')[0] ?? id;
		if (!/\.(svg|md)$/.test(file)) return null;
		return `export default ${JSON.stringify(readFileSync(file, 'utf8'))};`;
	},
};

const shared = {
	plugins: [textResources],
	oxc: { jsx: { runtime: 'automatic' as const, importSource: 'preact' } },
};

/** Settings definition tests render against the Iconic stub, as their former esbuild bundles did. */
const iconicStubTests = ['src/app/settings/setting-definitions.test.ts', 'src/modules/icons/iconic-port.test.ts'];

export default defineConfig({
	test: {
		projects: [
			{
				...shared,
				resolve: { alias: { obsidian: repo('./scripts/obsidian-stub.ts'), react: 'preact/compat' } },
				test: { name: 'unit', include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.ts'], exclude: iconicStubTests, environment: 'node', setupFiles: ['./scripts/module-strings.ts'] },
			},
			{
				...shared,
				resolve: { alias: { obsidian: repo('./scripts/iconic-obsidian-stub.ts'), react: 'preact/compat' } },
				test: { name: 'settings-iconic', include: iconicStubTests, environment: 'node', setupFiles: ['./scripts/module-strings.ts'] },
			},
		],
	},
});
