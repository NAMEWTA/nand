import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

function sourceFiles(directory) {
	const files = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const path = directory + '/' + entry.name;
		if (entry.isDirectory()) files.push(...sourceFiles(path));
		else if (/\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)) files.push(path);
	}
	return files;
}
const files = sourceFiles('src');

test('one ribbon registration owner opens the workbench', () => {
	const owners = files.filter((path) => /\.addRibbonIcon\s*\(/.test(fs.readFileSync(path, 'utf8')));
	assert.deepEqual(owners, ['src/app/workbench/surfaces/ribbon.ts']);
	assert.match(fs.readFileSync(owners[0], 'utf8'), /stableRibbon\(plugin, 'home'/);
	assert.match(fs.readFileSync('src/app/ribbon.ts', 'utf8'), /ribbon-/);
});

test('the shell UI only consumes contracts, the design system and shared code', () => {
	for (const path of files.filter((file) => file.startsWith('src/shell/') && !file.startsWith('src/shell/host/'))) {
		const text = fs.readFileSync(path, 'utf8');
		assert.doesNotMatch(text, /from ['"].*(?:modules\/|host\/|app\/(?!contracts\/)|obsidian|electron|xterm)/, path + ': the shell must only consume presentation contracts');
	}
});

test('only the workbench and the comments panel are registered views', () => {
	const registered = new Set();
	for (const path of files) {
		for (const match of fs.readFileSync(path, 'utf8').matchAll(/registerView\(\s*([A-Z_]+)/g)) registered.add(match[1]);
	}
	assert.deepEqual([...registered].sort(), ['COMMENTS_VIEW_TYPE', 'WORKBENCH_VIEW_TYPE']);
	assert.match(fs.readFileSync('src/app/workbench/comments-leaf.ts', 'utf8'), /COMMENTS_VIEW_TYPE = 'nand-comments-view'/);
});
