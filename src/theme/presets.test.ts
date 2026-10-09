import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';

const css = readFileSync(new URL('./styles/presets.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Variables declared by the rule whose selector is exactly `selector`. */
function declarations(selector: string): Record<string, string> {
	const match = new RegExp(`${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css);
	assert.ok(match, `missing rule ${selector}`);
	return Object.fromEntries([...match[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}

type Rgba = [number, number, number, number];
function parse(value: string): Rgba {
	const hex = /^#([0-9a-f]{6})$/i.exec(value);
	if (hex) return [0, 2, 4].map((i) => parseInt(hex[1]!.slice(i, i + 2), 16)).concat(1) as Rgba;
	const rgba = /^rgba?\(([^)]+)\)$/.exec(value);
	assert.ok(rgba, `unsupported color ${value}`);
	const [r, g, b, a = 1] = rgba[1]!.split(',').map((part) => Number(part.trim()));
	return [r!, g!, b!, a];
}
const over = (top: Rgba, bottom: Rgba): Rgba => [0, 1, 2].map((i) => top[i]! * top[3] + bottom[i]! * (1 - top[3])).concat(1) as Rgba;
const luminance = ([r, g, b]: Rgba) =>
	[r, g, b].map((c) => c / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i]!, 0);
function contrast(foreground: string, background: string, base: string): number {
	const bg = over(parse(background), parse(base));
	const fg = over(parse(foreground), bg);
	const [high, low] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
	return (high! + 0.05) / (low! + 0.05);
}

for (const preset of ['claude-code', 'eye-care']) {
	for (const mode of ['light', 'dark']) {
		test(`${preset} ${mode}: text, links and accent controls meet WCAG AA`, () => {
			const v = declarations(`body.nand-theme--${preset}.theme-${mode}`);
			const primary = v['--background-primary']!;
			for (const surface of ['--background-primary', '--background-secondary']) {
				for (const [token, minimum] of [['--text-normal', 7], ['--text-muted', 4.5], ['--text-faint', 3]] as const) {
					const ratio = contrast(v[token]!, v[surface]!, primary);
					assert.ok(ratio >= minimum, `${token} on ${surface}: ${ratio.toFixed(2)} < ${minimum}`);
				}
			}
			for (const token of ['--text-accent', '--link-color']) {
				const ratio = contrast(v[token]!, primary, primary);
				assert.ok(ratio >= 4.5, `${token} on background: ${ratio.toFixed(2)}`);
			}
			const onAccent = contrast(v['--text-on-accent']!, v['--interactive-accent']!, primary);
			assert.ok(onAccent >= 4.5, `text on accent: ${onAccent.toFixed(2)}`);
		});
	}
}
