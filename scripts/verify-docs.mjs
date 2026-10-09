import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const state = 'speculo/.speculo/specdev';
const failures = [];
const files = [];

// Inventory keys stay forward-slash even when Windows reports backslash paths.
function posix(rel) {
	return rel.split(path.sep).join('/');
}

function walk(directory) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'target') continue;
		const file = path.join(directory, entry.name);
		const rel = posix(path.relative(root, file));
		if (rel === 'scripts/tmp' || rel.startsWith('scripts/tmp/')) continue;
		if (entry.isDirectory()) {
			if (!rel.startsWith('src/') && (entry.name === 'legacy' || entry.name === 'old' || entry.name === 'backup-docs')) failures.push(`forbidden documentation directory ${rel}`);
			walk(file);
		} else if (entry.name.endsWith('.md')) files.push(rel);
	}
}
walk(root);

// Local scratch files (for example `temp/`) are git-ignored and never part of the documentation inventory.
const ignored = spawnSync('git', ['check-ignore', '--stdin'], { cwd: root, input: files.join('\n'), encoding: 'utf8' });
if (ignored.status === 0) {
	const skip = new Set(ignored.stdout.split(/\r?\n/).filter(Boolean).map(posix));
	files.splice(0, files.length, ...files.filter((file) => !skip.has(file)));
}

function classify(rel) {
	if (rel === 'NOTICE' || rel === 'THIRD-PARTY-NOTICES.md' || rel.endsWith('/NOTICE.txt') || rel.startsWith('docs/third-party/') || rel.startsWith('docs/licensing/')) return 'license';
	if (rel.startsWith('docs/')) return 'user-doc';
	if (/^(README|CHANGELOG|CLAUDE|SECURITY)(\.ZH)?\.md$/.test(rel)) return 'root-entry';
	if (rel.startsWith('.agents/')) return 'skill';
	if (rel.startsWith('speculo/.speculo/specdev/')) return 'specdev';
	if (rel.startsWith('speculo/')) return 'speculo-tooling';
	if (rel.startsWith('src/')) return 'source-template';
	if (rel.startsWith('scripts/')) return 'script-doc';
	if (rel.startsWith('test/')) return 'test-fixture';
	if (rel.startsWith('processes/')) return 'process-doc';
	if (rel.startsWith('.github/')) return 'workflow-doc';
	return '';
}

const counts = new Map();
for (const file of files) {
	const kind = classify(file);
	if (!kind) failures.push(`unclassified markdown ${file}`);
	else counts.set(kind, (counts.get(kind) ?? 0) + 1);
}

for (const required of [
	'docs/workbench.md',
	'docs/privacy.md',
	'SECURITY.md',
	`${state}/context/current-baseline.md`,
	`${state}/context/validation.md`,
	'LICENSE',
	'NOTICE',
	'src/modules/icons/core/res/NOTICE.txt',
]) {
	if (!fs.existsSync(path.join(root, required))) failures.push(`missing required documentation asset ${required}`);
}

const strict = new Set(['user-doc', 'root-entry', 'skill', 'specdev', 'source-template']);
let links = 0;
let external = 0;
const headings = new Map();
const bodies = new Map();

function fenceBody(text) {
	let fence = '';
	const kept = [];
	for (const line of text.split(/\r?\n/)) {
		const marker = line.match(/^\s*(`{3,}|~{3,})/);
		if (marker) {
			if (!fence) fence = marker[1][0];
			else if (marker[1][0] === fence) fence = '';
			continue;
		}
		if (!fence) kept.push(line);
	}
	return { unclosed: Boolean(fence), body: kept.join('\n') };
}

function githubSlug(text) {
	const plain = text
		.replace(/`([^`]*)`/g, '$1')
		.replace(/!\[[^\]]*\]\([^)\n]*\)/g, '')
		.replace(/\[([^\]]*)\]\([^)\n]*\)/g, '$1')
		.replace(/<[^>\n]+>/g, '');
	return plain
		.toLowerCase()
		.replace(/[\u0000-\u001f]/g, '')
		.replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, '')
		.replace(/\s/g, '-');
}

function rememberHeading(file, slug, seen) {
	if (!slug) return;
	const count = seen.get(slug) ?? 0;
	const actual = count === 0 ? slug : `${slug}-${count}`;
	seen.set(slug, count + 1);
	headings.get(file).add(actual);
}

function labelKey(value) {
	return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

for (const file of files) {
	if (!strict.has(classify(file))) continue;
	const text = fs.readFileSync(path.join(root, file), 'utf8');
	const { unclosed, body } = fenceBody(text);
	if (unclosed) failures.push(`${file}: unclosed code fence`);
	bodies.set(file, body);
	const slugs = new Set();
	const seen = new Map();
	headings.set(file, slugs);
	for (const line of body.split('\n')) {
		const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
		if (heading) rememberHeading(file, githubSlug(heading[1]), seen);
	}
	for (const match of body.matchAll(/ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}/g)) {
		failures.push(`${file}: secret-like token ${match[0].slice(0, 6)}…`);
	}
}

function checkTarget(fromFile, raw) {
	let target = raw.trim().replace(/^<|>$/g, '');
	const title = target.match(/\s+(?:"[^"]*"|'[^']*'|\([^)]*\))\s*$/);
	if (title) target = target.slice(0, title.index).trim();
	if (!target) return;
	if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//')) {
		external += 1;
		return;
	}
	const hash = target.indexOf('#');
	const destination = hash === -1 ? target : target.slice(0, hash);
	let fragment = '';
	if (hash !== -1) {
		try { fragment = decodeURIComponent(target.slice(hash + 1)); }
		catch { failures.push(`${fromFile}: bad link fragment ${target}`); return; }
	}
	const resolved = destination
		? path.resolve(root, path.dirname(fromFile), destination)
		: path.resolve(root, fromFile);
	const relative = posix(path.relative(root, resolved));
	if (destination) {
		links += 1;
		const missing = relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(resolved);
		// Format guides show archive-relative examples such as ../李四/基本信息.md.
		// Those paths exist in a user vault, not in this repository.
		const vaultExample = fromFile.startsWith('src/modules/archives/core/persist/format-guide');
		if (missing && !vaultExample) {
			failures.push(`${fromFile}: missing local link ${target}`);
			return;
		}
		if (missing) return;
	}
	if (fragment && !headings.get(relative)?.has(fragment)) failures.push(`${fromFile}: missing heading anchor ${target}`);
}

for (const [file, body] of bodies) {
	const definitions = new Map();
	for (const line of body.split('\n')) {
		const defined = line.match(/^ {0,3}\[([^\]\n]+)\]:[ \t]+(\S+)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?\s*$/);
		if (!defined) continue;
		definitions.set(labelKey(defined[1]), defined[2].replace(/^<|>$/g, ''));
	}
	for (const destination of definitions.values()) checkTarget(file, destination);
	for (const match of body.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)) checkTarget(file, match[1]);
	for (const match of body.matchAll(/!?\[([^\]\n]*)\]\[([^\]\n]*)\]/g)) {
		const key = labelKey(match[2] || match[1]);
		const destination = definitions.get(key);
		if (!destination) failures.push(`${file}: unresolved reference link [${match[1]}][${match[2]}]`);
		else checkTarget(file, destination);
	}
}

function readSource(directory, into) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const file = path.join(directory, entry.name);
		if (entry.isDirectory()) readSource(file, into);
		else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) into.push(fs.readFileSync(file, 'utf8'));
	}
}
const sources = [];
readSource(path.join(root, 'src'), sources);
const sourceText = sources.join('\n');

const viewTypes = new Set();
for (const match of sourceText.matchAll(/export const [A-Z0-9_]*VIEW_TYPE = '([^']+)'/g)) viewTypes.add(match[1]);
const workbench = bodies.get('docs/workbench.md') ?? '';
const documentedViews = new Set([...workbench.matchAll(/`(nand-[a-z0-9-]+-view|terminal-view)`/g)].map((match) => match[1]));
for (const viewType of viewTypes) if (!documentedViews.has(viewType)) failures.push(`docs/workbench.md: missing view type ${viewType}`);
for (const viewType of documentedViews) if (!viewTypes.has(viewType)) failures.push(`docs/workbench.md: unknown view type ${viewType}`);

const features = new Set([...sourceText.matchAll(/feature: '([a-z0-9-]+)'/g)].map((match) => match[1]));
const documentedFeatures = new Set([...workbench.matchAll(/\| `([a-z0-9-]+)` \|/g)].map((match) => match[1]));
for (const feature of documentedFeatures) {
	if (viewTypes.has(feature)) continue;
	if (!features.has(feature)) failures.push(`docs/workbench.md: unknown feature ${feature}`);
}
if (!workbench.includes('open-workbench') || !sourceText.includes("id: 'open-workbench'")) failures.push('open-workbench command is not documented against source');
if (!workbench.includes('`records`')) failures.push('docs/workbench.md: records pages must be documented as part of home');
const minAppVersion = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).minAppVersion;
for (const file of ['docs/settings.md', 'docs/settings.ZH.md'])
	if (!fs.readFileSync(path.join(root, file), 'utf8').includes(`Obsidian ${minAppVersion}`)) failures.push(`${file}: minimum Obsidian version must match manifest.json (${minAppVersion})`);

for (const file of ['docs/data.md', 'docs/privacy.md', 'docs/records.md', 'docs/agent-workbench.md'].flatMap((name) => [name, name.replace(/\.md$/, '.ZH.md')])) {
	const body = bodies.get(file) ?? '';
	for (const match of body.matchAll(/\.nand\/[A-Za-z0-9_./<>\-]+/g)) {
		const prefix = match[0].split('<')[0].replace(/\/+$/g, '');
		if (prefix === '.nand' || sourceText.includes(prefix)) continue;
		failures.push(`${file}: data path ${match[0]} is not in source`);
	}
}
// Every document has an English version (the plain name) and a Chinese one (`.ZH.md`), each opening with a language switch.
const bilingual = new Set(['user-doc', 'root-entry', 'skill', 'specdev']);
const english = '[English](';
const chinese = '[简体中文](';
for (const file of files) {
	if (!bilingual.has(classify(file))) continue;
	const zh = file.endsWith('.ZH.md');
	const partner = zh ? file.replace(/\.ZH\.md$/, '.md') : file.replace(/\.md$/, '.ZH.md');
	if (!fs.existsSync(path.join(root, partner))) failures.push(`${file}: missing ${zh ? 'English' : 'Chinese'} version ${partner}`);
	const first = (bodies.get(file) ?? fs.readFileSync(path.join(root, file), 'utf8')).replace(/^---\n[\s\S]*?\n---\n/, '').split('\n').find((line) => line.trim()) ?? '';
	if (!first.includes(zh ? english : chinese)) failures.push(`${file}: first line must link the ${zh ? 'English' : 'Chinese'} version`);
}

if ((bodies.get('docs/privacy.md') ?? '').includes('connection.json') && !sourceText.includes('connection.json')) {
	failures.push('docs/privacy.md: connection.json is not in source');
}

for (const [file, suffix] of [['README.md', '.md'], ['README.ZH.md', '.ZH.md']]) {
	const readme = fs.readFileSync(path.join(root, file), 'utf8');
	if (!readme.includes(`docs/workbench${suffix}`) || !readme.includes(`docs/privacy${suffix}`)) failures.push(`${file}: missing workbench or privacy link`);
	const index = fs.readFileSync(path.join(root, `docs/${file}`), 'utf8');
	if (!index.includes(`workbench${suffix}`) || !index.includes(`privacy${suffix}`)) failures.push(`docs/${file}: missing workbench or privacy link`);
}
const layout = fs.readFileSync(path.join(root, `${state}/.config/domain-layout.md`), 'utf8');
if (!layout.includes('context/current-baseline.md') || !layout.includes('context/validation.md')) failures.push('domain-layout.md: current baseline links missing');

const status = JSON.parse(fs.readFileSync(path.join(root, `${state}/status.json`), 'utf8'));
assert.equal(status.schema_version, 5);
for (const { change } of status.active) assert.ok(fs.existsSync(path.join(root, `${state}/changes/${change}/spec.md`)), `Missing active change ${change}`);
for (const change of status.archived) assert.ok(fs.existsSync(path.join(root, `${state}/archive/${change.slice(0, 7)}/${change}/README.md`)), `Missing archive ${change}`);
const actual = fs.readdirSync(path.join(root, `${state}/changes`), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
assert.deepEqual(actual, status.active.map((entry) => entry.change).sort(), 'Active index and directories must match');
assert.deepEqual(failures, [], 'Documentation links, anchors, contracts, and inventory');
const summary = [...counts.entries()].map(([kind, count]) => `${kind}=${count}`).join(', ');
console.log(`Documentation: ${files.length} Markdown files (${summary}), ${links} local links, ${external} external links (fetch not requested).`);
