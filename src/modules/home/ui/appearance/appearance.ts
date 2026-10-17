// Layout and interaction adapted from PandoraReads/apex-dashboard ac4d2c7 (MIT), Copyright (c) 2025 PandoraReads: src/appearance.ts
import { Platform, type App } from 'obsidian';
import { displayFocal } from '../../core/board/board-experience';
import type { DashboardSettings } from '../../core/board/types/index';
import { resolveVaultImage } from '../banner/image-resource';

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
const SURFACE_TOKENS = ['--db-bg-card'] as const;
/** Radius tokens driven by radiusScale (md = base, sm = base-4, lg = base+4). */
const RADIUS_TOKENS = {
	sm: '--db-radius-sm',
	md: '--db-radius-md',
	lg: '--db-radius-lg',
} as const;

/**
 * Apply user appearance overrides to a dashboard root container:
 *  - a global background-image layer (`.nand-dashboard-bg`) with dim + blur + fill
 *  - advanced overrides: glass blur, corner radius, surface opacity (colors come from NAND's global tokens)
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
}

/**
 * Live-update appearance on already-rendered dashboards WITHOUT a full re-render.
 * Used by the Appearance modal for buttery preview while dragging sliders/pickers:
 * it swaps the background layer and rewrites the `--db-*` overrides in place.
 */
export function refreshAppearanceLive(app: App, settings: DashboardSettings): void {
	const documents = new Set<Document>([app.workspace.containerEl.doc]);
	app.workspace.iterateAllLeaves((leaf) => documents.add(leaf.view.containerEl.doc));
	for (const doc of documents)
		for (const root of doc.querySelectorAll<HTMLElement>('.nand-dashboard-root')) {
			root.querySelectorAll(':scope > .nand-dashboard-bg').forEach((el) => el.remove());
			clearAdvanced(root);
			applyBackground(root, app, settings);
			applyAdvanced(root, settings);
		}
}

function applyBackground(container: HTMLElement, app: App, settings: DashboardSettings): void {
	const path = settings.bgImage?.trim();
	if (!path) return;

	const resolved = resolveVaultImage(app, path);
	if (!resolved) return;

	const layer = container.createDiv({
		cls: 'nand-dashboard-bg pointer-events-none absolute inset-0 -z-10 bg-center bg-no-repeat',
	});
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
		const scrim = layer.createDiv({ cls: 'nand-dashboard-bg-scrim absolute inset-0' });
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

/** Surface tokens whose alpha surfaceOpacity scales, re-expressed over the global token they derive from. */
const SURFACE_SOURCES: Readonly<Record<(typeof SURFACE_TOKENS)[number], string>> = {
	'--db-bg-card': 'var(--card)',
};
function applySurfaceOpacity(root: HTMLElement, opacity: number): void {
	const percent = clampNumber(opacity, 0, 100, 100);
	for (const token of SURFACE_TOKENS)
		root.style.setProperty(token, `color-mix(in srgb, ${SURFACE_SOURCES[token]} ${percent}%, transparent)`);
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

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
	if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
	return Math.max(min, Math.min(max, value));
}
