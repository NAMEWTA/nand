import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const layers = new Set(['plugin', 'view', 'platform', 'core', 'shared']);
const allowed = {
	plugin: layers,
	view: new Set(['view', 'platform', 'core', 'shared']),
	platform: new Set(['platform', 'core', 'shared']),
	core: new Set(['core', 'shared']),
	shared: new Set(['shared']),
};
const hostPackages = new Set([
	...builtinModules,
	...builtinModules.map((n) => `node:${n}`),
	'obsidian',
	'electron',
	'preact',
	'react',
	'react-dom',
]);
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
const layer = (file) => relative(file).split('/')[1];
function resolve(file, specifier) {
	if (!specifier.startsWith('.')) return undefined;
	const base = path.resolve(path.dirname(file), specifier);
	return [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')].find(
		(candidate) => known.has(candidate),
	);
}
for (const file of files) {
	const own = layer(file);
	if (!layers.has(own)) {
		errors.add(`${relative(file)}: unknown source layer`);
		continue;
	}
	const ast = program.getSourceFile(file);
	const pure = own === 'core' || own === 'shared';
	for (const specifier of dependencies(ast)) {
		const target = resolve(file, specifier);
		if (target && !allowed[own].has(layer(target)))
			errors.add(`${relative(file)} -> ${relative(target)}: forbidden layer direction`);
		if (
			!target &&
			!specifier.startsWith('.') &&
			(hostPackages.has(specifier) || /^(?:@codemirror|@xterm|preact|react)(?:\/|$)/.test(specifier)) &&
			pure
		)
			errors.add(`${relative(file)} -> ${specifier}: host dependency in ${own}`);
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
					errors.add(`${relative(file)}: host global/type ${node.text} in ${own}`);
			}
			ts.forEachChild(node, visit);
		}
		visit(ast);
	}
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
	errors.add(`Runtime cycle (including lazy imports):\n  ${group.map(relative).join('\n  ')}`);
if (errors.size) {
	console.error([...errors].join('\n'));
	process.exitCode = 1;
} else
	console.log(
		`Architecture: ${files.length} modules, valid layer directions, no host dependencies in core/shared, no enclosing-barrel imports, no runtime cycles.`,
	);
