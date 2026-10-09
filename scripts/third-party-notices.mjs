// Generate THIRD-PARTY-NOTICES.md: the license of every npm package bundled into main.js (from the esbuild
// metafile) and of every crate linked into the nand-pty helper (from `cargo metadata`, dev-dependencies
// excluded). Dual-licensed crates use their MIT (or BSD) text.
// Usage: node scripts/third-party-notices.mjs --write | --check
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { pluginBuildOptions } from './esbuild-options.mjs';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'THIRD-PARTY-NOTICES.md');
const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : '';
if (!mode) throw new Error('Use --write or --check');

const LICENSE_FILE = /^(licen[cs]e|copying|notice)([-._].*)?$/i;

function licenseTexts(dir, prefer = []) {
	const files = fs.readdirSync(dir).filter((name) => LICENSE_FILE.test(name) && fs.statSync(path.join(dir, name)).isFile()).sort();
	for (const want of prefer) {
		const match = files.find((name) => name.toUpperCase().includes(want));
		if (match) return [match];
	}
	return files.filter((name) => !/apache/i.test(name) || files.length === 1);
}

function read(dir, files) {
	return files.map((name) => fs.readFileSync(path.join(dir, name), 'utf8').replace(/\r\n/g, '\n').trim()).join('\n\n');
}

/** npm packages whose files end up in main.js. */
async function npmPackages() {
	const result = await esbuild.build({ ...pluginBuildOptions({ production: true }), write: false, metafile: true, logLevel: 'silent' });
	const output = Object.entries(result.metafile.outputs).find(([file]) => file.endsWith('main.js'))?.[1];
	const packages = new Map();
	for (const input of Object.keys(output.inputs)) {
		const at = input.lastIndexOf('node_modules/');
		if (at < 0) continue;
		// The package root is the folder right after the last node_modules/ (two segments for @scopes).
		const rest = input.slice(at + 'node_modules/'.length).split('/');
		const name = rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0];
		if (packages.has(name)) continue;
		const dir = path.join(root, input.slice(0, at), 'node_modules', name);
		const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
		packages.set(name, { name, version: manifest.version, license: typeof manifest.license === 'string' ? manifest.license : manifest.license?.type ?? 'UNKNOWN', dir });
	}
	return [...packages.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Crates in the helper's normal dependency graph, for every target platform. */
function cratePackages() {
	const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--format-version', '1', '--locked', '--manifest-path', path.join(root, 'native/pty-server/Cargo.toml')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
	const byId = new Map(metadata.packages.map((pkg) => [pkg.id, pkg]));
	const nodes = new Map(metadata.resolve.nodes.map((node) => [node.id, node]));
	const seen = new Set();
	const stack = [metadata.resolve.root];
	while (stack.length) {
		const id = stack.pop();
		for (const dep of nodes.get(id)?.deps ?? []) {
			if (!dep.dep_kinds.some((kind) => kind.kind === null || kind.kind === 'build')) continue;
			if (seen.has(dep.pkg)) continue;
			seen.add(dep.pkg);
			stack.push(dep.pkg);
		}
	}
	return [...seen].map((id) => byId.get(id)).map((pkg) => ({ name: pkg.name, version: pkg.version, license: pkg.license ?? 'UNKNOWN', dir: path.dirname(pkg.manifest_path) })).sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

function section(title, intro, packages, prefer) {
	const lines = [`## ${title}`, '', intro, ''];
	for (const pkg of packages) {
		const preferred = prefer(pkg.license);
		const files = licenseTexts(pkg.dir, preferred);
		lines.push(`### ${pkg.name} ${pkg.version}`, '', `License: ${pkg.license}`, '');
		// xterm.js add-ons published without a license file share the xterm.js license.
		const family = !files.length && pkg.name.startsWith('@xterm/') ? path.join(root, 'node_modules/@xterm/xterm') : '';
		if (files.length) lines.push('```text\n' + read(pkg.dir, files) + '\n```', '');
		else if (family) lines.push('The package ships no license file; it is part of xterm.js and uses its license:', '', '```text\n' + read(family, licenseTexts(family)) + '\n```', '');
		else lines.push('_The package ships no license file; see its repository for the full text._', '');
	}
	return lines.join('\n');
}

const npm = await npmPackages();
const crates = cratePackages();
const unknown = [...npm, ...crates].filter((pkg) => pkg.license === 'UNKNOWN' || /GPL/.test(pkg.license.replace(/LGPL-2\.1-or-later/, '')) && !/MIT|Apache|BSD/.test(pkg.license));
if (unknown.length) throw new Error(`Review these licenses: ${unknown.map((pkg) => `${pkg.name} (${pkg.license})`).join(', ')}`);

const text = [
	'# Third-party notices',
	'',
	'Generated by `node scripts/third-party-notices.mjs --write`. NAND itself is MIT licensed (see LICENSE); attributions for adapted source code are in NOTICE.',
	'',
	section('Bundled in main.js', 'npm packages whose code is part of the plugin bundle.', npm, () => []),
	section('Linked into nand-pty', 'Rust crates compiled into the terminal helper (all platforms). Crates offered under several licenses are used under the MIT (or BSD) terms shown.', crates, (license) => (/MIT/.test(license) ? ['MIT'] : /BSD/.test(license) ? ['BSD'] : [])),
].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';

if (mode === 'write') {
	fs.writeFileSync(out, text);
	console.log(`THIRD-PARTY-NOTICES.md: ${npm.length} npm packages, ${crates.length} crates`);
} else {
	const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
	if (current !== text) {
		console.error('THIRD-PARTY-NOTICES.md is out of date; run node scripts/third-party-notices.mjs --write');
		process.exit(1);
	}
	console.log(`THIRD-PARTY-NOTICES.md is current (${npm.length} npm packages, ${crates.length} crates)`);
}
