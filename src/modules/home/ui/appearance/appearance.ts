import { Platform, type App } from 'obsidian';
import { displayFocal } from '../../core/board/board-experience';
import type { DashboardSettings } from '../../core/board/types/index';
import { resolveVaultImage } from '../banner/banner';

const DEFAULT_DIM = 40;

/** Root font-size multipliers per fontScale option. em-based sizes across the
    dashboard cascade from the root, so one multiplier scales titles, body,
    banner, sidebar and widget labels proportionally while keeping their
    relative differences. 'medium' clears the override (inherited base size). */
const FONT_SCALE_SIZES: Readonly<Record<DashboardSettings['fontScale'], string>> = {
	small: '0.85em',
	medium: '',
	large: '1.15em',
};

/** Surface tokens whose alpha surfaceOpacity scales (read computed, re-emit rgba). */
const SURFACE_TOKENS = ['--db-bg-card', '--db-bg-section', '--db-bg-sidebar'] as const;
/** Radius tokens driven by radiusScale (md = base, sm = base-4, lg = base+4). */
const RADIUS_TOKENS = {
	sm: '--db-radius-sm',
	md: '--db-radius-md',
	lg: '--db-radius-lg',
} as const;

/**
 * Apply user appearance overrides to a dashboard root container:
 *  - a global background-image layer (`.nand-dashboard-bg`) with dim + blur + fill
 *  - advanced overrides: glass blur, corner radius, surface opacity
 *
 * Call once per full render. The container is
 * emptied by the caller before each render, so a fresh layer is created each time.
 * Advanced overrides run last; surfaceOpacity reads the computed surface color to compose color + opacity.
 */
export function applyAppearance(container: HTMLElement, app: App, settings: DashboardSettings): void {
	// The root survives full re-renders (only its children are emptied): drop earlier inline overrides.
	clearAdvanced(container);
	applyBackground(container, app, settings);
	applyAdvanced(container, settings);
	applyControlContrast(container);
}

/**
 * Live-update appearance on already-rendered dashboards WITHOUT a full re-render.
 * Used by the Appearance modal for buttery preview while dragging sliders/pickers:
 * it swaps the background layer and rewrites the `--db-*` overrides in place.
 */
export function refreshAppearanceLive(app: App, settings: DashboardSettings): void {
	const documents = new Set<Document>([app.workspace.containerEl.doc]);
	app.workspace.iterateAllLeaves(leaf => documents.add(leaf.view.containerEl.doc));
	for (const doc of documents) for (const root of doc.querySelectorAll<HTMLElement>('.nand-dashboard-root')) {
		root.querySelectorAll(':scope > .nand-dashboard-bg').forEach((el) => el.remove());
		clearAdvanced(root);
		applyBackground(root, app, settings);
		applyAdvanced(root, settings);
		applyControlContrast(root);
	}
}

function applyBackground(container: HTMLElement, app: App, settings: DashboardSettings): void {
	const path = settings.bgImage?.trim();
	if (!path) return;

	const resolved = resolveVaultImage(app, path);
	if (!resolved) return;

	const layer = container.createDiv({ cls: 'nand-dashboard-bg' });
	const focal = displayFocal(settings.bgFocal);
	layer.style.backgroundImage = `url("${resolved}")`;
	layer.style.backgroundSize = settings.bgSize === 'contain' ? 'contain' : 'cover';
	layer.style.backgroundPosition = `${focal.x}% ${focal.y}%`;

	const blur = Platform.isMobile ? 0 : clampNumber(settings.bgBlur, 0, 30, 0);
	if (blur > 0) {
		// Slight overscale so the blur's faded edge stays off-screen.
		layer.style.filter = `blur(${blur}px)`;
		layer.style.transform = `scale(${1 + blur / 200})`;
	}

	const dim = clampNumber(settings.bgDim, 0, 100, DEFAULT_DIM);
	if (dim > 0) {
		const scrim = layer.createDiv({ cls: 'nand-dashboard-bg-scrim' });
		scrim.style.background = `rgba(0,0,0,${dim / 100})`;
	}
}

/**
 * Advanced overrides: glass blur, corner radius, surface opacity. Each is
 * independent and no-op when its setting is null (theme default preserved).
 */
function applyAdvanced(root: HTMLElement, settings: DashboardSettings): void {
	if (Platform.isMobile) {
		root.setCssProps({ '--db-backdrop-blur': 'none' });
	} else if (settings.glassBlur != null) {
		const px = clampNumber(settings.glassBlur, 0, 20, 0);
		root.style.setProperty('--db-backdrop-blur', px <= 0 ? 'none' : `blur(${px}px)`);
	}
	if (settings.radiusScale != null) {
		const md = clampNumber(settings.radiusScale, 0, 22, 14);
		root.style.setProperty(RADIUS_TOKENS.md, `${md}px`);
		root.style.setProperty(RADIUS_TOKENS.sm, `${Math.max(0, md - 4)}px`);
		root.style.setProperty(RADIUS_TOKENS.lg, `${md + 4}px`);
	}
	applyFontScale(root, settings.fontScale);
	if (settings.surfaceOpacity != null) {
		applySurfaceOpacity(root, settings.surfaceOpacity);
	}
}

/** Scale the dashboard's base font size ('' clears back to the inherited default). */
function applyFontScale(root: HTMLElement, scale: DashboardSettings['fontScale']): void {
	const size = FONT_SCALE_SIZES[scale] ?? '';
	if (size) root.style.fontSize = size;
	else root.style.removeProperty('font-size');
}

/** Re-emit surface tokens as rgba(rgb, alpha), preserving the effective color. */
function applySurfaceOpacity(root: HTMLElement, opacity: number): void {
	const alpha = clampNumber(opacity, 0, 100, 100) / 100;
	const cs = root.win.getComputedStyle(root);
	for (const token of SURFACE_TOKENS) {
		const rgb = parseRgb(cs.getPropertyValue(token).trim());
		if (rgb) {
			root.style.setProperty(token, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`);
		}
	}
}

/** Remove the `--db-*` overrides applyAdvanced may have set (surface tokens + blur + radii). */
export function clearAdvanced(root: HTMLElement): void {
	root.style.removeProperty('--db-backdrop-blur');
	root.style.removeProperty('font-size');
	root.style.removeProperty(RADIUS_TOKENS.sm);
	root.style.removeProperty(RADIUS_TOKENS.md);
	root.style.removeProperty(RADIUS_TOKENS.lg);
	for (const token of SURFACE_TOKENS) {
		root.style.removeProperty(token);
	}
}

/** Parse a CSS color (hex or rgb/rgba) into an {r,g,b} triple, else null. */
function parseRgb(raw: string): Rgb | null {
	const s = raw.trim();
	let hex: string | null = null;
	if (/^#[0-9a-fA-F]{6}$/.test(s)) hex = s.slice(1);
	else if (/^#[0-9a-fA-F]{3}$/.test(s))
		hex = s
			.slice(1)
			.split('')
			.map((c) => c + c)
			.join('');
	if (hex) {
		return {
			r: parseInt(hex.slice(0, 2), 16),
			g: parseInt(hex.slice(2, 4), 16),
			b: parseInt(hex.slice(4, 6), 16),
		};
	}
	const m = s.match(/rgba?\(([^)]+)\)/);
	if (m) {
		const parts = m[1]!.split(',').map((p) => parseFloat(p.trim()));
		return { r: clampByte(parts[0] ?? 0), g: clampByte(parts[1] ?? 0), b: clampByte(parts[2] ?? 0) };
	}
	return null;
}

type Rgb = { r: number; g: number; b: number };

function clampByte(n: number): number {
	if (Number.isNaN(n)) return 0;
	return Math.max(0, Math.min(255, Math.round(n)));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
	if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
	return Math.max(min, Math.min(max, value));
}

/** Choose control foregrounds from their actual backgrounds, including custom alpha. */
export function applyControlContrast(root: HTMLElement): void {
	const computed = root.ownerDocument?.defaultView?.getComputedStyle(root);
	if (!computed) return;
	const card = computed.getPropertyValue('--db-bg-card').trim();
	const base = parseRgb(computed.getPropertyValue('--db-bg')) ?? { r: 255, g: 255, b: 255 };
	const cardColor = parseRgb(card);
	const cardAlpha = card.startsWith('rgba') ? Number(card.slice(card.lastIndexOf(',') + 1).replace(')', '')) : 1;
	const surface = cardColor ? {
		r: cardColor.r * cardAlpha + base.r * (1 - cardAlpha),
		g: cardColor.g * cardAlpha + base.g * (1 - cardAlpha),
		b: cardColor.b * cardAlpha + base.b * (1 - cardAlpha),
	} : base;
	for (const [background, foreground] of [
		['--db-accent', '--db-text-on-accent'],
		['--db-danger', '--db-text-on-danger'],
		['--db-text-muted', '--db-text-on-muted'],
	] as const) {
		const raw = computed.getPropertyValue(background).trim(),
			color = parseRgb(raw);
		if (!color) continue;
		const alpha = raw.startsWith('rgba') ? Number(raw.slice(raw.lastIndexOf(',') + 1).replace(')', '')) : 1;
		const rgb = [color.r, color.g, color.b].map(
			(value, i) => value * alpha + (surface ? [surface.r, surface.g, surface.b][i]! : 255) * (1 - alpha),
		);
		const luminance = rgb.reduce((sum, value, i) => {
			const c = value / 255;
			return sum + (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i]!;
		}, 0);
		root.style.setProperty(
			foreground,
			(luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff',
		);
	}
	// Transparent timer buttons need a foreground against the card, rather
	// than against the accent fill. Preserve the requested hue when readable.
	if (surface) {
		const luminance = (rgb: number[]) => rgb.reduce((sum, value, i) => {
			const c = value / 255;
			return sum + (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i]!;
		}, 0);
		for (const running of [false, true]) {
			const raw = computed.getPropertyValue(running ? '--db-text-muted' : '--db-accent').trim();
			const color = parseRgb(raw);
			if (!color) continue;
			const background = [surface.r, surface.g, surface.b];
			const alpha = raw.startsWith('rgba') ? Number(raw.slice(raw.lastIndexOf(',') + 1).replace(')', '')) : 1;
			const bg = luminance(background);
			const fg = luminance([color.r, color.g, color.b].map((value, i) => value * alpha + background[i]! * (1 - alpha)));
			const ratio = (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
			root.style.setProperty(running ? '--db-pomodoro-running-text' : '--db-pomodoro-text',
				ratio >= 4.5 ? raw : (bg + 0.05) / 0.05 >= 1.05 / (bg + 0.05) ? '#000000' : '#ffffff');
		}
	}
}
