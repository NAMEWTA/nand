import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const state = 'speculo/.speculo/specdev';
const files = ['README.md', 'CHANGELOG.md', 'CLAUDE.md'];
function walk(directory) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const file = path.join(directory, entry.name);
		if (entry.isDirectory()) walk(file);
		else if (entry.name.endsWith('.md')) files.push(file);
	}
}
for (const directory of ['docs', '.agents/skills', ...['adr', 'context', 'changes', 'archive', '.config'].map((name) => `${state}/${name}`)]) walk(directory);
const failures = [];
let links = 0;
for (const file of files) {
	const text = fs.readFileSync(file, 'utf8');
	let fence = '', body = '';
	for (const line of text.split(/\r?\n/)) {
		const marker = line.match(/^\s*(`{3,}|~{3,})/);
		if (marker) { if (!fence) fence = marker[1][0]; else if (marker[1][0] === fence) fence = ''; continue; }
		if (!fence) body += line + '\n';
	}
	if (fence) failures.push(`${file}: unclosed code fence`);
	for (const match of body.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
		const target = match[1].trim().replace(/^<|>$/g, '').split(/\s+"/)[0];
		if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('#')) continue;
		const destination = decodeURIComponent(target.split('#')[0]);
		if (!destination) continue;
		links++;
		const resolved = path.resolve(path.dirname(file), destination);
		if (!resolved.startsWith(root + path.sep) || !fs.existsSync(resolved)) failures.push(`${file}: missing local link ${target}`);
	}
}
const status = JSON.parse(fs.readFileSync(`${state}/status.json`, 'utf8'));
assert.equal(status.schema_version, 5);
for (const { change } of status.active) assert.ok(fs.existsSync(`${state}/changes/${change}/spec.md`), `Missing active change ${change}`);
for (const change of status.archived) assert.ok(fs.existsSync(`${state}/archive/${change.slice(0, 7)}/${change}/README.md`), `Missing archive ${change}`);
const actual = fs.readdirSync(`${state}/changes`, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
assert.deepEqual(actual, status.active.map((entry) => entry.change).sort(), 'Active index and directories must match');
assert.deepEqual(failures, [], 'Documentation links and fences');
console.log(`Documentation: ${files.length} Markdown files, ${links} local links, code fences and active/archive indexes verified.`);
