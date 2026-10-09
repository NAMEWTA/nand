// Architecture check: zones, module boundaries, host packages, barrels and runtime cycles.
//
// Every violation fails; there is no baseline.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const nodeBuiltins = new Set([...builtinModules, ...builtinModules.map((n) => `node:${n}`)]);
const hostPackages = new Set([...nodeBuiltins, 'obsidian', 'electron', 'preact', 'react', 'react-dom']);
const forbiddenGlobals = new Set([
	'window',
	'activeWindow',
	'activeDocument',
	'document',
	'navigator',
	'process',
	'Buffer',
	'NodeJS',
	'HTMLElement',
	'Element',
	'Document',
	'Window',
	'HTMLDivElement',
	'HTMLInputElement',
	'HTMLTextAreaElement',
	'HTMLButtonElement',
]);
function filesIn(directory) {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(directory, entry.name);
		return entry.isDirectory()
			? filesIn(file)
			: /(?<!\.test)\.tsx?$/.test(file) && !file.endsWith('.d.ts')
				? [file]
				: [];
	});
}
function dependencies(ast) {
	const result = [];
	function visit(node) {
		let specifier;
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
		else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) specifier = node.argument.literal;
		else if (
			ts.isCallExpression(node) &&
			(node.expression.kind === ts.SyntaxKind.ImportKeyword ||
				node.expression.getText(ast) === 'require' ||
				node.expression.getText(ast) === 'window.require')
		)
			specifier = node.arguments[0];
		if (specifier && ts.isStringLiteralLike(specifier)) result.push(specifier.text);
		ts.forEachChild(node, visit);
	}
	visit(ast);
	return result;
}
function cycles(graph) {
	let sequence = 0;
	const ids = new Map(),
		low = new Map(),
		stack = [],
		active = new Set(),
		result = [];
	function visit(file) {
		ids.set(file, sequence);
		low.set(file, sequence++);
		stack.push(file);
		active.add(file);
		for (const target of graph.get(file) ?? []) {
			if (!ids.has(target)) {
				visit(target);
				low.set(file, Math.min(low.get(file), low.get(target)));
			} else if (active.has(target)) low.set(file, Math.min(low.get(file), ids.get(target)));
		}
		if (low.get(file) === ids.get(file)) {
			let target;
			const group = [];
			do {
				target = stack.pop();
				active.delete(target);
				group.push(target);
			} while (target !== file);
			if (group.length > 1 || graph.get(file)?.includes(file)) result.push(group);
		}
	}
	for (const file of graph.keys()) if (!ids.has(file)) visit(file);
	return result;
}
// Guard the guard: type imports, lazy imports, exports, require and real cycles.
assert.deepEqual(
	dependencies(
		ts.createSourceFile(
			'fixture.ts',
			`import type { A } from './a'; export { b } from './b'; type C = import('./c').C; import('./d'); require('./e'); window.require('fs');`,
			99,
			true,
		),
	),
	['./a', './b', './c', './d', './e', 'fs'],
);
assert.equal(
	cycles(
		new Map([
			['a', ['b']],
			['b', ['a']],
			['c', []],
		]),
	).length,
	1,
);
assert.equal(
	cycles(
		new Map([
			['a', ['b']],
			['b', []],
		]),
	).length,
	0,
);

const files = filesIn(path.join(root, 'src'));
const known = new Set(files);
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const program = ts.createProgram(files, parsed.options);
const checker = program.getTypeChecker();
const graph = new Map(files.map((file) => [file, []]));
const errors = new Set();
const relative = (file) => path.relative(root, file).replaceAll(path.sep, '/');

/** Zone of a source file: { zone, module? }. Module roots are manifest/api/module/settings/i18n files. */
function zoneOf(file) {
	const parts = relative(file).split('/');
	if (parts[1] !== 'modules') return { zone: parts[1] };
	const module = parts[2];
	if (parts.length === 4) return { zone: `root:${parts[3].replace(/\.tsx?$/, '')}`, module };
	return { zone: parts[3], module };
}
const MODULE_ZONES = new Set(['core', 'platform', 'services', 'contrib', 'ui']);
const TOP_ZONES = new Set(['shared', 'host', 'theme', 'ui', 'app', 'shell', 'types', 'modules']);
/** May `from` import `to` (static or type import)? `dynamic` marks a runtime import() edge. */
function allowedEdge(from, to, target, dynamic) {
	const z = from.zone, t = to.zone;
	if (from.module === undefined && to.module === undefined) {
		const top = {
			shared: ['shared'],
			host: ['shared', 'host'],
			theme: ['shared', 'theme'],
			ui: ['shared', 'theme', 'ui'],
			shell: ['shared', 'theme', 'ui', 'shell', 'host'],
			app: ['shared', 'host', 'theme', 'ui', 'app'],
			types: [],
		}[z] ?? [];
		if (z === 'app' && t === 'shell') return dynamic;
		if (t === 'app' && relative(target).startsWith('src/app/contracts/')) return z !== 'shared' && z !== 'host';
		return top.includes(t);
	}
	if (from.module === undefined) {
		// Shared layers reach module code only through declared surfaces; app may load module entries lazily.
		if (z === 'app') return t === 'root:manifest' || t === 'root:api' || t === 'root:settings' || (dynamic && t === 'root:module');
		return false;
	}
	if (to.module === undefined) {
		const base = { core: ['shared'], platform: ['shared', 'host'], services: ['shared', 'host', 'theme'], contrib: ['shared', 'host'], ui: ['shared', 'host', 'theme', 'ui', 'shell'] };
		const allowedTop = z.startsWith('root:') ? ['shared', 'host', 'theme'] : base[z] ?? [];
		if (t === 'app' && relative(target).startsWith('src/app/contracts/')) return true;
		return allowedTop.includes(t);
	}
	if (from.module !== to.module) return t === 'root:api';
	// Same module.
	const own = {
		core: ['core', 'root:api'],
		platform: ['core', 'platform', 'root:api'],
		services: ['core', 'platform', 'services', 'contrib', 'root:api', 'root:settings', 'root:i18n'],
		contrib: ['core', 'platform', 'contrib', 'root:api'],
		ui: ['core', 'platform', 'services', 'contrib', 'ui', 'root:api', 'root:settings', 'root:i18n'],
		'root:manifest': ['root:api'],
		'root:api': ['core'],
		'root:module': ['core', 'platform', 'services', 'contrib', 'root:api', 'root:settings', 'root:i18n', 'root:manifest'],
		'root:settings': ['core', 'root:api'],
		'root:i18n': [],
	}[z] ?? [];
	if (z === 'root:module' && t === 'ui') return dynamic;
	// A manifest's `load()` is the only edge into its module's code.
	if (z === 'root:manifest' && t === 'root:module') return dynamic;
	return own.includes(t);
}
function resolve(file, specifier) {
	if (!specifier.startsWith('.')) return undefined;
	const base = path.resolve(path.dirname(file), specifier);
	return [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')].find(
		(candidate) => known.has(candidate),
	);
}
/** Literal `import()` specifiers in a file (runtime-lazy edges). */
function dynamicSpecifiers(ast) {
	const result = new Set();
	function visit(node) {
		if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]))
			result.add(node.arguments[0].text);
		ts.forEachChild(node, visit);
	}
	visit(ast);
	return result;
}
for (const file of files) {
	const own = zoneOf(file);
	const top = relative(file).split('/')[1];
	if (!TOP_ZONES.has(top) || (own.module !== undefined && !own.zone.startsWith('root:') && !MODULE_ZONES.has(own.zone))) {
		errors.add(`${relative(file)}: unknown source zone`);
		continue;
	}
	const ast = program.getSourceFile(file);
	const pure = own.zone === 'core' || own.zone === 'shared';
	const lazy = dynamicSpecifiers(ast);
	const desktop = relative(file).includes('/desktop/');
	for (const specifier of dependencies(ast)) {
		const target = resolve(file, specifier);
		if (target && !allowedEdge(own, zoneOf(target), target, lazy.has(specifier)))
			errors.add(`${relative(file)} -> ${relative(target)}: forbidden zone direction`);
		if (!target && !specifier.startsWith('.')) {
			if (pure && (hostPackages.has(specifier) || /^(?:@codemirror|@xterm|preact|react)(?:\/|$)/.test(specifier)))
				errors.add(`${relative(file)} -> ${specifier}: host dependency in ${own.zone}`);
			else if ((specifier === 'electron' || nodeBuiltins.has(specifier)) && !desktop)
				errors.add(`${relative(file)} -> ${specifier}: desktop-only dependency outside a desktop folder`);
		}
		if (
			target &&
			path.basename(target).startsWith('index.') &&
			(path.dirname(file) === path.dirname(target) ||
				path.dirname(file).startsWith(path.dirname(target) + path.sep))
		)
			errors.add(`${relative(file)} -> ${relative(target)}: import the declaration, not the enclosing barrel`);
	}
	if (pure) {
		function visit(node) {
			if (ts.isIdentifier(node) && forbiddenGlobals.has(node.text)) {
				const symbol = checker.getSymbolAtLocation(node);
				if (symbol?.declarations?.some((d) => d.getSourceFile().fileName.includes('node_modules')))
					errors.add(`${relative(file)}: host global/type ${node.text} in ${own.zone}`);
			}
			ts.forEachChild(node, visit);
		}
		visit(ast);
	}
	// Electron's renderer-side `window.require` reaches Node just like an import does.
	if (!desktop && /\bwindow\.require\(/.test(ast.text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')))
		errors.add(`${relative(file)} -> window.require: desktop-only dependency outside a desktop folder`);
	const emitted = ts.transpileModule(ast.text, {
		compilerOptions: { ...parsed.options, module: ts.ModuleKind.ESNext },
		fileName: file,
	}).outputText;
	const runtime = ts.createSourceFile(file, emitted, ts.ScriptTarget.Latest, true);
	graph.set(
		file,
		dependencies(runtime).flatMap((specifier) => {
			const target = resolve(file, specifier);
			return target ? [target] : [];
		}),
	);
}
for (const group of cycles(graph))
	errors.add(`Runtime cycle (including lazy imports):\n  ${group.map(relative).sort().join('\n  ')}`);

const current = [...errors].sort();
if (current.length) {
	console.error(`Architecture violations:\n${current.join('\n')}`);
	process.exitCode = 1;
} else console.log(`Architecture: ${files.length} modules; no zone, host-package, desktop-only, barrel or cycle violations.`);
