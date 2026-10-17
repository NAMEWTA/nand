import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const files = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory()
			? files(path)
			: /\.(tsx?|css)$/.test(name) && !/\.test\./.test(name)
				? [path]
				: [];
	});

test('the board palette derives only from NAND tokens', () => {
	expect(tokens).not.toMatch(/#[0-9a-f]{3,8}\b/i);
	expect(tokens).not.toMatch(/data-theme/);
	// no fixed colors at all: masks and image text come from the global --scrim / --on-image tokens
	expect(tokens).not.toMatch(/\b(white|black)\b|rgba?\(|oklch\(|hsl\(/);
	expect(tokens).toContain('--db-accent: var(--primary)');
	expect(tokens).toContain('--db-bg: var(--background)');
	expect(tokens).toContain('--db-bg-card: var(--card)');
	expect(tokens).toContain('--db-text: var(--foreground)');
});

test('every board token that styles read is defined by tokens.css or set inline by its component', () => {
	const defined = new Set([...tokens.matchAll(/(--db-[a-z0-9-]+):/g)].map((m) => m[1]));
	const inline = new Set(['--db-pipe-accent', '--db-widget-span', '--db-sidebar-w', '--db-widget-unit-h']);
	const missing = new Set<string>();
	for (const file of files(root)) {
		if (file.endsWith('tokens.css')) continue;
		const text = readFileSync(file, 'utf8');
		for (const m of text.matchAll(/var\((--db-[a-z0-9-]+)/g)) {
			const name = m[1]!;
			if (!defined.has(name) && !inline.has(name) && !/-$/.test(name)) missing.add(name);
		}
	}
	expect([...missing].sort()).toEqual([]);
});

test('pipeline and paper surfaces are styled by role: ink never equals its surface', () => {
	const read = (name: string) => new RegExp(`${name}: ([^;]+);`, 'g');
	const last = (name: string) => [...tokens.matchAll(read(name))].at(-1)?.[1];
	for (const [surface, ink] of [['82', '83'], ['86', '87'], ['91', '93'], ['92', '93'], ['75', '76'], ['74', '76'], ['70', '71']])
		expect(last(`--db-p1-color-${surface}`), `${surface} vs ${ink}`).not.toBe(last(`--db-p1-color-${ink}`));
	for (const surface of ['82', '86', '91', '92', '70', '74', '75'])
		expect(last(`--db-p1-color-${surface}`)).toMatch(/var\(--(card|muted)\)|var\(--card\)\)/);
	expect(last('--db-record-color-58')).toBe('var(--foreground)');
});

test('the style maps and widget frames hold no fixed colors either', () => {
	const mapped = ['p1-classes.ts', 'p2-classes.ts', 'widget-classes.ts', 'input-widget-classes.ts', 'immersive-classes.ts', 'dashboard.css'].map((name) => join(root, 'ui/theme', name));
	const frames = [...files(join(root, 'ui/canvas')), join(root, 'ui/widgets/WidgetBackground.tsx'), join(root, 'ui/banner/Banner.tsx')];
	const found: string[] = [];
	for (const file of [...mapped, ...frames]) {
		const text = readFileSync(file, 'utf8');
		for (const match of text.matchAll(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}\b|\b(?:bg|text|border)-(?:white|black)\b/g)) found.push(`${file.slice(root.length)}: ${match[0]}`);
	}
	expect(found).toEqual([]);
});
