import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import type { App } from 'obsidian';
import { El, findByClass, findTag } from './mini-dom';
import { applyCustomColors, resolveCustomColorValue } from '../src/view/dashboard/appearance/appearance';
import { ThemeStudioModal } from '../src/view/dashboard/appearance/theme-studio-modal';
import type { CustomColors, DashboardSettings } from '../src/core/dashboard/types/index';

// Theme-studio color scheme: per-area mode dropdown (follow theme / light /
// dark / custom, the widget-background foreground recipe). Checks the preset
// resolver, applyCustomColors sentinel handling, and the modal row wiring —
// dropdown state derives from the stored value, picker/slider only drive the
// value in custom mode, presets seed custom picks color + alpha.

// Obsidian globals absent in Node: activeDocument (root query misses ->
// theme-default reading and live refresh no-op, fine for these checks) and
// window (scheduleApply debounces via window.setTimeout).
(globalThis as { activeDocument?: unknown }).activeDocument = {
	querySelector: () => null,
	querySelectorAll: () => [],
};
(globalThis as { window?: unknown }).window = globalThis;

function makeApp(): App {
	return { vault: { getFileByPath: () => null, adapter: {} } } as unknown as App;
}

function makeSettings(customColors: CustomColors): DashboardSettings {
	return {
		customColors,
		bgImage: '',
		bgDim: 40,
		bgBlur: 0,
		bgSize: 'cover',
		surfaceOpacity: null,
		glassBlur: null,
		radiusScale: null,
		fontScale: 'medium',
	} as unknown as DashboardSettings;
}

/** Build the modal and open it; returns the modal plus a handle to the plugin
 *  stand-in so assertions can read what scheduleApply persisted. */
function openStudio(customColors: CustomColors): {
	modal: ThemeStudioModal;
	plugin: { settings: DashboardSettings; saveSettings: () => Promise<void> };
} {
	const plugin = {
		settings: makeSettings(customColors),
		saveSettings: async () => {},
	};
	const modal = new ThemeStudioModal(makeApp(), plugin as never);
	modal.onOpen();
	return { modal, plugin };
}

interface RowParts {
	row: El;
	select: El;
	picker: El;
	slider: El;
}

/** Locate the color row for a field by its label text (row order-safe). */
function rowByLabel(root: El, label: string): RowParts {
	const rows = findByClass(root, 'dashboard-theme-studio-color-row');
	const row = rows.find((r) => r.children[0]?.textContent === label);
	assert.ok(row, `row with label ${label} rendered`);
	const select = findTag(row!, 'select')[0]!;
	const inputs = findTag(row!, 'input');
	return { row: row!, select, picker: inputs[0]!, slider: inputs[1]! };
}

function optionValues(select: El): string[] {
	return select.children.map((o) => o.getAttribute('value') ?? '');
}

type Color = [number, number, number, number];
function color(value: string): Color {
	if (/^#[\da-f]{6}$/i.test(value)) return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16), 1];
	const channels = value.match(/[\d.]+/g)?.map(Number);
	assert.ok(channels && channels.length >= 3, `Supported color: ${value}`);
	return [channels[0]!, channels[1]!, channels[2]!, channels[3] ?? 1];
}
function painted(foreground: Color, background: Color): Color {
	return [0, 1, 2].map((channel) => foreground[channel]! * foreground[3] + background[channel]! * (1 - foreground[3])).concat(1) as Color;
}
function contrast(foreground: Color, background: Color): number {
	const luminance = (value: Color) => value.slice(0, 3).map((channel) => {
		const normalized = channel / 255;
		return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
	}).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
	const a = luminance(painted(foreground, background)), b = luminance(background);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function palette(css: string, theme: string, mode: 'light' | 'dark'): Record<string, string> {
	const tokens: Record<string, string> = {};
	for (const selector of [`.nand-dashboard-root[data-theme="${theme}"]`, `.theme-${mode} .nand-dashboard-root[data-theme="${theme}"]`]) {
		const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const blocks = css.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]+)\\}`, 'g'));
		for (const block of blocks) for (const declaration of block[1]!.matchAll(/(--db-[\w-]+):\s*([^;]+);/g)) tokens[declaration[1]!] = declaration[2]!.trim();
	}
	return tokens;
}
function verifyThemeContrast(): void {
	const css = readFileSync('styles.css', 'utf8');
	for (const theme of ['matcha', 'lilac']) for (const mode of ['light', 'dark'] as const) {
		const tokens = palette(css, theme, mode);
		const base = color(tokens['--db-bg']!);
		const surfaces = [base, painted(color(tokens['--db-bg-card']!), base), color(tokens['--db-bg-modal']!)];
		if (mode === 'dark') for (const stop of tokens['--db-aurora-bg']!.match(/#[\da-f]{6}/gi) ?? []) surfaces.push(color(stop));
		for (const surface of surfaces) {
			for (const text of ['--db-text', '--db-text-muted', '--db-accent']) assert.ok(contrast(color(tokens[text]!), surface) >= 4.5, `${theme}/${mode} ${text} remains readable on ${surface.slice(0, 3)}`);
		}
		if (mode === 'dark') {
			const card = surfaces[1]!;
			const accent = color(tokens['--db-accent']!);
			accent[3] = 0.7; // the Start focus button's existing hover opacity
			assert.ok(contrast(accent, card) >= 4.5, `${theme} Start focus hover remains readable`);
			assert.ok(color(tokens['--db-text-inverse']!)[0] > 230, `${theme} photo Banner retains its light foreground`);
			assert.ok(contrast(color(tokens['--db-text-on-accent']!), color(tokens['--db-accent']!)) >= 4.5, `${theme} bright accent controls have their own contrasting foreground`);
		}
	}
	for (const theme of ['onyx', 'volt']) for (const mode of ['light', 'dark'] as const) {
		const tokens = palette(css, theme, mode);
		assert.ok(contrast(color(tokens['--db-text-inverse']!), color(tokens['--db-accent']!)) >= 4.5, `${theme}/${mode} current workspace badge contrast`);
	}
	const active = css.match(/\.dashboard-workspace-btn\.active\s*\{[^}]*\}/)?.[0] ?? '';
	assert.match(active, /color:\s*var\(--db-text-on-accent/);
	assert.match(active, /opacity:\s*1/);
	const switcher = css.match(/\.dashboard-workspace-switcher\s*\{[^}]*\}/)?.[0] ?? '';
	assert.doesNotMatch(switcher, /opacity:\s*0\./, 'Ancestor opacity must not erase the selected badge contrast');
}

function main(): void {
	verifyThemeContrast();
	// 1. resolveCustomColorValue: sentinels map per field; everything else
	//    passes through untouched.
	{
		assert.equal(resolveCustomColorValue('text', 'light'), '#ffffff', '1: text light preset');
		assert.equal(resolveCustomColorValue('text', 'dark'), '#111111', '1: text dark preset');
		assert.equal(
			resolveCustomColorValue('textMuted', 'light'),
			'rgba(255, 255, 255, 0.62)',
			'1: muted keeps hierarchy',
		);
		assert.equal(
			resolveCustomColorValue('borderCard', 'dark'),
			'rgba(255, 255, 255, 0.16)',
			'1: dark border translucent',
		);
		assert.equal(resolveCustomColorValue('bgCard', 'light'), '#ffffff', '1: light card surface');
		assert.equal(resolveCustomColorValue('text', '#123456'), '#123456', '1: hex passthrough');
		assert.equal(resolveCustomColorValue('text', undefined), undefined, '1: undefined passthrough');
	}

	// 2. applyCustomColors: sentinels never reach the style bag — the resolved
	//    color lands on the token, and the page bg also paints inline resolved.
	{
		const root = new El('div');
		applyCustomColors(root as unknown as HTMLElement, {
			text: 'light',
			bg: 'dark',
			bgCard: '#abcdef',
		});
		assert.equal(root.style.getPropertyValue('--db-text'), '#ffffff', '2: text token resolved');
		assert.equal(root.style.getPropertyValue('--db-bg'), '#141416', '2: bg token resolved');
		assert.equal(root.style.getPropertyValue('--db-bg-card'), '#abcdef', '2: custom hex unaffected');
		assert.equal(root.style.background, '#141416', '2: inline page paint uses resolved color');
		assert.ok(!root.style.getPropertyValue('--db-text').includes('light'), '2: sentinel never leaks');
	}

	// 3. Rows render a 4-option dropdown; mode derives from the stored value;
	//    picker + slider disable outside custom mode but preview the preset.
	{
		const { modal } = openStudio({ text: 'light', accent: '#e76f51' });
		const content = modal.contentEl as unknown as El;
		const rows = findByClass(content, 'dashboard-theme-studio-color-row');
		assert.equal(rows.length, 8, '3: all eight areas render');

		const text = rowByLabel(content, '文字');
		assert.deepEqual(
			optionValues(text.select),
			['theme', 'light', 'dark', 'custom'],
			'3: dropdown offers the four modes',
		);
		assert.equal(text.select.value, 'light', '3: sentinel selects light mode');
		assert.equal(text.picker.disabled, true, '3: picker disabled in preset mode');
		assert.equal(text.slider.disabled, true, '3: slider disabled in preset mode');
		assert.equal(text.picker.value, '#ffffff', '3: picker previews the preset color');

		const accent = rowByLabel(content, '主色');
		assert.equal(accent.select.value, 'custom', '3: hex value selects custom mode');
		assert.equal(accent.picker.disabled, false, '3: picker enabled in custom mode');
		assert.equal(accent.picker.value, '#e76f51', '3: picker shows the stored hex');

		const bg = rowByLabel(content, '页面底色');
		assert.equal(bg.select.value, 'theme', '3: unset field selects follow-theme');
		assert.equal(bg.picker.disabled, true, '3: picker disabled in theme mode');
	}

	// 4. Dropdown changes: theme clears the field, presets store the sentinel,
	//    custom seeds from the previewed color (and preset alpha carries over).
	{
		const { modal, plugin } = openStudio({ text: 'dark', textMuted: 'light' });
		const content = modal.contentEl as unknown as El;

		const text = rowByLabel(content, '文字');
		text.select.value = 'custom';
		text.select.dispatchEvent({ type: 'change' });
		assert.equal(plugin.settings.customColors.text, '#111111', '4: custom seeds from the dark preset');
		assert.equal(text.picker.disabled, false, '4: picker enabled after switching to custom');

		const muted = rowByLabel(content, '文字（次要）');
		muted.select.value = 'custom';
		muted.select.dispatchEvent({ type: 'change' });
		assert.equal(
			plugin.settings.customColors.textMuted,
			'rgba(255, 255, 255, 0.62)',
			'4: preset alpha carries into the seeded custom value',
		);

		text.select.value = 'theme';
		text.select.dispatchEvent({ type: 'change' });
		assert.equal(plugin.settings.customColors.text, undefined, '4: follow-theme deletes the override');

		const card = rowByLabel(content, '卡片底色');
		card.select.value = 'dark';
		card.select.dispatchEvent({ type: 'change' });
		assert.equal(plugin.settings.customColors.bgCard, 'dark', '4: preset stores the sentinel');
		assert.equal(card.picker.value, '#1d1d20', '4: picker previews the dark card preset');
	}

	// 5. Accent swatches flip the accent row to custom mode.
	{
		const { modal, plugin } = openStudio({ accent: 'dark' });
		const content = modal.contentEl as unknown as El;
		const accent = rowByLabel(content, '主色');
		assert.equal(accent.select.value, 'dark', '5: starts in preset mode');

		const swatch = findByClass(content, 'dashboard-theme-studio-swatch')[0]!;
		swatch.click();
		assert.equal(accent.select.value, 'custom', '5: swatch flips the dropdown to custom');
		assert.equal(accent.picker.disabled, false, '5: picker re-enabled');
		const hex = swatch.getAttribute('title')!;
		assert.equal(plugin.settings.customColors.accent, hex, '5: swatch hex persisted');
	}

	// 6. Section reset returns every row to follow-theme.
	{
		const { modal, plugin } = openStudio({ text: 'light', accent: '#e76f51', borderCard: 'dark' });
		const content = modal.contentEl as unknown as El;
		findByClass(content, 'dashboard-theme-studio-reset')[0]!.click();
		assert.deepEqual(plugin.settings.customColors, {}, '6: reset clears every override');
		const text = rowByLabel(content, '文字');
		assert.equal(text.select.value, 'theme', '6: dropdown back to follow-theme');
		assert.equal(text.picker.disabled, true, '6: picker disabled again');
	}

	// 7. Clear button on a row resets just that field (dropdown included).
	{
		const { modal, plugin } = openStudio({ text: 'light', accent: '#e76f51' });
		const content = modal.contentEl as unknown as El;
		const text = rowByLabel(content, '文字');
		findTag(text.row, 'button')[0]!.click();
		assert.equal(plugin.settings.customColors.text, undefined, '7: clear removes only that field');
		assert.equal(plugin.settings.customColors.accent, '#e76f51', '7: sibling untouched');
		assert.equal(text.select.value, 'theme', '7: dropdown follows');
	}

	console.log('verify-theme-studio-colors: all 7 checks passed');
}

main();
