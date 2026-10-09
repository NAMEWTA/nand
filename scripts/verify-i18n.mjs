import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve('src/shared/i18n');
const isDictionary = (file) => /export const (messages|iconicTranslations)/.test(fs.readFileSync(file, 'utf8'));
// Startup dictionaries, the dictionaries several modules share (lazy/) and each module's own `i18n.ts`.
const files = [
	...fs.readdirSync(root).filter((file) => file.endsWith('.ts')).map((file) => `src/shared/i18n/${file}`),
	...fs.readdirSync(path.join(root, 'lazy')).filter((file) => file.endsWith('.ts')).map((file) => `src/shared/i18n/lazy/${file}`),
	...fs.readdirSync('src/modules').map((module) => `src/modules/${module}/i18n.ts`).filter((file) => fs.existsSync(file)),
].filter(isDictionary);
const outfile = path.resolve('scripts/tmp/i18n-dictionaries.cjs');
await build({ stdin: { contents: files.map((file, i) => `export * as m${i} from ${JSON.stringify('./' + file)};`).join('\n'), resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', outfile, logLevel: 'warning' });
const modules = require(outfile);
const merged = { zh: {}, en: {} };
const placeholders = (value) => [...value.matchAll(/\{([\w#]+)\}/g)].map((match) => match[1]).sort();
for (const [index, module] of Object.entries(modules)) {
	const messages = module.messages || module.iconicTranslations;
	const file = files[Number(index.slice(1))];
	assert.deepEqual(Object.keys(messages.zh).sort(), Object.keys(messages.en).sort(), `${file}: language key mismatch`);
	for (const key of Object.keys(messages.zh)) assert.deepEqual(placeholders(messages.zh[key]), placeholders(messages.en[key]), `${file}: ${key} placeholders`);
	Object.assign(merged.zh, messages.zh); Object.assign(merged.en, messages.en);
}
const unknown = [];
function inspect(directory) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const file = path.join(directory, entry.name);
		if (entry.isDirectory()) { inspect(file); continue; }
		if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file) || file.includes(`${path.sep}i18n${path.sep}`) || file.endsWith(`${path.sep}i18n.ts`)) continue;
		const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
		const calls = new Map();
		for (const statement of source.statements) {
			if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
			const location = statement.moduleSpecifier.text;
			const bindings = statement.importClause?.namedBindings;
			if (!bindings || !ts.isNamedImports(bindings)) continue;
			for (const binding of bindings.elements) {
				const name = binding.propertyName?.text || binding.name.text;
				if (name === 't' && location.includes('i18n')) calls.set(binding.name.text, '');
				if (name === 'ct' && /labels|forms/.test(location)) calls.set(binding.name.text, 'contacts.');
			}
		}
		function visit(node) {
			if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && calls.has(node.expression.text) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
				const key = calls.get(node.expression.text) + node.arguments[0].text;
				if (!(key in merged.zh)) unknown.push(`${file}:${source.getLineAndCharacterOfPosition(node.pos).line + 1}: ${key}`);
			}
			ts.forEachChild(node, visit);
		}
		visit(source);
	}
}
inspect('src');
assert.deepEqual(unknown, [], 'Unknown literal translation keys');
console.log(`I18N: ${files.length} dictionaries, ${Object.keys(merged.zh).length} keys, matching placeholders and literal references.`);
