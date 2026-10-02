import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import esbuild from 'esbuild';
import { canonicalTextResources, normalizeBuildText } from './build-text-resources.mjs';

// Retain the small owned fixture for debugging; never touch tracked sources.
const fixture = await mkdtemp(path.join(tmpdir(), 'nand-build-text-'));
for (const source of ['src/core/contacts/persist/format-guide.md', 'src/core/contacts/persist/format-guide-en.md']) {
	const text = normalizeBuildText(await readFile(source, 'utf8'));
	for (const extension of ['md', 'svg']) {
		const filename = path.join(fixture, `resource.${extension}`);
		const build = () => esbuild.build({ stdin: { contents: `import text from './resource.${extension}'; module.exports = text;`, resolveDir: fixture }, bundle: true, platform: 'node', format: 'cjs', write: false, plugins: [canonicalTextResources], logLevel: 'silent' });
		await writeFile(filename, text);
		const lf = (await build()).outputFiles[0].text;
		await writeFile(filename, text.replace(/\n/g, '\r\n'));
		assert.equal((await build()).outputFiles[0].text, lf);
		const module = { exports: {} };
		new Function('module', 'exports', lf)(module, module.exports);
		assert.equal(module.exports, text);
		assert.equal(String(module.exports).includes('\r'), false);
	}
}
for (const filename of ['src/core/icons/res/NOTICE.txt', 'docs/third-party/orca-LICENSE.txt']) {
	const lf = normalizeBuildText(await readFile(filename, 'utf8'));
	assert.equal(normalizeBuildText(lf.replace(/\n/g, '\r\n')), lf);
}
console.log('Build text: LF/CRLF assets and license banners are equivalent');
