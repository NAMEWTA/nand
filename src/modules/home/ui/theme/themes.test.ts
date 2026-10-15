// Golden token digests from PandoraReads/apex-dashboard ac4d2c7 (MIT), styles.css
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import postcss from 'postcss';
import { expect, test } from 'vitest';
import expected from './apex-tokens.fixture.json';
test('all thirteen apex themes and light/dark overrides keep exact upstream token values', () => {
	const map: Record<string, Record<string, string>> = {};
	postcss.parse(readFileSync(new URL('./themes.css', import.meta.url), 'utf8')).walkRules((rule) => {
		const key = rule.selector.replaceAll("'", '"').replace(/\s+/g, ' ').trim();
		if (!(key in expected)) return;
		for (const node of rule.nodes)
			if (node.type === 'decl' && node.prop.startsWith('--db-'))
				(map[key] ??= {})[node.prop] = node.value.replace(/\s+/g, ' ').trim();
	});
	expect(
		Object.fromEntries(
			Object.entries(map).map(([key, value]) => [
				key,
				createHash('sha256')
					.update(JSON.stringify(Object.entries(value).sort()))
					.digest('hex'),
			]),
		),
	).toEqual(expected);
	expect(
		new Set(Object.keys(expected).flatMap((key) => [...key.matchAll(/data-theme="([^"]+)"/g)].map((m) => m[1])))
			.size,
	).toBe(13);
});
