import { readFile } from 'node:fs/promises';

export const normalizeBuildText = text => text.replace(/\r\n/g, '\n');

/** Text-loader output must not depend on the checkout's line endings. */
export const canonicalTextResources = {
	name: 'canonical-text-resources',
	setup(build) {
		build.onLoad({ filter: /\.(md|svg)$/ }, async ({ path }) => ({
			contents: normalizeBuildText(await readFile(path, 'utf8')),
			loader: 'text',
		}));
	},
};
