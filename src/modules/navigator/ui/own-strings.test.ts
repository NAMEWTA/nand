// Behaviour modelled on johansan/notebook-navigator (GPL-3.0); independent implementation, no code copied.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

/**
 * The navigator can be switched on without any other module, so the only dictionaries guaranteed to be loaded are
 * its own and the `ui.*` ones the React providers register. Shared `common.*` keys belong to other modules' loads.
 */
test('navigator sources never use keys of dictionaries they do not register', () => {
	const files: string[] = [];
	const walk = (dir: string) => {
		for (const name of readdirSync(dir)) {
			const path = join(dir, name);
			if (statSync(path).isDirectory()) walk(path);
			else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) && name !== 'i18n.ts') files.push(path);
		}
	};
	walk(join(__dirname, '..'));
	const offenders = files.filter((file) => /\bt\(\s*['"`]common\./.test(readFileSync(file, 'utf8')) || /promptText/.test(readFileSync(file, 'utf8')));
	expect(offenders).toEqual([]);
});
