import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve as resolvePath } from 'node:path';

const EXT = /\.(?:[cm]?[jt]s|json|svg|md|node)$/;

export async function resolve(specifier, context, nextResolve) {
	if (specifier === 'obsidian') {
		return nextResolve(pathToFileURL(resolvePath(process.cwd(), 'scripts/obsidian-stub.ts')).href, context);
	}
	if (
		(specifier.startsWith('./') || specifier.startsWith('../')) &&
		!EXT.test(specifier)
	) {
		try {
			return await nextResolve(`${specifier}.ts`, context);
		} catch {
			return nextResolve(`${specifier}/index.ts`, context);
		}
	}
	return nextResolve(specifier, context);
}

/** TypeScript is compiled with esbuild, so the suites behave the same whether or not the runtime can strip or transform types. */
export async function load(url, context, nextLoad) {
	if (!/\.m?ts$/.test(new URL(url).pathname)) return nextLoad(url, context);
	const { transform } = await import('esbuild');
	const path = fileURLToPath(url);
	const { code } = await transform(await readFile(path, 'utf8'), {
		loader: 'ts',
		format: 'esm',
		sourcefile: path,
		sourcemap: 'inline',
		tsconfigRaw: { compilerOptions: { useDefineForClassFields: false } },
	});
	return { format: 'module', source: code, shortCircuit: true };
}
